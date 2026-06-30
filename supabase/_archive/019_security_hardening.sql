-- LEGACY (Système A) — remplacé par supabase/nouveau (Système B) le 2026-06-30. Ne plus modifier.
-- ============================================================
-- 019_security_hardening.sql — Durcissement RLS & RPC (audit sécurité)
-- À exécuter dans le SQL Editor de Supabase. Idempotent, sûr à ré-exécuter.
--
-- Couvre :
--   C2  — escalade de rôle via profiles_update_own (WITH CHECK + trigger)
--   H1  — pdv UPDATE sans WITH CHECK (séparation admin / terrain)
--   M3  — visites_insert sans WITH CHECK (usurpation user_id)
--   M2  — RPC import SECURITY DEFINER : REVOKE accès client + search_path
--   B12 — search_path manquant sur les fonctions SECURITY DEFINER
--
-- NON couvert ici (ruptures applicatives — migration dédiée requise) :
--   H2 — bucket 'visite-images' privé + URLs signées (URLs publiques stockées
--        en clair dans pdv.image_url / visites.image_urls, affichées partout).
--   M5 — scoping de profiles_select_all (lecture inter-utilisateurs en place).
-- ============================================================


-- ============================================================
-- C2 — Anti auto-escalade de rôle sur public.profiles
-- ============================================================
-- profiles_update_own : un utilisateur édite SA ligne mais ne peut PAS
-- changer son role ni is_active (figés sur leurs valeurs courantes).
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role      = (SELECT p.role      FROM public.profiles p WHERE p.id = auth.uid())
    AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid())
  );

-- profiles_update_admin : un admin peut tout modifier (policies UPDATE = OR permissif).
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE
  USING      (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Défense en profondeur : trigger bloquant tout changement de role/is_active
-- par un non-admin, même si une policy future réintroduisait la faille.
-- auth.uid() IS NULL = contexte service_role (scripts backend) → autorisé.
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


-- ============================================================
-- H1 — public.pdv UPDATE : ajout du WITH CHECK manquant
-- ============================================================
-- L'ancienne policy 'pdv_update_admin' contenait "OR auth.role()='authenticated'"
-- → le contrôle admin était mort (USING ≡ TRUE) et il n'y avait aucun WITH CHECK.
-- On sépare : policy admin/superviseur (USING+WITH CHECK) + policy terrain
-- (authentifié) afin de conserver l'édition mobile (pages/mobile/pdv/[id].vue).
-- ⚠️ Correctif COMPLET = scoper l'édition terrain à la zone assignée
--    (profiles.zone_assignee = pdv.zone) — à valider, voir SECURITY-AUDIT.md H1.
DROP POLICY IF EXISTS "pdv_update_admin" ON public.pdv;
CREATE POLICY "pdv_update_admin" ON public.pdv FOR UPDATE
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superviseur')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superviseur')));

DROP POLICY IF EXISTS "pdv_update_field" ON public.pdv;
CREATE POLICY "pdv_update_field" ON public.pdv FOR UPDATE
  USING      (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- ============================================================
-- M3 — public.visites INSERT : interdire l'usurpation de user_id
-- ============================================================
-- L'app pose toujours user_id = auth.uid() (pages/mobile/visites/new.vue).
DROP POLICY IF EXISTS "visites_insert" ON public.visites;
CREATE POLICY "visites_insert" ON public.visites FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- M2 — RPC d'import SECURITY DEFINER : retirer l'accès client + search_path
-- ============================================================
-- import_zone_secteur / import_pdv_from_csv / import_visite_from_csv ne sont
-- appelées QUE par les scripts via la clé service_role (qui ignore REVOKE).
-- Aucun appel .rpc() client (seul get_visites_filtered l'est). On retire donc
-- l'EXECUTE à anon/authenticated et on fige le search_path (anti hijack).
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


-- ============================================================
-- B12 — search_path figé sur TOUTES les fonctions SECURITY DEFINER
-- ============================================================
-- Couvre handle_new_user, compute_perfect_store, etc. Idempotent : ne
-- retouche pas celles qui ont déjà un search_path.
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
