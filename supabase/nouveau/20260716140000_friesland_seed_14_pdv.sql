-- ============================================================================
-- SEED : remplace le parc PDV par 14 points de vente de démonstration, chacun
-- lié à un distributeur cohérent avec son territoire, couvrant tous les niveaux
-- Perfect Store (Flagship / VIP / Core / Basic / non conforme) sur GT et MT.
--
-- ⚠️  DESTRUCTIF : vide `visites` puis `pdv` (tout le parc réel inclus).
--     Faire un backup CSV de `pdv` et `visites` AVANT d'exécuter.
--     Décision client validée 2026-07-16 : nettoyage total + distributeurs
--     variés par territoire + format migration SQL.
--
-- Les niveaux sont obtenus en pilotant `data` (quantités vs seuils, standards
-- visibilité vs matrice) : le trigger trg_perfect_store recalcule tout seul.
-- Les gabarits de visibilité reprennent EXACTEMENT ceux de la démo validée
-- (20260630140000) pour garantir le niveau atteint sans recalibrage.
--
-- Idempotent (delete + insert déterministe, on conflict do update).
-- Dépend de 120100..130100 (schéma Perfect Store) + 20260709150000 (MT câblé).
-- Distributeurs référencés : présents via 20260709130000 (territoire_distributeur).
-- ============================================================================
begin;

-- Colonne écrite par le front (PDVQuickCreateModal, stores/pdv.ts) mais jamais
-- créée par une migration -> on la garantit ici (no-op si déjà présente).
alter table pdv add column if not exists distributor_name text;

-- Nettoyage total. Ordre imposé par les FK : resultat_perfect_store est en
-- cascade sur visites ; visites.pdv_id -> pdv(pdv_id) sans cascade.
delete from visites;
delete from pdv;

-- ----------------------------------------------------------------------------
-- 14 PDV : type (level4) pilote le scoring, distributeur cohérent au territoire.
-- ----------------------------------------------------------------------------
insert into pdv(pdv_id, nom_pdv, canal, categorie_pdv, sous_categorie_pdv,
                region, zone, secteur, distributor_name, is_active)
values
  ('PS-001','Boutique Cocody Palmeraie','General trade','Point de vente détail','Boutique A',
   'Abidjan','Cocody 1','PALMERAIE','PRODISMA',true),
  ('PS-002','Superette Treichville Zone 3','General trade','Point de vente détail','Superettes A',
   'Abidjan','Treichville','ZONE 3','SIDECOM',true),
  ('PS-003','Supermarché Bouaké Koko','Modern trade','Point de vente détail','Supermarket A',
   'Intérieur','Bouake 1','KOKO','SODIAMA',true),
  ('PS-004','Boutique Marcory Hibiscus','General trade','Point de vente détail','Boutique B',
   'Abidjan','Marcory','HIBISCUS','SIDECOM',true),
  ('PS-005','Boutique Gagnoa Soleil','General trade','Point de vente détail','Boutique B',
   'Intérieur','Gagnoa 1','SOLEIL','SOMALI-CI',true),
  ('PS-006','Boutique Yamoussoukro Assabou','General trade','Point de vente détail','Boutique B',
   'Intérieur','Yamoussoukro','ASSABOU','UP GROUND SALES & MARKETING',true),
  ('PS-007','Boutique Yopougon Wassakara','General trade','Point de vente détail','Boutique C',
   'Abidjan','Yopougon 1','WASSAKARA','SODICOM-CI',true),
  ('PS-008','Boutique Plateau Centre','General trade','Point de vente détail','Boutique C',
   'Abidjan','Plateau','PLATEAU CENTRE','BOUSSOURA SARL',true),
  ('PS-009','Boutique Korhogo Commerce','General trade','Point de vente détail','Boutique C',
   'Intérieur','Korhogo','COMMERCE','ESF KORHOGO',true),
  ('PS-010','Boutique Daloa Labia','General trade','Point de vente détail','Boutique C',
   'Intérieur','Daloa','LABIA','BON MARCHE',true),
  ('PS-011','Kiosque Bingerville Nouveau Goudron','General trade','Point de vente détail','Kiosk A',
   'Abidjan','Bingerville','NOUVEAU GOUDRON','DYNAMIS',true),
  ('PS-012','Kiosque Man Marché','General trade','Point de vente détail','Kiosk A',
   'Intérieur','Man','MARCHE','ALI BABA CI',true),
  ('PS-013','Boutique Abobo Dokui','General trade','Point de vente détail','Boutique C',
   'Abidjan','Abobo 1','DOKUI','ETABLISSEMENT NIARE & FRERES',true),
  ('PS-014','Supermarché Divo Sokoura','Modern trade','Point de vente détail','Supermarket C',
   'Intérieur','Divo','SOKOURA','RIDACOM',true)
on conflict (pdv_id) do update set
  nom_pdv = excluded.nom_pdv,
  canal = excluded.canal,
  sous_categorie_pdv = excluded.sous_categorie_pdv,
  region = excluded.region,
  zone = excluded.zone,
  secteur = excluded.secteur,
  distributor_name = excluded.distributor_name,
  is_active = true;

-- ----------------------------------------------------------------------------
-- Gabarits de stock (réutilisés). GT boutique/superette/MT = stock plein.
--   evap : br_gold, br_160g, brb_160g, br_400g, brb_400g, pearl_400g
--   imp  : br_20g, brd_15g, br_375g, br_900g, br_2_5kg, brd_350g, br_400g
--   scm  : br_1kg, pearl_1kg
-- Kiosque : seules pearl_400g + pearl_1kg ont un seuil Kiosque.
-- ----------------------------------------------------------------------------

-- === FLAGSHIP (3) ==========================================================

-- PS-001 Boutique A : stock plein + tous standards boutique => FLAGSHIP
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values ('PS-VIS-001','PS-001', now(), 'Démo Commercial', 'demo@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object('br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
      'imp',  jsonb_build_object('quantites', jsonb_build_object('br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
      'scm',  jsonb_build_object('quantites', jsonb_build_object('br_1kg',999,'pearl_1kg',999))),
    'visibilite', jsonb_build_object('promotion_applicable', true, 'standards', jsonb_build_object(
      'affiche',true,'fleche',true,'guirlande',true,'sign_board',true,'panneau_privilege',true,
      'full_branding',true,'reglette',true,'maison_br',true,'hanger',true,'wobler',true,
      'presentoir',true,'tg',true,'plaque_br',true,'merchandising',true,
      'standard',true,'hotesses',true,'degustation',true))),
  'synced')
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- PS-002 Superette A : stock plein + tous standards superette => FLAGSHIP
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values ('PS-VIS-002','PS-002', now(), 'Démo Commercial', 'demo@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object('br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
      'imp',  jsonb_build_object('quantites', jsonb_build_object('br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
      'scm',  jsonb_build_object('quantites', jsonb_build_object('br_1kg',999,'pearl_1kg',999))),
    'visibilite', jsonb_build_object('promotion_applicable', true, 'standards', jsonb_build_object(
      'affiche',true,'fleche',true,'sign_board',true,'panneau_privilege',true,
      'reglette',true,'espace_br',true,'wobler',true,'presentoir',true,'tg',true,
      'plaque_br',true,'merchandising',true,'standard',true,'hotesses',true,'degustation',true))),
  'synced')
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- PS-003 Supermarket A (MT) : stock plein + standards MT (matrice 'mt' :
-- niche/wobler/top_shelf/bacs/reglette/tg + plot/hotesses) => FLAGSHIP MT
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values ('PS-VIS-003','PS-003', now(), 'Démo Commercial', 'demo@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      -- MT : facings renseignés (999) pour satisfaire la règle ET (quantité ET facings).
      'evap', jsonb_build_object(
        'quantites', jsonb_build_object('br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999),
        'facings',   jsonb_build_object('br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
      'imp',  jsonb_build_object(
        'quantites', jsonb_build_object('br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999),
        'facings',   jsonb_build_object('br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
      'scm',  jsonb_build_object(
        'quantites', jsonb_build_object('br_1kg',999,'pearl_1kg',999),
        'facings',   jsonb_build_object('br_1kg',999,'pearl_1kg',999))),
    'visibilite', jsonb_build_object('promotion_applicable', true, 'standards', jsonb_build_object(
      'niche',true,'wobler',true,'top_shelf',true,'bacs',true,'reglette',true,'tg',true,
      'plot',true,'hotesses',true))),
  'synced')
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- === VIP (3) : boutique B, stock plein, full_branding + plaque_br absents ====

-- PS-004
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values ('PS-VIS-004','PS-004', now(), 'Démo Commercial', 'demo@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object('br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
      'imp',  jsonb_build_object('quantites', jsonb_build_object('br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
      'scm',  jsonb_build_object('quantites', jsonb_build_object('br_1kg',999,'pearl_1kg',999))),
    'visibilite', jsonb_build_object('promotion_applicable', true, 'standards', jsonb_build_object(
      'affiche',true,'fleche',true,'guirlande',true,'sign_board',true,'panneau_privilege',true,
      'full_branding',false,'reglette',true,'maison_br',true,'hanger',true,'wobler',true,
      'presentoir',true,'tg',true,'plaque_br',false,'merchandising',true,
      'standard',true,'hotesses',true,'degustation',true))),
  'synced')
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- PS-005
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values ('PS-VIS-005','PS-005', now(), 'Démo Commercial', 'demo@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object('br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
      'imp',  jsonb_build_object('quantites', jsonb_build_object('br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
      'scm',  jsonb_build_object('quantites', jsonb_build_object('br_1kg',999,'pearl_1kg',999))),
    'visibilite', jsonb_build_object('promotion_applicable', true, 'standards', jsonb_build_object(
      'affiche',true,'fleche',true,'guirlande',true,'sign_board',true,'panneau_privilege',true,
      'full_branding',false,'reglette',true,'maison_br',true,'hanger',true,'wobler',true,
      'presentoir',true,'tg',true,'plaque_br',false,'merchandising',true,
      'standard',true,'hotesses',true,'degustation',true))),
  'synced')
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- PS-006
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values ('PS-VIS-006','PS-006', now(), 'Démo Commercial', 'demo@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object('br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
      'imp',  jsonb_build_object('quantites', jsonb_build_object('br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
      'scm',  jsonb_build_object('quantites', jsonb_build_object('br_1kg',999,'pearl_1kg',999))),
    'visibilite', jsonb_build_object('promotion_applicable', true, 'standards', jsonb_build_object(
      'affiche',true,'fleche',true,'guirlande',true,'sign_board',true,'panneau_privilege',true,
      'full_branding',false,'reglette',true,'maison_br',true,'hanger',true,'wobler',true,
      'presentoir',true,'tg',true,'plaque_br',false,'merchandising',true,
      'standard',true,'hotesses',true,'degustation',true))),
  'synced')
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- === CORE (4) : boutique C, stock plein, standards limités au requis Core =====

-- PS-007
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values ('PS-VIS-007','PS-007', now(), 'Démo Commercial', 'demo@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object('br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
      'imp',  jsonb_build_object('quantites', jsonb_build_object('br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
      'scm',  jsonb_build_object('quantites', jsonb_build_object('br_1kg',999,'pearl_1kg',999))),
    'visibilite', jsonb_build_object('promotion_applicable', false, 'standards', jsonb_build_object(
      'affiche',true,'fleche',true,'guirlande',true,'sign_board',true,'panneau_privilege',false,
      'full_branding',false,'reglette',true,'maison_br',true,'hanger',true,'wobler',true,
      'presentoir',false,'tg',false,'plaque_br',false,'merchandising',true,
      'standard',true,'hotesses',false,'degustation',false))),
  'synced')
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- PS-008
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values ('PS-VIS-008','PS-008', now(), 'Démo Commercial', 'demo@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object('br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
      'imp',  jsonb_build_object('quantites', jsonb_build_object('br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
      'scm',  jsonb_build_object('quantites', jsonb_build_object('br_1kg',999,'pearl_1kg',999))),
    'visibilite', jsonb_build_object('promotion_applicable', false, 'standards', jsonb_build_object(
      'affiche',true,'fleche',true,'guirlande',true,'sign_board',true,'panneau_privilege',false,
      'full_branding',false,'reglette',true,'maison_br',true,'hanger',true,'wobler',true,
      'presentoir',false,'tg',false,'plaque_br',false,'merchandising',true,
      'standard',true,'hotesses',false,'degustation',false))),
  'synced')
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- PS-009
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values ('PS-VIS-009','PS-009', now(), 'Démo Commercial', 'demo@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object('br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
      'imp',  jsonb_build_object('quantites', jsonb_build_object('br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
      'scm',  jsonb_build_object('quantites', jsonb_build_object('br_1kg',999,'pearl_1kg',999))),
    'visibilite', jsonb_build_object('promotion_applicable', false, 'standards', jsonb_build_object(
      'affiche',true,'fleche',true,'guirlande',true,'sign_board',true,'panneau_privilege',false,
      'full_branding',false,'reglette',true,'maison_br',true,'hanger',true,'wobler',true,
      'presentoir',false,'tg',false,'plaque_br',false,'merchandising',true,
      'standard',true,'hotesses',false,'degustation',false))),
  'synced')
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- PS-010
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values ('PS-VIS-010','PS-010', now(), 'Démo Commercial', 'demo@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object('br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
      'imp',  jsonb_build_object('quantites', jsonb_build_object('br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
      'scm',  jsonb_build_object('quantites', jsonb_build_object('br_1kg',999,'pearl_1kg',999))),
    'visibilite', jsonb_build_object('promotion_applicable', false, 'standards', jsonb_build_object(
      'affiche',true,'fleche',true,'guirlande',true,'sign_board',true,'panneau_privilege',false,
      'full_branding',false,'reglette',true,'maison_br',true,'hanger',true,'wobler',true,
      'presentoir',false,'tg',false,'plaque_br',false,'merchandising',true,
      'standard',true,'hotesses',false,'degustation',false))),
  'synced')
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- === BASIC (2) : kiosque, stock (réfs à seuil kiosque) mais visibilité nulle ==

-- PS-011
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values ('PS-VIS-011','PS-011', now(), 'Démo Commercial', 'demo@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object('pearl_400g',999)),
      'imp',  jsonb_build_object('quantites', jsonb_build_object()),
      'scm',  jsonb_build_object('quantites', jsonb_build_object('pearl_1kg',999))),
    'visibilite', jsonb_build_object('promotion_applicable', false, 'standards', jsonb_build_object(
      'affiche',false,'thermos',false,'verre',false,'carafe',false,
      'maison_br',false,'chasuble',false,'full_branding',false,'promotion',false))),
  'synced')
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- PS-012
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values ('PS-VIS-012','PS-012', now(), 'Démo Commercial', 'demo@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object('pearl_400g',999)),
      'imp',  jsonb_build_object('quantites', jsonb_build_object()),
      'scm',  jsonb_build_object('quantites', jsonb_build_object('pearl_1kg',999))),
    'visibilite', jsonb_build_object('promotion_applicable', false, 'standards', jsonb_build_object(
      'affiche',false,'thermos',false,'verre',false,'carafe',false,
      'maison_br',false,'chasuble',false,'full_branding',false,'promotion',false))),
  'synced')
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- === NON CONFORME (2) : rien en stock, rien en visibilité (sous Basic) ========

-- PS-013 Boutique C
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values ('PS-VIS-013','PS-013', now(), 'Démo Commercial', 'demo@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object()),
      'imp',  jsonb_build_object('quantites', jsonb_build_object()),
      'scm',  jsonb_build_object('quantites', jsonb_build_object())),
    'visibilite', jsonb_build_object('promotion_applicable', false, 'standards', jsonb_build_object(
      'affiche',false,'fleche',false,'guirlande',false,'sign_board',false,'panneau_privilege',false,
      'full_branding',false,'reglette',false,'maison_br',false,'hanger',false,'wobler',false,
      'presentoir',false,'tg',false,'plaque_br',false,'merchandising',false,
      'standard',false,'hotesses',false,'degustation',false))),
  'synced')
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- PS-014 Supermarket C (MT)
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values ('PS-VIS-014','PS-014', now(), 'Démo Commercial', 'demo@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object()),
      'imp',  jsonb_build_object('quantites', jsonb_build_object()),
      'scm',  jsonb_build_object('quantites', jsonb_build_object())),
    'visibilite', jsonb_build_object('promotion_applicable', false, 'standards', jsonb_build_object(
      'affiche',false,'fleche',false,'sign_board',false,'panneau_privilege',false,
      'reglette',false,'espace_br',false,'wobler',false,'presentoir',false,'tg',false,
      'plaque_br',false,'merchandising',false,'standard',false,'hotesses',false,'degustation',false))),
  'synced')
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- Recalcul explicite (le trigger l'a déjà fait à l'insert, on garantit l'état
-- final si la migration est rejouée sur des données identiques).
select calculer_perfect_store(id,'taux_vente') from visites;

commit;
