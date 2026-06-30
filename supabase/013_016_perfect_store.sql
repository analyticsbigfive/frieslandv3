-- ============================================================
--  PERFECT STORE — migrations incrémentales pour frieslandv3
--  (Nuxt 3 + Supabase). À exécuter APRÈS 012_sku_thresholds.sql.
--  Conventions du repo : schéma public, libellés FR, RLS via
--  public.profiles.role, seeds ON CONFLICT idempotents.
--
--  Blocs : 013 (référentiels) · 014 (poids) · 015 (visibilité)
--          016 (scores + moteur + vues). Sûr à ré-exécuter.
--
--  ⚠️ Le brief NE FIXE PAS la combinaison des piliers en % final
--     ni les seuils de tier. Tout est donc EXTERNALISÉ et
--     PARAMÉTRABLE (perfect_store_tier_config + perfect_store_score_config).
--     Voir FORMULE_ET_TESTS_perfect_store.md pour la formule exacte.
-- ============================================================


-- ============================================================
--  013 — MAPPING TYPE DE PDV -> GROUPE STANDARD + TIER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pos_standard_map (
  sous_categorie_pdv TEXT PRIMARY KEY,
  standard_group     TEXT NOT NULL,
  tier               TEXT NOT NULL CHECK (tier IN ('A','B','C')),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.pos_standard_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS psm_read ON public.pos_standard_map;
CREATE POLICY psm_read ON public.pos_standard_map FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS psm_write ON public.pos_standard_map;
CREATE POLICY psm_write ON public.pos_standard_map FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')));
INSERT INTO public.pos_standard_map (sous_categorie_pdv, standard_group, tier) VALUES
  ('Boutique A','BOUTIQUE','A'),('Boutique B','BOUTIQUE','B'),('Boutique C','BOUTIQUE','C'),
  ('Superette GT','MINI MARKET','A'),('Kiosque','KIOSQUE','A')
ON CONFLICT (sous_categorie_pdv) DO NOTHING;

ALTER TABLE public.pdv
  ADD COLUMN IF NOT EXISTS objectif_perfect_store TEXT
  CHECK (objectif_perfect_store IN ('FLAGSHIP','VIP','CORE','BASIC'));


-- ============================================================
--  013b — STANDARDS DE DISPONIBILITÉ (quantité mini par SKU)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.availability_standards (
  category       TEXT NOT NULL,
  sku            TEXT NOT NULL,
  standard_group TEXT NOT NULL,
  tier           TEXT NOT NULL CHECK (tier IN ('A','B','C')),
  min_quantity   INTEGER NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (category, sku, standard_group, tier)
);
ALTER TABLE public.availability_standards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS avs_read ON public.availability_standards;
CREATE POLICY avs_read ON public.availability_standards FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS avs_write ON public.availability_standards;
CREATE POLICY avs_write ON public.availability_standards FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')));
INSERT INTO public.availability_standards (category, sku, standard_group, tier, min_quantity) VALUES
  ('evap','br_gold','BOUTIQUE','A',24),('evap','br_gold','BOUTIQUE','B',24),('evap','br_gold','BOUTIQUE','C',12),
  ('evap','br_160g','BOUTIQUE','A',48),('evap','br_160g','BOUTIQUE','B',36),('evap','br_160g','BOUTIQUE','C',18),
  ('evap','brb_160g','BOUTIQUE','A',24),('evap','brb_160g','BOUTIQUE','B',18),('evap','brb_160g','BOUTIQUE','C',12),
  ('evap','br_400g','BOUTIQUE','A',24),('evap','br_400g','BOUTIQUE','B',18),('evap','br_400g','BOUTIQUE','C',10),
  ('evap','brb_400g','BOUTIQUE','A',12),('evap','brb_400g','BOUTIQUE','B',12),('evap','brb_400g','BOUTIQUE','C',6),
  ('evap','pearl_400g','BOUTIQUE','A',24),('evap','pearl_400g','BOUTIQUE','B',18),('evap','pearl_400g','BOUTIQUE','C',10),
  ('evap','br_gold','MINI MARKET','A',24),('evap','br_gold','MINI MARKET','B',12),
  ('evap','br_160g','MINI MARKET','A',48),('evap','br_160g','MINI MARKET','B',24),
  ('evap','brb_160g','MINI MARKET','A',24),('evap','brb_160g','MINI MARKET','B',18),
  ('evap','br_400g','MINI MARKET','A',24),('evap','br_400g','MINI MARKET','B',18),
  ('evap','brb_400g','MINI MARKET','A',12),('evap','brb_400g','MINI MARKET','B',12),
  ('evap','pearl_400g','MINI MARKET','A',24),('evap','pearl_400g','MINI MARKET','B',18),
  ('scm','br_1kg','BOUTIQUE','A',3),
  ('scm','br_1kg','MINI MARKET','A',6),('scm','br_1kg','MINI MARKET','B',3),
  ('scm','pearl_1kg','BOUTIQUE','A',12),('scm','pearl_1kg','BOUTIQUE','B',6),('scm','pearl_1kg','BOUTIQUE','C',3),
  ('scm','pearl_1kg','MINI MARKET','A',12),('scm','pearl_1kg','MINI MARKET','B',6),
  ('imp','br_20g','BOUTIQUE','A',12),('imp','br_20g','BOUTIQUE','B',12),('imp','br_20g','BOUTIQUE','C',3),
  ('imp','brd_15g','BOUTIQUE','A',12),('imp','brd_15g','BOUTIQUE','B',12),('imp','brd_15g','BOUTIQUE','C',3),
  ('imp','br_375g','BOUTIQUE','A',6),('imp','br_375g','BOUTIQUE','B',3),('imp','br_375g','BOUTIQUE','C',3),
  ('imp','br_900g','BOUTIQUE','A',12),('imp','br_900g','BOUTIQUE','B',6),('imp','br_900g','BOUTIQUE','C',3),
  ('imp','br_2_5kg','BOUTIQUE','A',6),('imp','br_2_5kg','BOUTIQUE','B',3)
ON CONFLICT (category, sku, standard_group, tier) DO NOTHING;
-- TODO IMP : brb_25g, brb_400g, br_400g("BR 2"), brd_350g — mapping format<->SKU à confirmer.

CREATE TABLE IF NOT EXISTS public.assortment_standards (
  standard_group  TEXT NOT NULL,
  tier            TEXT NOT NULL CHECK (tier IN ('A','B','C')),
  min_sku_count   INTEGER NOT NULL,
  min_sku_present INTEGER NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (standard_group, tier)
);
ALTER TABLE public.assortment_standards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ass_read ON public.assortment_standards;
CREATE POLICY ass_read ON public.assortment_standards FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ass_write ON public.assortment_standards;
CREATE POLICY ass_write ON public.assortment_standards FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')));
INSERT INTO public.assortment_standards (standard_group, tier, min_sku_count, min_sku_present) VALUES
  ('BOUTIQUE','A',15,10),('BOUTIQUE','B',12,8),('BOUTIQUE','C',11,5),
  ('MINI MARKET','A',15,10),('MINI MARKET','B',12,8),('MINI MARKET','C',11,5)
ON CONFLICT (standard_group, tier) DO NOTHING;


-- ============================================================
--  014 — PONDÉRATIONS DE DISPONIBILITÉ (taux vente / taux revu)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.availability_weights (
  category    TEXT NOT NULL,
  trade_type  TEXT NOT NULL CHECK (trade_type IN ('GT','MT')),
  basis       TEXT NOT NULL CHECK (basis IN ('taux_vente','taux_revu')),
  sku         TEXT NOT NULL,
  weight      NUMERIC NOT NULL CHECK (weight >= 0 AND weight <= 1),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (category, trade_type, basis, sku)
);
ALTER TABLE public.availability_weights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS avw_read ON public.availability_weights;
CREATE POLICY avw_read ON public.availability_weights FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS avw_write ON public.availability_weights;
CREATE POLICY avw_write ON public.availability_weights FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')));
INSERT INTO public.availability_weights (category, trade_type, basis, sku, weight) VALUES
  ('evap','GT','taux_vente','br_160g',0.75),('evap','GT','taux_vente','brb_160g',0.08),
  ('evap','GT','taux_vente','br_400g',0.05),('evap','GT','taux_vente','brb_400g',0.01),
  ('evap','GT','taux_vente','br_gold',0.01),('evap','GT','taux_vente','pearl_400g',0.10),
  ('evap','GT','taux_revu','br_160g',0.65),('evap','GT','taux_revu','brb_160g',0.07),
  ('evap','GT','taux_revu','br_400g',0.05),('evap','GT','taux_revu','brb_400g',0.03),
  ('evap','GT','taux_revu','br_gold',0.10),('evap','GT','taux_revu','pearl_400g',0.10),
  ('evap','MT','taux_vente','br_160g',0.69),('evap','MT','taux_vente','brb_160g',0.09),
  ('evap','MT','taux_vente','br_400g',0.08),('evap','MT','taux_vente','brb_400g',0.04),
  ('evap','MT','taux_vente','br_gold',0.04),('evap','MT','taux_vente','pearl_400g',0.05),
  ('evap','MT','taux_revu','br_160g',0.55),('evap','MT','taux_revu','brb_160g',0.12),
  ('evap','MT','taux_revu','br_400g',0.08),('evap','MT','taux_revu','brb_400g',0.05),
  ('evap','MT','taux_revu','br_gold',0.15),('evap','MT','taux_revu','pearl_400g',0.05),
  ('scm','GT','taux_vente','pearl_1kg',0.95),('scm','GT','taux_vente','br_1kg',0.05),
  ('scm','GT','taux_revu','pearl_1kg',0.95),('scm','GT','taux_revu','br_1kg',0.05)
ON CONFLICT (category, trade_type, basis, sku) DO NOTHING;
-- TODO IMP (GT & MT) + SCM MT — mapping à valider :
--   IMP GT taux_vente : BR15g .85 / BR360 .05 / delice15g .08 / Delice350g .01 / BR400g .002 / BR900g .001 / BR2500g .001
--   IMP GT taux_revu  : .76 / .07 / .05 / .03 / .05 / .02 / .02
--   SCM MT taux_revu  : pearl_1kg .30 / br_1kg .70


-- ============================================================
--  015 — STANDARDS DE VISIBILITÉ (PLV requise par tier)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.visibility_standards (
  standard_group TEXT NOT NULL,
  ps_tier        TEXT NOT NULL CHECK (ps_tier IN ('FLAGSHIP','VIP','CORE','BASIC')),
  zone           TEXT NOT NULL CHECK (zone IN ('exterieure','interieure')),
  element_key    TEXT NOT NULL,
  is_required    BOOLEAN NOT NULL DEFAULT true,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (standard_group, ps_tier, zone, element_key)
);
ALTER TABLE public.visibility_standards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vis_read ON public.visibility_standards;
CREATE POLICY vis_read ON public.visibility_standards FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS vis_write ON public.visibility_standards;
CREATE POLICY vis_write ON public.visibility_standards FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')));
INSERT INTO public.visibility_standards (standard_group, ps_tier, zone, element_key, is_required) VALUES
  ('BOUTIQUE','FLAGSHIP','exterieure','poster',true),
  ('BOUTIQUE','FLAGSHIP','exterieure','guirlande',true),
  ('BOUTIQUE','FLAGSHIP','exterieure','sign_board',true),
  ('BOUTIQUE','FLAGSHIP','exterieure','panneau_privilege',true),
  ('BOUTIQUE','FLAGSHIP','exterieure','full_branding',true),
  ('BOUTIQUE','FLAGSHIP','interieure','reglettes',true),
  ('BOUTIQUE','FLAGSHIP','interieure','maison_bonnet_rouge',true),
  ('BOUTIQUE','FLAGSHIP','interieure','hanger',true),
  ('BOUTIQUE','FLAGSHIP','interieure','presentoirs',true),
  ('BOUTIQUE','FLAGSHIP','interieure','tete_gondole',true),
  ('BOUTIQUE','FLAGSHIP','interieure','merchandising',true),
  ('BOUTIQUE','VIP','exterieure','poster',true),
  ('BOUTIQUE','VIP','exterieure','guirlande',true),
  ('BOUTIQUE','VIP','exterieure','sign_board',true),
  ('BOUTIQUE','VIP','exterieure','panneau_privilege',true),
  ('BOUTIQUE','VIP','interieure','reglettes',true),
  ('BOUTIQUE','VIP','interieure','maison_bonnet_rouge',true),
  ('BOUTIQUE','VIP','interieure','hanger',true),
  ('BOUTIQUE','VIP','interieure','presentoirs',true),
  ('BOUTIQUE','VIP','interieure','merchandising',true),
  ('BOUTIQUE','CORE','exterieure','poster',true),
  ('BOUTIQUE','CORE','exterieure','guirlande',true),
  ('BOUTIQUE','CORE','exterieure','sign_board',true),
  ('BOUTIQUE','CORE','interieure','reglettes',true),
  ('BOUTIQUE','CORE','interieure','maison_bonnet_rouge',true),
  ('BOUTIQUE','CORE','interieure','hanger',true),
  ('BOUTIQUE','CORE','interieure','merchandising',true),
  ('BOUTIQUE','BASIC','exterieure','poster',true),
  ('BOUTIQUE','BASIC','exterieure','guirlande',true),
  ('BOUTIQUE','BASIC','interieure','reglettes',true),
  ('BOUTIQUE','BASIC','interieure','maison_bonnet_rouge',true),
  ('BOUTIQUE','BASIC','interieure','hanger',true),
  ('BOUTIQUE','BASIC','interieure','merchandising',true)
ON CONFLICT (standard_group, ps_tier, zone, element_key) DO NOTHING;
-- TODO compléter SUPERETTE/MINI MARKET, KIOSQUE, ABOKI, PUSHCART, TABLE TOP, PORRIDGE.


-- ============================================================
--  016 — SCORES + CONFIG + MOTEUR + VUES
-- ============================================================

-- Seuils de GATING par tier (piliers conjonctifs). Paramétrable.
-- DROP+CREATE : la table a dérivé d'une version antérieure de ce fichier
-- (colonnes renommées). CREATE IF NOT EXISTS ne réconcilie PAS le schéma,
-- d'où "ERROR 42703: column assort_min does not exist". Config pure, re-seedée.
DROP TABLE IF EXISTS public.perfect_store_tier_config CASCADE;
CREATE TABLE public.perfect_store_tier_config (
  ps_tier    TEXT PRIMARY KEY CHECK (ps_tier IN ('FLAGSHIP','VIP','CORE','BASIC')),
  osa_min    NUMERIC NOT NULL,   -- OSA pondérée mini (0..1)
  assort_min NUMERIC NOT NULL,   -- ratio assortiment mini (0..1)
  visi_min   NUMERIC NOT NULL,   -- taux visibilité mini (0..1)
  promo_min  NUMERIC,            -- NULL = promo non bloquante
  rang       INTEGER NOT NULL
);
ALTER TABLE public.perfect_store_tier_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pstc_read ON public.perfect_store_tier_config;
CREATE POLICY pstc_read ON public.perfect_store_tier_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pstc_write ON public.perfect_store_tier_config;
CREATE POLICY pstc_write ON public.perfect_store_tier_config FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
-- Défauts À VALIDER (le brief ne les fixe pas).
INSERT INTO public.perfect_store_tier_config (ps_tier, osa_min, assort_min, visi_min, promo_min, rang) VALUES
  ('FLAGSHIP',0.95,1.00,1.00,NULL,4),
  ('VIP',     0.85,0.90,1.00,NULL,3),
  ('CORE',    0.75,0.80,1.00,NULL,2),
  ('BASIC',   0.60,0.60,1.00,NULL,1)
ON CONFLICT (ps_tier) DO NOTHING;

-- Pondérations du SCORE COMPOSITE (% final continu, pour dashboards/tendances).
-- Distinct du gating binaire. Σ par défaut = 1.00. Paramétrable.
CREATE TABLE IF NOT EXISTS public.perfect_store_score_config (
  id             INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  w_osa_lineaire NUMERIC NOT NULL DEFAULT 0.10,
  w_osa_pondere  NUMERIC NOT NULL DEFAULT 0.45,
  w_assortiment  NUMERIC NOT NULL DEFAULT 0.15,
  w_visibilite   NUMERIC NOT NULL DEFAULT 0.30,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.perfect_store_score_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pssc_read ON public.perfect_store_score_config;
CREATE POLICY pssc_read ON public.perfect_store_score_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pssc_write ON public.perfect_store_score_config;
CREATE POLICY pssc_write ON public.perfect_store_score_config FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
INSERT INTO public.perfect_store_score_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Résultats par visite
-- DROP+CREATE : table dérivée d'une version antérieure (colonne score_global
-- absente → "ERROR 42703" dans v_perfect_store_global). Résultats régénérés
-- par le trigger visites_perfect_store / compute_perfect_store.
DROP TABLE IF EXISTS public.visite_perfect_store CASCADE;
CREATE TABLE public.visite_perfect_store (
  visite_id        TEXT PRIMARY KEY REFERENCES public.visites(visite_id) ON DELETE CASCADE,
  basis            TEXT NOT NULL DEFAULT 'taux_vente' CHECK (basis IN ('taux_vente','taux_revu')),
  osa_lineaire     NUMERIC,        -- 0..1
  osa_pondere      NUMERIC,        -- 0..1 (normalisée)
  osa_note10       NUMERIC,        -- osa_pondere * 10
  assortiment_taux NUMERIC,        -- 0..1
  visibilite_taux  NUMERIC,        -- 0..1
  promo_taux       NUMERIC,        -- nullable
  score_global     NUMERIC,        -- 0..1 (composite pondéré, % final continu)
  dispo_categorie  JSONB DEFAULT '{}'::jsonb,
  is_perfect_store BOOLEAN NOT NULL DEFAULT false,
  tier_atteint     TEXT CHECK (tier_atteint IN ('FLAGSHIP','VIP','CORE','BASIC')),
  computed_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.visite_perfect_store ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vps_read ON public.visite_perfect_store;
CREATE POLICY vps_read ON public.visite_perfect_store FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS vps_write ON public.visite_perfect_store;
CREATE POLICY vps_write ON public.visite_perfect_store FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
--  compute_perfect_store(visite_id, basis)
--  Pipeline (détail dans FORMULE_ET_TESTS_perfect_store.md) :
--   1) Pour chaque SKU evap/imp/scm ayant un standard (group,tier) :
--        is_available = quantite_relevee >= min_quantity
--   2) OSA linéaire   = nb_dispo / nb_evalués
--      OSA pondérée   = Σ(dispo·poids) / Σ(poids)            [normalisée]
--   3) Assortiment    = min( nb_dispo / min_sku_present , 1 )
--   4) Visibilité     = nb_PLV_requis_présents / nb_PLV_requis  (objectif PS du PDV)
--   5) score_global   = (wL·lin + wP·pond + wA·assort + wV·visi)
--                       / (somme des poids des composantes NON NULL)   [renormalisé]
--   6) tier_atteint   = tier de plus haut rang tel que (GATING conjonctif) :
--        pond ≥ osa_min  ET  assort ≥ assort_min  ET  visi ≥ visi_min
--        ET (promo_min NULL  OU  promo ≥ promo_min)
--      is_perfect_store = (tier_atteint IS NOT NULL)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_perfect_store(p_visite_id TEXT, p_basis TEXT DEFAULT 'taux_vente')
RETURNS public.visite_perfect_store
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_visite   public.visites%ROWTYPE;
  v_pdv      public.pdv%ROWTYPE;
  v_group    TEXT; v_tier TEXT; v_trade TEXT; v_objectif TEXT;
  v_qte      INTEGER; v_min INTEGER; v_weight NUMERIC; v_avail BOOLEAN;
  g_eval     INTEGER := 0; g_avail INTEGER := 0;
  g_wsum     NUMERIC := 0; g_wtot NUMERIC := 0;
  cat_detail JSONB := '{}'::jsonb; cat_eval INTEGER; cat_avail INTEGER;
  vis_req    INTEGER := 0; vis_ok INTEGER := 0; vis_rate NUMERIC;
  v_minsku   INTEGER; assort NUMERIC;
  osa_lin    NUMERIC; osa_w NUMERIC; score NUMERIC; wden NUMERIC;
  cfg        public.perfect_store_score_config%ROWTYPE;
  res        public.visite_perfect_store%ROWTYPE;
  v_rec      RECORD;
BEGIN
  SELECT * INTO v_visite FROM public.visites WHERE visite_id = p_visite_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Visite % introuvable', p_visite_id; END IF;
  SELECT * INTO v_pdv FROM public.pdv WHERE pdv_id = v_visite.pdv_id;
  SELECT * INTO cfg  FROM public.perfect_store_score_config WHERE id = 1;

  SELECT standard_group, tier INTO v_group, v_tier
    FROM public.pos_standard_map WHERE sous_categorie_pdv = v_pdv.sous_categorie_pdv;
  v_trade := CASE WHEN v_pdv.canal ILIKE '%modern%' OR v_pdv.canal = 'MT' THEN 'MT' ELSE 'GT' END;
  v_objectif := COALESCE(v_pdv.objectif_perfect_store, 'BASIC');

  -- (1)(2)(3) OSA + assortiment
  FOR v_rec IN
    SELECT s.category, s.sku, s.min_quantity
    FROM public.availability_standards s
    WHERE s.standard_group = v_group AND s.tier = v_tier AND s.category IN ('evap','imp','scm')
  LOOP
    v_min := v_rec.min_quantity;
    v_qte := COALESCE(NULLIF(v_visite.data->'produits'->v_rec.category->'quantites'->>v_rec.sku,'')::INTEGER, 0);
    v_avail := v_qte >= v_min;
    SELECT weight INTO v_weight FROM public.availability_weights
      WHERE category=v_rec.category AND trade_type=v_trade AND basis=p_basis AND sku=v_rec.sku;
    v_weight := COALESCE(v_weight, 0);

    g_eval := g_eval + 1; g_wtot := g_wtot + v_weight;
    IF v_avail THEN g_avail := g_avail + 1; g_wsum := g_wsum + v_weight; END IF;

    cat_eval  := COALESCE((cat_detail->v_rec.category->>'eval')::INTEGER,0) + 1;
    cat_avail := COALESCE((cat_detail->v_rec.category->>'avail')::INTEGER,0) + (CASE WHEN v_avail THEN 1 ELSE 0 END);
    cat_detail := jsonb_set(cat_detail, ARRAY[v_rec.category],
      jsonb_build_object('eval',cat_eval,'avail',cat_avail), true);
  END LOOP;

  osa_lin := CASE WHEN g_eval>0 THEN g_avail::NUMERIC/g_eval ELSE NULL END;
  osa_w   := CASE WHEN g_wtot>0 THEN g_wsum/g_wtot ELSE NULL END;

  SELECT min_sku_present INTO v_minsku FROM public.assortment_standards
    WHERE standard_group=v_group AND tier=v_tier;
  assort := CASE WHEN v_minsku IS NULL OR v_minsku=0 THEN NULL
                 ELSE LEAST(g_avail::NUMERIC / v_minsku, 1) END;

  -- (4) Visibilité
  FOR v_rec IN
    SELECT zone, element_key FROM public.visibility_standards
    WHERE standard_group=v_group AND ps_tier=v_objectif AND is_required
  LOOP
    vis_req := vis_req + 1;
    IF COALESCE((v_visite.data->'visibilite'->v_rec.zone->>v_rec.element_key)::BOOLEAN, false) THEN
      vis_ok := vis_ok + 1;
    END IF;
  END LOOP;
  vis_rate := CASE WHEN vis_req>0 THEN vis_ok::NUMERIC/vis_req ELSE NULL END;

  -- (5) Score composite renormalisé sur les composantes présentes
  score := 0; wden := 0;
  IF osa_lin  IS NOT NULL THEN score := score + cfg.w_osa_lineaire*osa_lin; wden := wden + cfg.w_osa_lineaire; END IF;
  IF osa_w    IS NOT NULL THEN score := score + cfg.w_osa_pondere*osa_w;   wden := wden + cfg.w_osa_pondere; END IF;
  IF assort   IS NOT NULL THEN score := score + cfg.w_assortiment*assort;  wden := wden + cfg.w_assortiment; END IF;
  IF vis_rate IS NOT NULL THEN score := score + cfg.w_visibilite*vis_rate; wden := wden + cfg.w_visibilite; END IF;
  score := CASE WHEN wden>0 THEN score/wden ELSE NULL END;

  -- (6) Gating tier
  res.visite_id := p_visite_id; res.basis := p_basis;
  res.osa_lineaire := osa_lin; res.osa_pondere := osa_w; res.osa_note10 := ROUND(COALESCE(osa_w,0)*10,2);
  res.assortiment_taux := assort; res.visibilite_taux := vis_rate; res.promo_taux := NULL;
  res.score_global := score; res.dispo_categorie := cat_detail;
  res.is_perfect_store := false; res.tier_atteint := NULL; res.computed_at := NOW();

  SELECT ps_tier INTO res.tier_atteint
  FROM public.perfect_store_tier_config c
  WHERE COALESCE(osa_w,0)    >= c.osa_min
    AND COALESCE(assort,1)   >= c.assort_min
    AND COALESCE(vis_rate,0) >= c.visi_min
    AND (c.promo_min IS NULL OR COALESCE(res.promo_taux,0) >= c.promo_min)
  ORDER BY c.rang DESC
  LIMIT 1;
  res.is_perfect_store := res.tier_atteint IS NOT NULL;

  INSERT INTO public.visite_perfect_store AS t VALUES (res.*)
  ON CONFLICT (visite_id) DO UPDATE SET
    basis=EXCLUDED.basis, osa_lineaire=EXCLUDED.osa_lineaire, osa_pondere=EXCLUDED.osa_pondere,
    osa_note10=EXCLUDED.osa_note10, assortiment_taux=EXCLUDED.assortiment_taux,
    visibilite_taux=EXCLUDED.visibilite_taux, promo_taux=EXCLUDED.promo_taux,
    score_global=EXCLUDED.score_global, dispo_categorie=EXCLUDED.dispo_categorie,
    is_perfect_store=EXCLUDED.is_perfect_store, tier_atteint=EXCLUDED.tier_atteint,
    computed_at=EXCLUDED.computed_at;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.trg_compute_perfect_store()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.compute_perfect_store(NEW.visite_id, 'taux_vente');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS visites_perfect_store ON public.visites;
CREATE TRIGGER visites_perfect_store
  AFTER INSERT OR UPDATE OF data ON public.visites
  FOR EACH ROW EXECUTE FUNCTION public.trg_compute_perfect_store();


-- ============================================================
--  VUES DASHBOARD
-- ============================================================
CREATE OR REPLACE VIEW public.v_perfect_store_global AS
SELECT
  count(*)                                            AS visites_scorees,
  count(*) FILTER (WHERE vps.is_perfect_store)        AS perfect_stores,
  ROUND(100.0 * count(*) FILTER (WHERE vps.is_perfect_store) / NULLIF(count(*),0), 1) AS perfect_store_pct,
  ROUND(AVG(vps.score_global)*100, 1)                 AS score_global_moyen_pct,
  ROUND(AVG(vps.osa_pondere)*100, 1)                  AS osa_moyen_pct,
  ROUND(AVG(vps.visibilite_taux)*100, 1)              AS visibilite_moyenne_pct
FROM public.visite_perfect_store vps;

CREATE OR REPLACE VIEW public.v_perfect_store_par_type AS
SELECT
  p.sous_categorie_pdv                                AS type_pdv,
  count(*)                                            AS visites_scorees,
  count(*) FILTER (WHERE vps.is_perfect_store)        AS perfect_stores,
  ROUND(100.0 * count(*) FILTER (WHERE vps.is_perfect_store) / NULLIF(count(*),0), 1) AS perfect_store_pct,
  ROUND(AVG(vps.score_global)*100, 1)                 AS score_global_moyen_pct
FROM public.visite_perfect_store vps
JOIN public.visites v ON v.visite_id = vps.visite_id
JOIN public.pdv p     ON p.pdv_id   = v.pdv_id
GROUP BY p.sous_categorie_pdv
ORDER BY perfect_store_pct DESC NULLS LAST;

-- FIN — penser à ajouter la section 'perfect-store' au RBAC (role_section_access).
