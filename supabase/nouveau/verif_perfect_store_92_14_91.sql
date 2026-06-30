-- ============================================================================
-- VÉRIFICATION DE BOUT EN BOUT (Système B, Path 1) — doit reproduire 92 / 14 / 91
-- Teste la VRAIE fonction de prod calculer_dispo_categorie() en lui passant
-- directement un blob JSONB au format visites.data (pas besoin de pdv/visite :
-- la fonction lit produits->categorie->quantites->sku_key).
-- Scénario : EVAP, commerce traditionnel GT, segment Boutique, grade A
--            = les 3 profils du fichier source.
-- Read-only. Dépend des migrations 4 (référentiel), 6 (pont) + patch 6b.
-- ⚠️ Remplace l'ancienne version (Path 2, tables transactionnelles supprimées).
-- ============================================================================

with cas(visite, data, attendu) as (values
  -- V1 [BR150g 48, BRB150g 0, BR380g 24, BRB380g 12, GOLD 24, PEARL 24] -> 92
  ('V1', '{"produits":{"evap":{"quantites":{
            "br_160g":48,"brb_160g":0,"br_400g":24,"brb_400g":12,"br_gold":24,"pearl_400g":24}}}}'::jsonb, 92),
  -- V2 [0, 24, 24, 0, 24, 0] (le phare 150g rouge manque) -> 14
  ('V2', '{"produits":{"evap":{"quantites":{
            "br_160g":0,"brb_160g":24,"br_400g":24,"brb_400g":0,"br_gold":24,"pearl_400g":0}}}}'::jsonb, 14),
  -- V3 [48, 0, 24, 0, 24, 24] -> 91
  ('V3', '{"produits":{"evap":{"quantites":{
            "br_160g":48,"brb_160g":0,"br_400g":24,"brb_400g":0,"br_gold":24,"pearl_400g":24}}}}'::jsonb, 91)
)
select
  cas.visite,
  calculer_dispo_categorie(cas.data, 'evap', 'GT', 'Boutique', 'A') as score_obtenu,
  cas.attendu                                                       as score_attendu,
  (calculer_dispo_categorie(cas.data, 'evap', 'GT', 'Boutique', 'A') = cas.attendu) as ok
from cas
order by cas.visite;
