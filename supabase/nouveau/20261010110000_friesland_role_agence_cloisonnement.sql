-- ============================================================================
-- RÔLE « AGENCE » : CLOISONNEMENT COMPLÉTÉ (vérification du 09/10/2026)
--
-- Contrôle du compte d'Elias après 20261010100000, en se connectant comme lui :
-- visites, tournées, routing mensuel, installations et écarts étaient bien
-- limités à Atom, mais trois sources restaient globales.
--   1. PDV : pdv_ids_perimetre() rend TOUT le parc à un compte sans
--      territoire (règle des comptes terrain). Un compte agence n'a pas de
--      territoire : il voyait les 45 678 PDV. Il n'a plus que pdv_ids_agence().
--   2. Perfect Store : resultat_perfect_store et visite_perfect_store sont
--      lisibles par tous. Une politique RESTRICTIVE limite un compte agence aux
--      résultats des visites de ses merchandisers ; les vues Perfect Store
--      (security_invoker) suivent.
--   3. Statistiques précalculées (schéma stats : vues matérialisées, sans
--      droits par ligne) : v_stats_visites, v_performance_commerciaux,
--      v_visites_par_jour, v_distribution_pdv ne renvoient rien à un compte
--      agence. Son Activité se calculera sur ses visites (front, à venir).
-- Rien ne change pour les autres rôles. Idempotent.
-- ============================================================================
begin;

-- 1. Périmètre territorial : jamais pour un compte agence.
create or replace function public.pdv_ids_perimetre()
 returns setof text
 language sql
 stable security definer rows 2000
 set search_path to 'public'
as $function$
  with moi as materialized (
    select pr.role,
      case
        when jsonb_typeof(pr.territoires_assignes) = 'array' and jsonb_array_length(pr.territoires_assignes) > 0
          then (select array_agg(t) from jsonb_array_elements_text(pr.territoires_assignes) t where t <> '')
        when pr.zone_assignee is not null and pr.zone_assignee <> '' then array[pr.zone_assignee]
        else array[]::text[]
      end as territoires,
      case
        when jsonb_typeof(pr.quartiers_assignes) = 'array'
          then (select coalesce(array_agg(q), array[]::text[]) from jsonb_array_elements_text(pr.quartiers_assignes) q where q <> '')
        else array[]::text[]
      end as quartiers
    -- Un compte agence voit les PDV de son agence (pdv_ids_agence), pas un périmètre.
    from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role <> 'agence'
  ),
  terr as materialized (
    select m.territoires, m.quartiers,
           coalesce((select array_agg(x) from public.territoires_etendus(m.territoires) x), array[]::text[]) as noms
    from moi m
  )
  -- Deux branches sans OR sur une constante : le planificateur utilise l'index.
  select p.pdv_id
  from terr t
  join public.pdv p on p.zone = any(t.noms)
  where cardinality(t.territoires) > 0
    and (cardinality(t.quartiers) = 0 or p.quartier is null or p.quartier = any(t.quartiers))
  union all
  select p.pdv_id
  from terr t
  join public.pdv p on true
  where cardinality(t.territoires) = 0
    and (cardinality(t.quartiers) = 0 or p.quartier is null or p.quartier = any(t.quartiers));
$function$;

-- 2. Résultats Perfect Store : ceux des visites de l'agence
--    (resultat_perfect_store.visite_id = visites.id ; visite_perfect_store.visite_id = visites.visite_id).
drop policy if exists resultat_perfect_store_agence on public.resultat_perfect_store;
create policy resultat_perfect_store_agence on public.resultat_perfect_store
  as restrictive for select to authenticated
  using ((select public.agence_courante()) is null
         or visite_id in (select v.id from public.visites v where v.user_id in (select public.merch_ids_agence())));

drop policy if exists visite_perfect_store_agence on public.visite_perfect_store;
create policy visite_perfect_store_agence on public.visite_perfect_store
  as restrictive for select to authenticated
  using ((select public.agence_courante()) is null
         or visite_id in (select v.visite_id from public.visites v where v.user_id in (select public.merch_ids_agence())));

-- 3. Statistiques globales précalculées : rien pour un compte agence.
create or replace view public.v_stats_visites with (security_invoker = on) as
  select total_visites, pdv_visites, commerciaux_actifs, visites_today, visites_week, visites_month,
         taux_evap, taux_imp, taux_scm, taux_uht, taux_yaourt
  from stats.mv_stats_visites
  where public.agence_courante() is null;

create or replace view public.v_performance_commerciaux with (security_invoker = on) as
  select nom, email, total_visites, visites_mois, derniere_visite
  from stats.mv_performance_commerciaux
  where public.agence_courante() is null
  order by id;

create or replace view public.v_visites_par_jour with (security_invoker = on) as
  select date, count
  from stats.mv_visites_par_jour
  where public.agence_courante() is null
  order by date desc;

create or replace view public.v_distribution_pdv with (security_invoker = on) as
  select type, count
  from stats.mv_distribution_pdv
  where public.agence_courante() is null
  order by count desc;

commit;
