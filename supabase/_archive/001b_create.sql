-- ============================================================
-- 001b_create.sql - Création du schéma
-- Exécuter EN SECOND dans le SQL Editor de Supabase
-- (après avoir exécuté 001a_cleanup.sql)
-- ============================================================

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
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
