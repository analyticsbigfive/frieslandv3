-- ============================================================
-- 001a_cleanup.sql - Nettoyage complet
-- Exécuter EN PREMIER dans le SQL Editor de Supabase
-- ============================================================

-- Drop views
DROP VIEW IF EXISTS public.v_visites_par_jour CASCADE;
DROP VIEW IF EXISTS public.v_performance_commerciaux CASCADE;
DROP VIEW IF EXISTS public.v_stats_visites CASCADE;

-- Drop tables (CASCADE supprimera triggers, indexes, policies, FK automatiquement)
DROP TABLE IF EXISTS public.visites CASCADE;
DROP TABLE IF EXISTS public.routing_data CASCADE;
DROP TABLE IF EXISTS public.pdv CASCADE;
DROP TABLE IF EXISTS public.zones_secteurs CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Clean storage policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "images_select_public" ON storage.objects;
  DROP POLICY IF EXISTS "images_insert_auth" ON storage.objects;
  DROP POLICY IF EXISTS "images_delete_admin" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
