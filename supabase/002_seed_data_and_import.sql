-- ============================================================
-- Migration Supabase - Friesland Bonnet Rouge
-- 002_seed_data_and_import.sql
-- Seed zones_secteurs, routing_data + fonctions d'import CSV
-- ============================================================

-- ============================================================
-- 1. SEED: jours de routing (lookup)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.jours_routing (
  id SERIAL PRIMARY KEY,
  jour TEXT UNIQUE NOT NULL
);

INSERT INTO public.jours_routing (jour) VALUES
  ('Lundi 1'), ('Lundi 2'), ('Lundi 3'), ('Lundi 4'),
  ('Mardi 1'), ('Mardi 2'), ('Mardi 3'), ('Mardi 4'),
  ('Mercredi 1'), ('Mercredi 2'), ('Mercredi 3'), ('Mercredi 4'),
  ('Jeudi 1'), ('Jeudi 2'), ('Jeudi 3'), ('Jeudi 4'),
  ('Vendredi 1'), ('Vendredi 2'), ('Vendredi 3'), ('Vendredi 4'),
  ('Samedi 1'), ('Samedi 2'), ('Samedi 3'), ('Samedi 4')
ON CONFLICT (jour) DO NOTHING;

-- ============================================================
-- 2. SEED: canaux de routing (lookup)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.canaux_routing (
  id SERIAL PRIMARY KEY,
  canal TEXT UNIQUE NOT NULL
);

INSERT INTO public.canaux_routing (canal) VALUES
  ('GT'), ('MT'), ('GT et MT')
ON CONFLICT (canal) DO NOTHING;

-- ============================================================
-- 3. SEED: sales_reps (lookup)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sales_reps (
  id SERIAL PRIMARY KEY,
  nom TEXT UNIQUE NOT NULL
);

INSERT INTO public.sales_reps (nom) VALUES
  ('CINDY KADIA'), ('ARMANDE'), ('SOUARE IBRAHIMA'), ('GAI KAMY'),
  ('OPHELIIA'), ('RACHID'), ('MURIELLE'), ('GUE HERMAN'),
  ('ASSAMOI TRESOR'), ('COULIBALY PADIE'), ('OUATTARA ZANGA'),
  ('NOUHOUN SINWINDE'), ('FLORENT N''DJA'), ('EBROTTIE CHRISTIAN'),
  ('KACOU N''GUESSAN LEONARD'), ('KOUAKOU ISMAEL'), ('Youan mireille'),
  ('SONIA AKON'), ('Malik')
ON CONFLICT (nom) DO NOTHING;

-- ============================================================
-- 4. SEED: routing_data (combinaisons jour/canal/position_order/sales_rep/mdm)
-- ============================================================
-- Recréer la table pour s'assurer que le schéma est à jour
-- Ne pas DROP car déjà créée dans 001b, juste TRUNCATE
TRUNCATE public.routing_data RESTART IDENTITY;

INSERT INTO public.routing_data (jour_routing, canal, position_order, sales_rep, mdm) VALUES
  ('Lundi 1', 'GT', 1, 'CINDY KADIA', 'YAO ANNA AGBRE'),
  ('Lundi 2', 'MT', 2, 'ARMANDE', 'AGBETOU EMMANUEL'),
  ('Lundi 3', 'GT et MT', 3, 'SOUARE IBRAHIMA', 'GAI KAMY HERMANN'),
  ('Lundi 4', NULL, 4, 'GAI KAMY', NULL),
  ('Mardi 1', NULL, 5, 'OPHELIIA', NULL),
  ('Mardi 2', NULL, 6, 'RACHID', NULL),
  ('Mardi 3', NULL, 7, 'MURIELLE', NULL),
  ('Mardi 4', NULL, 8, 'GUE HERMAN', NULL),
  ('Mercredi 1', NULL, 9, 'ASSAMOI TRESOR', NULL),
  ('Mercredi 2', NULL, 10, 'COULIBALY PADIE', NULL),
  ('Mercredi 3', NULL, 11, 'OUATTARA ZANGA', NULL),
  ('Mercredi 4', NULL, 12, 'NOUHOUN SINWINDE', NULL),
  ('Jeudi 1', NULL, 13, 'FLORENT N''DJA', NULL),
  ('Jeudi 2', NULL, 14, 'EBROTTIE CHRISTIAN', NULL),
  ('Jeudi 3', NULL, 15, 'KACOU N''GUESSAN LEONARD', NULL);

-- ============================================================
-- 5. SEED: zones_secteurs (depuis CSV ZONE SECTEUR - 863 lignes)
-- ============================================================
-- Fonction d'import batch pour zones_secteurs
CREATE OR REPLACE FUNCTION public.import_zone_secteur(
  p_secteur_id INTEGER,
  p_zone TEXT,
  p_secteur TEXT,
  p_merchandiser TEXT,
  p_email TEXT,
  p_sales_rep TEXT,
  p_email_sales_rep TEXT,
  p_region TEXT
) RETURNS void AS $$
BEGIN
  INSERT INTO public.zones_secteurs (id, zone, secteur, merchandiser, email_merchandiser, sales_rep, email_sales_rep, region)
  VALUES (p_secteur_id, p_zone, p_secteur, p_merchandiser, p_email, p_sales_rep, p_email_sales_rep, p_region)
  ON CONFLICT (id) DO UPDATE SET
    zone = EXCLUDED.zone,
    secteur = EXCLUDED.secteur,
    merchandiser = EXCLUDED.merchandiser,
    email_merchandiser = EXCLUDED.email_merchandiser,
    sales_rep = EXCLUDED.sales_rep,
    email_sales_rep = EXCLUDED.email_sales_rep,
    region = EXCLUDED.region;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. FONCTION: import_pdv_from_csv
--    Import massif des PDV depuis le CSV
-- ============================================================
CREATE OR REPLACE FUNCTION public.import_pdv_from_csv(
  p_pdv_id TEXT,
  p_nom_pdv TEXT,
  p_canal TEXT DEFAULT 'General trade',
  p_categorie_pdv TEXT DEFAULT 'Point de vente détail',
  p_sous_categorie_pdv TEXT DEFAULT 'Boutique C',
  p_autre_sous_categorie TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_zone TEXT DEFAULT NULL,
  p_secteur TEXT DEFAULT NULL,
  p_geolocation TEXT DEFAULT NULL,  -- format "lat, lng"
  p_adressage TEXT DEFAULT NULL,
  p_image TEXT DEFAULT NULL,
  p_date TEXT DEFAULT NULL,         -- format DD/MM/YYYY
  p_ajoute_par TEXT DEFAULT NULL,
  p_jour_routing TEXT DEFAULT NULL,
  p_position_routing INTEGER DEFAULT NULL,
  p_canal_routing TEXT DEFAULT NULL,
  p_sales_rep_routing TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_date DATE;
  v_parts TEXT[];
BEGIN
  -- Parse geolocation "lat, lng"
  IF p_geolocation IS NOT NULL AND p_geolocation != '' THEN
    v_parts := string_to_array(replace(p_geolocation, ' ', ''), ',');
    IF array_length(v_parts, 1) = 2 THEN
      v_lat := v_parts[1]::DOUBLE PRECISION;
      v_lng := v_parts[2]::DOUBLE PRECISION;
    END IF;
  END IF;

  -- Parse date DD/MM/YYYY
  IF p_date IS NOT NULL AND p_date != '' THEN
    BEGIN
      v_date := to_date(p_date, 'DD/MM/YYYY');
    EXCEPTION WHEN OTHERS THEN
      v_date := NULL;
    END;
  END IF;

  INSERT INTO public.pdv (
    pdv_id, nom_pdv, canal, categorie_pdv, sous_categorie_pdv,
    autre_sous_categorie, region, zone, secteur,
    geolocation_lat, geolocation_lng, adressage, image_url,
    date_creation, ajoute_par, jour_routing, position_routing,
    canal_routing, sales_rep_routing
  ) VALUES (
    p_pdv_id, p_nom_pdv, p_canal, p_categorie_pdv, p_sous_categorie_pdv,
    NULLIF(p_autre_sous_categorie, ''), p_region, p_zone, p_secteur,
    v_lat, v_lng, p_adressage, p_image,
    v_date, p_ajoute_par, NULLIF(p_jour_routing, ''), p_position_routing,
    NULLIF(p_canal_routing, ''), NULLIF(p_sales_rep_routing, '')
  )
  ON CONFLICT (pdv_id) DO UPDATE SET
    nom_pdv = EXCLUDED.nom_pdv,
    canal = EXCLUDED.canal,
    categorie_pdv = EXCLUDED.categorie_pdv,
    sous_categorie_pdv = EXCLUDED.sous_categorie_pdv,
    autre_sous_categorie = EXCLUDED.autre_sous_categorie,
    region = EXCLUDED.region,
    zone = EXCLUDED.zone,
    secteur = EXCLUDED.secteur,
    geolocation_lat = EXCLUDED.geolocation_lat,
    geolocation_lng = EXCLUDED.geolocation_lng,
    adressage = EXCLUDED.adressage,
    image_url = EXCLUDED.image_url,
    date_creation = EXCLUDED.date_creation,
    ajoute_par = EXCLUDED.ajoute_par,
    jour_routing = EXCLUDED.jour_routing,
    position_routing = EXCLUDED.position_routing,
    canal_routing = EXCLUDED.canal_routing,
    sales_rep_routing = EXCLUDED.sales_rep_routing,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. FONCTION: import_visite_from_csv
--    Import massif des visites depuis le CSV
--    Accepte un JSONB unique pour contourner la limite de 100 args PG
-- ============================================================
CREATE OR REPLACE FUNCTION public.import_visite_from_csv(p_data JSONB)
RETURNS void AS $$
DECLARE
  v_date TIMESTAMPTZ;
  v_visite_data JSONB;
  v_images TEXT[];
  -- Extracted fields
  v_visite_id TEXT;
  v_pdv_id TEXT;
  v_commercial TEXT;
  v_email TEXT;
BEGIN
  v_visite_id := p_data->>'visite_id';
  v_pdv_id := p_data->>'pdv_id';
  v_commercial := p_data->>'commercial';
  v_email := p_data->>'email';

  -- Parse date "DD/MM/YYYY HH24:MI:SS"
  BEGIN
    v_date := to_timestamp(p_data->>'date', 'DD/MM/YYYY HH24:MI:SS');
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_date := to_timestamp(p_data->>'date', 'DD/MM/YYYY');
    EXCEPTION WHEN OTHERS THEN
      v_date := NOW();
    END;
  END;

  -- Build structured JSONB
  v_visite_data := jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object(
        'present', COALESCE((p_data->>'evap_present')::boolean, false),
        'br_gold', COALESCE(p_data->>'evap_br_gold', 'En rupture'),
        'br_160g', COALESCE(p_data->>'evap_br_160g', 'En rupture'),
        'brb_160g', COALESCE(p_data->>'evap_brb_160g', 'En rupture'),
        'br_400g', COALESCE(p_data->>'evap_br_400g', 'En rupture'),
        'brb_400g', COALESCE(p_data->>'evap_brb_400g', 'En rupture'),
        'pearl_400g', COALESCE(p_data->>'evap_pearl_400g', 'En rupture'),
        'prix_respectes', COALESCE((p_data->>'evap_prix')::boolean, false)
      ),
      'imp', jsonb_build_object(
        'present', COALESCE((p_data->>'imp_present')::boolean, false),
        'br_400g', COALESCE(p_data->>'imp_br_400g', 'En rupture'),
        'br_900g', COALESCE(p_data->>'imp_br_900g', 'En rupture'),
        'br_2_5kg', COALESCE(p_data->>'imp_br_2_5kg', 'En rupture'),
        'br_375g', COALESCE(p_data->>'imp_br_375g', 'En rupture'),
        'brb_400g', COALESCE(p_data->>'imp_brb_400g', 'En rupture'),
        'br_20g', COALESCE(p_data->>'imp_br_20g', 'En rupture'),
        'brb_25g', COALESCE(p_data->>'imp_brb_25g', 'En rupture'),
        'brd_15g', COALESCE(p_data->>'imp_brd_15g', 'En rupture'),
        'brd_350g', COALESCE(p_data->>'imp_brd_350g', 'En rupture'),
        'prix_respectes', COALESCE((p_data->>'imp_prix')::boolean, false)
      ),
      'scm', jsonb_build_object(
        'present', COALESCE((p_data->>'scm_present')::boolean, false),
        'br_1kg', COALESCE(p_data->>'scm_br_1kg', 'En rupture'),
        'brb_1kg', COALESCE(p_data->>'scm_brb_1kg', 'En rupture'),
        'brb_397g', COALESCE(p_data->>'scm_brb_397g', 'En rupture'),
        'br_397g', COALESCE(p_data->>'scm_br_397g', 'En rupture'),
        'pearl_1kg', COALESCE(p_data->>'scm_pearl_1kg', 'En rupture'),
        'prix_respectes', COALESCE((p_data->>'scm_prix')::boolean, false)
      ),
      'uht', jsonb_build_object(
        'present', COALESCE((p_data->>'uht_present')::boolean, false),
        'demi_ecreme', COALESCE(p_data->>'uht_demi_ecreme', 'En rupture'),
        'elopack_500ml', COALESCE(p_data->>'uht_elopack_500ml', 'En rupture'),
        'brique_1l', COALESCE(p_data->>'uht_brique_1l', 'En rupture'),
        'prix_respectes', COALESCE((p_data->>'uht_prix')::boolean, false)
      ),
      'cereales', jsonb_build_object(
        'present', COALESCE((p_data->>'cereales_present')::boolean, false),
        'brcv', COALESCE(p_data->>'cereales_brcv', 'En rupture'),
        'brcc', COALESCE(p_data->>'cereales_brcc', 'En rupture'),
        'prix_respectes', COALESCE((p_data->>'cereales_prix')::boolean, false)
      ),
      'yaourt', jsonb_build_object(
        'present', COALESCE((p_data->>'yaourt_present')::boolean, false),
        'br_yogoo_nature_mini_90ml', COALESCE(p_data->>'yaourt_nature_mini', 'En rupture'),
        'br_yogoo_fraise_mini_90ml', COALESCE(p_data->>'yaourt_fraise_mini', 'En rupture'),
        'br_yogoo_fraise_maxi_318ml', COALESCE(p_data->>'yaourt_fraise_maxi', 'En rupture'),
        'br_yogoo_nature_maxi_318ml', COALESCE(p_data->>'yaourt_nature_maxi', 'En rupture'),
        'prix_respectes', COALESCE((p_data->>'yaourt_prix')::boolean, false)
      )
    ),
    'concurrence', jsonb_build_object(
      'presence_concurrents', COALESCE((p_data->>'conc_presence')::boolean, false),
      'evap', jsonb_build_object(
        'present', COALESCE((p_data->>'conc_evap_present')::boolean, false),
        'cowmilk', COALESCE((p_data->>'conc_evap_cowmilk')::boolean, false),
        'nido_150g', COALESCE((p_data->>'conc_evap_nido_150g')::boolean, false),
        'autre', COALESCE((p_data->>'conc_evap_autre')::boolean, false),
        'nom_concurrent', p_data->>'conc_evap_nom'
      ),
      'imp', jsonb_build_object(
        'present', COALESCE((p_data->>'conc_imp_present')::boolean, false),
        'nido', COALESCE((p_data->>'conc_imp_nido')::boolean, false),
        'laity', COALESCE((p_data->>'conc_imp_laity')::boolean, false),
        'top_lait', COALESCE((p_data->>'conc_imp_toplait')::boolean, false),
        'autre', COALESCE((p_data->>'conc_imp_autre')::boolean, false),
        'nom_concurrent', p_data->>'conc_imp_nom'
      ),
      'scm', jsonb_build_object(
        'present', COALESCE((p_data->>'conc_scm_present')::boolean, false),
        'top_saho', COALESCE((p_data->>'conc_scm_topsaho')::boolean, false),
        'autre', COALESCE((p_data->>'conc_scm_autre')::boolean, false),
        'nom_concurrent', p_data->>'conc_scm_nom'
      ),
      'uht', jsonb_build_object(
        'present', COALESCE((p_data->>'conc_uht_present')::boolean, false),
        'candia', COALESCE((p_data->>'conc_uht_candia')::boolean, false),
        'autre', COALESCE((p_data->>'conc_uht_autre')::boolean, false),
        'nom_concurrent', p_data->>'conc_uht_nom'
      )
    ),
    'visibilite', jsonb_build_object(
      'exterieure', jsonb_build_object(
        'presence_visibilite', COALESCE((p_data->>'vis_ext_presence')::boolean, false),
        'photo_branding', p_data->>'vis_ext_photo',
        'full_branding', COALESCE((p_data->>'vis_ext_full_branding')::boolean, false),
        'etat_branding', COALESCE(p_data->>'vis_ext_etat_branding', ''),
        'poster', COALESCE((p_data->>'vis_ext_poster')::boolean, false),
        'etat_poster', COALESCE(p_data->>'vis_ext_etat_poster', ''),
        'panneau_privilege', COALESCE((p_data->>'vis_ext_panneau')::boolean, false),
        'etat_panneau', COALESCE(p_data->>'vis_ext_etat_panneau', ''),
        'sign_board', COALESCE((p_data->>'vis_ext_signboard')::boolean, false),
        'etat_sign_board', COALESCE(p_data->>'vis_ext_etat_signboard', ''),
        'guirlande', COALESCE((p_data->>'vis_ext_guirlande')::boolean, false),
        'etat_guirlande', COALESCE(p_data->>'vis_ext_etat_guirlande', ''),
        'autre_branding', COALESCE((p_data->>'vis_ext_autre')::boolean, false),
        'etat_autre', COALESCE(p_data->>'vis_ext_etat_autre', '')
      ),
      'interieure', jsonb_build_object(
        'presence_visibilite', COALESCE((p_data->>'vis_int_presence')::boolean, false),
        'photo_visibilite', p_data->>'vis_int_photo',
        'hanger', COALESCE((p_data->>'vis_int_hanger')::boolean, false),
        'etat_hanger', COALESCE(p_data->>'vis_int_etat_hanger', ''),
        'tete_gondole', COALESCE((p_data->>'vis_int_tete_gondole')::boolean, false),
        'etat_tete_gondole', COALESCE(p_data->>'vis_int_etat_tete_gondole', ''),
        'maison_bonnet_rouge', COALESCE((p_data->>'vis_int_maison_br')::boolean, false),
        'etat_maison_br', COALESCE(p_data->>'vis_int_etat_maison_br', ''),
        'reglettes', COALESCE((p_data->>'vis_int_reglettes')::boolean, false),
        'etat_reglettes', COALESCE(p_data->>'vis_int_etat_reglettes', ''),
        'zone_chaude', COALESCE((p_data->>'vis_int_zone_chaude')::boolean, false),
        'etat_zone_chaude', COALESCE(p_data->>'vis_int_etat_zone_chaude', ''),
        'produits_frigo', COALESCE((p_data->>'vis_int_frigo')::boolean, false),
        'etat_frigo', COALESCE(p_data->>'vis_int_etat_frigo', ''),
        'presentoirs', COALESCE((p_data->>'vis_int_presentoirs')::boolean, false),
        'etat_presentoirs', COALESCE(p_data->>'vis_int_etat_presentoirs', ''),
        'bacs_pouch', COALESCE((p_data->>'vis_int_bacs')::boolean, false),
        'etat_bacs', COALESCE(p_data->>'vis_int_etat_bacs', ''),
        'autre_gt', COALESCE((p_data->>'vis_int_autre_gt')::boolean, false),
        'etat_autre_gt', COALESCE(p_data->>'vis_int_etat_autre_gt', ''),
        'habillage_rayon', COALESCE((p_data->>'vis_int_habillage')::boolean, false),
        'etat_habillage', COALESCE(p_data->>'vis_int_etat_habillage', ''),
        'merchandising', COALESCE((p_data->>'vis_int_merchandising')::boolean, false),
        'etat_merchandising', COALESCE(p_data->>'vis_int_etat_merchandising', ''),
        'autre_interieure', COALESCE((p_data->>'vis_int_autre')::boolean, false),
        'etat_autre_int', COALESCE(p_data->>'vis_int_etat_autre', '')
      ),
      'concurrence', jsonb_build_object(
        'presence_visibilite', COALESCE((p_data->>'vis_conc_presence')::boolean, false),
        'nido_exterieur', COALESCE((p_data->>'vis_conc_nido_ext')::boolean, false),
        'nido_interieur', COALESCE((p_data->>'vis_conc_nido_int')::boolean, false),
        'laity_exterieur', COALESCE((p_data->>'vis_conc_laity_ext')::boolean, false),
        'laity_interieur', COALESCE((p_data->>'vis_conc_laity_int')::boolean, false),
        'candia_exterieur', COALESCE((p_data->>'vis_conc_candia_ext')::boolean, false),
        'candia_interieur', COALESCE((p_data->>'vis_conc_candia_int')::boolean, false),
        'autre_exterieur', COALESCE((p_data->>'vis_conc_autre_ext')::boolean, false),
        'nom_concurrent_ext', p_data->>'vis_conc_nom_ext',
        'autre_interieur', COALESCE((p_data->>'vis_conc_autre_int')::boolean, false),
        'nom_concurrent_int', p_data->>'vis_conc_nom_int'
      )
    ),
    'actions', jsonb_build_object(
      'execution_visibilite', COALESCE((p_data->>'act_execution_vis')::boolean, false),
      'referencement_produits', COALESCE((p_data->>'act_referencement')::boolean, false),
      'execution_activites_promotionnelles', COALESCE((p_data->>'act_execution_promo')::boolean, false),
      'prospection_pdv', COALESCE((p_data->>'act_prospection')::boolean, false),
      'verification_fifo', COALESCE((p_data->>'act_fifo')::boolean, false),
      'rangement_produits', COALESCE((p_data->>'act_rangement')::boolean, false),
      'pose_affiches', COALESCE((p_data->>'act_affiches')::boolean, false),
      'pose_materiel_visibilite', COALESCE((p_data->>'act_materiel_vis')::boolean, false)
    )
  );

  -- Collect images
  v_images := ARRAY[]::TEXT[];
  IF p_data->>'vis_ext_photo' IS NOT NULL AND p_data->>'vis_ext_photo' != '' THEN
    v_images := array_append(v_images, p_data->>'vis_ext_photo');
  END IF;
  IF p_data->>'vis_int_photo' IS NOT NULL AND p_data->>'vis_int_photo' != '' THEN
    v_images := array_append(v_images, p_data->>'vis_int_photo');
  END IF;
  IF p_data->>'image' IS NOT NULL AND p_data->>'image' != '' THEN
    v_images := array_append(v_images, p_data->>'image');
  END IF;

  -- Auto-create PDV if it doesn't exist (placeholder with pdv_id)
  INSERT INTO public.pdv (pdv_id, nom_pdv)
  VALUES (v_pdv_id, 'PDV ' || v_pdv_id)
  ON CONFLICT (pdv_id) DO NOTHING;

  INSERT INTO public.visites (
    visite_id, pdv_id, date_visite, commercial, email,
    data, image_urls, sync_status
  ) VALUES (
    v_visite_id, v_pdv_id, v_date, v_commercial, v_email,
    v_visite_data, v_images, 'synced'
  )
  ON CONFLICT (visite_id) DO UPDATE SET
    pdv_id = EXCLUDED.pdv_id,
    date_visite = EXCLUDED.date_visite,
    commercial = EXCLUDED.commercial,
    email = EXCLUDED.email,
    data = EXCLUDED.data,
    image_urls = EXCLUDED.image_urls,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. RLS pour nouvelles tables lookup
-- ============================================================
ALTER TABLE public.jours_routing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canaux_routing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_reps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN DROP POLICY IF EXISTS "jours_routing_select" ON public.jours_routing; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "jours_routing_admin" ON public.jours_routing; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "canaux_routing_select" ON public.canaux_routing; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "canaux_routing_admin" ON public.canaux_routing; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "sales_reps_select" ON public.sales_reps; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "sales_reps_admin" ON public.sales_reps; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "jours_routing_select" ON public.jours_routing FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "jours_routing_admin" ON public.jours_routing FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "canaux_routing_select" ON public.canaux_routing FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "canaux_routing_admin" ON public.canaux_routing FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "sales_reps_select" ON public.sales_reps FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "sales_reps_admin" ON public.sales_reps FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 9. VUES additionnelles pour visites détaillées
-- ============================================================

-- Vue: visites avec info produits dénormalisées
CREATE OR REPLACE VIEW public.v_visites_detail AS
SELECT
  v.id,
  v.visite_id,
  v.pdv_id,
  v.date_visite,
  v.commercial,
  v.email,
  p.nom_pdv,
  p.canal,
  p.zone,
  p.secteur,
  p.region,
  p.categorie_pdv,
  -- EVAP
  (v.data->'produits'->'evap'->>'present')::boolean AS evap_present,
  (v.data->'produits'->'evap'->>'prix_respectes')::boolean AS evap_prix_ok,
  -- IMP
  (v.data->'produits'->'imp'->>'present')::boolean AS imp_present,
  (v.data->'produits'->'imp'->>'prix_respectes')::boolean AS imp_prix_ok,
  -- SCM
  (v.data->'produits'->'scm'->>'present')::boolean AS scm_present,
  (v.data->'produits'->'scm'->>'prix_respectes')::boolean AS scm_prix_ok,
  -- UHT
  (v.data->'produits'->'uht'->>'present')::boolean AS uht_present,
  (v.data->'produits'->'uht'->>'prix_respectes')::boolean AS uht_prix_ok,
  -- Céréales
  (v.data->'produits'->'cereales'->>'present')::boolean AS cereales_present,
  -- Yaourt
  (v.data->'produits'->'yaourt'->>'present')::boolean AS yaourt_present,
  -- Concurrence
  (v.data->'concurrence'->>'presence_concurrents')::boolean AS concurrence_presente,
  -- Visibilité
  (v.data->'visibilite'->'exterieure'->>'presence_visibilite')::boolean AS vis_ext_presente,
  (v.data->'visibilite'->'interieure'->>'presence_visibilite')::boolean AS vis_int_presente,
  -- Actions
  (v.data->'actions'->>'referencement_produits')::boolean AS act_referencement,
  (v.data->'actions'->>'verification_fifo')::boolean AS act_fifo,
  (v.data->'actions'->>'rangement_produits')::boolean AS act_rangement,
  v.image_urls,
  v.created_at
FROM public.visites v
LEFT JOIN public.pdv p ON p.pdv_id = v.pdv_id;

-- Vue: stats par zone/secteur
CREATE OR REPLACE VIEW public.v_stats_zone_secteur AS
SELECT
  p.region,
  p.zone,
  p.secteur,
  COUNT(DISTINCT p.pdv_id) AS total_pdv,
  COUNT(DISTINCT v.visite_id) AS total_visites,
  COUNT(DISTINCT v.commercial) AS nb_commerciaux,
  ROUND(100.0 * COUNT(DISTINCT v.pdv_id) / NULLIF(COUNT(DISTINCT p.pdv_id), 0), 1) AS taux_couverture,
  MAX(v.date_visite) AS derniere_visite
FROM public.pdv p
LEFT JOIN public.visites v ON v.pdv_id = p.pdv_id
GROUP BY p.region, p.zone, p.secteur
ORDER BY p.region, p.zone, p.secteur;

-- Vue: stats disponibilité produits par zone
CREATE OR REPLACE VIEW public.v_dispo_produits_zone AS
SELECT
  p.zone,
  COUNT(*) AS total_visites,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (v.data->'produits'->'evap'->>'present')::boolean) / NULLIF(COUNT(*), 0), 1) AS taux_evap,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (v.data->'produits'->'imp'->>'present')::boolean) / NULLIF(COUNT(*), 0), 1) AS taux_imp,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (v.data->'produits'->'scm'->>'present')::boolean) / NULLIF(COUNT(*), 0), 1) AS taux_scm,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (v.data->'produits'->'uht'->>'present')::boolean) / NULLIF(COUNT(*), 0), 1) AS taux_uht,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (v.data->'produits'->'yaourt'->>'present')::boolean) / NULLIF(COUNT(*), 0), 1) AS taux_yaourt,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (v.data->'concurrence'->>'presence_concurrents')::boolean) / NULLIF(COUNT(*), 0), 1) AS taux_concurrence
FROM public.visites v
JOIN public.pdv p ON p.pdv_id = v.pdv_id
GROUP BY p.zone
ORDER BY p.zone;
