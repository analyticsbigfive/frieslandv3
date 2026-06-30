-- ============================================================================
-- PATCH 6b/N : complète correspondance_reference (IMP)
-- Comble le TODO de 20260630120500_friesland_pont_releves.sql :
--   IMP : clé JSONB 'br_400g' (label "BR 2") -> référence 'BR tin 2500g'.
-- Dépend de 20260630120300 (reference_produit) et 20260630120500 (correspondance_reference).
-- Idempotent (on conflict do nothing). À exécuter dans le SQL Editor Supabase.
-- ============================================================================
begin;

insert into correspondance_reference(reference_produit_id, categorie_jsonb, sku_key)
select rp.id, v.cat, v.sku from (values
  ('imp', 'br_400g', 'BR tin 2500g')   -- "BR 2" : seule correspondance IMP encore manquante
) as v(cat, sku, nom)
join reference_produit rp on rp.nom = v.nom
on conflict (categorie_jsonb, sku_key) do nothing;

-- RESTE NON MAPPABLE (aucune référence dans le référentiel — ne PAS forcer) :
--   IMP : clés brb_25g / brb_400g (gamme BRB en IMP : pas de réf IMP correspondante).
--   SCM : clés brb_1kg / br_397g / brb_397g (pas de réf SCM correspondante).
-- => signalés par diagnostic_correspondance_references.sql, à arbitrer côté Friesland
--    (soit créer la référence produit, soit confirmer que la clé est hors-scope).

commit;
