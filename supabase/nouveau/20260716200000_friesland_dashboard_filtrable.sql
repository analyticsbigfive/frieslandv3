-- ============================================================================
-- DASHBOARD PERFECT STORE FILTRABLE : RPC renvoyant les KPI agrégés en fonction
-- des filtres Division / Territoire / Area / Distributeur.
--
-- Remplace, quand un filtre est actif, les vues globales sans paramètre
-- (v_perfect_store_global, v_couverture_globale) qui restaient réseau-global.
-- Filtre vide/null = pas de contrainte sur cet axe.
--
-- Division résolue via le territoire (pdv.zone = territoire.nom) -> region.nom_affichage
-- (ABIDJAN / UP COUNTRY = équivalence North/South).
--
-- Idempotent. Dépend de resultat_perfect_store, pdv, géographie.
-- ============================================================================
begin;

create or replace function dashboard_perfect_store_filtre(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null
) returns jsonb
language sql stable
set search_path = public
as $$
  with scope_pdv as (
    select p.pdv_id
    from pdv p
    left join territoire t on t.nom = p.zone
    left join sous_region sr on sr.code = t.sous_region_code
    left join region rg on rg.code = sr.region_code
    where (p_division is null or p_division = '' or rg.nom_affichage = p_division)
      and (p_territoire is null or p_territoire = '' or p.zone = p_territoire)
      and (p_area is null or p_area = '' or p.secteur = p_area)
      and (p_distributeur is null or p_distributeur = '' or p.distributor_name = p_distributeur)
  ),
  actifs as (
    select count(*) filter (where coalesce(p.is_active, true)) as pdv_total
    from pdv p where p.pdv_id in (select pdv_id from scope_pdv)
  ),
  scored as (
    select r.*
    from resultat_perfect_store r
    join visites v on v.id = r.visite_id
    where v.pdv_id in (select pdv_id from scope_pdv)
  ),
  vus as (
    select count(distinct v.pdv_id) as pdv_vus
    from visites v where v.pdv_id in (select pdv_id from scope_pdv)
  )
  select jsonb_build_object(
    'visites_scorees', (select count(*) from scored),
    'perfect_stores', (select count(*) filter (where niveau is not null) from scored),
    'perfect_store_pct', (select round(100.0*count(*) filter (where niveau is not null)/nullif(count(*),0),1) from scored),
    'score_global_moyen_pct', (select round(avg(score_global),1) from scored),
    'osa_moyen_pct', (select round(avg(dispo_rayon),1) from scored),
    'visibilite_moyenne_pct', (select round(avg(visibilite),1) from scored),
    'promotion_moyenne_pct', (select round(avg(promotion),1) from scored),
    'assortiment_moyen_pct', (select round(avg(assortiment),1) from scored),
    'pdv_vus', (select pdv_vus from vus),
    'pdv_total', (select pdv_total from actifs),
    'couverture_pct', (select round(100.0*(select pdv_vus from vus)/nullif((select pdv_total from actifs),0),1))
  );
$$;

commit;
