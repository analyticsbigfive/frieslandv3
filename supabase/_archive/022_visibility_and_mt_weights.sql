-- LEGACY (Système A) — remplacé par supabase/nouveau (Système B) le 2026-06-30. Ne plus modifier.
-- ============================================================
-- 022_visibility_and_mt_weights.sql
-- Issu du .xlsx NATIF (openpyxl, vraie structure 2D) :
--   1) Matrice de visibilité réelle par niveau (BOUTIQUE, MINI MARKET, KIOSQUE)
--   2) Poids OSA MT manquants (IMP MT, SCM MT) — cluster DIVISION (seul à porter le TAUX REVU)
-- À exécuter après 021. SUPERETTE(fichier) -> MINI MARKET (nom DB pos_standard_map).
-- ============================================================

-- (1) Visibilité — réapplique la matrice source pour ces 3 groupes (écrase l'existant).
DELETE FROM public.visibility_standards WHERE standard_group IN ('BOUTIQUE','MINI MARKET','KIOSQUE');
INSERT INTO public.visibility_standards (standard_group, ps_tier, zone, element_key, is_required) VALUES
  ('BOUTIQUE', 'FLAGSHIP', 'exterieure', 'poster', true),
  ('BOUTIQUE', 'FLAGSHIP', 'exterieure', 'guirlande', true),
  ('BOUTIQUE', 'FLAGSHIP', 'exterieure', 'sign_board', true),
  ('BOUTIQUE', 'FLAGSHIP', 'exterieure', 'panneau_privilege', true),
  ('BOUTIQUE', 'FLAGSHIP', 'exterieure', 'full_branding', true),
  ('BOUTIQUE', 'FLAGSHIP', 'interieure', 'reglettes', true),
  ('BOUTIQUE', 'FLAGSHIP', 'interieure', 'maison_bonnet_rouge', true),
  ('BOUTIQUE', 'FLAGSHIP', 'interieure', 'hanger', true),
  ('BOUTIQUE', 'FLAGSHIP', 'interieure', 'presentoirs', true),
  ('BOUTIQUE', 'FLAGSHIP', 'interieure', 'tete_gondole', true),
  ('BOUTIQUE', 'FLAGSHIP', 'interieure', 'merchandising', true),
  ('BOUTIQUE', 'VIP', 'exterieure', 'poster', true),
  ('BOUTIQUE', 'VIP', 'exterieure', 'guirlande', true),
  ('BOUTIQUE', 'VIP', 'exterieure', 'sign_board', true),
  ('BOUTIQUE', 'VIP', 'exterieure', 'panneau_privilege', true),
  ('BOUTIQUE', 'VIP', 'interieure', 'reglettes', true),
  ('BOUTIQUE', 'VIP', 'interieure', 'maison_bonnet_rouge', true),
  ('BOUTIQUE', 'VIP', 'interieure', 'hanger', true),
  ('BOUTIQUE', 'VIP', 'interieure', 'presentoirs', true),
  ('BOUTIQUE', 'VIP', 'interieure', 'tete_gondole', true),
  ('BOUTIQUE', 'VIP', 'interieure', 'merchandising', true),
  ('BOUTIQUE', 'CORE', 'exterieure', 'poster', true),
  ('BOUTIQUE', 'CORE', 'exterieure', 'guirlande', true),
  ('BOUTIQUE', 'CORE', 'exterieure', 'sign_board', true),
  ('BOUTIQUE', 'CORE', 'interieure', 'reglettes', true),
  ('BOUTIQUE', 'CORE', 'interieure', 'maison_bonnet_rouge', true),
  ('BOUTIQUE', 'CORE', 'interieure', 'hanger', true),
  ('BOUTIQUE', 'CORE', 'interieure', 'merchandising', true),
  ('BOUTIQUE', 'BASIC', 'exterieure', 'poster', true),
  ('BOUTIQUE', 'BASIC', 'exterieure', 'guirlande', true),
  ('BOUTIQUE', 'BASIC', 'interieure', 'reglettes', true),
  ('BOUTIQUE', 'BASIC', 'interieure', 'maison_bonnet_rouge', true),
  ('BOUTIQUE', 'BASIC', 'interieure', 'hanger', true),
  ('BOUTIQUE', 'BASIC', 'interieure', 'merchandising', true),
  ('MINI MARKET', 'FLAGSHIP', 'exterieure', 'poster', true),
  ('MINI MARKET', 'FLAGSHIP', 'exterieure', 'sign_board', true),
  ('MINI MARKET', 'FLAGSHIP', 'exterieure', 'panneau_privilege', true),
  ('MINI MARKET', 'FLAGSHIP', 'interieure', 'reglettes', true),
  ('MINI MARKET', 'FLAGSHIP', 'interieure', 'maison_bonnet_rouge', true),
  ('MINI MARKET', 'FLAGSHIP', 'exterieure', 'guirlande', true),
  ('MINI MARKET', 'FLAGSHIP', 'interieure', 'presentoirs', true),
  ('MINI MARKET', 'FLAGSHIP', 'interieure', 'tete_gondole', true),
  ('MINI MARKET', 'FLAGSHIP', 'interieure', 'merchandising', true),
  ('MINI MARKET', 'VIP', 'exterieure', 'poster', true),
  ('MINI MARKET', 'VIP', 'exterieure', 'sign_board', true),
  ('MINI MARKET', 'VIP', 'exterieure', 'panneau_privilege', true),
  ('MINI MARKET', 'VIP', 'interieure', 'reglettes', true),
  ('MINI MARKET', 'VIP', 'interieure', 'maison_bonnet_rouge', true),
  ('MINI MARKET', 'VIP', 'exterieure', 'guirlande', true),
  ('MINI MARKET', 'VIP', 'interieure', 'presentoirs', true),
  ('MINI MARKET', 'VIP', 'interieure', 'tete_gondole', true),
  ('MINI MARKET', 'VIP', 'interieure', 'merchandising', true),
  ('MINI MARKET', 'CORE', 'exterieure', 'poster', true),
  ('MINI MARKET', 'CORE', 'interieure', 'reglettes', true),
  ('MINI MARKET', 'CORE', 'interieure', 'maison_bonnet_rouge', true),
  ('MINI MARKET', 'CORE', 'exterieure', 'guirlande', true),
  ('MINI MARKET', 'CORE', 'interieure', 'merchandising', true),
  ('MINI MARKET', 'BASIC', 'exterieure', 'poster', true),
  ('MINI MARKET', 'BASIC', 'interieure', 'reglettes', true),
  ('MINI MARKET', 'BASIC', 'interieure', 'maison_bonnet_rouge', true),
  ('MINI MARKET', 'BASIC', 'exterieure', 'guirlande', true),
  ('MINI MARKET', 'BASIC', 'interieure', 'merchandising', true),
  ('KIOSQUE', 'FLAGSHIP', 'exterieure', 'poster', true),
  ('KIOSQUE', 'FLAGSHIP', 'interieure', 'maison_bonnet_rouge', true),
  ('KIOSQUE', 'FLAGSHIP', 'exterieure', 'full_branding', true),
  ('KIOSQUE', 'VIP', 'interieure', 'maison_bonnet_rouge', true),
  ('KIOSQUE', 'CORE', 'interieure', 'maison_bonnet_rouge', true)
ON CONFLICT (standard_group, ps_tier, zone, element_key) DO NOTHING;

-- (2) Poids OSA MT (cluster DIVISION). Mapping label->SKU aligné sur 021/013_016.
--     Ignorés (pas de clé catalogue) : imp BR 2500g, imp Delice 350g
INSERT INTO public.availability_weights (category, trade_type, basis, sku, weight) VALUES
  ('imp', 'MT', 'taux_vente', 'br_20g', 0.5754),
  ('imp', 'MT', 'taux_revu', 'br_20g', 0.25),
  ('imp', 'MT', 'taux_vente', 'br_375g', 0.2401),
  ('imp', 'MT', 'taux_revu', 'br_375g', 0.16),
  ('imp', 'MT', 'taux_vente', 'brd_15g', 0.0786),
  ('imp', 'MT', 'taux_revu', 'brd_15g', 0.15),
  ('imp', 'MT', 'taux_vente', 'br_900g', 0.0231),
  ('imp', 'MT', 'taux_revu', 'br_900g', 0.15),
  ('imp', 'MT', 'taux_vente', 'br_2_5kg', 0.0138),
  ('imp', 'MT', 'taux_revu', 'br_2_5kg', 0.12),
  ('scm', 'MT', 'taux_vente', 'pearl_1kg', 0.0247),
  ('scm', 'MT', 'taux_revu', 'pearl_1kg', 0.3),
  ('scm', 'MT', 'taux_vente', 'br_1kg', 0.775),
  ('scm', 'MT', 'taux_revu', 'br_1kg', 0.7),
  ('scm', 'MT', 'taux_vente', 'br_397g', 0.074),
  ('scm', 'MT', 'taux_vente', 'brb_1kg', 0.1263)
ON CONFLICT (category, trade_type, basis, sku) DO NOTHING;

-- FIN 022
