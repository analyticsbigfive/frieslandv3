-- ============================================================================
-- CORRECTIF de 20260924180000 : le rafraîchissement pg_cron des vues de stats
-- échouait ET bloquait la base.
--
-- Premier run à 18:20 (24 sept. 2026) : « canceling statement due to
-- statement timeout » après 2 min sur `refresh materialized view concurrently
-- stats.mv_stats_visites`. Le job tourne avec le statement_timeout du rôle
-- postgres (120 s) ; sous charge (4 RPC perfect_store_liste_filtre en
-- parallèle au même moment), le calcul dépasse ces 2 min. Pendant ces 2 min,
-- une requête PostgREST d'une ligne mettait 53 s. Résultat : compteurs figés
-- à 18:12 et base inutilisable toutes les 10 min.
--
-- 1. La fonction de rafraîchissement s'affranchit du timeout (10 min max).
-- 2. Cadence ramenée à UNE FOIS PAR HEURE (à la minute 7) : sur un compute à
--    1 vCPU, chaque rafraîchissement coûte ~20 s de CPU en période calme et
--    bien plus sous charge. Après un import massif, un admin peut forcer le
--    recalcul : `select public.refresh_stats_dashboard();` (RPC autorisée aux
--    rôles admin/superviseur).
-- Idempotent.
-- ============================================================================
begin;

alter function public.refresh_stats_dashboard() set statement_timeout = '600s';

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'refresh_stats_dashboard';
  perform cron.schedule('refresh_stats_dashboard', '7 * * * *', 'select public.refresh_stats_dashboard()');
end $$;

commit;
