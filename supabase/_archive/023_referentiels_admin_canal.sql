-- 023 — Canal GT/MT sur pos_types (catégorie de PDV) + table proposée de
-- pondération entre catégories. Complète les écrans admin Référentiels.
-- Ré-exécutable (IF NOT EXISTS / IF EXISTS).

-- ───────────────────────────────────────────────────────────────────────────
-- 1) Canal GT/MT sur le type de PDV (À FAIRE README : « canal GT/MT à valider »)
--    Permet à l'admin de classer chaque type/catégorie de PDV en commerce
--    traditionnel (GT) ou moderne (MT) depuis l'écran Référentiels > Types PDV.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.pos_types
  ADD COLUMN IF NOT EXISTS canal TEXT CHECK (canal IN ('GT', 'MT'));

COMMENT ON COLUMN public.pos_types.canal IS
  'Canal commercial : GT (traditionnel) ou MT (moderne). NULL = non classé.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2) PROPOSITION (à valider Friesland) — pondération ENTRE catégories pour la
--    disponibilité globale. Aujourd'hui v_score_disponibilite fait une moyenne
--    simple des catégories (EVAP/IMP/SCM). Cette table permettrait de pondérer.
--    La table seule est inerte : il faut ensuite recâbler la vue de calcul
--    (voir bloc commenté ci-dessous) APRÈS validation des poids par Friesland.
-- ───────────────────────────────────────────────────────────────────────────
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

-- À DÉCOMMENTER après validation des poids (recâble la moyenne simple en
-- moyenne pondérée par category_weights ; fallback poids 1 si absent) :
--
-- CREATE OR REPLACE VIEW public.v_score_disponibilite AS
-- SELECT
--   s.visite_id,
--   round(sum(s.score_categorie * coalesce(cw.weight, 1))
--         / nullif(sum(coalesce(cw.weight, 1)), 0))::int AS score_disponibilite
-- FROM public.v_score_disponibilite_categorie s
-- LEFT JOIN public.category_weights cw
--   ON cw.category = s.categorie AND cw.trade_type = s.trade_type
-- GROUP BY s.visite_id;
