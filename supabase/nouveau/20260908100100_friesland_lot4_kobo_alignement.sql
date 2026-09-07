-- ============================================================================
-- LOT 4 : alignement sur le questionnaire Kobo réel (PDF reçu le 7 sept. 2026)
-- - nom & prénom du vendeur (I_2), sous-type de PDV (I_3, ex. Boutique A,
--   Kiosk B, Bakery C), motif de non-participation à la promo (II_1.3).
-- Les SKU disponibles restent ceux du référentiel reference_produit.
-- Idempotent. Additif.
-- ============================================================================
begin;
alter table public.field_coaching add column if not exists vendeur_nom text;
alter table public.field_coaching add column if not exists type_pdv_detail text;
alter table public.field_coaching add column if not exists motif_non_participation text;
commit;
