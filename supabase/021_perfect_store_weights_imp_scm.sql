-- ============================================================
-- 021_perfect_store_weights_imp_scm.sql
-- Affinage Perfect Store : poids OSA manquants (IMP GT + SCM MT),
-- depuis "BIG FIVE KPI UPDATE vf.xlsx". À exécuter après 013_016.
-- Idempotent (ON CONFLICT DO NOTHING).
--
-- Mapping format(fichier) -> clé SKU : ALIGNÉ sur availability_standards
-- (déjà seedé en 013_016), pour cohérence :
--   BR 15g -> br_20g · BRD 15g/delice 15g -> brd_15g · BR 360g -> br_375g
--   BR 400g Tin -> br_900g · BR 900g Tin -> br_2_5kg
-- SKU du fichier SANS clé catalogue (NON seedés, poids négligeable) :
--   "Delice 350g" (revu .03) et "BR 2500g" (revu .02) -> pas de SKU -> ignorés.
--   La normalisation par Σpoids du scorer absorbe l'écart sans fausser l'OSA.
--
-- TODO (clusters MT ambigus dans le fichier, à valider avant seed) :
--   - IMP MT (taux_vente cluster1/cluster2, taux_revu) : 2 colonnes divergentes.
--   - SCM MT taux_vente : 47/44 vs 2/78/7/13 selon cluster.
-- ============================================================

INSERT INTO public.availability_weights (category, trade_type, basis, sku, weight) VALUES
  -- IMP General Trade — taux de vente
  ('imp','GT','taux_vente','br_20g',0.85),
  ('imp','GT','taux_vente','brd_15g',0.08),
  ('imp','GT','taux_vente','br_375g',0.05),
  ('imp','GT','taux_vente','br_900g',0.002),
  ('imp','GT','taux_vente','br_2_5kg',0.001),
  -- IMP General Trade — taux revu
  ('imp','GT','taux_revu','br_20g',0.76),
  ('imp','GT','taux_revu','brd_15g',0.05),
  ('imp','GT','taux_revu','br_375g',0.07),
  ('imp','GT','taux_revu','br_900g',0.05),
  ('imp','GT','taux_revu','br_2_5kg',0.02),
  -- SCM Modern Trade — taux revu (cluster confirmé : pearl 30% / br 70%)
  ('scm','MT','taux_revu','pearl_1kg',0.30),
  ('scm','MT','taux_revu','br_1kg',0.70)
ON CONFLICT (category, trade_type, basis, sku) DO NOTHING;
