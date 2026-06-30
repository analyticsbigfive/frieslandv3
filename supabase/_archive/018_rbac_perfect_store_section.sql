-- LEGACY (Système A) — remplacé par supabase/nouveau (Système B) le 2026-06-30. Ne plus modifier.
-- ============================================================
-- 018_rbac_perfect_store_section.sql
-- Ajoute la section 'perfect-store' au RBAC (role_section_access).
-- admin + superviseur : accès ; merchandiser + commercial : non.
-- À exécuter après 011_rbac_role_section_access.sql. Idempotent.
-- ============================================================

INSERT INTO public.role_section_access (role, section, can_access) VALUES
  ('admin','perfect-store',true),
  ('superviseur','perfect-store',true),
  ('merchandiser','perfect-store',false),
  ('commercial','perfect-store',false)
ON CONFLICT (role, section) DO NOTHING;
