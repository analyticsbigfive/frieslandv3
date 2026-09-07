-- ============================================================================
-- PÉRIMÈTRE DE SUIVI ET ALERTES UTILISABLES (demande du 7 septembre 2026)
--
-- Constat mesuré le 7 sept. sur les 37 zones : `synthese_zones_filtre` rend
-- `alertes = pdv_total` PARTOUT. Le parc compte 25 391 PDV alors que 3 666
-- seulement ont été visités au moins une fois en douze mois : les 21 725
-- jamais visités noient le signal, l'indicateur ne désigne plus rien.
--
-- Décision client : les alertes portent sur les PDV DÉJÀ SUIVIS — visités au
-- moins une fois sur une fenêtre glissante (12 mois par défaut, paramétrable).
-- Les jamais-visités deviennent un compteur « à prospecter », distinct.
--
-- Cette migration :
--  1) crée `parametre_suivi` (+ CRUD admin) et `fenetre_suivi_mois()` ;
--  2) ajoute une colonne `suivi` aux deux RPC PLUTÔT qu'une 4e valeur à `etat` :
--     l'union 'a_jour' | 'en_retard' | 'jamais_visite' est miroir en trois
--     endroits côté client (usePerfectStore.ts:46, utils/actionsCommerciales.ts:52,
--     zones.vue) et sert de valeur au paramètre `p_etat` — l'élargir casserait
--     chaque `switch` ;
--  3) corrige le DOUBLE RÉFÉRENTIEL TEMPOREL. Jusqu'ici, sur une même ligne,
--     `pdv_visites` / `dispo_moyenne` / `perfect_store_pct` suivaient la période
--     choisie tandis que `a_jour` / `en_retard` / `jamais_visites` étaient
--     figés sur `current_date` : deux horloges dans un même tableau. Désormais
--     tout est calculé à `coalesce(p_date_fin, current_date)`.
--     La borne BASSE n'est volontairement pas appliquée à la dernière visite :
--     un PDV vu la veille de la période paraîtrait « jamais visité ». La borne
--     basse pertinente est la fenêtre de suivi, horizon distinct et plus long.
--  4) expose `derniere_visite_statut` (soumis / validé / rejeté), demandé pour
--     la liste PDV mobile.
--
-- ATTENTION : `create or replace function` ne sait pas ajouter un paramètre —
-- il crée une SECONDE surcharge, et PostgREST échoue ensuite en PGRST203
-- (« could not choose the best candidate function ») puisque tous les
-- arguments ont une valeur par défaut. D'où le `drop function <signature
-- exacte>` avant chaque `create` (même motif qu'en 20260730120000:20-24).
--
-- Les nouveaux paramètres ayant tous une valeur par défaut, le front actuel
-- continue de fonctionner sans modification.
--
-- Idempotent. Additif (aucune suppression de données).
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1) Paramètre de fenêtre de suivi
-- ---------------------------------------------------------------------------
-- Table dédiée plutôt qu'une colonne sur `frequence_visite` : cette dernière
-- porte un nombre de JOURS entre deux visites, par zone et type de PDV, avec
-- une clé (zone, type_pdv). Y loger une fenêtre globale en MOIS demanderait une
-- ligne magique, illisible pour qui édite le référentiel.
create table if not exists parametre_suivi (
  cle     text primary key check (cle in ('fenetre_suivi_mois')),
  valeur  integer not null check (valeur > 0),
  libelle text not null,
  aide    text
);

comment on table parametre_suivi is
  'Paramètres de pilotage du suivi. fenetre_suivi_mois : au-delà de ce nombre de mois sans visite, un PDV sort des alertes et bascule dans « à prospecter ».';

alter table parametre_suivi enable row level security;
drop policy if exists parametre_suivi_read on parametre_suivi;
create policy parametre_suivi_read on parametre_suivi
  for select to authenticated using (true);
drop policy if exists parametre_suivi_write on parametre_suivi;
create policy parametre_suivi_write on parametre_suivi
  for all to authenticated
  using (est_gestionnaire_perfect_store())
  with check (est_gestionnaire_perfect_store());

insert into parametre_suivi (cle, valeur, libelle, aide)
select 'fenetre_suivi_mois', 12,
       'Fenêtre de suivi (mois)',
       'Un PDV visité au moins une fois dans cette fenêtre est « suivi » et compte dans les alertes. Au-delà, il bascule dans « à prospecter ».'
where not exists (select 1 from parametre_suivi where cle = 'fenetre_suivi_mois');

-- `coalesce` : si la ligne venait à disparaître, les RPC continuent de répondre.
create or replace function fenetre_suivi_mois()
returns integer
language sql stable
set search_path = public
as $$
  select coalesce((select valeur from parametre_suivi where cle = 'fenetre_suivi_mois'), 12);
$$;

-- ---------------------------------------------------------------------------
-- 2) Fraîcheur par PDV : une seule horloge, colonne `suivi`, statut de visite
-- ---------------------------------------------------------------------------
drop function if exists pdv_fraicheur_filtre(text, text, text, text, text);

create or replace function pdv_fraicheur_filtre(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_etat text default null,
  p_date_fin date default null,
  p_fenetre_mois integer default null,
  p_suivi boolean default null
) returns table(
  pdv_id text,
  nom_pdv text,
  zone text,
  quartier text,
  sous_categorie_pdv text,
  distributor_name text,
  derniere_visite timestamptz,
  derniere_visite_statut text,
  jours_depuis integer,
  frequence_jours integer,
  etat text,
  suivi boolean,
  niveau text,
  score_global numeric,
  visite_id uuid
)
language plpgsql stable
set search_path = public
as $$
declare
  v_ref     date := coalesce(p_date_fin, current_date);
  v_fenetre integer := coalesce(p_fenetre_mois, fenetre_suivi_mois());
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
  -- Bornée PAR LE HAUT seulement : voir l'en-tête, point 3.
  derniere as materialized (
    select distinct on (v.pdv_id) v.pdv_id, v.id as visite_id, v.date_visite, v.status
    from visites v
    where p_date_fin is null or v.date_visite < (p_date_fin + 1)::timestamptz
    order by v.pdv_id, v.date_visite desc
  ),
  etat as materialized (
    select s.*, d.visite_id, d.date_visite, d.status,
           case when d.date_visite is null then null
                else (v_ref - d.date_visite::date) end as jours_depuis,
           case
             when d.date_visite is null then 'jamais_visite'
             when (v_ref - d.date_visite::date) > coalesce(s.frequence_jours, 7) then 'en_retard'
             else 'a_jour'
           end as etat,
           coalesce(d.date_visite::date >= (v_ref - make_interval(months => v_fenetre)), false) as suivi
    from scope_pdv s
    left join derniere d on d.pdv_id = s.pdv_id
  )
  select e.pdv_id, e.nom_pdv, e.zone, e.quartier, e.sous_categorie_pdv, e.distributor_name,
         e.date_visite, e.status, e.jours_depuis, e.frequence_jours, e.etat, e.suivi,
         r.niveau, r.score_global, e.visite_id
  from etat e
  left join resultat_perfect_store r on r.visite_id = e.visite_id
  where (p_etat is null or p_etat = '' or e.etat = p_etat)
    and (p_suivi is null or e.suivi = p_suivi)
  order by case e.etat when 'jamais_visite' then 0 when 'en_retard' then 1 else 2 end,
           e.jours_depuis desc nulls first, e.nom_pdv;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Synthèse par zone : alertes sur les PDV suivis, « à prospecter » à part
-- ---------------------------------------------------------------------------
drop function if exists synthese_zones_filtre(text, text, text, text, date, date);

create or replace function synthese_zones_filtre(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_date_debut date default null,
  p_date_fin date default null,
  p_fenetre_mois integer default null
) returns table(
  zone text,
  pdv_total bigint,
  pdv_visites bigint,
  pdv_non_visites bigint,
  pdv_suivis bigint,
  a_prospecter bigint,
  a_jour bigint,
  en_retard bigint,
  jamais_visites bigint,
  alertes bigint,
  alertes_toutes bigint,
  dispo_moyenne numeric,
  perfect_store_pct numeric
)
language plpgsql stable
set search_path = public
as $$
declare
  v_ref     date := coalesce(p_date_fin, current_date);
  v_fenetre integer := coalesce(p_fenetre_mois, fenetre_suivi_mois());
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
    where p_date_fin is null or v.date_visite < (p_date_fin + 1)::timestamptz
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
             when (v_ref - d.date_visite::date) > coalesce(s.frequence_jours, 7) then 'en_retard'
             else 'a_jour'
           end as etat,
           coalesce(d.date_visite::date >= (v_ref - make_interval(months => v_fenetre)), false) as suivi
    from scope_pdv s
    left join derniere d on d.pdv_id = s.pdv_id
  )
  select
    coalesce(e.zone, '—') as zone,
    count(*) as pdv_total,
    count(sc.pdv_id) as pdv_visites,
    count(*) - count(sc.pdv_id) as pdv_non_visites,
    count(*) filter (where e.suivi) as pdv_suivis,
    count(*) filter (where not e.suivi) as a_prospecter,
    count(*) filter (where e.etat = 'a_jour') as a_jour,
    count(*) filter (where e.etat = 'en_retard') as en_retard,
    count(*) filter (where e.etat = 'jamais_visite') as jamais_visites,
    -- Le sens d'`alertes` CHANGE ici, et c'est voulu : seuls les PDV sous
    -- couverture en retard. `alertes_toutes` conserve l'ancien chiffre.
    count(*) filter (where e.suivi and e.etat = 'en_retard') as alertes,
    count(*) filter (where e.etat in ('en_retard', 'jamais_visite')) as alertes_toutes,
    round(avg(sc.dispo_rayon), 1) as dispo_moyenne,
    round(100.0 * count(*) filter (where sc.niveau is not null) / nullif(count(sc.pdv_id), 0), 1) as perfect_store_pct
  from etat e
  left join scored sc on sc.pdv_id = e.pdv_id
  group by coalesce(e.zone, '—')
  order by 10 desc, 1;
end $$;

commit;
