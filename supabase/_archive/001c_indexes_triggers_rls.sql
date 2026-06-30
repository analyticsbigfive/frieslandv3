-- ============================================================
-- 001c_indexes_triggers_rls.sql - Indexes, Triggers, RLS, Views
-- Exécuter EN TROISIÈME dans le SQL Editor de Supabase
-- (après avoir exécuté 001b_create.sql)
-- ============================================================

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

DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_pdv ON public.pdv;
CREATE TRIGGER set_updated_at_pdv
  BEFORE UPDATE ON public.pdv
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_visites ON public.visites;
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones_secteurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_data ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies first to avoid duplicates
DO $$ BEGIN DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pdv_select_auth" ON public.pdv; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pdv_insert_auth" ON public.pdv; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pdv_update_admin" ON public.pdv; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pdv_delete_admin" ON public.pdv; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "visites_select" ON public.visites; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "visites_insert" ON public.visites; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "visites_update" ON public.visites; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "visites_delete_admin" ON public.visites; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "zones_select" ON public.zones_secteurs; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "zones_manage_admin" ON public.zones_secteurs; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "routing_select" ON public.routing_data; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "routing_manage_admin" ON public.routing_data; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Create policies
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR auth.uid() = id
  );
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "pdv_select_auth" ON public.pdv FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "pdv_insert_auth" ON public.pdv FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "pdv_update_admin" ON public.pdv FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superviseur'))
    OR auth.role() = 'authenticated'
  );
CREATE POLICY "pdv_delete_admin" ON public.pdv FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

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

DO $$ BEGIN
  CREATE POLICY "images_select_public" ON storage.objects FOR SELECT
    USING (bucket_id = 'visite-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "images_insert_auth" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'visite-images' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "images_delete_admin" ON storage.objects FOR DELETE
    USING (bucket_id = 'visite-images' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
