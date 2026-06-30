-- ============================================================
-- 009_routing_templates.sql - Templates de routing permanent
-- Permet de définir des routings récurrents par jour de semaine
-- avec ajout/retrait dynamique de PDV
-- ============================================================

-- ============================================================
-- TABLE: routing_templates (planning permanent hebdomadaire)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.routing_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  -- 0=Dimanche, 1=Lundi, 2=Mardi, 3=Mercredi, 4=Jeudi, 5=Vendredi, 6=Samedi
  label TEXT, -- Ex: "Tournée Appolo", "Route Belleville"
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Un seul template actif par utilisateur par jour de semaine
  UNIQUE(user_id, day_of_week)
);

-- ============================================================
-- TABLE: routing_template_pdv (PDV dans un template permanent)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.routing_template_pdv (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.routing_templates(id) ON DELETE CASCADE,
  pdv_id TEXT NOT NULL REFERENCES public.pdv(pdv_id) ON DELETE CASCADE,
  position_order INTEGER NOT NULL,
  objectifs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Un PDV ne peut apparaître qu'une seule fois dans un template
  UNIQUE(template_id, pdv_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_routing_templates_user ON public.routing_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_routing_templates_day ON public.routing_templates(day_of_week);
CREATE INDEX IF NOT EXISTS idx_routing_templates_active ON public.routing_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_routing_template_pdv_template ON public.routing_template_pdv(template_id);
CREATE INDEX IF NOT EXISTS idx_routing_template_pdv_pdv ON public.routing_template_pdv(pdv_id);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================
DROP TRIGGER IF EXISTS trg_routing_templates_updated_at ON public.routing_templates;
CREATE TRIGGER trg_routing_templates_updated_at
  BEFORE UPDATE ON public.routing_templates
  FOR EACH ROW EXECUTE FUNCTION update_routing_updated_at();

DROP TRIGGER IF EXISTS trg_routing_template_pdv_updated_at ON public.routing_template_pdv;
CREATE TRIGGER trg_routing_template_pdv_updated_at
  BEFORE UPDATE ON public.routing_template_pdv
  FOR EACH ROW EXECUTE FUNCTION update_routing_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE public.routing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_template_pdv ENABLE ROW LEVEL SECURITY;

-- Admin/superviseur: full access
CREATE POLICY routing_templates_admin_policy ON public.routing_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superviseur')
    )
  );

-- Users: can read their own templates
CREATE POLICY routing_templates_user_read ON public.routing_templates
  FOR SELECT
  USING (user_id = auth.uid());

-- routing_template_pdv: Admin full access
CREATE POLICY routing_template_pdv_admin_policy ON public.routing_template_pdv
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superviseur')
    )
  );

-- routing_template_pdv: Users can read items from their templates
CREATE POLICY routing_template_pdv_user_read ON public.routing_template_pdv
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.routing_templates
      WHERE routing_templates.id = routing_template_pdv.template_id
      AND routing_templates.user_id = auth.uid()
    )
  );
