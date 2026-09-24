-- ============================================================================
-- RPC DU TABLEAU DE BORD : 2 à 15 FOIS MOINS DE PAGES LUES
--
-- Mesuré le 24 sept. 2026 (compute Micro, rôle authenticated, plan générique
-- comme PostgREST) :
--   perfect_store_liste_filtre, 30 j : 283 ms / 182 000 pages → 70 ms / 12 000
--   perfect_store_liste_filtre, tout : 416 ms / 260 000 pages → 220 ms / 106 000
--   dashboard_perfect_store_filtre, 30 j : 292 ms / 182 000 → 137 ms / 79 000
-- Sur l'ancien compute saturé, ces mêmes RPC mettaient 20 à 45 s et c'est
-- perfect_store_liste_filtre (appelée une fois par niveau) qui remplissait
-- l'alerte « Data API error rate » avec des 500 = statement timeout.
--
-- Cause : le périmètre géographique était calculé dans une CTE `scope_pdv`
-- (pdv ⟕ territoire ⟕ sous_region ⟕ region, 25 000 lignes) et les visites
-- filtrées par `pdv_id in (select … from scope_pdv)`. Avec des paramètres
-- (plan générique), le planificateur estime cette CTE à 1 ligne et boucle
-- 25 000 fois sur l'index des visites — quelle que soit la période demandée.
-- Et `p_date_debut is null or v.date_visite >= p_date_debut` ne peut pas
-- utiliser l'index sur la date.
--
-- Ici : on part des visites bornées par la période (bornes ±infinity si
-- absentes → indexable), les filtres géographiques s'appliquent directement
-- sur la ligne pdv jointe, la division via un EXISTS sur le référentiel
-- (43 territoires). Mêmes résultats, mêmes colonnes, même ordre.
-- Idempotent.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Liste paginée des PDV par niveau (une RPC par niveau sur /admin).
-- ---------------------------------------------------------------------------
create or replace function public.perfect_store_liste_filtre(
  p_niveau text default null,
  p_type text default null,
  p_page integer default 1,
  p_per_page integer default 10,
  p_order text default 'date',
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_date_debut date default null,
  p_date_fin date default null,
  p_search text default null
)
returns jsonb
language sql
stable
set search_path to 'public'
set work_mem to '16MB'
as $$
  with latest as (
    select distinct on (v.pdv_id)
      r.visite_id, v.pdv_id, p.nom_pdv,
      coalesce(p.sous_categorie_pdv, 'Non renseigné') as type_pdv,
      p.zone, v.date_visite, v.commercial,
      coalesce(r.niveau, 'NON CONFORME') as niveau,
      r.score_global, r.dispo_rayon, r.assortiment, r.visibilite, r.promotion
    from visites v
    join resultat_perfect_store r on r.visite_id = v.id
    join pdv p on p.pdv_id = v.pdv_id
    where v.date_visite >= coalesce(p_date_debut::timestamptz, '-infinity'::timestamptz)
      and v.date_visite < coalesce((p_date_fin + 1)::timestamptz, 'infinity'::timestamptz)
      and (p_territoire is null or p_territoire = '' or p.zone = p_territoire)
      and (p_area is null or p_area = '' or p.area_code = p_area or p.quartier = p_area)
      and (p_distributeur is null or p_distributeur = '' or p.distributor_name = p_distributeur)
      and (p_division is null or p_division = '' or exists (
            select 1
            from territoire t
            join sous_region sr on sr.code = t.sous_region_code
            join region rg on rg.code = sr.region_code
            where t.nom = p.zone and rg.nom_affichage = p_division))
    order by v.pdv_id, v.date_visite desc, r.calcule_le desc
  ),
  filtre as (
    select * from latest l
    where (p_niveau is null or p_niveau = ''
           or (p_niveau = 'CONFORMES' and l.niveau <> 'NON CONFORME')
           or l.niveau = p_niveau)
      and (p_type is null or p_type = '' or l.type_pdv = p_type)
      -- Mêmes colonnes que la recherche de l'ancien chemin « vue » :
      -- nom, code PDV, zone.
      and (p_search is null or btrim(p_search) = ''
           or l.nom_pdv ilike '%' || btrim(p_search) || '%'
           or l.pdv_id ilike '%' || btrim(p_search) || '%'
           or l.zone ilike '%' || btrim(p_search) || '%')
  ),
  page as (
    select * from filtre
    order by
      case when p_order = 'score' then score_global end desc nulls last,
      date_visite desc
    limit greatest(coalesce(p_per_page, 10), 1)
    offset greatest(coalesce(p_page, 1) - 1, 0) * greatest(coalesce(p_per_page, 10), 1)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtre),
    'items', coalesce((
      select jsonb_agg(to_jsonb(pg)
        order by case when p_order = 'score' then pg.score_global end desc nulls last, pg.date_visite desc)
      from page pg
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Bloc KPI global (le « Vues Perfect Store indisponibles » quand il tombe).
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_perfect_store_filtre(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_date_debut date default null,
  p_date_fin date default null
)
returns jsonb
language sql
stable
set search_path to 'public'
set work_mem to '16MB'
as $$
  with pdv_scope as (
    select p.pdv_id, p.is_active
    from pdv p
    where (p_territoire is null or p_territoire = '' or p.zone = p_territoire)
      and (p_area is null or p_area = '' or p.area_code = p_area or p.quartier = p_area)
      and (p_distributeur is null or p_distributeur = '' or p.distributor_name = p_distributeur)
      and (p_division is null or p_division = '' or exists (
            select 1
            from territoire t
            join sous_region sr on sr.code = t.sous_region_code
            join region rg on rg.code = sr.region_code
            where t.nom = p.zone and rg.nom_affichage = p_division))
  ),
  actifs as (
    select count(*) filter (where coalesce(is_active, true)) as pdv_total from pdv_scope
  ),
  visites_scope as (
    select v.id, v.pdv_id, v.date_visite
    from visites v
    where v.date_visite >= coalesce(p_date_debut::timestamptz, '-infinity'::timestamptz)
      and v.date_visite < coalesce((p_date_fin + 1)::timestamptz, 'infinity'::timestamptz)
      and exists (select 1 from pdv_scope s where s.pdv_id = v.pdv_id)
  ),
  scored as (
    select r.niveau, r.score_global, r.dispo_rayon, r.visibilite, r.promotion,
           r.assortiment, r.calcule_le, v.pdv_id, v.date_visite,
           r.presence_rayon, r.presence_rayon_evap, r.presence_rayon_imp, r.presence_rayon_scm,
           r.dispo_rayon_evap, r.dispo_rayon_imp, r.dispo_rayon_scm
    from resultat_perfect_store r
    join visites_scope v on v.id = r.visite_id
  ),
  -- Une ligne par PDV : sa dernière visite scorée de la période, avec TOUS ses
  -- piliers. Les moyennes ci-dessous portent sur cette CTE et non sur `scored`,
  -- sinon un PDV revisité 3 fois pèserait 3 fois dans le taux de présence alors
  -- que le reste de la page le compte une fois.
  dernier as (
    select distinct on (s.pdv_id) s.*
    from scored s
    order by s.pdv_id, s.date_visite desc, s.calcule_le desc
  ),
  -- Tous les niveaux du référentiel, y compris ceux à 0 PDV : le client lit
  -- « 500 Flagship, 0 VIP, … » — un niveau absent se lirait comme un oubli.
  par_niveau as (
    select n.code as niveau, count(d.pdv_id) as nb_pdv, n.rang
    from niveau_perfect_store n
    left join dernier d on d.niveau = n.code
    group by n.code, n.rang
  )
  select jsonb_build_object(
    'pdv_scores', (select count(*) from dernier),
    'pdv_perfect_stores', (select count(*) filter (where niveau is not null) from dernier),
    'pdv_perfect_store_pct', (select round(100.0 * count(*) filter (where niveau is not null) / nullif(count(*), 0), 1) from dernier),
    'pdv_non_conformes', (select count(*) filter (where niveau is null) from dernier),
    'par_niveau', coalesce((
      select jsonb_agg(jsonb_build_object('niveau', niveau, 'nb_pdv', nb_pdv) order by rang desc nulls last, niveau)
      from par_niveau
    ), '[]'::jsonb),
    -- Compteurs d'activité : ceux-là comptent bien des passages.
    'visites_scorees', (select count(*) from scored),
    'perfect_stores', (select count(*) filter (where niveau is not null) from scored),
    'perfect_store_pct', (select round(100.0 * count(*) filter (where niveau is not null) / nullif(count(*), 0), 1) from scored),
    -- Moyennes des piliers : base PDV distincts, comme le KPI principal.
    'score_global_moyen_pct', (select round(avg(score_global), 1) from dernier),
    'osa_moyen_pct', (select round(avg(dispo_rayon), 1) from dernier),
    'visibilite_moyenne_pct', (select round(avg(visibilite), 1) from dernier),
    'promotion_moyenne_pct', (select round(avg(promotion), 1) from dernier),
    'assortiment_moyen_pct', (select round(avg(assortiment), 1) from dernier),
    -- Taux de présence : distribution numérique (quantité >= 1).
    'presence_moyenne_pct', (select round(avg(presence_rayon), 1) from dernier),
    'par_categorie', coalesce((
      select jsonb_agg(x order by x->>'categorie')
      from (
        select jsonb_build_object(
          'categorie', c.cat,
          'presence_pct', round(avg(case c.cat when 'evap' then s.presence_rayon_evap when 'imp' then s.presence_rayon_imp else s.presence_rayon_scm end), 1),
          'disponibilite_pct', round(avg(case c.cat when 'evap' then s.dispo_rayon_evap when 'imp' then s.dispo_rayon_imp else s.dispo_rayon_scm end), 1)
        ) as x
        from dernier s cross join (values ('evap'),('imp'),('scm')) as c(cat)
        group by c.cat
      ) t
    ), '[]'::jsonb),
    'pdv_vus', (select count(distinct pdv_id) from visites_scope),
    'pdv_total', (select pdv_total from actifs),
    'couverture_pct', (
      select round(100.0 * (select count(distinct pdv_id) from visites_scope)
        / nullif((select pdv_total from actifs), 0), 1)
    ),
    'visites_total', (select count(*) from visites_scope)
  );
$$;

commit;
