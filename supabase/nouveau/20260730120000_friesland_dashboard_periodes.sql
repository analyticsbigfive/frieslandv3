-- ============================================================================
-- DASHBOARD : FILTRES DE PÉRIODE + COMPTAGE EN PDV DISTINCTS
-- Réunion client du 23 juillet, tâches 1, 2 et 6.
--
-- 1) Toutes les RPC du dashboard Perfect Store acceptent p_date_debut /
--    p_date_fin (bornes incluses, null = pas de contrainte). Sans ça, les
--    filtres jour / semaine / mois ne peuvent pas exister côté front.
--
-- 2) Base de comptage unifiée : un PDV compte UNE fois, sur sa DERNIÈRE visite
--    scorée de la période. Auparavant le haut du dashboard comptait des visites
--    scorées (un PDV visité 3 fois pesait 3 fois) alors que la liste paginée
--    comptait déjà des PDV distincts — deux dénominateurs sur la même page.
--    Les compteurs en visites restent exposés (visites_scorees) pour le suivi
--    d'activité, mais ne servent plus de base au taux Perfect Store.
--
-- 3) Couverture des visites (tâche 2.2) : visites_total = nombre total de
--    passages, les passages multiples sur un même PDV comptent. À opposer à la
--    couverture effective (pdv_vus / pdv_total), qui reste en PDV uniques.
--
-- ATTENTION : `create or replace function` ne sait pas ajouter un paramètre —
-- il crée une SECONDE surcharge, et PostgREST échoue ensuite en PGRST203
-- (« could not choose the best candidate function ») puisque tous les arguments
-- ont une valeur par défaut. D'où le `drop function <signature exacte>` avant
-- chaque `create`.
--
-- Idempotent. Additif : aucune donnée touchée, aucune colonne supprimée.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. KPI agrégés de l'accueil
-- ---------------------------------------------------------------------------
drop function if exists dashboard_perfect_store_filtre(text, text, text, text);

create or replace function dashboard_perfect_store_filtre(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_date_debut date default null,
  p_date_fin date default null
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
  -- Univers assigné : dénominateur de la couverture effective. Indépendant de
  -- la période — le parc de PDV ne rétrécit pas parce qu'on regarde un jour.
  actifs as (
    select count(*) filter (where coalesce(p.is_active, true)) as pdv_total
    from pdv p where p.pdv_id in (select pdv_id from scope_pdv)
  ),
  visites_scope as (
    select v.id, v.pdv_id, v.date_visite
    from visites v
    where v.pdv_id in (select pdv_id from scope_pdv)
      and (p_date_debut is null or v.date_visite >= p_date_debut::timestamptz)
      and (p_date_fin is null or v.date_visite < (p_date_fin + 1)::timestamptz)
  ),
  scored as (
    select r.niveau, r.score_global, r.dispo_rayon, r.visibilite, r.promotion,
           r.assortiment, r.calcule_le, v.pdv_id, v.date_visite
    from resultat_perfect_store r
    join visites_scope v on v.id = r.visite_id
  ),
  -- Un PDV = sa dernière visite scorée de la période.
  dernier as (
    select distinct on (s.pdv_id) s.pdv_id, s.niveau, s.score_global
    from scored s
    order by s.pdv_id, s.date_visite desc, s.calcule_le desc
  ),
  par_niveau as (
    select d.niveau, count(*) as nb_pdv, max(n.rang) as rang
    from dernier d
    left join niveau_perfect_store n on n.code = d.niveau
    where d.niveau is not null
    group by d.niveau
  )
  select jsonb_build_object(
    -- Base PDV distincts : ce que lit le KPI principal du dashboard.
    'pdv_scores', (select count(*) from dernier),
    'pdv_perfect_stores', (select count(*) filter (where niveau is not null) from dernier),
    'pdv_perfect_store_pct', (select round(100.0 * count(*) filter (where niveau is not null) / nullif(count(*), 0), 1) from dernier),
    'pdv_non_conformes', (select count(*) filter (where niveau is null) from dernier),
    'par_niveau', coalesce((
      select jsonb_agg(jsonb_build_object('niveau', niveau, 'nb_pdv', nb_pdv) order by rang desc nulls last, niveau)
      from par_niveau
    ), '[]'::jsonb),

    -- Base visites : conservée pour le suivi d'activité et la compatibilité.
    'visites_scorees', (select count(*) from scored),
    'perfect_stores', (select count(*) filter (where niveau is not null) from scored),
    'perfect_store_pct', (select round(100.0 * count(*) filter (where niveau is not null) / nullif(count(*), 0), 1) from scored),

    -- Moyennes des piliers, sur la dernière visite de chaque PDV.
    'score_global_moyen_pct', (select round(avg(score_global), 1) from scored),
    'osa_moyen_pct', (select round(avg(dispo_rayon), 1) from scored),
    'visibilite_moyenne_pct', (select round(avg(visibilite), 1) from scored),
    'promotion_moyenne_pct', (select round(avg(promotion), 1) from scored),
    'assortiment_moyen_pct', (select round(avg(assortiment), 1) from scored),

    -- Couverture effective : PDV uniques visités / parc actif du périmètre.
    'pdv_vus', (select count(distinct pdv_id) from visites_scope),
    'pdv_total', (select pdv_total from actifs),
    'couverture_pct', (
      select round(100.0 * (select count(distinct pdv_id) from visites_scope)
        / nullif((select pdv_total from actifs), 0), 1)
    ),
    -- Couverture des visites : tous les passages, doublons compris.
    'visites_total', (select count(*) from visites_scope)
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Ventilation par type de magasin (accordéons)
--    Passe en PDV distincts pour ne pas contredire le KPI du haut.
-- ---------------------------------------------------------------------------
drop function if exists perfect_store_par_type_filtre(text, text, text, text);

create or replace function perfect_store_par_type_filtre(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_date_debut date default null,
  p_date_fin date default null
) returns table(
  type_pdv text,
  pdv_scores bigint,
  pdv_perfect_stores bigint,
  perfect_store_pct numeric,
  score_global_moyen_pct numeric,
  visites_scorees bigint
)
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
  scored as (
    select r.niveau, r.score_global, r.calcule_le, v.pdv_id, v.date_visite,
           coalesce(p.sous_categorie_pdv, 'Non renseigné') as type_pdv
    from resultat_perfect_store r
    join visites v on v.id = r.visite_id
    join pdv p on p.pdv_id = v.pdv_id
    where v.pdv_id in (select pdv_id from scope_pdv)
      and (p_date_debut is null or v.date_visite >= p_date_debut::timestamptz)
      and (p_date_fin is null or v.date_visite < (p_date_fin + 1)::timestamptz)
  ),
  dernier as (
    select distinct on (s.pdv_id) s.pdv_id, s.type_pdv, s.niveau, s.score_global
    from scored s
    order by s.pdv_id, s.date_visite desc, s.calcule_le desc
  )
  select
    d.type_pdv,
    count(*) as pdv_scores,
    count(*) filter (where d.niveau is not null) as pdv_perfect_stores,
    round(100.0 * count(*) filter (where d.niveau is not null) / nullif(count(*), 0), 1) as perfect_store_pct,
    round(avg(d.score_global), 1) as score_global_moyen_pct,
    (select count(*) from scored s where s.type_pdv = d.type_pdv) as visites_scorees
  from dernier d
  group by d.type_pdv
  order by 1;
$$;

-- ---------------------------------------------------------------------------
-- 3. Évolution jour par jour
--    Un PDV compte une fois par jour (sa dernière visite du jour).
-- ---------------------------------------------------------------------------
drop function if exists perfect_store_evolution_filtre(text, text, text, text);

create or replace function perfect_store_evolution_filtre(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_date_debut date default null,
  p_date_fin date default null
) returns table(date text, perfect_stores bigint, pdv_scores bigint, perfect_store_pct numeric)
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
  scored as (
    select r.niveau, r.calcule_le, v.pdv_id, v.date_visite,
           date_trunc('day', v.date_visite) as jour
    from resultat_perfect_store r
    join visites v on v.id = r.visite_id
    where v.pdv_id in (select pdv_id from scope_pdv)
      and (p_date_debut is null or v.date_visite >= p_date_debut::timestamptz)
      and (p_date_fin is null or v.date_visite < (p_date_fin + 1)::timestamptz)
  ),
  dernier_du_jour as (
    select distinct on (s.jour, s.pdv_id) s.jour, s.pdv_id, s.niveau
    from scored s
    order by s.jour, s.pdv_id, s.date_visite desc, s.calcule_le desc
  )
  select
    to_char(d.jour, 'YYYY-MM-DD') as date,
    count(*) filter (where d.niveau is not null) as perfect_stores,
    count(*) as pdv_scores,
    round(100.0 * count(*) filter (where d.niveau is not null) / nullif(count(*), 0), 1) as perfect_store_pct
  from dernier_du_jour d
  group by d.jour
  order by 1;
$$;

-- ---------------------------------------------------------------------------
-- 4. Liste paginée (déjà en PDV distincts, il ne manquait que les dates)
-- ---------------------------------------------------------------------------
drop function if exists perfect_store_liste_filtre(text, text, integer, integer, text, text, text, text, text);

create or replace function perfect_store_liste_filtre(
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
  p_date_fin date default null
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
      and (p_date_debut is null or v.date_visite >= p_date_debut::timestamptz)
      and (p_date_fin is null or v.date_visite < (p_date_fin + 1)::timestamptz)
    order by v.pdv_id, v.date_visite desc, r.calcule_le desc
  ),
  filtre as (
    select * from latest
    -- p_niveau = 'CONFORMES' : tous les Perfect Stores, tous niveaux confondus.
    -- Sert la liste des PDV Perfect Store en page 1 du dashboard (tâche 1.3),
    -- qui ne peut pas se contenter d'un niveau unique ni des non conformes.
    where (p_niveau is null or p_niveau = ''
           or (p_niveau = 'CONFORMES' and niveau <> 'NON CONFORME')
           or niveau = p_niveau)
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

-- ---------------------------------------------------------------------------
-- 5. Couverture des visites détaillée par merchandiser (tâche 2.2)
--    « Nombre total de visites » + le détail des PDV visités, pour suivre
--    l'objectif journalier (ex. 20 visites/jour/merchandiser).
-- ---------------------------------------------------------------------------
drop function if exists couverture_visites_par_commercial(text, text, text, text, date, date);

create or replace function couverture_visites_par_commercial(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_date_debut date default null,
  p_date_fin date default null
) returns table(
  commercial text,
  email text,
  nb_visites bigint,
  nb_pdv bigint,
  nb_jours bigint,
  visites_par_jour numeric,
  pdv_visites jsonb
)
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
  visites_scope as (
    select
      coalesce(nullif(trim(v.commercial), ''), v.email, '—') as commercial,
      coalesce(v.email, '') as email,
      v.pdv_id, v.date_visite,
      coalesce(p.nom_pdv, v.pdv_id) as nom_pdv
    from visites v
    join pdv p on p.pdv_id = v.pdv_id
    where v.pdv_id in (select pdv_id from scope_pdv)
      and (p_date_debut is null or v.date_visite >= p_date_debut::timestamptz)
      and (p_date_fin is null or v.date_visite < (p_date_fin + 1)::timestamptz)
  ),
  -- Un PDV par merchandiser, avec son nombre de passages sur la période.
  par_pdv as (
    select commercial, pdv_id, max(nom_pdv) as nom_pdv, count(*) as passages,
           max(date_visite) as derniere_visite
    from visites_scope
    group by commercial, pdv_id
  )
  select
    vs.commercial,
    max(vs.email) as email,
    count(*) as nb_visites,
    count(distinct vs.pdv_id) as nb_pdv,
    count(distinct date_trunc('day', vs.date_visite)) as nb_jours,
    round(count(*)::numeric / nullif(count(distinct date_trunc('day', vs.date_visite)), 0), 1) as visites_par_jour,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'pdv_id', pp.pdv_id,
        'nom_pdv', pp.nom_pdv,
        'passages', pp.passages,
        'derniere_visite', pp.derniere_visite
      ) order by pp.passages desc, pp.nom_pdv)
      from par_pdv pp where pp.commercial = vs.commercial
    ), '[]'::jsonb) as pdv_visites
  from visites_scope vs
  group by vs.commercial
  order by count(*) desc;
$$;

commit;
