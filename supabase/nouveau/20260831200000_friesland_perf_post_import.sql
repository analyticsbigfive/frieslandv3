-- ============================================================
-- Performance post-import massif du 31/08/2026
-- (25 378 PDV, 26 248 visites importés via API REST)
--
-- Les RPC du dashboard (dashboard_perfect_store_filtre,
-- perfect_store_liste_filtre, v_couverture_globale, …) tombent en
-- "canceling statement due to statement timeout" : statistiques du
-- planificateur périmées après l'import en masse + quelques index
-- manquants + timeout par défaut (8 s) trop court pour 26 k visites JSONB.
--
-- À exécuter dans le SQL Editor Supabase (ou psql). Idempotent.
-- ============================================================

-- 1. Index utiles aux scopes et jointures du dashboard
CREATE INDEX IF NOT EXISTS idx_pdv_pdv_id      ON public.pdv(pdv_id);
CREATE INDEX IF NOT EXISTS idx_pdv_zone        ON public.pdv(zone);
CREATE INDEX IF NOT EXISTS idx_pdv_region      ON public.pdv(region);
CREATE INDEX IF NOT EXISTS idx_pdv_quartier    ON public.pdv(quartier);
CREATE INDEX IF NOT EXISTS idx_pdv_canal       ON public.pdv(canal);
CREATE INDEX IF NOT EXISTS idx_visites_pdv_id  ON public.visites(pdv_id);
CREATE INDEX IF NOT EXISTS idx_visites_date    ON public.visites(date_visite);
CREATE INDEX IF NOT EXISTS idx_visites_email   ON public.visites(email);
-- Dernière visite par PDV (pattern fréquent des RPC perfect store)
CREATE INDEX IF NOT EXISTS idx_visites_pdv_date ON public.visites(pdv_id, date_visite DESC);

-- 2. Rafraîchir les statistiques du planificateur (crucial après bulk load)
ANALYZE public.pdv;
ANALYZE public.visites;
ANALYZE public.zones_secteurs;
ANALYZE public.profiles;

-- 3. Timeout plus généreux pour les rôles API (8 s par défaut).
--    Les RPC perfect store agrègent 26 k visites JSONB : 30 s de marge.
ALTER ROLE authenticated SET statement_timeout = '30s';
ALTER ROLE anon SET statement_timeout = '15s';
ALTER ROLE service_role SET statement_timeout = '120s';

-- PostgREST doit recharger la config pour prendre en compte les ALTER ROLE
NOTIFY pgrst, 'reload config';

-- ============================================================
-- Vérification : ces deux requêtes doivent répondre en < 2-3 s
-- ============================================================
-- SELECT * FROM v_stats_visites;
-- SELECT public.dashboard_perfect_store_filtre(NULL, NULL, NULL, NULL);
