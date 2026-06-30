-- ============================================================================
-- Migration 6/N : PONT entre les relevés terrain et le référentiel
-- Les relevés sont dans visites.data (JSONB) avec des clés internes (ex. br_160g) ;
-- le référentiel utilise reference_produit.nom (ex. 'BR 150g'). Ces deux mondes ne
-- joignent pas directement : on crée ici les tables de correspondance.
-- Dépend des migrations 2 (type_pdv) et 4 (reference_produit).
-- ============================================================================
begin;

-- Clé JSONB (categorie + sku) -> référence du référentiel.
-- categorie_jsonb = clé sous visites.data.produits (evap|imp|scm) ; sku_key = clé sous .quantites.
create table if not exists correspondance_reference (
  reference_produit_id bigint not null references reference_produit(id) on delete cascade,
  categorie_jsonb      text   not null,        -- evap | imp | scm
  sku_key              text   not null,        -- ex. br_160g (cf. utils/products.ts)
  primary key (categorie_jsonb, sku_key)
);

-- Segment + grade d'un type de PDV (niveau 4), pour retrouver le seuil de disponibilité.
-- Le segment doit correspondre à seuil_disponibilite.segment ; le grade au suffixe A/B/C.
create table if not exists segment_grade_type_pdv (
  type_pdv_id bigint not null references type_pdv(id) on delete cascade,
  segment     text   not null,                 -- Boutique | Minimarket | Kiosque | Aboki | Pushcart | TableTop | Porridge
  grade       text   not null check (grade in ('A','B','C')),
  primary key (type_pdv_id)
);

-- --- Correspondance clé JSONB -> référence (join par nom du référentiel) ---
-- EVAP : mapping complet et sûr.
-- IMP/SCM : seules les correspondances non ambiguës sont posées. Les libellés IMP de
--           utils/products.ts sont incohérents (cf. -- TODO ci-dessous) -> à compléter.
insert into correspondance_reference(reference_produit_id, categorie_jsonb, sku_key)
select rp.id, v.cat, v.sku from (values
  -- EVAP (6/6)
  ('evap','br_gold',   'BR Gold 160g'),
  ('evap','br_160g',   'BR 150g'),
  ('evap','brb_160g',  'BRB 150g'),
  ('evap','br_400g',   'BR 380g'),
  ('evap','brb_400g',  'BRB 380g'),
  ('evap','pearl_400g','Pearl 380g'),
  -- IMP (correspondances sûres)
  ('imp','br_20g',  'BR 15g'),            -- label "BR 15g"
  ('imp','brd_15g', 'BR Délice 15g'),     -- label "BRD 15g"
  ('imp','br_375g', 'BR Pouch 360g'),     -- label "BR 360g"
  ('imp','br_900g', 'BR tin 400g'),       -- label "BR 400g Tin"
  ('imp','br_2_5kg','BR tin 900g'),       -- label "BR 900g Tin"
  ('imp','brd_350g','BR Delice Pouch 350g'), -- clé présente dans le JSONB historique, absente de utils/products.ts
  -- SCM (correspondances sûres)
  ('scm','br_1kg',   'BR 1kg'),
  ('scm','pearl_1kg','Pearl 1kg')
) as v(cat, sku, nom)
join reference_produit rp on rp.nom = v.nom
on conflict (categorie_jsonb, sku_key) do nothing;

-- TODO confirmer client (correspondances ambiguës, non posées) :
--   IMP : 'BR tin 2500g' (réf) vs clé br_400g (label "BR 2", ambigu) ; clés brb_25g/brb_400g (BRB) sans réf IMP.
--   SCM : clés brb_1kg / br_397g / brb_397g sans référence dans le référentiel.

-- --- Segment + grade par type de PDV (commerce traditionnel) ---
-- Noms repris à l'identique de la migration 2 (attention 'Boutique  B' = double espace).
insert into segment_grade_type_pdv(type_pdv_id, segment, grade)
select tp.id, v.segment, v.grade from (values
  ('Boutique A',  'Boutique',   'A'),
  ('Boutique  B', 'Boutique',   'B'),
  ('Boutique C',  'Boutique',   'C'),
  ('Superettes A','Minimarket', 'A'),
  ('Superettes B','Minimarket', 'B'),
  ('Superettes C','Minimarket', 'C'),
  ('Kiosk A',     'Kiosque',    'A'),
  ('Kiosk B',     'Kiosque',    'B'),
  ('Aboki A',     'Aboki',      'A'),
  ('Aboki B',     'Aboki',      'B'),
  ('Pushcard A',  'Pushcart',   'A'),
  ('Pushcard B',  'Pushcart',   'B'),
  ('Table Top',   'TableTop',   'A'),
  ('Porridge',    'Porridge',   'A')
) as v(nom, segment, grade)
join type_pdv tp on tp.nom = v.nom
on conflict (type_pdv_id) do nothing;

-- TODO confirmer client : segment/grade des types MT (Hypermarket, Supermarket A/B/C, Pharmacy, Bakery…)
--   et lien entre pdv (pdv.categorie_pdv / pdv.sous_categorie_pdv, sans grade) et type_pdv.

commit;
