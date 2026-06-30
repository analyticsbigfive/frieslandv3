-- ============================================================
-- CATCHUP_019_023.sql — Rattrapage migrations non appliquées
-- Détecté 2026-06-30 (scripts/probe-migrations.mjs) sur la base live :
--   ❌ pos_types.canal (023) ABSENTE — la table category_weights (023) existe
--      déjà → 023 n'a tourné qu'à moitié. C'est le seul trou prouvé.
--   ❓ 019 (durcissement RLS) non vérifiable via l'API REST → ré-appliqué ici
--      par précaution (idempotent, no-op si déjà en place).
-- Reste (017/018/022/nouveau) : vérifié APPLIQUÉ, non répété.
--
-- 100% idempotent (IF NOT EXISTS / DROP+CREATE). Sûr à ré-exécuter.
-- Self-contained : copier-coller dans le SQL Editor Supabase, OU
--   psql "<DATABASE_URL>" -f supabase/CATCHUP_019_023.sql
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║ 023 — Canal GT/MT sur pos_types  (LE TROU À COMBLER)      ║
-- ╚══════════════════════════════════════════════════════════╝
ALTER TABLE public.pos_types
  ADD COLUMN IF NOT EXISTS canal TEXT CHECK (canal IN ('GT', 'MT'));
COMMENT ON COLUMN public.pos_types.canal IS
  'Canal commercial : GT (traditionnel) ou MT (moderne). NULL = non classé.';

-- category_weights : déjà présente sur la base live, mais re-créée IF NOT EXISTS
-- pour que ce fichier soit complet et rejouable sur une base neuve.
CREATE TABLE IF NOT EXISTS public.category_weights (
  category    TEXT NOT NULL,
  trade_type  TEXT NOT NULL CHECK (trade_type IN ('GT', 'MT')),
  weight      NUMERIC NOT NULL CHECK (weight >= 0 AND weight <= 1),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (category, trade_type)
);
ALTER TABLE public.category_weights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cw_read ON public.category_weights;
CREATE POLICY cw_read ON public.category_weights FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cw_write ON public.category_weights;
CREATE POLICY cw_write ON public.category_weights FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'superviseur')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'superviseur')));


-- ╔══════════════════════════════════════════════════════════╗
-- ║ 019 — Durcissement RLS & RPC  (ré-appliqué par précaution)║
-- ╚══════════════════════════════════════════════════════════╝

-- C2 — Anti auto-escalade de rôle sur public.profiles
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role      = (SELECT p.role      FROM public.profiles p WHERE p.id = auth.uid())
    AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE
  USING      (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role) OR (NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
    IF auth.uid() IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Modification de role/is_active réservée aux admins (profil %)', NEW.id
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_prevent_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- H1 — public.pdv UPDATE : WITH CHECK manquant
DROP POLICY IF EXISTS "pdv_update_admin" ON public.pdv;
CREATE POLICY "pdv_update_admin" ON public.pdv FOR UPDATE
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superviseur')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superviseur')));

DROP POLICY IF EXISTS "pdv_update_field" ON public.pdv;
CREATE POLICY "pdv_update_field" ON public.pdv FOR UPDATE
  USING      (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- M3 — public.visites INSERT : interdire l'usurpation de user_id
DROP POLICY IF EXISTS "visites_insert" ON public.visites;
CREATE POLICY "visites_insert" ON public.visites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- M2 — RPC d'import SECURITY DEFINER : retirer accès client + search_path
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS sig
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('import_zone_secteur', 'import_pdv_from_csv', 'import_visite_from_csv')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END $$;

-- B12 — search_path figé sur TOUTES les fonctions SECURITY DEFINER
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosecdef = true
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}'::text[])) c
        WHERE c LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END $$;

-- ============================================================
-- FIN. Vérif post-exécution :
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='pos_types' AND column_name='canal';  -- doit renvoyer 1 ligne
-- ============================================================
