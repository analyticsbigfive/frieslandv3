-- ============================================================================
-- DIAGNOSTIC — santé du pont relevés terrain <-> référentiel (Système B)
-- Read-only (aucun begin/commit, que des SELECT). À lancer dans le SQL Editor.
-- Objectif : zéro ligne dans les sections 1 et 2 pour EVAP/IMP/SCM en GT.
-- Trois familles de trous :
--   1) CLÉ SANS RÉFÉRENCE : un (categorie, sku) saisi sur le terrain (visites.data)
--      n'a pas de ligne dans correspondance_reference -> non compté dans le score.
--   2) RÉFÉRENCE SANS CLÉ : une reference_produit n'est mappée à aucune clé JSONB
--      -> son poids/seuil n'est jamais évalué.
--   3) MAPPING ORPHELIN : une correspondance pointe vers une clé jamais vue dans
--      les données réelles -> mapping probablement mort (faute de frappe, clé obsolète).
-- ============================================================================

-- ── 1) CLÉS DATA SANS CORRESPONDANCE ────────────────────────────────────────
with cles_data as (
  select distinct prod.key as categorie_jsonb, q.key as sku_key
  from visites v
  cross join lateral jsonb_each(coalesce(v.data->'produits', '{}'::jsonb)) as prod(key, val)
  cross join lateral jsonb_object_keys(coalesce(prod.val->'quantites', '{}'::jsonb)) as q(key)
  where prod.key in ('evap', 'imp', 'scm')
)
select '1_cle_sans_reference' as probleme, c.categorie_jsonb, c.sku_key, null::text as reference
from cles_data c
left join correspondance_reference cr
  on cr.categorie_jsonb = c.categorie_jsonb and cr.sku_key = c.sku_key
where cr.sku_key is null
order by c.categorie_jsonb, c.sku_key;

-- ── 2) RÉFÉRENCES SANS CLÉ JSONB ────────────────────────────────────────────
select '2_reference_sans_cle' as probleme, cp.code as categorie_jsonb,
       null::text as sku_key, rp.nom as reference
from reference_produit rp
join categorie_produit cp on cp.id = rp.categorie_produit_id
left join correspondance_reference cr on cr.reference_produit_id = rp.id
where cr.reference_produit_id is null
order by cp.code, rp.nom;

-- ── 3) MAPPINGS ORPHELINS (clé jamais vue dans les données) ─────────────────
select '3_mapping_orphelin' as probleme, cr.categorie_jsonb, cr.sku_key, rp.nom as reference
from correspondance_reference cr
join reference_produit rp on rp.id = cr.reference_produit_id
where not exists (
  select 1 from visites v
  where (v.data->'produits'->cr.categorie_jsonb->'quantites') ? cr.sku_key
)
order by cr.categorie_jsonb, cr.sku_key;
