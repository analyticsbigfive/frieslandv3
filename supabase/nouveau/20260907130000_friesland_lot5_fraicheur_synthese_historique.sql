-- ============================================================================
-- LOT 5 (1.0.4) : FRAÎCHEUR DES VISITES, SYNTHÈSE PAR ZONE, HISTORIQUE PDV
--
-- 1) frequence_visite
--    Rythme attendu entre deux visites d'un PDV. Une ligne par défaut
--    (zone et type nuls, 7 jours = hebdomadaire, hypothèse à confirmer par le
--    client), surchargeable par territoire (pdv.zone) et/ou type de PDV
--    (pdv.sous_categorie_pdv). Résolution : zone+type > type > zone > défaut.
--    Gérée depuis l'admin (Référentiels › Points de vente).
--
-- 2) pdv_fraicheur_filtre
--    Une ligne par PDV actif du périmètre : dernière visite, jours écoulés,
--    fréquence applicable, état a_jour / en_retard / jamais_visite, dernier
--    niveau et score Perfect Store. Alimente les alertes rouges.
--
-- 3) synthese_zones_filtre
--    Une ligne par territoire : PDV visités / non visités sur la période,
--    états de fraîcheur, disponibilité moyenne et taux de Perfect Store des
--    derniers relevés de la période. Compte des PDV DISTINCTS, comme les
--    autres RPC du dashboard (jamais des visites).
--
-- 4) pdv_historique_perfect_store / pdv_comparaison_periodes
--    Historique d'un PDV visite par visite, et moyennes de deux périodes.
--
-- Convention : RPC `language sql stable`, `set search_path = public`,
-- paramètres p_*, mêmes filtres géographiques que 20260716200000.
-- Idempotent. Additif.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1) Fréquence de visite
-- ---------------------------------------------------------------------------
create table if not exists frequence_visite (
  id       bigint generated always as identity primary key,
  zone     text,          -- pdv.zone (nom du territoire), null = toutes
  type_pdv text,          -- pdv.sous_categorie_pdv, null = tous
  jours    integer not null check (jours > 0),
  unique nulls not distinct (zone, type_pdv)
);

comment on table frequence_visite is
  'Nombre de jours attendu entre deux visites d''un PDV. Ligne (null, null) = défaut réseau. Surcharges par territoire et/ou type de PDV.';

alter table frequence_visite enable row level security;
drop policy if exists frequence_visite_read on frequence_visite;
create policy frequence_visite_read on frequence_visite
  for select to authenticated using (true);
drop policy if exists frequence_visite_write on frequence_visite;
create policy frequence_visite_write on frequence_visite
  for all to authenticated
  using (est_gestionnaire_perfect_store())
  with check (est_gestionnaire_perfect_store());

insert into frequence_visite (zone, type_pdv, jours)
select null, null, 7
where not exists (select 1 from frequence_visite where zone is null and type_pdv is null);

-- Fréquence applicable à un PDV : la surcharge la plus précise gagne.
create or replace function frequence_pour_pdv(p_zone text, p_type text)
returns integer
language sql stable
set search_path = public
as $$
  select f.jours
  from frequence_visite f
  where (f.zone is null or f.zone = p_zone)
    and (f.type_pdv is null or f.type_pdv = p_type)
  order by (f.zone is not null)::int + (f.type_pdv is not null)::int desc,
           (f.type_pdv is not null)::int desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 2) Fraîcheur par PDV
-- PERF : 25 000 PDV, 26 000 visites. Pas d'appel de fonction par ligne
-- (frequence_pour_pdv coûtait ~1 s à elle seule) : fréquence résolue par
-- sous-requête corrélée sur la petite table frequence_visite ; dernière visite
-- par distinct on sur toutes les visites puis jointure hash au périmètre.
-- ---------------------------------------------------------------------------
create or replace function pdv_fraicheur_filtre(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_etat text default null
) returns table(
  pdv_id text,
  nom_pdv text,
  zone text,
  quartier text,
  sous_categorie_pdv text,
  distributor_name text,
  derniere_visite timestamptz,
  jours_depuis integer,
  frequence_jours integer,
  etat text,
  niveau text,
  score_global numeric,
  visite_id uuid
)
language plpgsql stable
set search_path = public
as $$
begin
  return query
  -- plpgsql et non sql : une fonction SQL planifie sur des paramètres
  -- génériques et choisissait des nested loops (7 s à 70 s selon les bornes) ;
  -- plpgsql planifie avec les valeurs réelles. `materialized` évite en plus
  -- l'inlining des CTE référencées une fois. Mesuré : ~0,35 s réseau entier.
  with scope_pdv as materialized (
    select p.pdv_id, p.nom_pdv, p.zone, p.quartier, p.sous_categorie_pdv, p.distributor_name,
           (select f.jours from frequence_visite f
             where (f.zone is null or f.zone = p.zone)
               and (f.type_pdv is null or f.type_pdv = p.sous_categorie_pdv)
             order by (f.zone is not null)::int + (f.type_pdv is not null)::int desc,
                      (f.type_pdv is not null)::int desc
             limit 1) as frequence_jours
    from pdv p
    left join territoire t on t.nom = p.zone
    left join sous_region sr on sr.code = t.sous_region_code
    left join region rg on rg.code = sr.region_code
    where coalesce(p.is_active, true)
      and (p_division is null or p_division = '' or rg.nom_affichage = p_division)
      and (p_territoire is null or p_territoire = '' or p.zone = p_territoire)
      and (p_area is null or p_area = '' or p.area_code = p_area or p.quartier = p_area)
      and (p_distributeur is null or p_distributeur = '' or p.distributor_name = p_distributeur)
  ),
  -- Sur TOUTES les visites (26k lignes, agrégat trivial), jointes ensuite au
  -- périmètre par hash. Un « where pdv_id in (select … from scope_pdv) » ici
  -- devenait un nested loop × CTE scan dans la fonction (26k × 25k = 70 s).
  derniere as materialized (
    select distinct on (v.pdv_id) v.pdv_id, v.id as visite_id, v.date_visite
    from visites v
    order by v.pdv_id, v.date_visite desc
  ),
  etat as materialized (
    select s.*, d.visite_id, d.date_visite,
           case when d.date_visite is null then null
                else (current_date - d.date_visite::date) end as jours_depuis,
           case
             when d.date_visite is null then 'jamais_visite'
             when (current_date - d.date_visite::date) > coalesce(s.frequence_jours, 7) then 'en_retard'
             else 'a_jour'
           end as etat
    from scope_pdv s
    left join derniere d on d.pdv_id = s.pdv_id
  )
  select e.pdv_id, e.nom_pdv, e.zone, e.quartier, e.sous_categorie_pdv, e.distributor_name,
         e.date_visite, e.jours_depuis, e.frequence_jours, e.etat,
         r.niveau, r.score_global, e.visite_id
  from etat e
  left join resultat_perfect_store r on r.visite_id = e.visite_id
  where p_etat is null or p_etat = '' or e.etat = p_etat
  order by case e.etat when 'jamais_visite' then 0 when 'en_retard' then 1 else 2 end,
           e.jours_depuis desc nulls first, e.nom_pdv;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Synthèse par zone (territoire)
-- Autonome (ne rappelle pas pdv_fraicheur_filtre : un appel de fonction
-- table dans une CTE coûtait plusieurs secondes). Mêmes règles de fraîcheur.
-- plpgsql + CTE matérialisées, mêmes raisons que pdv_fraicheur_filtre.
-- Mesuré : 0,5 s (cache chaud) à 2,5 s (froid) réseau entier, 25k PDV.
-- ---------------------------------------------------------------------------
create or replace function synthese_zones_filtre(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_date_debut date default null,
  p_date_fin date default null
) returns table(
  zone text,
  pdv_total bigint,
  pdv_visites bigint,
  pdv_non_visites bigint,
  a_jour bigint,
  en_retard bigint,
  jamais_visites bigint,
  alertes bigint,
  dispo_moyenne numeric,
  perfect_store_pct numeric
)
language plpgsql stable
set search_path = public
as $$
begin
  return query
  with scope_pdv as materialized (
    select p.pdv_id, p.zone,
           (select f.jours from frequence_visite f
             where (f.zone is null or f.zone = p.zone)
               and (f.type_pdv is null or f.type_pdv = p.sous_categorie_pdv)
             order by (f.zone is not null)::int + (f.type_pdv is not null)::int desc,
                      (f.type_pdv is not null)::int desc
             limit 1) as frequence_jours
    from pdv p
    left join territoire t on t.nom = p.zone
    left join sous_region sr on sr.code = t.sous_region_code
    left join region rg on rg.code = sr.region_code
    where coalesce(p.is_active, true)
      and (p_division is null or p_division = '' or rg.nom_affichage = p_division)
      and (p_territoire is null or p_territoire = '' or p.zone = p_territoire)
      and (p_area is null or p_area = '' or p.area_code = p_area or p.quartier = p_area)
      and (p_distributeur is null or p_distributeur = '' or p.distributor_name = p_distributeur)
  ),
  -- Agrégats sur toutes les visites, jointure au périmètre ensuite (voir
  -- pdv_fraicheur_filtre : le semi-join sur la CTE coûtait 70 s).
  derniere as materialized (
    select v.pdv_id, max(v.date_visite) as date_visite
    from visites v
    group by v.pdv_id
  ),
  -- Dernière visite de chaque PDV DANS la période : c'est elle qui compte.
  periode as materialized (
    select distinct on (v.pdv_id) v.pdv_id, v.id as visite_id
    from visites v
    where (p_date_debut is null or v.date_visite >= p_date_debut::timestamptz)
      and (p_date_fin is null or v.date_visite < (p_date_fin + 1)::timestamptz)
    order by v.pdv_id, v.date_visite desc
  ),
  scored as materialized (
    select p.pdv_id, r.dispo_rayon, r.niveau
    from periode p
    left join resultat_perfect_store r on r.visite_id = p.visite_id
  ),
  etat as materialized (
    select s.pdv_id, s.zone,
           case
             when d.date_visite is null then 'jamais_visite'
             when (current_date - d.date_visite::date) > coalesce(s.frequence_jours, 7) then 'en_retard'
             else 'a_jour'
           end as etat
    from scope_pdv s
    left join derniere d on d.pdv_id = s.pdv_id
  )
  select
    coalesce(e.zone, '—') as zone,
    count(*) as pdv_total,
    count(sc.pdv_id) as pdv_visites,
    count(*) - count(sc.pdv_id) as pdv_non_visites,
    count(*) filter (where e.etat = 'a_jour') as a_jour,
    count(*) filter (where e.etat = 'en_retard') as en_retard,
    count(*) filter (where e.etat = 'jamais_visite') as jamais_visites,
    count(*) filter (where e.etat in ('en_retard', 'jamais_visite')) as alertes,
    round(avg(sc.dispo_rayon), 1) as dispo_moyenne,
    round(100.0 * count(*) filter (where sc.niveau is not null) / nullif(count(sc.pdv_id), 0), 1) as perfect_store_pct
  from etat e
  left join scored sc on sc.pdv_id = e.pdv_id
  group by coalesce(e.zone, '—')
  order by 8 desc, 1;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Historique d'un PDV et comparaison de deux périodes
-- ---------------------------------------------------------------------------
create or replace function pdv_historique_perfect_store(p_pdv_id text)
returns table(
  visite_id uuid,
  date_visite timestamptz,
  commercial text,
  niveau text,
  score_global numeric,
  dispo_rayon numeric,
  visibilite numeric,
  promotion numeric,
  assortiment numeric
)
language sql stable
set search_path = public
as $$
  select v.id, v.date_visite, v.commercial,
         r.niveau, r.score_global, r.dispo_rayon, r.visibilite, r.promotion, r.assortiment
  from visites v
  left join resultat_perfect_store r on r.visite_id = v.id
  where v.pdv_id = p_pdv_id
  order by v.date_visite;
$$;

create or replace function pdv_comparaison_periodes(
  p_pdv_id text,
  p_debut1 date, p_fin1 date,
  p_debut2 date, p_fin2 date
) returns jsonb
language sql stable
set search_path = public
as $$
  with h as (
    select * from pdv_historique_perfect_store(p_pdv_id)
  ),
  agg as (
    select
      n,
      count(*) as visites,
      round(avg(score_global), 1) as score_moyen,
      round(avg(dispo_rayon), 1) as dispo_moyenne,
      round(avg(visibilite), 1) as visibilite_moyenne,
      round(avg(promotion), 1) as promotion_moyenne,
      round(100.0 * count(*) filter (where niveau is not null) / nullif(count(*), 0), 1) as perfect_store_pct
    from (
      select 1 as n, h.* from h where h.date_visite >= p_debut1::timestamptz and h.date_visite < (p_fin1 + 1)::timestamptz
      union all
      select 2 as n, h.* from h where h.date_visite >= p_debut2::timestamptz and h.date_visite < (p_fin2 + 1)::timestamptz
    ) x
    group by n
  )
  select jsonb_build_object(
    'periode1', coalesce((select to_jsonb(a) - 'n' from agg a where n = 1), '{"visites":0}'::jsonb),
    'periode2', coalesce((select to_jsonb(a) - 'n' from agg a where n = 2), '{"visites":0}'::jsonb)
  );
$$;

commit;
