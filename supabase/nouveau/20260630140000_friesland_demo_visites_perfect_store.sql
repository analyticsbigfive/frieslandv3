-- ============================================================================
-- DEMO : visites couvrant tous les niveaux Perfect Store, pour peupler le
-- dashboard KPI (v_perfect_store_global, v_perfect_store_par_categorie_pdv,
-- v_couverture). Idempotent (on conflict do update) : peut être rejoué.
-- Dépend de 120100..130100 (schéma complet Perfect Store).
-- ============================================================================
begin;

insert into pdv(pdv_id, nom_pdv, canal, categorie_pdv, sous_categorie_pdv, region, zone, secteur, is_active)
values
  ('DEMO-PS-001','Boutique Démo Flagship','General trade','Point de vente détail','Boutique A','Abidjan','Zone 1','Secteur Cocody',true),
  ('DEMO-PS-002','Boutique Démo VIP','General trade','Point de vente détail','Boutique B','Abidjan','Zone 1','Secteur Marcory',true),
  ('DEMO-PS-003','Boutique Démo Core','General trade','Point de vente détail','Boutique C','Abidjan','Zone 2','Secteur Yopougon',true),
  ('DEMO-PS-004','Boutique Démo Non Conforme','General trade','Point de vente détail','Boutique C','Abidjan','Zone 2','Secteur Abobo',true),
  ('DEMO-PS-005','Superette Démo Flagship','General trade','Point de vente détail','Superettes A','Abidjan','Zone 3','Secteur Treichville',true),
  ('DEMO-PS-006','Kiosque Démo Basic','General trade','Point de vente détail','Kiosk A','Abidjan','Zone 3','Secteur Adjamé',true)
on conflict (pdv_id) do update set
  nom_pdv = excluded.nom_pdv,
  sous_categorie_pdv = excluded.sous_categorie_pdv,
  is_active = true;

-- ----------------------------------------------------------------------------
-- 1. Boutique A — stock complet + tous les standards visibilité/promo à true
--    => FLAGSHIP STORE (dispo 100, visi 100, promo 100)
-- ----------------------------------------------------------------------------
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values (
  'DEMO-PS-VISITE-001','DEMO-PS-001', now(), 'Démo Commercial 1', 'demo1@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object(
        'br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
      'imp', jsonb_build_object('quantites', jsonb_build_object(
        'br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
      'scm', jsonb_build_object('quantites', jsonb_build_object(
        'br_1kg',999,'pearl_1kg',999))
    ),
    'visibilite', jsonb_build_object(
      'promotion_applicable', true,
      'standards', jsonb_build_object(
        'affiche',true,'fleche',true,'guirlande',true,'sign_board',true,'panneau_privilege',true,
        'full_branding',true,'reglette',true,'maison_br',true,'hanger',true,'wobler',true,
        'presentoir',true,'tg',true,'plaque_br',true,'merchandising',true,
        'standard',true,'hotesses',true,'degustation',true
      )
    )
  ),
  'synced'
)
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- ----------------------------------------------------------------------------
-- 2. Boutique B — stock complet, mais Full branding + Plaque BR absents
--    => échoue Flagship (les 2 exigés), passe VIP (les 2 optionnels en VIP)
--    => VIP PERFECT STORE
-- ----------------------------------------------------------------------------
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values (
  'DEMO-PS-VISITE-002','DEMO-PS-002', now(), 'Démo Commercial 2', 'demo2@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object(
        'br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
      'imp', jsonb_build_object('quantites', jsonb_build_object(
        'br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
      'scm', jsonb_build_object('quantites', jsonb_build_object(
        'br_1kg',999,'pearl_1kg',999))
    ),
    'visibilite', jsonb_build_object(
      'promotion_applicable', true,
      'standards', jsonb_build_object(
        'affiche',true,'fleche',true,'guirlande',true,'sign_board',true,'panneau_privilege',true,
        'full_branding',false,'reglette',true,'maison_br',true,'hanger',true,'wobler',true,
        'presentoir',true,'tg',true,'plaque_br',false,'merchandising',true,
        'standard',true,'hotesses',true,'degustation',true
      )
    )
  ),
  'synced'
)
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- ----------------------------------------------------------------------------
-- 3. Boutique C — stock complet, standards limités au strict requis Core
--    => CORE PERFECT STORE
-- ----------------------------------------------------------------------------
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values (
  'DEMO-PS-VISITE-003','DEMO-PS-003', now(), 'Démo Commercial 3', 'demo3@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object(
        'br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
      'imp', jsonb_build_object('quantites', jsonb_build_object(
        'br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
      'scm', jsonb_build_object('quantites', jsonb_build_object(
        'br_1kg',999,'pearl_1kg',999))
    ),
    'visibilite', jsonb_build_object(
      'promotion_applicable', false,
      'standards', jsonb_build_object(
        'affiche',true,'fleche',true,'guirlande',true,'sign_board',true,'panneau_privilege',false,
        'full_branding',false,'reglette',true,'maison_br',true,'hanger',true,'wobler',true,
        'presentoir',false,'tg',false,'plaque_br',false,'merchandising',true,
        'standard',true,'hotesses',false,'degustation',false
      )
    )
  ),
  'synced'
)
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- ----------------------------------------------------------------------------
-- 4. Boutique C — rien en stock, rien en visibilité
--    => AUCUN NIVEAU (sous Basic), pour montrer le cas "non conforme"
-- ----------------------------------------------------------------------------
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values (
  'DEMO-PS-VISITE-004','DEMO-PS-004', now(), 'Démo Commercial 4', 'demo4@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object()),
      'imp', jsonb_build_object('quantites', jsonb_build_object()),
      'scm', jsonb_build_object('quantites', jsonb_build_object())
    ),
    'visibilite', jsonb_build_object(
      'promotion_applicable', false,
      'standards', jsonb_build_object(
        'affiche',false,'fleche',false,'guirlande',false,'sign_board',false,'panneau_privilege',false,
        'full_branding',false,'reglette',false,'maison_br',false,'hanger',false,'wobler',false,
        'presentoir',false,'tg',false,'plaque_br',false,'merchandising',false,
        'standard',false,'hotesses',false,'degustation',false
      )
    )
  ),
  'synced'
)
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- ----------------------------------------------------------------------------
-- 5. Superette A — stock complet + tous les standards "superette" requis
--    => FLAGSHIP STORE (segment superette)
-- ----------------------------------------------------------------------------
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values (
  'DEMO-PS-VISITE-005','DEMO-PS-005', now(), 'Démo Commercial 5', 'demo5@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object(
        'br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
      'imp', jsonb_build_object('quantites', jsonb_build_object(
        'br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
      'scm', jsonb_build_object('quantites', jsonb_build_object(
        'br_1kg',999,'pearl_1kg',999))
    ),
    'visibilite', jsonb_build_object(
      'promotion_applicable', true,
      'standards', jsonb_build_object(
        'affiche',true,'fleche',true,'sign_board',true,'panneau_privilege',true,
        'reglette',true,'espace_br',true,'wobler',true,'presentoir',true,'tg',true,
        'plaque_br',true,'merchandising',true,'standard',true,'hotesses',true,'degustation',true
      )
    )
  ),
  'synced'
)
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- ----------------------------------------------------------------------------
-- 6. Kiosk A — stock complet (les seules réfs avec seuils Kiosque) mais
--    standards visibilité tous à false
--    => visi flagship/vip/core échouent, basic n'exige rien (auto 100%)
--    => BASIC PERFECT STORE
-- ----------------------------------------------------------------------------
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status)
values (
  'DEMO-PS-VISITE-006','DEMO-PS-006', now(), 'Démo Commercial 6', 'demo6@friesland.test',
  jsonb_build_object(
    'produits', jsonb_build_object(
      'evap', jsonb_build_object('quantites', jsonb_build_object('pearl_400g',999)),
      'imp', jsonb_build_object('quantites', jsonb_build_object()),
      'scm', jsonb_build_object('quantites', jsonb_build_object('pearl_1kg',999))
    ),
    'visibilite', jsonb_build_object(
      'promotion_applicable', false,
      'standards', jsonb_build_object(
        'affiche',false,'thermos',false,'verre',false,'carafe',false,
        'maison_br',false,'chasuble',false,'full_branding',false,'promotion',false
      )
    )
  ),
  'synced'
)
on conflict (visite_id) do update set data = excluded.data, date_visite = excluded.date_visite;

-- Le trigger trg_perfect_store recalcule déjà sur insert/update de data,
-- mais on force un recalcul explicite pour garantir l'état final si la
-- migration est rejouée avec des données déjà présentes à l'identique.
select calculer_perfect_store(id,'taux_vente')
from visites
where visite_id in (
  'DEMO-PS-VISITE-001','DEMO-PS-VISITE-002','DEMO-PS-VISITE-003',
  'DEMO-PS-VISITE-004','DEMO-PS-VISITE-005','DEMO-PS-VISITE-006'
);

commit;
