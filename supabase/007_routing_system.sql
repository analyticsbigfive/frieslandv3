-- ============================================================
-- 007_routing_system.sql - Système de Routing / Planning
-- Permet à l'admin d'assigner des PDV ordonnés aux utilisateurs
-- avec des objectifs spécifiques par visite
-- ============================================================

-- ============================================================
-- TABLE: routings (planning journalier)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.routings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date_routing DATE NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Un seul routing par utilisateur par jour
  UNIQUE(user_id, date_routing)
);

-- ============================================================
-- TABLE: routing_pdv (PDV assignés dans un routing)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.routing_pdv (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  routing_id UUID NOT NULL REFERENCES public.routings(id) ON DELETE CASCADE,
  pdv_id TEXT NOT NULL REFERENCES public.pdv(pdv_id) ON DELETE CASCADE,
  position_order INTEGER NOT NULL,
  -- Objectifs spécifiques pour ce PDV
  objectifs JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Status du passage
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  -- Geofencing
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  geofence_validated BOOLEAN DEFAULT false,
  geolocation_lat DOUBLE PRECISION,
  geolocation_lng DOUBLE PRECISION,
  precision_gps DOUBLE PRECISION,
  -- Résultats / notes terrain
  result_notes TEXT,
  visite_id TEXT REFERENCES public.visites(visite_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Un PDV ne peut apparaître qu'une seule fois dans un routing
  UNIQUE(routing_id, pdv_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_routings_user_date ON public.routings(user_id, date_routing);
CREATE INDEX IF NOT EXISTS idx_routings_date ON public.routings(date_routing);
CREATE INDEX IF NOT EXISTS idx_routings_status ON public.routings(status);
CREATE INDEX IF NOT EXISTS idx_routing_pdv_routing ON public.routing_pdv(routing_id);
CREATE INDEX IF NOT EXISTS idx_routing_pdv_pdv ON public.routing_pdv(pdv_id);
CREATE INDEX IF NOT EXISTS idx_routing_pdv_status ON public.routing_pdv(status);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_routing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_routings_updated_at ON public.routings;
CREATE TRIGGER trg_routings_updated_at
  BEFORE UPDATE ON public.routings
  FOR EACH ROW EXECUTE FUNCTION update_routing_updated_at();

DROP TRIGGER IF EXISTS trg_routing_pdv_updated_at ON public.routing_pdv;
CREATE TRIGGER trg_routing_pdv_updated_at
  BEFORE UPDATE ON public.routing_pdv
  FOR EACH ROW EXECUTE FUNCTION update_routing_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE public.routings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_pdv ENABLE ROW LEVEL SECURITY;

-- Admin/superviseur: full access
CREATE POLICY routings_admin_policy ON public.routings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superviseur')
    )
  );

-- Users: can read their own routings
CREATE POLICY routings_user_read ON public.routings
  FOR SELECT
  USING (user_id = auth.uid());

-- Users: can update their own routings (status changes)
CREATE POLICY routings_user_update ON public.routings
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- routing_pdv: Admin full access
CREATE POLICY routing_pdv_admin_policy ON public.routing_pdv
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superviseur')
    )
  );

-- routing_pdv: Users can read items from their routings
CREATE POLICY routing_pdv_user_read ON public.routing_pdv
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.routings
      WHERE routings.id = routing_pdv.routing_id
      AND routings.user_id = auth.uid()
    )
  );

-- routing_pdv: Users can update items from their routings (status, geofence, notes)
CREATE POLICY routing_pdv_user_update ON public.routing_pdv
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.routings
      WHERE routings.id = routing_pdv.routing_id
      AND routings.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.routings
      WHERE routings.id = routing_pdv.routing_id
      AND routings.user_id = auth.uid()
    )
  );
