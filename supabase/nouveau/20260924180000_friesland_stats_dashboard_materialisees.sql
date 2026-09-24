-- ============================================================================
-- PERFORMANCE : vues de statistiques du tableau de bord matérialisées.
--
-- Mesuré en production le 24 sept. 2026 (compute Supabase partagé, 1 vCPU) :
--   v_stats_visites            8,4 s  (scan complet de visites + parsing jsonb)
--   v_performance_commerciaux  9,4 s  en moyenne sur un mois
--   v_visites_par_jour         2,3 s
--   v_distribution_pdv         3,4 s
-- Ces 4 vues sont relues à CHAQUE ouverture d'une page admin (layout admin →
-- fetchStats). Ajoutées aux RPC du dashboard (dashboard_perfect_store_filtre :
-- 14 s en moyenne, 45 s mesuré), la base sature et PostgREST renvoie des 504
-- « upstream request timeout » / « canceling statement due to statement
-- timeout » sur TOUTES les requêtes en attente — y compris la liste des PDV et
-- des visites, pourtant rapides seules. D'où le « une fois sur deux ».
--
-- 1. Les 4 agrégats sont calculés dans des vues matérialisées (schéma privé
--    `stats`, non exposé par PostgREST), rafraîchies toutes les 10 minutes par
--    pg_cron (REFRESH CONCURRENTLY : aucune lecture bloquée). Lecture : < 5 ms.
-- 2. Les vues public.v_* gardent leur nom et leurs colonnes (le front ne change
--    pas) et restent en security_invoker, sans accès anon.
-- 3. Les RPC du dashboard trient 26 000 lignes avec work_mem = 2 Mo et
--    débordent sur disque (« external merge ») : work_mem porté à 16 Mo pour
--    ces fonctions uniquement.
--
-- Ce que ça ne règle pas : le compute reste sous-dimensionné pour un dashboard
-- qui lance 10+ agrégations lourdes en parallèle. Voir le rapport du 24 sept.
-- Idempotent.
-- ============================================================================
begin;

create extension if not exists pg_cron;

create schema if not exists stats;
revoke all on schema stats from public, anon;
grant usage on schema stats to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Vues matérialisées (mêmes colonnes que les vues d'origine + une clé
--    unique, requise par REFRESH CONCURRENTLY).
-- ---------------------------------------------------------------------------
drop materialized view if exists stats.mv_stats_visites;
create materialized view stats.mv_stats_visites as
  select 1 as id,
    count(*) as total_visites,
    count(distinct pdv_id) as pdv_visites,
    count(distinct user_id) as commerciaux_actifs,
    count(*) filter (where date_visite::date = current_date) as visites_today,
    count(*) filter (where date_visite >= date_trunc('week', current_date::timestamptz)) as visites_week,
    count(*) filter (where date_visite >= date_trunc('month', current_date::timestamptz)) as visites_month,
    round(100.0 * count(*) filter (where ((data->'produits'->'evap'->>'present')::boolean) = true)::numeric / nullif(count(*), 0)::numeric, 1) as taux_evap,
    round(100.0 * count(*) filter (where ((data->'produits'->'imp'->>'present')::boolean) = true)::numeric / nullif(count(*), 0)::numeric, 1) as taux_imp,
    round(100.0 * count(*) filter (where ((data->'produits'->'scm'->>'present')::boolean) = true)::numeric / nullif(count(*), 0)::numeric, 1) as taux_scm,
    round(100.0 * count(*) filter (where ((data->'produits'->'uht'->>'present')::boolean) = true)::numeric / nullif(count(*), 0)::numeric, 1) as taux_uht,
    round(100.0 * count(*) filter (where ((data->'produits'->'yaourt'->>'present')::boolean) = true)::numeric / nullif(count(*), 0)::numeric, 1) as taux_yaourt,
    now() as calcule_le
  from public.visites;
create unique index on stats.mv_stats_visites (id);

drop materialized view if exists stats.mv_performance_commerciaux;
create materialized view stats.mv_performance_commerciaux as
  select row_number() over (order by count(*) desc, commercial, email) as id,
    commercial as nom,
    email,
    count(*) as total_visites,
    count(*) filter (where date_visite >= date_trunc('month', current_date::timestamptz)) as visites_mois,
    max(date_visite) as derniere_visite
  from public.visites
  group by commercial, email;
create unique index on stats.mv_performance_commerciaux (id);

drop materialized view if exists stats.mv_visites_par_jour;
create materialized view stats.mv_visites_par_jour as
  select date_visite::date as date, count(*) as count
  from public.visites
  group by date_visite::date
  order by date_visite::date desc
  limit 90;
create unique index on stats.mv_visites_par_jour (date);

drop materialized view if exists stats.mv_distribution_pdv;
create materialized view stats.mv_distribution_pdv as
  select coalesce(sous_categorie_pdv, 'Autre') as type, count(*) as count
  from public.pdv
  where is_active = true
  group by coalesce(sous_categorie_pdv, 'Autre');
create unique index on stats.mv_distribution_pdv (type);

grant select on all tables in schema stats to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Vues publiques : mêmes noms et colonnes qu'avant, lecture instantanée.
--    security_invoker : l'appelant lit stats.mv_* avec ses propres droits
--    (authenticated uniquement, jamais anon).
-- ---------------------------------------------------------------------------
drop view if exists public.v_stats_visites;
create view public.v_stats_visites with (security_invoker = on) as
  select total_visites, pdv_visites, commerciaux_actifs, visites_today, visites_week,
         visites_month, taux_evap, taux_imp, taux_scm, taux_uht, taux_yaourt
  from stats.mv_stats_visites;

drop view if exists public.v_performance_commerciaux;
create view public.v_performance_commerciaux with (security_invoker = on) as
  select nom, email, total_visites, visites_mois, derniere_visite
  from stats.mv_performance_commerciaux
  order by id;

drop view if exists public.v_visites_par_jour;
create view public.v_visites_par_jour with (security_invoker = on) as
  select date, count from stats.mv_visites_par_jour order by date desc;

drop view if exists public.v_distribution_pdv;
create view public.v_distribution_pdv with (security_invoker = on) as
  select type, count from stats.mv_distribution_pdv order by count desc;

revoke all on public.v_stats_visites, public.v_performance_commerciaux,
           public.v_visites_par_jour, public.v_distribution_pdv from anon, public;
grant select on public.v_stats_visites, public.v_performance_commerciaux,
                public.v_visites_par_jour, public.v_distribution_pdv to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Rafraîchissement : toutes les 10 minutes, sans bloquer les lecteurs.
--    Appelable aussi à la main (RPC, admin/superviseur) après un import.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_stats_dashboard()
returns timestamptz
language plpgsql security definer
set search_path = public, stats
as $$
begin
  if current_user <> 'postgres'
     and coalesce(public.role_actif_courant(), '') not in ('admin', 'superviseur') then
    raise exception 'refresh_stats_dashboard : réservé aux administrateurs';
  end if;
  refresh materialized view concurrently stats.mv_stats_visites;
  refresh materialized view concurrently stats.mv_performance_commerciaux;
  refresh materialized view concurrently stats.mv_visites_par_jour;
  refresh materialized view concurrently stats.mv_distribution_pdv;
  return now();
end;
$$;
revoke all on function public.refresh_stats_dashboard() from public, anon;
grant execute on function public.refresh_stats_dashboard() to authenticated, service_role;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'refresh_stats_dashboard';
  perform cron.schedule('refresh_stats_dashboard', '*/10 * * * *', 'select public.refresh_stats_dashboard()');
end $$;

-- ---------------------------------------------------------------------------
-- 4. work_mem des RPC du dashboard : plus de tri sur disque.
-- ---------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'dashboard_perfect_store_filtre', 'perfect_store_liste_filtre', 'synthese_zones_filtre',
      'pdv_fraicheur_filtre', 'couverture_visites_par_commercial', 'dashboard_presence_skus',
      'perfect_store_evolution_filtre', 'perfect_store_manques_filtre',
      'perfect_store_par_type_filtre', 'get_visites_filtered')
  loop
    execute format('alter function %s set work_mem = %L', f.sig, '16MB');
  end loop;
end $$;

commit;
