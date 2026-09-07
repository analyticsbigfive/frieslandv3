-- ============================================================================
-- LOT 6 (1.0.4) : CATÉGORIES DE RELEVÉ DÉSACTIVABLES + CONCURRENCE PAR SKU
-- Sources : demandes client du 7 septembre 2026 (retrait yaourt/céréales,
-- fichier « Competitors list IMP EVAP - Présence.xlsx »).
--
-- Règle du lot : AUCUNE suppression en base. Cette migration n'écrit que du
-- schéma, du seed et des politiques. Tout retrait se fait depuis l'admin.
--
-- 1) categorie_releve
--    Les catégories du relevé produit (evap, imp, scm, uht, yaourt, cereales)
--    n'existaient qu'en front (utils/products.ts). Le client veut pouvoir en
--    retirer une sans redéploiement : elles deviennent un paramètre. Le code
--    est structurel dans visites.data.produits.<code> — pas de delete, on
--    désactive. Yaourt et céréales sont livrés désactivés.
--
-- 2) marque_concurrente_sku
--    Le fichier client liste des SKU (marque + grammage), pas des marques.
--    Le relevé passe au niveau SKU sous data.concurrence.<famille>.skus.<code>.
--    Les marques existantes et leur clé JSONB sont conservées : la marque est
--    dérivée « Présent » dès qu'un de ses SKU l'est.
--    `code` est figé à la création (même raison que marque_concurrente.code).
--
-- Idempotent. Additif.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1) Catégories de relevé
-- ---------------------------------------------------------------------------
create table if not exists categorie_releve (
  code    text primary key
          check (code in ('evap','imp','scm','uht','yaourt','cereales')),
  libelle text not null,
  actif   boolean not null default true,
  ordre   integer not null default 0
);

comment on table categorie_releve is
  'Catégories du relevé produit du formulaire de visite. actif=false retire la catégorie du wizard mobile, des onglets et récaps admin, sans toucher aux visites historiques.';
comment on column categorie_releve.code is
  'Clé JSONB sous visites.data.produits.<code>. Structurelle : jamais supprimée, seulement désactivée.';

alter table categorie_releve enable row level security;
drop policy if exists categorie_releve_read on categorie_releve;
create policy categorie_releve_read on categorie_releve
  for select to authenticated using (true);
drop policy if exists categorie_releve_write on categorie_releve;
create policy categorie_releve_write on categorie_releve
  for all to authenticated
  using (est_gestionnaire_perfect_store())
  with check (est_gestionnaire_perfect_store());

insert into categorie_releve (code, libelle, actif, ordre) values
  ('evap',     'EVAP',     true,  1),
  ('imp',      'IMP',      true,  2),
  ('scm',      'SCM',      true,  3),
  ('uht',      'UHT',      true,  4),
  ('yaourt',   'Yaourt',   false, 5),
  ('cereales', 'Céréales', false, 6)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 2) SKU concurrents
-- ---------------------------------------------------------------------------
create table if not exists marque_concurrente_sku (
  id          uuid primary key default gen_random_uuid(),
  marque_id   uuid not null references marque_concurrente(id) on delete cascade,
  -- Clé JSONB sous data.concurrence.<famille>.skus.<code>. Figée à la création.
  code        text not null,
  libelle     text not null,
  grammage_g  integer,
  format      text,
  colisage    integer,
  image_url   text,
  actif       boolean not null default true,
  ordre       integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (marque_id, code)
);

comment on table marque_concurrente_sku is
  'SKU concurrents suivis (marque + grammage), source fichier client du 7 sept. 2026. Relevés sous visites.data.concurrence.<famille>.skus.<code>.';
comment on column marque_concurrente_sku.code is
  'Clé JSONB du statut. Figée à la création — en changer orphelinerait les relevés existants.';
comment on column marque_concurrente_sku.image_url is
  'Photo du SKU (bucket visite-images). Nulle tant que le client n''a pas fourni les visuels.';

create index if not exists marque_concurrente_sku_marque_idx
  on marque_concurrente_sku (marque_id, ordre);

alter table marque_concurrente_sku enable row level security;
drop policy if exists marque_concurrente_sku_read on marque_concurrente_sku;
create policy marque_concurrente_sku_read on marque_concurrente_sku
  for select to authenticated using (true);
drop policy if exists marque_concurrente_sku_write on marque_concurrente_sku;
create policy marque_concurrente_sku_write on marque_concurrente_sku
  for all to authenticated
  using (est_gestionnaire_perfect_store())
  with check (est_gestionnaire_perfect_store());

-- Marques manquantes au niveau marque (liste Présence du fichier).
-- nido_150g (EVAP) n'est pas dans la liste Présence mais figure dans l'onglet
-- IVC Evap : conservée.
insert into marque_concurrente (famille, code, nom, ordre) values
  ('evap', 'laity',   'Laity',   3),
  ('evap', 'soleil',  'Soleil',  4),
  ('imp',  'biblos',  'Biblos',  4),
  ('imp',  'captain', 'Captain', 5)
on conflict (famille, code) do nothing;

-- 19 SKU de la liste Présence (Laity 150 g dédoublonné). Format et colisage
-- repris des onglets IVC quand ils existent.
insert into marque_concurrente_sku (marque_id, code, libelle, grammage_g, format, colisage, ordre)
select m.id, v.code, v.libelle, v.grammage_g, v.format, v.colisage, v.ordre
from (values
  -- EVAP
  ('evap', 'cowmilk',  'cowmilk_160g',   'Cowmilk 160g',            160,  'Boîte',  48,   1),
  ('evap', 'laity',    'laity_150g',     'Laity 150g',              150,  'Boîte',  24,   1),
  ('evap', 'soleil',   'soleil_400g',    'Soleil 400g',             400,  'Boîte',  null, 1),
  -- IMP — Nido
  ('imp',  'nido',     'nido_15g',       'Nido 15g',                15,   'Sachet', 120,  1),
  ('imp',  'nido',     'nido_350g',      'Nido 350g',               350,  'Pouch',  null, 2),
  ('imp',  'nido',     'nido_400g',      'Nido 400g',               400,  'Boîte',  24,   3),
  ('imp',  'nido',     'nido_800g',      'Nido 800g',               800,  'Boîte',  null, 4),
  ('imp',  'nido',     'nido_2500g',     'Nido 2500g',              2500, 'Boîte',  6,    5),
  -- IMP — Top lait
  ('imp',  'top_lait', 'top_lait_12g',   'Top lait 12g',            12,   'Sachet', null, 1),
  ('imp',  'top_lait', 'top_lait_400g',  'Top lait 400g',           400,  'Boîte',  null, 2),
  -- IMP — Laity
  ('imp',  'laity',    'laity_18g',      'Laity 18g',               18,   'Sachet', 120,  1),
  ('imp',  'laity',    'laity_360g',     'Laity 360g',              360,  'Pouch',  6,    2),
  ('imp',  'laity',    'laity_400g',     'Laity 400g',              400,  'Boîte',  null, 3),
  ('imp',  'laity',    'laity_900g',     'Laity 900g',              900,  'Boîte',  null, 4),
  -- IMP — Biblos
  ('imp',  'biblos',   'biblos_16g',     'Biblos FC 16g',           16,   'Sachet', 120,  1),
  ('imp',  'biblos',   'biblos_360g',    'Biblos Full Cream 360g',  360,  'Pouch',  6,    2),
  ('imp',  'biblos',   'biblos_900g',    'Biblos Fat Filled 900g',  900,  'Boîte',  20,   3),
  -- IMP — Captain
  ('imp',  'captain',  'captain_12g',    'Captain 12g',             12,   'Sachet', null, 1),
  ('imp',  'captain',  'captain_22g',    'Captain 22g',             22,   'Sachet', 120,  2)
) as v(famille, marque_code, code, libelle, grammage_g, format, colisage, ordre)
join marque_concurrente m on m.famille = v.famille and m.code = v.marque_code
on conflict (marque_id, code) do nothing;

commit;
