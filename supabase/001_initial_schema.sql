-- ============================================================
-- Migration Supabase - Friesland Bonnet Rouge
-- 001_initial_schema.sql
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
-- TABLE: profiles (linked to auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  nom TEXT NOT NULL DEFAULT '',
  telephone TEXT,
  role TEXT NOT NULL DEFAULT 'merchandiser' CHECK (role IN ('admin', 'superviseur', 'merchandiser', 'commercial')),
  zone_assignee TEXT,
  secteurs_assignes JSONB DEFAULT '[]'::jsonb,
  region TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: zones_secteurs (reference data)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.zones_secteurs (
  id SERIAL PRIMARY KEY,
  zone TEXT NOT NULL,
  secteur TEXT,
  merchandiser TEXT,
  email_merchandiser TEXT,
  sales_rep TEXT,
  email_sales_rep TEXT,
  region TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: pdv (Points de Vente)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pdv (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pdv_id TEXT UNIQUE NOT NULL,
  nom_pdv TEXT NOT NULL,
  canal TEXT DEFAULT 'General trade',
  categorie_pdv TEXT DEFAULT 'Point de vente détail',
  sous_categorie_pdv TEXT DEFAULT 'Boutique C',
  autre_sous_categorie TEXT,
  region TEXT,
  zone TEXT,
  secteur TEXT,
  geolocation_lat DOUBLE PRECISION,
  geolocation_lng DOUBLE PRECISION,
  rayon_geofence INTEGER DEFAULT 300,
  adressage TEXT,
  image_url TEXT,
  date_creation DATE,
  ajoute_par TEXT,
  jour_routing TEXT,
  position_routing INTEGER,
  canal_routing TEXT,
  sales_rep_routing TEXT,
  mdm TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: visites
-- ============================================================
CREATE TABLE IF NOT EXISTS public.visites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  visite_id TEXT UNIQUE NOT NULL,
  pdv_id TEXT REFERENCES public.pdv(pdv_id),
  user_id UUID REFERENCES public.profiles(id),
  date_visite TIMESTAMPTZ NOT NULL,
  commercial TEXT,
  email TEXT,
  geolocation_lat DOUBLE PRECISION,
  geolocation_lng DOUBLE PRECISION,
  geofence_validated BOOLEAN DEFAULT false,
  precision_gps DOUBLE PRECISION,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  image_urls TEXT[] DEFAULT '{}',
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: routing_data
-- ============================================================
CREATE TABLE IF NOT EXISTS public.routing_data (
  id SERIAL PRIMARY KEY,
  jour_routing TEXT,
  canal TEXT,
  position_order INTEGER,
  sales_rep TEXT,
  mdm TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pdv_pdv_id ON public.pdv(pdv_id);
CREATE INDEX IF NOT EXISTS idx_pdv_zone ON public.pdv(zone);
CREATE INDEX IF NOT EXISTS idx_pdv_region ON public.pdv(region);
CREATE INDEX IF NOT EXISTS idx_pdv_secteur ON public.pdv(secteur);
CREATE INDEX IF NOT EXISTS idx_pdv_geolocation ON public.pdv(geolocation_lat, geolocation_lng);

CREATE INDEX IF NOT EXISTS idx_visites_pdv_id ON public.visites(pdv_id);
CREATE INDEX IF NOT EXISTS idx_visites_user_id ON public.visites(user_id);
CREATE INDEX IF NOT EXISTS idx_visites_date ON public.visites(date_visite);
CREATE INDEX IF NOT EXISTS idx_visites_email ON public.visites(email);
CREATE INDEX IF NOT EXISTS idx_visites_data ON public.visites USING GIN(data);

CREATE INDEX IF NOT EXISTS idx_zones_secteurs_zone ON public.zones_secteurs(zone);
CREATE INDEX IF NOT EXISTS idx_zones_secteurs_region ON public.zones_secteurs(region);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_pdv
  BEFORE UPDATE ON public.pdv
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_visites
  BEFORE UPDATE ON public.visites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nom', ''), 'merchandiser');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones_secteurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_data ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, edit own
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR auth.uid() = id
  );
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- PDV: all authenticated can read, admin can write
CREATE POLICY "pdv_select_auth" ON public.pdv FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "pdv_insert_auth" ON public.pdv FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "pdv_update_admin" ON public.pdv FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superviseur'))
    OR auth.role() = 'authenticated'
  );
CREATE POLICY "pdv_delete_admin" ON public.pdv FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Visites: users can CRUD own visits, admins see all
CREATE POLICY "visites_select" ON public.visites FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superviseur'))
  );
CREATE POLICY "visites_insert" ON public.visites FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "visites_update" ON public.visites FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "visites_delete_admin" ON public.visites FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Zones/Routing: all authenticated read, admin write
CREATE POLICY "zones_select" ON public.zones_secteurs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "zones_manage_admin" ON public.zones_secteurs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "routing_select" ON public.routing_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "routing_manage_admin" ON public.routing_data FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- STORAGE: bucket pour images
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('visite-images', 'visite-images', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "images_select_public" ON storage.objects FOR SELECT
  USING (bucket_id = 'visite-images');
CREATE POLICY "images_insert_auth" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'visite-images' AND auth.role() = 'authenticated');
CREATE POLICY "images_delete_admin" ON storage.objects FOR DELETE
  USING (bucket_id = 'visite-images' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- VIEWS: Statistics helpers
-- ============================================================
CREATE OR REPLACE VIEW public.v_stats_visites AS
SELECT
  COUNT(*) AS total_visites,
  COUNT(DISTINCT pdv_id) AS pdv_visites,
  COUNT(DISTINCT user_id) AS commerciaux_actifs,
  COUNT(*) FILTER (WHERE date_visite::date = CURRENT_DATE) AS visites_today,
  COUNT(*) FILTER (WHERE date_visite >= date_trunc('week', CURRENT_DATE)) AS visites_week,
  COUNT(*) FILTER (WHERE date_visite >= date_trunc('month', CURRENT_DATE)) AS visites_month,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (data->'produits'->'evap'->>'present')::boolean = true) / NULLIF(COUNT(*), 0), 1) AS taux_evap,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (data->'produits'->'imp'->>'present')::boolean = true) / NULLIF(COUNT(*), 0), 1) AS taux_imp,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (data->'produits'->'scm'->>'present')::boolean = true) / NULLIF(COUNT(*), 0), 1) AS taux_scm,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (data->'produits'->'uht'->>'present')::boolean = true) / NULLIF(COUNT(*), 0), 1) AS taux_uht,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (data->'produits'->'yaourt'->>'present')::boolean = true) / NULLIF(COUNT(*), 0), 1) AS taux_yaourt
FROM public.visites;

CREATE OR REPLACE VIEW public.v_performance_commerciaux AS
SELECT
  commercial AS nom,
  email,
  COUNT(*) AS total_visites,
  COUNT(*) FILTER (WHERE date_visite >= date_trunc('month', CURRENT_DATE)) AS visites_mois,
  MAX(date_visite) AS derniere_visite
FROM public.visites
GROUP BY commercial, email
ORDER BY total_visites DESC;

CREATE OR REPLACE VIEW public.v_visites_par_jour AS
SELECT
  date_visite::date AS date,
  COUNT(*) AS count
FROM public.visites
GROUP BY date_visite::date
ORDER BY date DESC
LIMIT 90;
