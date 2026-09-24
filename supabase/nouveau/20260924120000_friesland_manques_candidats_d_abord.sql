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
-- Ici on sélectionne d'abord les 50 visites candidates avec les seules
-- colonnes nécessaires au tri et aux filtres (dernière visite par PDV, niveau
-- actuel, disponibilité sous le seuil du niveau suivant), puis on ne calcule
-- la vue que pour elles. Même résultat, même ordre : ~1 s au repos.
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
  -- Mêmes jointures et filtres que la vue (division via territoire → sous-région
  -- → région, niveau cible = rang actuel + 1), sans ses colonnes coûteuses.
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
  )
  select m.*
  from candidats c
  join v_perfect_store_manques m on m.visite_id = c.visite_id
  order by c.niveau_actuel asc nulls first, c.dispo_manque desc;
$$;

commit;
