-- ============================================================================
-- DASHBOARD FILTRABLE (suite) : les blocs détaillés de l'accueil Perfect Store
-- réagissent aux filtres Division / Territoire / Area / Distributeur.
--
-- 20260716200000 ne couvrait que les KPI agrégés (dashboard_perfect_store_filtre).
-- Ici, trois RPC miroirs des vues, avec le même scope_pdv :
--   - perfect_store_evolution_filtre  (miroir v_perfect_store_evolution)
--   - perfect_store_par_type_filtre   (miroir v_perfect_store_par_categorie_pdv)
--   - perfect_store_liste_filtre      (miroir v_perfect_store_liste_full,
--     paginée ; p_niveau pour « PDV par niveau », p_type pour les accordéons)
-- Filtre vide/null = pas de contrainte. Idempotent.
-- ============================================================================
begin;

create or replace function perfect_store_evolution_filtre(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null
) returns table(date text, perfect_stores bigint, visites_scorees bigint, perfect_store_pct numeric)
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
      and (p_area is null or p_area = '' or p.area_code = p_area or p.quartier = p_area)
      and (p_distributeur is null or p_distributeur = '' or p.distributor_name = p_distributeur)
  )
  select
    to_char(date_trunc('day', v.date_visite), 'YYYY-MM-DD') as date,
    count(*) filter (where r.niveau is not null) as perfect_stores,
    count(*) as visites_scorees,
    round(100.0 * count(*) filter (where r.niveau is not null) / nullif(count(*), 0), 1) as perfect_store_pct
  from visites v
  join resultat_perfect_store r on r.visite_id = v.id
  where v.pdv_id in (select pdv_id from scope_pdv)
  group by date_trunc('day', v.date_visite)
  order by 1;
$$;

create or replace function perfect_store_par_type_filtre(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null
) returns table(type_pdv text, visites_scorees bigint, perfect_stores bigint, perfect_store_pct numeric, score_global_moyen_pct numeric)
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
      and (p_area is null or p_area = '' or p.area_code = p_area or p.quartier = p_area)
      and (p_distributeur is null or p_distributeur = '' or p.distributor_name = p_distributeur)
  )
  select
    coalesce(p.sous_categorie_pdv, 'Non renseigné') as type_pdv,
    count(*) as visites_scorees,
    count(*) filter (where r.niveau is not null) as perfect_stores,
    round(100.0 * count(*) filter (where r.niveau is not null) / nullif(count(*), 0), 1) as perfect_store_pct,
    round(avg(r.score_global), 1) as score_global_moyen_pct
  from resultat_perfect_store r
  join visites v on v.id = r.visite_id
  join pdv p on p.pdv_id = v.pdv_id
  where v.pdv_id in (select pdv_id from scope_pdv)
  group by coalesce(p.sous_categorie_pdv, 'Non renseigné')
  order by 1;
$$;

create or replace function perfect_store_liste_filtre(
  p_niveau text default null,
  p_type text default null,
  p_page integer default 1,
  p_per_page integer default 10,
  p_order text default 'date',
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
      and (p_area is null or p_area = '' or p.area_code = p_area or p.quartier = p_area)
      and (p_distributeur is null or p_distributeur = '' or p.distributor_name = p_distributeur)
  ),
  latest as (
    select distinct on (v.pdv_id)
      r.visite_id, v.pdv_id, p.nom_pdv,
      coalesce(p.sous_categorie_pdv, 'Non renseigné') as type_pdv,
      p.zone, v.date_visite, v.commercial,
      coalesce(r.niveau, 'NON CONFORME') as niveau,
      r.score_global, r.dispo_rayon, r.assortiment, r.visibilite, r.promotion
    from resultat_perfect_store r
    join visites v on v.id = r.visite_id
    join pdv p on p.pdv_id = v.pdv_id
    where v.pdv_id in (select pdv_id from scope_pdv)
    order by v.pdv_id, v.date_visite desc, r.calcule_le desc
  ),
  filtre as (
    select * from latest
    where (p_niveau is null or p_niveau = '' or niveau = p_niveau)
      and (p_type is null or p_type = '' or type_pdv = p_type)
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

commit;
