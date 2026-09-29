-- ============================================================================
-- « PASSER AU NIVEAU SUPÉRIEUR » : CHOISIR LES 50 CANDIDATS AVANT DE CALCULER
--
-- perfect_store_manques_filtre() prenait 31 s seule sur un serveur au repos,
-- soit la limite de 30 s des requêtes : lancée avec le reste du tableau de
-- bord, elle saturait le serveur et faisait tomber en timeout le bloc KPI
-- (dashboard_perfect_store_filtre), d'où le message « Vues Perfect Store
-- indisponibles » une fois sur deux sur /admin.
--
-- Cause : la fonction joignait v_perfect_store_manques en entier, donc
-- calculait pour les 26 000 visites les critères manquants (deux sous-requêtes
-- par ligne qui lisent le JSON de la visite), avant de trier et garder 50.
--
-- Joindre la vue sur les 50 candidats ne suffit pas : le planificateur ne
-- pousse pas le filtre visite_id à l'intérieur de la vue (vérifié en
-- production : jointure par hachage sur la vue entière, 30 s). La fonction
-- reprend donc la logique de la vue, restreinte dès la première jointure aux
-- candidats. À garder alignée sur v_perfect_store_manques (migration
-- 20260907150000 et suivantes) si la vue change : la fonction renvoie ses
-- lignes, toute divergence de colonne casse la fonction à la création.
--
-- Même résultat, même ordre. Mesuré au repos : ~1 s.
-- ============================================================================
begin;

create or replace function public.perfect_store_manques_filtre(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_date_debut date default null,
  p_date_fin date default null,
  p_limit integer default 50
)
returns setof public.v_perfect_store_manques
language sql
stable
set search_path to 'public'
as $$
  with derniere as (
    select distinct on (v.pdv_id) v.id as visite_id, v.pdv_id
    from visites v
    where (p_date_debut is null or v.date_visite >= p_date_debut::timestamptz)
      and (p_date_fin is null or v.date_visite < (p_date_fin + 1)::timestamptz)
    order by v.pdv_id, v.date_visite desc
  ),
  -- Les 50 visites retenues, avec les seules colonnes utiles au tri et aux
  -- filtres. Mêmes jointures que la vue (division via territoire → sous-région
  -- → région ; niveau cible = rang actuel + 1, donc un PDV au niveau maximal
  -- n'a pas de « niveau supérieur » et n'apparaît pas, comme dans la vue).
  candidats as (
    select d.visite_id,
           r.niveau as niveau_actuel,
           (r.dispo_rayon < nt.dispo_rayon_min) as dispo_manque
    from derniere d
    join resultat_perfect_store r on r.visite_id = d.visite_id
    join pdv p on p.pdv_id = d.pdv_id
    left join niveau_perfect_store n on n.code = r.niveau
    join niveau_perfect_store nt on nt.rang = coalesce(n.rang, 0) + 1
    left join territoire t on t.nom = p.zone
    left join sous_region sr on sr.code = t.sous_region_code
    left join region rg on rg.code = sr.region_code
    where (p_division is null or p_division = '' or rg.nom_affichage = p_division)
      and (p_territoire is null or p_territoire = '' or p.zone = p_territoire)
      and (p_area is null or p_area = '' or p.quartier = p_area)
      and (p_distributeur is null or p_distributeur = '' or p.distributor_name = p_distributeur)
    -- Les moins conformes d'abord : non conformes (niveau null), puis dispo manquante.
    order by r.niveau asc nulls first, (r.dispo_rayon < nt.dispo_rayon_min) desc
    limit greatest(coalesce(p_limit, 50), 1)
  ),
  -- Ci-dessous : corps de v_perfect_store_manques, démarré depuis `candidats`.
  base as (
    select r.visite_id, v.pdv_id, v.data, r.niveau as niveau_actuel, r.dispo_rayon, r.assortiment,
           coalesce(n.rang, 0) as rang_actuel, p.nom_pdv, p.sous_categorie_pdv as type_pdv, p.zone,
           p.quartier as secteur, p.distributor_name, rg.nom_affichage as division,
           c.niveau_actuel as tri_niveau, c.dispo_manque as tri_dispo
    from candidats c
    join resultat_perfect_store r on r.visite_id = c.visite_id
    join visites v on v.id = r.visite_id
    join pdv p on p.pdv_id = v.pdv_id
    left join niveau_perfect_store n on n.code = r.niveau
    left join territoire t on t.nom = p.zone
    left join sous_region sr on sr.code = t.sous_region_code
    left join region rg on rg.code = sr.region_code
  ),
  resolu as (
    select b.*, sv.segment as vis_segment
    from base b
    left join lateral (
      select c_1.id
      from type_pdv c_1
      where regexp_replace(trim(c_1.nom), '\s+', ' ', 'g') = regexp_replace(trim(b.type_pdv), '\s+', ' ', 'g')
      order by (c_1.nom = b.type_pdv) desc
      limit 1
    ) tp on true
    left join segment_visibilite_type_pdv sv on sv.type_pdv_id = tp.id
  ),
  cible as (
    select r.*, nt.code as niveau_cible, nt.dispo_rayon_min,
           case
             when nt.code ilike 'FLAGSHIP%' then 'flagship'
             when nt.code ilike 'VIP%' then 'vip'
             when nt.code ilike 'CORE%' then 'core'
             else 'basic'
           end as key_cible
    from resolu r
    join niveau_perfect_store nt on nt.rang = r.rang_actuel + 1
  )
  select c.visite_id, c.pdv_id, c.nom_pdv, c.type_pdv, c.division, c.zone, c.secteur as quartier,
         c.distributor_name, c.niveau_actuel, c.niveau_cible,
         c.dispo_rayon < c.dispo_rayon_min as dispo_manque, c.dispo_rayon, c.dispo_rayon_min,
         c.assortiment is not null and c.assortiment < 100::numeric as assortiment_manque,
         (select coalesce(array_agg(e.nom order by e.nom), '{}'::text[])
            from standard_visibilite s
            join element_visibilite e on e.id = s.element_visibilite_id
           where s.segment = c.vis_segment and s.niveau_perfect_store = c.key_cible and s.requis
             and not e.optionnel and e.pilier = 'visibilite'
             and not element_visibilite_observe(c.data, e.code)) as visibilite_manques,
         (select coalesce(array_agg(e.nom order by e.nom), '{}'::text[])
            from standard_visibilite s
            join element_visibilite e on e.id = s.element_visibilite_id
           where s.segment = c.vis_segment and s.niveau_perfect_store = c.key_cible and s.requis
             and not e.optionnel and e.pilier = 'promotion'
             and coalesce(((c.data -> 'visibilite') ->> 'promotion_applicable')::boolean, false)
             and not element_visibilite_observe(c.data, e.code)) as promotion_manques
  from cible c
  order by c.tri_niveau asc nulls first, c.tri_dispo desc;
$$;

commit;
