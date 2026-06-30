-- LEGACY (Système A) — remplacé par supabase/nouveau (Système B) le 2026-06-30. Ne plus modifier.
-- ============================================================
-- 012_sku_thresholds.sql
-- Seuils "stock bas" configurables par SKU (pour calcul dispo / OOS / stock bas).
-- À exécuter dans le SQL Editor de Supabase. Sûr à ré-exécuter.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sku_thresholds (
  category TEXT NOT NULL,
  sku TEXT NOT NULL,
  label TEXT,
  seuil_bas INTEGER NOT NULL DEFAULT 3,
  ordre INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (category, sku)
);

ALTER TABLE public.sku_thresholds ENABLE ROW LEVEL SECURITY;

-- Lecture: tout authentifié (app terrain + dashboards)
DROP POLICY IF EXISTS sku_thresholds_read ON public.sku_thresholds;
CREATE POLICY sku_thresholds_read ON public.sku_thresholds
  FOR SELECT TO authenticated USING (true);

-- Écriture: admin + superviseur
DROP POLICY IF EXISTS sku_thresholds_write ON public.sku_thresholds;
CREATE POLICY sku_thresholds_write ON public.sku_thresholds
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')));

-- Seed depuis le catalogue (seuil par défaut = 3). ON CONFLICT: ne pas écraser une config existante.
INSERT INTO public.sku_thresholds (category, sku, label, seuil_bas, ordre) VALUES
  ('evap','br_gold','BR Gold',3,1),
  ('evap','br_160g','BR 150g',3,2),
  ('evap','brb_160g','BRB 150g',3,3),
  ('evap','br_400g','BR 380g',3,4),
  ('evap','brb_400g','BRB 380g',3,5),
  ('evap','pearl_400g','Pearl 380g',3,6),
  ('imp','br_400g','BR 2',3,1),
  ('imp','br_20g','BR 15g',3,2),
  ('imp','brb_25g','BRB 16g',3,3),
  ('imp','br_375g','BR 360g',3,4),
  ('imp','br_900g','BR 400g Tin',3,5),
  ('imp','brb_400g','BRB 360g',3,6),
  ('imp','br_2_5kg','BR 900g Tin',3,7),
  ('imp','brd_15g','BRD 15g',3,8),
  ('scm','pearl_1kg','Pearl 1Kg',3,1),
  ('scm','br_1kg','BR 1Kg',3,2),
  ('scm','brb_1kg','BRB 1Kg',3,3),
  ('scm','br_397g','BR 397g',3,4),
  ('scm','brb_397g','BRB 397g',3,5),
  ('uht','demi_ecreme','BR 516ml',3,1),
  ('uht','elopack_500ml','Elopack 500ml',3,2),
  ('uht','brique_1l','Brique 1L',3,3),
  ('yaourt','br_yogoo_fraise_mini_90ml','Yogoo Fraise Mini 90ml',3,1),
  ('yaourt','br_yogoo_fraise_maxi_318ml','Yogoo Fraise Maxi 318ml',3,2),
  ('yaourt','br_yogoo_nature_mini_90ml','Yogoo Nature Mini 90ml',3,3),
  ('yaourt','br_yogoo_nature_maxi_318ml','Yogoo Nature Maxi 318ml',3,4),
  ('cereales','brcv','Céréales BRCV',3,1),
  ('cereales','brcc','Céréales BRCC',3,2)
ON CONFLICT (category, sku) DO NOTHING;
