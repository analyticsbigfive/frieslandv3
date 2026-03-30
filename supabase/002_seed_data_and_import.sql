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
DROP TABLE IF EXISTS public.routing_data CASCADE;
CREATE TABLE IF NOT EXISTS public.routing_data (
  id SERIAL PRIMARY KEY,
  jour_routing TEXT,
  canal TEXT,
  position_order INTEGER,
  sales_rep TEXT,
  mdm TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Réactiver RLS après DROP CASCADE
ALTER TABLE public.routing_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routing_select" ON public.routing_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "routing_manage_admin" ON public.routing_data FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

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
--    Import massif des visites depuis le CSV (gros morceau !)
--    Parse les ~120 colonnes du CSV VISITE en JSONB structuré
-- ============================================================
CREATE OR REPLACE FUNCTION public.import_visite_from_csv(
  p_visite_id TEXT,
  p_pdv_id TEXT,
  p_date TEXT,               -- format DD/MM/YYYY HH24:MI:SS
  p_commercial TEXT,
  p_email TEXT,
  -- EVAP (7 colonnes)
  p_evap_present BOOLEAN DEFAULT FALSE,
  p_evap_br_gold TEXT DEFAULT 'En rupture',
  p_evap_br_160g TEXT DEFAULT 'En rupture',
  p_evap_brb_160g TEXT DEFAULT 'En rupture',
  p_evap_br_400g TEXT DEFAULT 'En rupture',
  p_evap_brb_400g TEXT DEFAULT 'En rupture',
  p_evap_pearl_400g TEXT DEFAULT 'En rupture',
  p_evap_prix BOOLEAN DEFAULT FALSE,
  -- IMP (10 colonnes)
  p_imp_present BOOLEAN DEFAULT FALSE,
  p_imp_br_400g TEXT DEFAULT 'En rupture',
  p_imp_br_900g TEXT DEFAULT 'En rupture',
  p_imp_br_2_5kg TEXT DEFAULT 'En rupture',
  p_imp_br_375g TEXT DEFAULT 'En rupture',
  p_imp_brb_400g TEXT DEFAULT 'En rupture',
  p_imp_br_20g TEXT DEFAULT 'En rupture',
  p_imp_brb_25g TEXT DEFAULT 'En rupture',
  p_imp_prix BOOLEAN DEFAULT FALSE,
  -- SCM (6 colonnes)
  p_scm_present BOOLEAN DEFAULT FALSE,
  p_scm_br_1kg TEXT DEFAULT 'En rupture',
  p_scm_brb_1kg TEXT DEFAULT 'En rupture',
  p_scm_brb_397g TEXT DEFAULT 'En rupture',
  p_scm_br_397g TEXT DEFAULT 'En rupture',
  p_scm_pearl_1kg TEXT DEFAULT 'En rupture',
  p_scm_prix BOOLEAN DEFAULT FALSE,
  -- UHT (3 colonnes)
  p_uht_present BOOLEAN DEFAULT FALSE,
  p_uht_demi_ecreme TEXT DEFAULT 'En rupture',
  p_uht_prix BOOLEAN DEFAULT FALSE,
  -- Céréales (3 colonnes)
  p_cereales_present BOOLEAN DEFAULT FALSE,
  p_cereales_brcv TEXT DEFAULT 'En rupture',
  p_cereales_brcc TEXT DEFAULT 'En rupture',
  p_cereales_prix BOOLEAN DEFAULT FALSE,
  -- Concurrence (tout)
  p_conc_presence BOOLEAN DEFAULT FALSE,
  p_conc_evap_present BOOLEAN DEFAULT FALSE,
  p_conc_evap_cowmilk BOOLEAN DEFAULT FALSE,
  p_conc_evap_autre BOOLEAN DEFAULT FALSE,
  p_conc_evap_nom TEXT DEFAULT NULL,
  p_conc_imp_present BOOLEAN DEFAULT FALSE,
  p_conc_imp_nido BOOLEAN DEFAULT FALSE,
  p_conc_imp_laity BOOLEAN DEFAULT FALSE,
  p_conc_imp_toplait BOOLEAN DEFAULT FALSE,
  p_conc_imp_autre BOOLEAN DEFAULT FALSE,
  p_conc_imp_nom TEXT DEFAULT NULL,
  p_conc_scm_present BOOLEAN DEFAULT FALSE,
  p_conc_scm_topsaho BOOLEAN DEFAULT FALSE,
  p_conc_scm_autre BOOLEAN DEFAULT FALSE,
  p_conc_scm_nom TEXT DEFAULT NULL,
  p_conc_uht_present BOOLEAN DEFAULT FALSE,
  p_conc_uht_candia BOOLEAN DEFAULT FALSE,
  p_conc_uht_autre BOOLEAN DEFAULT FALSE,
  p_conc_uht_nom TEXT DEFAULT NULL,
  -- Visibilité extérieure
  p_vis_ext_presence BOOLEAN DEFAULT FALSE,
  p_vis_ext_photo TEXT DEFAULT NULL,
  p_vis_ext_full_branding BOOLEAN DEFAULT FALSE,
  p_vis_ext_etat_branding TEXT DEFAULT '',
  p_vis_ext_poster BOOLEAN DEFAULT FALSE,
  p_vis_ext_etat_poster TEXT DEFAULT '',
  p_vis_ext_panneau BOOLEAN DEFAULT FALSE,
  p_vis_ext_etat_panneau TEXT DEFAULT '',
  p_vis_ext_signboard BOOLEAN DEFAULT FALSE,
  p_vis_ext_etat_signboard TEXT DEFAULT '',
  p_vis_ext_guirlande BOOLEAN DEFAULT FALSE,
  p_vis_ext_etat_guirlande TEXT DEFAULT '',
  p_vis_ext_autre BOOLEAN DEFAULT FALSE,
  p_vis_ext_etat_autre TEXT DEFAULT '',
  -- Visibilité intérieure
  p_vis_int_presence BOOLEAN DEFAULT FALSE,
  p_vis_int_photo TEXT DEFAULT NULL,
  p_vis_int_hanger BOOLEAN DEFAULT FALSE,
  p_vis_int_etat_hanger TEXT DEFAULT '',
  p_vis_int_tete_gondole BOOLEAN DEFAULT FALSE,
  p_vis_int_etat_tete_gondole TEXT DEFAULT '',
  p_vis_int_maison_br BOOLEAN DEFAULT FALSE,
  p_vis_int_etat_maison_br TEXT DEFAULT '',
  p_vis_int_reglettes BOOLEAN DEFAULT FALSE,
  p_vis_int_etat_reglettes TEXT DEFAULT '',
  p_vis_int_zone_chaude BOOLEAN DEFAULT FALSE,
  p_vis_int_etat_zone_chaude TEXT DEFAULT '',
  p_vis_int_frigo BOOLEAN DEFAULT FALSE,
  p_vis_int_etat_frigo TEXT DEFAULT '',
  p_vis_int_presentoirs BOOLEAN DEFAULT FALSE,
  p_vis_int_etat_presentoirs TEXT DEFAULT '',
  p_vis_int_bacs BOOLEAN DEFAULT FALSE,
  p_vis_int_etat_bacs TEXT DEFAULT '',
  p_vis_int_autre_gt BOOLEAN DEFAULT FALSE,
  p_vis_int_etat_autre_gt TEXT DEFAULT '',
  p_vis_int_habillage BOOLEAN DEFAULT FALSE,
  p_vis_int_etat_habillage TEXT DEFAULT '',
  p_vis_int_merchandising BOOLEAN DEFAULT FALSE,
  p_vis_int_etat_merchandising TEXT DEFAULT '',
  p_vis_int_autre BOOLEAN DEFAULT FALSE,
  p_vis_int_etat_autre TEXT DEFAULT '',
  -- Visibilité concurrence
  p_vis_conc_presence BOOLEAN DEFAULT FALSE,
  p_vis_conc_nido_ext BOOLEAN DEFAULT FALSE,
  p_vis_conc_nido_int BOOLEAN DEFAULT FALSE,
  p_vis_conc_laity_ext BOOLEAN DEFAULT FALSE,
  p_vis_conc_laity_int BOOLEAN DEFAULT FALSE,
  p_vis_conc_candia_ext BOOLEAN DEFAULT FALSE,
  p_vis_conc_candia_int BOOLEAN DEFAULT FALSE,
  p_vis_conc_autre_ext BOOLEAN DEFAULT FALSE,
  p_vis_conc_nom_ext TEXT DEFAULT NULL,
  p_vis_conc_autre_int BOOLEAN DEFAULT FALSE,
  p_vis_conc_nom_int TEXT DEFAULT NULL,
  -- Actions
  p_act_execution_vis BOOLEAN DEFAULT FALSE,
  p_act_referencement BOOLEAN DEFAULT FALSE,
  p_act_execution_promo BOOLEAN DEFAULT FALSE,
  p_act_prospection BOOLEAN DEFAULT FALSE,
  p_act_test BOOLEAN DEFAULT FALSE,
  p_act_fifo BOOLEAN DEFAULT FALSE,
  p_act_rangement BOOLEAN DEFAULT FALSE,
  p_act_affiches BOOLEAN DEFAULT FALSE,
  p_act_materiel_vis BOOLEAN DEFAULT FALSE,
  -- Yaourt (ajouté plus tard)
  p_yaourt_present BOOLEAN DEFAULT FALSE,
  p_yaourt_nature_mini TEXT DEFAULT 'En rupture',
  p_yaourt_fraise_mini TEXT DEFAULT 'En rupture',
  p_yaourt_fraise_maxi TEXT DEFAULT 'En rupture',
  p_yaourt_nature_maxi TEXT DEFAULT 'En rupture',
  p_yaourt_prix BOOLEAN DEFAULT FALSE,
  -- EVAP NIDO 150g concurrent
  p_conc_evap_nido_150g BOOLEAN DEFAULT FALSE,
  -- UHT supplémentaires
  p_uht_elopack_500ml TEXT DEFAULT 'En rupture',
  p_uht_brique_1l TEXT DEFAULT 'En rupture',
  -- IMP supplémentaires
  p_imp_brd_15g TEXT DEFAULT 'En rupture',
  p_imp_brd_350g TEXT DEFAULT 'En rupture',
  -- Image générale
  p_image TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_date TIMESTAMPTZ;
  v_data JSONB;
  v_images TEXT[];
BEGIN
  -- Parse date "DD/MM/YYYY HH24:MI:SS"
  BEGIN
    v_date := to_timestamp(p_date, 'DD/MM/YYYY HH24:MI:SS');
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_date := to_timestamp(p_date, 'DD/MM/YYYY');
    EXCEPTION WHEN OTHERS THEN
      v_date := NOW();
    END;
  END;

  -- Construire le JSONB structuré
  v_data := jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object(
        'present', p_evap_present,
        'br_gold', p_evap_br_gold,
        'br_160g', p_evap_br_160g,
        'brb_160g', p_evap_brb_160g,
        'br_400g', p_evap_br_400g,
        'brb_400g', p_evap_brb_400g,
        'pearl_400g', p_evap_pearl_400g,
        'prix_respectes', p_evap_prix
      ),
      'imp', jsonb_build_object(
        'present', p_imp_present,
        'br_400g', p_imp_br_400g,
        'br_900g', p_imp_br_900g,
        'br_2_5kg', p_imp_br_2_5kg,
        'br_375g', p_imp_br_375g,
        'brb_400g', p_imp_brb_400g,
        'br_20g', p_imp_br_20g,
        'brb_25g', p_imp_brb_25g,
        'brd_15g', p_imp_brd_15g,
        'brd_350g', p_imp_brd_350g,
        'prix_respectes', p_imp_prix
      ),
      'scm', jsonb_build_object(
        'present', p_scm_present,
        'br_1kg', p_scm_br_1kg,
        'brb_1kg', p_scm_brb_1kg,
        'brb_397g', p_scm_brb_397g,
        'br_397g', p_scm_br_397g,
        'pearl_1kg', p_scm_pearl_1kg,
        'prix_respectes', p_scm_prix
      ),
      'uht', jsonb_build_object(
        'present', p_uht_present,
        'demi_ecreme', p_uht_demi_ecreme,
        'elopack_500ml', p_uht_elopack_500ml,
        'brique_1l', p_uht_brique_1l,
        'prix_respectes', p_uht_prix
      ),
      'cereales', jsonb_build_object(
        'present', p_cereales_present,
        'brcv', p_cereales_brcv,
        'brcc', p_cereales_brcc,
        'prix_respectes', p_cereales_prix
      ),
      'yaourt', jsonb_build_object(
        'present', p_yaourt_present,
        'br_yogoo_nature_mini_90ml', p_yaourt_nature_mini,
        'br_yogoo_fraise_mini_90ml', p_yaourt_fraise_mini,
        'br_yogoo_fraise_maxi_318ml', p_yaourt_fraise_maxi,
        'br_yogoo_nature_maxi_318ml', p_yaourt_nature_maxi,
        'prix_respectes', p_yaourt_prix
      )
    ),
    'concurrence', jsonb_build_object(
      'presence_concurrents', p_conc_presence,
      'evap', jsonb_build_object(
        'present', p_conc_evap_present,
        'cowmilk', p_conc_evap_cowmilk,
        'nido_150g', p_conc_evap_nido_150g,
        'autre', p_conc_evap_autre,
        'nom_concurrent', p_conc_evap_nom
      ),
      'imp', jsonb_build_object(
        'present', p_conc_imp_present,
        'nido', p_conc_imp_nido,
        'laity', p_conc_imp_laity,
        'top_lait', p_conc_imp_toplait,
        'autre', p_conc_imp_autre,
        'nom_concurrent', p_conc_imp_nom
      ),
      'scm', jsonb_build_object(
        'present', p_conc_scm_present,
        'top_saho', p_conc_scm_topsaho,
        'autre', p_conc_scm_autre,
        'nom_concurrent', p_conc_scm_nom
      ),
      'uht', jsonb_build_object(
        'present', p_conc_uht_present,
        'candia', p_conc_uht_candia,
        'autre', p_conc_uht_autre,
        'nom_concurrent', p_conc_uht_nom
      )
    ),
    'visibilite', jsonb_build_object(
      'exterieure', jsonb_build_object(
        'presence_visibilite', p_vis_ext_presence,
        'photo_branding', p_vis_ext_photo,
        'full_branding', p_vis_ext_full_branding,
        'etat_branding', p_vis_ext_etat_branding,
        'poster', p_vis_ext_poster,
        'etat_poster', p_vis_ext_etat_poster,
        'panneau_privilege', p_vis_ext_panneau,
        'etat_panneau', p_vis_ext_etat_panneau,
        'sign_board', p_vis_ext_signboard,
        'etat_sign_board', p_vis_ext_etat_signboard,
        'guirlande', p_vis_ext_guirlande,
        'etat_guirlande', p_vis_ext_etat_guirlande,
        'autre_branding', p_vis_ext_autre,
        'etat_autre', p_vis_ext_etat_autre
      ),
      'interieure', jsonb_build_object(
        'presence_visibilite', p_vis_int_presence,
        'photo_visibilite', p_vis_int_photo,
        'hanger', p_vis_int_hanger,
        'etat_hanger', p_vis_int_etat_hanger,
        'tete_gondole', p_vis_int_tete_gondole,
        'etat_tete_gondole', p_vis_int_etat_tete_gondole,
        'maison_bonnet_rouge', p_vis_int_maison_br,
        'etat_maison_br', p_vis_int_etat_maison_br,
        'reglettes', p_vis_int_reglettes,
        'etat_reglettes', p_vis_int_etat_reglettes,
        'zone_chaude', p_vis_int_zone_chaude,
        'etat_zone_chaude', p_vis_int_etat_zone_chaude,
        'produits_frigo', p_vis_int_frigo,
        'etat_frigo', p_vis_int_etat_frigo,
        'presentoirs', p_vis_int_presentoirs,
        'etat_presentoirs', p_vis_int_etat_presentoirs,
        'bacs_pouch', p_vis_int_bacs,
        'etat_bacs', p_vis_int_etat_bacs,
        'autre_gt', p_vis_int_autre_gt,
        'etat_autre_gt', p_vis_int_etat_autre_gt,
        'habillage_rayon', p_vis_int_habillage,
        'etat_habillage', p_vis_int_etat_habillage,
        'merchandising', p_vis_int_merchandising,
        'etat_merchandising', p_vis_int_etat_merchandising,
        'autre_interieure', p_vis_int_autre,
        'etat_autre_int', p_vis_int_etat_autre
      ),
      'concurrence', jsonb_build_object(
        'presence_visibilite', p_vis_conc_presence,
        'nido_exterieur', p_vis_conc_nido_ext,
        'nido_interieur', p_vis_conc_nido_int,
        'laity_exterieur', p_vis_conc_laity_ext,
        'laity_interieur', p_vis_conc_laity_int,
        'candia_exterieur', p_vis_conc_candia_ext,
        'candia_interieur', p_vis_conc_candia_int,
        'autre_exterieur', p_vis_conc_autre_ext,
        'nom_concurrent_ext', p_vis_conc_nom_ext,
        'autre_interieur', p_vis_conc_autre_int,
        'nom_concurrent_int', p_vis_conc_nom_int
      )
    ),
    'actions', jsonb_build_object(
      'execution_visibilite', p_act_execution_vis,
      'referencement_produits', p_act_referencement,
      'execution_activites_promotionnelles', p_act_execution_promo,
      'prospection_pdv', p_act_prospection,
      'verification_fifo', p_act_fifo,
      'rangement_produits', p_act_rangement,
      'pose_affiches', p_act_affiches,
      'pose_materiel_visibilite', p_act_materiel_vis
    )
  );

  -- Collecter les images
  v_images := ARRAY[]::TEXT[];
  IF p_vis_ext_photo IS NOT NULL AND p_vis_ext_photo != '' THEN
    v_images := array_append(v_images, p_vis_ext_photo);
  END IF;
  IF p_vis_int_photo IS NOT NULL AND p_vis_int_photo != '' THEN
    v_images := array_append(v_images, p_vis_int_photo);
  END IF;
  IF p_image IS NOT NULL AND p_image != '' THEN
    v_images := array_append(v_images, p_image);
  END IF;

  INSERT INTO public.visites (
    visite_id, pdv_id, date_visite, commercial, email,
    data, image_urls, sync_status
  ) VALUES (
    p_visite_id, p_pdv_id, v_date, p_commercial, p_email,
    v_data, v_images, 'synced'
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
