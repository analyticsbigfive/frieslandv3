-- ============================================================
-- 011_rbac_role_section_access.sql
-- Contrôle d'accès par rôle aux sections du dashboard admin.
-- Matrice éditable (rôle × section) gérée depuis /admin/permissions.
-- À exécuter dans le SQL Editor de Supabase. Sûr à ré-exécuter.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.role_section_access (
  role TEXT NOT NULL,
  section TEXT NOT NULL,
  can_access BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (role, section)
);

ALTER TABLE public.role_section_access ENABLE ROW LEVEL SECURITY;

-- Lecture: tout utilisateur authentifié (nécessaire pour construire son menu)
DROP POLICY IF EXISTS rsa_read ON public.role_section_access;
CREATE POLICY rsa_read ON public.role_section_access
  FOR SELECT TO authenticated USING (true);

-- Écriture: réservée à l'admin
DROP POLICY IF EXISTS rsa_admin_write ON public.role_section_access;
CREATE POLICY rsa_admin_write ON public.role_section_access
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- ============================================================
-- Valeurs par défaut
--   admin        : accès total (forcé aussi côté app)
--   superviseur  : tout sauf 'administration'
--   merchandiser : aucun accès dashboard (app mobile)
--   commercial   : aucun accès dashboard (app mobile)
-- Sections: principal, pdv, visites, visibilite, concurrence, produits, actions, administration
-- ============================================================
INSERT INTO public.role_section_access (role, section, can_access) VALUES
  ('admin','principal',true),('admin','pdv',true),('admin','visites',true),('admin','visibilite',true),('admin','concurrence',true),('admin','produits',true),('admin','actions',true),('admin','administration',true),
  ('superviseur','principal',true),('superviseur','pdv',true),('superviseur','visites',true),('superviseur','visibilite',true),('superviseur','concurrence',true),('superviseur','produits',true),('superviseur','actions',true),('superviseur','administration',false),
  ('merchandiser','principal',false),('merchandiser','pdv',false),('merchandiser','visites',false),('merchandiser','visibilite',false),('merchandiser','concurrence',false),('merchandiser','produits',false),('merchandiser','actions',false),('merchandiser','administration',false),
  ('commercial','principal',false),('commercial','pdv',false),('commercial','visites',false),('commercial','visibilite',false),('commercial','concurrence',false),('commercial','produits',false),('commercial','actions',false),('commercial','administration',false)
ON CONFLICT (role, section) DO NOTHING;
