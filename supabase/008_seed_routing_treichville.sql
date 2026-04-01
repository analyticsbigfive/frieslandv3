-- ============================================================================
-- 008_seed_routing_treichville.sql
-- Seed: Routing hebdomadaire pour merchandiser@friesland.ci à Treichville
-- Crée 30 PDV fictifs + 6 routings (Lundi-Samedi) avec 5 PDV/jour
-- ============================================================================

-- ============================================================================
-- 1. CRÉER 30 PDV FICTIFS À TREICHVILLE
-- ============================================================================
-- Quartiers couverts: Appolo, Belleville, Biafra, France Amérique, Aras, Cité du Port

INSERT INTO pdv (pdv_id, nom_pdv, canal, categorie_pdv, sous_categorie_pdv, zone, secteur, region, geolocation_lat, geolocation_lng, rayon_geofence, is_active)
VALUES
  -- === LUNDI - Quartier Appolo ===
  ('RTG-TREICH-001', 'Superette Chez Tanti Marie',      'General trade', 'Point de vente détail', 'Boutique A', 'TREICHVILLE', 'Quartier Appolo', 'Treichville', 5.2988, -3.9932, 300, true),
  ('RTG-TREICH-002', 'Alimentation Koné & Fils',         'General trade', 'Point de vente détail', 'Boutique B', 'TREICHVILLE', 'Quartier Appolo', 'Treichville', 5.2981, -3.9940, 300, true),
  ('RTG-TREICH-003', 'Kiosque du Marché Appolo',         'General trade', 'Point de vente détail', 'Kiosque',    'TREICHVILLE', 'Quartier Appolo', 'Treichville', 5.2975, -3.9928, 300, true),
  ('RTG-TREICH-004', 'Dépôt Lait Frais Adama',           'General trade', 'Point de vente détail', 'Boutique C', 'TREICHVILLE', 'Quartier Appolo', 'Treichville', 5.2970, -3.9945, 300, true),
  ('RTG-TREICH-005', 'Mini Market Espoir',                'General trade', 'Point de vente détail', 'Boutique A', 'TREICHVILLE', 'Quartier Appolo', 'Treichville', 5.2992, -3.9920, 300, true),

  -- === MARDI - Belleville ===
  ('RTG-TREICH-006', 'Boutique Awa Diallo',              'General trade', 'Point de vente détail', 'Boutique B', 'TREICHVILLE', 'Belleville', 'Treichville', 5.2972, -3.9985, 300, true),
  ('RTG-TREICH-007', 'Épicerie du Carrefour Belleville',  'General trade', 'Point de vente détail', 'Boutique A', 'TREICHVILLE', 'Belleville', 'Treichville', 5.2968, -3.9978, 300, true),
  ('RTG-TREICH-008', 'Kiosque Mamadou Sangaré',          'General trade', 'Point de vente détail', 'Kiosque',    'TREICHVILLE', 'Belleville', 'Treichville', 5.2965, -3.9992, 300, true),
  ('RTG-TREICH-009', 'Alimentation La Grâce Divine',     'General trade', 'Point de vente détail', 'Boutique B', 'TREICHVILLE', 'Belleville', 'Treichville', 5.2958, -3.9975, 300, true),
  ('RTG-TREICH-010', 'Dépôt Boissons Yao',               'General trade', 'Point de vente détail', 'Boutique C', 'TREICHVILLE', 'Belleville', 'Treichville', 5.2975, -3.9968, 300, true),

  -- === MERCREDI - Biafra ===
  ('RTG-TREICH-011', 'Boutique Fatou Bamba',              'General trade', 'Point de vente détail', 'Boutique A', 'TREICHVILLE', 'Biafra', 'Treichville', 5.2945, -3.9955, 300, true),
  ('RTG-TREICH-012', 'Superette Le Bon Prix',             'General trade', 'Point de vente détail', 'Boutique A', 'TREICHVILLE', 'Biafra', 'Treichville', 5.2938, -3.9948, 300, true),
  ('RTG-TREICH-013', 'Kiosque Issouf Traoré',            'General trade', 'Point de vente détail', 'Kiosque',    'TREICHVILLE', 'Biafra', 'Treichville', 5.2942, -3.9960, 300, true),
  ('RTG-TREICH-014', 'Alimentation Chez Tantie Adjoua',  'General trade', 'Point de vente détail', 'Boutique B', 'TREICHVILLE', 'Biafra', 'Treichville', 5.2932, -3.9942, 300, true),
  ('RTG-TREICH-015', 'Dépôt Produits Laitiers Konan',    'General trade', 'Point de vente détail', 'Boutique C', 'TREICHVILLE', 'Biafra', 'Treichville', 5.2948, -3.9938, 300, true),

  -- === JEUDI - France Amérique ===
  ('RTG-TREICH-016', 'Boutique Moussa Coulibaly',         'General trade', 'Point de vente détail', 'Boutique B', 'TREICHVILLE', 'France Amerique', 'Treichville', 5.2958, -3.9912, 300, true),
  ('RTG-TREICH-017', 'Épicerie Sainte Famille',           'General trade', 'Point de vente détail', 'Boutique A', 'TREICHVILLE', 'France Amerique', 'Treichville', 5.2952, -3.9905, 300, true),
  ('RTG-TREICH-018', 'Mini Marché Ouattara',              'General trade', 'Point de vente détail', 'Boutique A', 'TREICHVILLE', 'France Amerique', 'Treichville', 5.2948, -3.9918, 300, true),
  ('RTG-TREICH-019', 'Kiosque Abibata Touré',            'General trade', 'Point de vente détail', 'Kiosque',    'TREICHVILLE', 'France Amerique', 'Treichville', 5.2945, -3.9900, 300, true),
  ('RTG-TREICH-020', 'Dépôt Central Treichville',         'General trade', 'Point de vente détail', 'Boutique C', 'TREICHVILLE', 'France Amerique', 'Treichville', 5.2962, -3.9895, 300, true),

  -- === VENDREDI - Aras ===
  ('RTG-TREICH-021', 'Boutique Salimata Keita',           'General trade', 'Point de vente détail', 'Boutique B', 'TREICHVILLE', 'Aras', 'Treichville', 5.2925, -3.9975, 300, true),
  ('RTG-TREICH-022', 'Alimentation Le Grenier',           'General trade', 'Point de vente détail', 'Boutique A', 'TREICHVILLE', 'Aras', 'Treichville', 5.2918, -3.9968, 300, true),
  ('RTG-TREICH-023', 'Superette Maman Adjoua',            'General trade', 'Point de vente détail', 'Boutique A', 'TREICHVILLE', 'Aras', 'Treichville', 5.2922, -3.9982, 300, true),
  ('RTG-TREICH-024', 'Kiosque Ibrahim Soro',              'General trade', 'Point de vente détail', 'Kiosque',    'TREICHVILLE', 'Aras', 'Treichville', 5.2912, -3.9960, 300, true),
  ('RTG-TREICH-025', 'Dépôt Friesland Aras',              'General trade', 'Point de vente détail', 'Boutique C', 'TREICHVILLE', 'Aras', 'Treichville', 5.2908, -3.9972, 300, true),

  -- === SAMEDI - Cité du Port ===
  ('RTG-TREICH-026', 'Boutique Fanta Dramé',              'General trade', 'Point de vente détail', 'Boutique B', 'TREICHVILLE', 'Cité du port', 'Treichville', 5.2915, -3.9925, 300, true),
  ('RTG-TREICH-027', 'Alimentation du Port',              'General trade', 'Point de vente détail', 'Boutique A', 'TREICHVILLE', 'Cité du port', 'Treichville', 5.2908, -3.9918, 300, true),
  ('RTG-TREICH-028', 'Kiosque Sékou Bah',                 'General trade', 'Point de vente détail', 'Kiosque',    'TREICHVILLE', 'Cité du port', 'Treichville', 5.2912, -3.9932, 300, true),
  ('RTG-TREICH-029', 'Épicerie Bénédiction',              'General trade', 'Point de vente détail', 'Boutique A', 'TREICHVILLE', 'Cité du port', 'Treichville', 5.2902, -3.9912, 300, true),
  ('RTG-TREICH-030', 'Dépôt Laitier Port Autonome',       'General trade', 'Point de vente détail', 'Boutique C', 'TREICHVILLE', 'Cité du port', 'Treichville', 5.2918, -3.9905, 300, true)

ON CONFLICT (pdv_id) DO NOTHING;


-- ============================================================================
-- 2. CRÉER LES ROUTINGS POUR CHAQUE JOUR DE LA SEMAINE
-- ============================================================================
-- Semaine du 30 mars au 4 avril 2026
-- Utilise une requête pour récupérer dynamiquement l'ID de l'utilisateur

DO $$
DECLARE
  v_user_id UUID;
  v_admin_id UUID;
  v_routing_id UUID;
BEGIN

  -- Récupérer l'ID du merchandiser
  SELECT id INTO v_user_id
  FROM profiles
  WHERE email = 'merchandiser@friesland.ci'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Utilisateur merchandiser@friesland.ci non trouvé. Tentative avec merchandiseur@friesland.ci...';
    SELECT id INTO v_user_id
    FROM profiles
    WHERE email = 'merchandiseur@friesland.ci'
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Aucun utilisateur merchandiser trouvé. Exécutez d''abord le script de création des comptes.';
  END IF;

  -- Récupérer l'ID de l'admin (créateur du routing)
  SELECT id INTO v_admin_id
  FROM profiles
  WHERE role = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    v_admin_id := v_user_id; -- fallback
  END IF;

  RAISE NOTICE 'Création des routings pour user_id: %, admin_id: %', v_user_id, v_admin_id;

  -- ========================================================================
  -- LUNDI 30 MARS 2026 — Quartier Appolo (5 PDV)
  -- ========================================================================
  INSERT INTO routings (user_id, date_routing, created_by, notes, status)
  VALUES (v_user_id, '2026-03-30', v_admin_id, 'Tournée Quartier Appolo - Relevé de stock prioritaire', 'pending')
  ON CONFLICT (user_id, date_routing) DO UPDATE SET notes = EXCLUDED.notes
  RETURNING id INTO v_routing_id;

  DELETE FROM routing_pdv WHERE routing_id = v_routing_id;

  INSERT INTO routing_pdv (routing_id, pdv_id, position_order, objectifs, status) VALUES
    (v_routing_id, 'RTG-TREICH-001', 1, '{"releve_stock": true, "merchandising": true, "photos": true}'::jsonb,  'pending'),
    (v_routing_id, 'RTG-TREICH-002', 2, '{"releve_stock": true, "encaissement": true}'::jsonb,                    'pending'),
    (v_routing_id, 'RTG-TREICH-003', 3, '{"releve_stock": true, "photos": true}'::jsonb,                          'pending'),
    (v_routing_id, 'RTG-TREICH-004', 4, '{"releve_stock": true, "merchandising": true}'::jsonb,                   'pending'),
    (v_routing_id, 'RTG-TREICH-005', 5, '{"releve_stock": true, "encaissement": true, "photos": true}'::jsonb,    'pending');

  RAISE NOTICE 'Lundi 30/03 créé - Quartier Appolo (5 PDV)';

  -- ========================================================================
  -- MARDI 31 MARS 2026 — Belleville (5 PDV)
  -- ========================================================================
  INSERT INTO routings (user_id, date_routing, created_by, notes, status)
  VALUES (v_user_id, '2026-03-31', v_admin_id, 'Tournée Belleville - Prospection nouveaux clients', 'pending')
  ON CONFLICT (user_id, date_routing) DO UPDATE SET notes = EXCLUDED.notes
  RETURNING id INTO v_routing_id;

  DELETE FROM routing_pdv WHERE routing_id = v_routing_id;

  INSERT INTO routing_pdv (routing_id, pdv_id, position_order, objectifs, status) VALUES
    (v_routing_id, 'RTG-TREICH-006', 1, '{"prospection": true, "photos": true}'::jsonb,                           'pending'),
    (v_routing_id, 'RTG-TREICH-007', 2, '{"releve_stock": true, "merchandising": true, "photos": true}'::jsonb,   'pending'),
    (v_routing_id, 'RTG-TREICH-008', 3, '{"encaissement": true, "releve_stock": true}'::jsonb,                    'pending'),
    (v_routing_id, 'RTG-TREICH-009', 4, '{"prospection": true, "merchandising": true}'::jsonb,                    'pending'),
    (v_routing_id, 'RTG-TREICH-010', 5, '{"releve_stock": true, "encaissement": true, "photos": true}'::jsonb,    'pending');

  RAISE NOTICE 'Mardi 31/03 créé - Belleville (5 PDV)';

  -- ========================================================================
  -- MERCREDI 1 AVRIL 2026 — Biafra (5 PDV) — AUJOURD'HUI
  -- ========================================================================
  INSERT INTO routings (user_id, date_routing, created_by, notes, status)
  VALUES (v_user_id, '2026-04-01', v_admin_id, 'Tournée Biafra - Merchandising + Encaissement', 'in_progress')
  ON CONFLICT (user_id, date_routing) DO UPDATE SET notes = EXCLUDED.notes, status = 'in_progress'
  RETURNING id INTO v_routing_id;

  DELETE FROM routing_pdv WHERE routing_id = v_routing_id;

  INSERT INTO routing_pdv (routing_id, pdv_id, position_order, objectifs, status) VALUES
    (v_routing_id, 'RTG-TREICH-011', 1, '{"merchandising": true, "photos": true, "releve_stock": true}'::jsonb,   'completed'),
    (v_routing_id, 'RTG-TREICH-012', 2, '{"encaissement": true, "merchandising": true}'::jsonb,                   'completed'),
    (v_routing_id, 'RTG-TREICH-013', 3, '{"releve_stock": true, "photos": true, "encaissement": true}'::jsonb,    'in_progress'),
    (v_routing_id, 'RTG-TREICH-014', 4, '{"merchandising": true, "releve_stock": true}'::jsonb,                   'pending'),
    (v_routing_id, 'RTG-TREICH-015', 5, '{"photos": true, "merchandising": true, "prospection": true}'::jsonb,    'pending');

  RAISE NOTICE 'Mercredi 01/04 créé - Biafra (5 PDV) - EN COURS';

  -- ========================================================================
  -- JEUDI 2 AVRIL 2026 — France Amérique (5 PDV)
  -- ========================================================================
  INSERT INTO routings (user_id, date_routing, created_by, notes, status)
  VALUES (v_user_id, '2026-04-02', v_admin_id, 'Tournée France Amérique - Photos vitrine obligatoires', 'pending')
  ON CONFLICT (user_id, date_routing) DO UPDATE SET notes = EXCLUDED.notes
  RETURNING id INTO v_routing_id;

  DELETE FROM routing_pdv WHERE routing_id = v_routing_id;

  INSERT INTO routing_pdv (routing_id, pdv_id, position_order, objectifs, status) VALUES
    (v_routing_id, 'RTG-TREICH-016', 1, '{"photos": true, "merchandising": true}'::jsonb,                         'pending'),
    (v_routing_id, 'RTG-TREICH-017', 2, '{"releve_stock": true, "photos": true, "encaissement": true}'::jsonb,    'pending'),
    (v_routing_id, 'RTG-TREICH-018', 3, '{"merchandising": true, "prospection": true}'::jsonb,                    'pending'),
    (v_routing_id, 'RTG-TREICH-019', 4, '{"photos": true, "releve_stock": true}'::jsonb,                          'pending'),
    (v_routing_id, 'RTG-TREICH-020', 5, '{"encaissement": true, "photos": true, "merchandising": true}'::jsonb,   'pending');

  RAISE NOTICE 'Jeudi 02/04 créé - France Amérique (5 PDV)';

  -- ========================================================================
  -- VENDREDI 3 AVRIL 2026 — Aras (5 PDV)
  -- ========================================================================
  INSERT INTO routings (user_id, date_routing, created_by, notes, status)
  VALUES (v_user_id, '2026-04-03', v_admin_id, 'Tournée Aras - Encaissement fin de semaine', 'pending')
  ON CONFLICT (user_id, date_routing) DO UPDATE SET notes = EXCLUDED.notes
  RETURNING id INTO v_routing_id;

  DELETE FROM routing_pdv WHERE routing_id = v_routing_id;

  INSERT INTO routing_pdv (routing_id, pdv_id, position_order, objectifs, status) VALUES
    (v_routing_id, 'RTG-TREICH-021', 1, '{"encaissement": true, "releve_stock": true}'::jsonb,                    'pending'),
    (v_routing_id, 'RTG-TREICH-022', 2, '{"releve_stock": true, "merchandising": true, "photos": true}'::jsonb,   'pending'),
    (v_routing_id, 'RTG-TREICH-023', 3, '{"encaissement": true, "prospection": true}'::jsonb,                     'pending'),
    (v_routing_id, 'RTG-TREICH-024', 4, '{"releve_stock": true, "photos": true}'::jsonb,                          'pending'),
    (v_routing_id, 'RTG-TREICH-025', 5, '{"encaissement": true, "merchandising": true, "releve_stock": true}'::jsonb, 'pending');

  RAISE NOTICE 'Vendredi 03/04 créé - Aras (5 PDV)';

  -- ========================================================================
  -- SAMEDI 4 AVRIL 2026 — Cité du Port (5 PDV)
  -- ========================================================================
  INSERT INTO routings (user_id, date_routing, created_by, notes, status)
  VALUES (v_user_id, '2026-04-04', v_admin_id, 'Tournée Cité du Port - Dernière tournée de la semaine', 'pending')
  ON CONFLICT (user_id, date_routing) DO UPDATE SET notes = EXCLUDED.notes
  RETURNING id INTO v_routing_id;

  DELETE FROM routing_pdv WHERE routing_id = v_routing_id;

  INSERT INTO routing_pdv (routing_id, pdv_id, position_order, objectifs, status) VALUES
    (v_routing_id, 'RTG-TREICH-026', 1, '{"releve_stock": true, "photos": true, "merchandising": true}'::jsonb,   'pending'),
    (v_routing_id, 'RTG-TREICH-027', 2, '{"encaissement": true, "releve_stock": true}'::jsonb,                    'pending'),
    (v_routing_id, 'RTG-TREICH-028', 3, '{"merchandising": true, "photos": true}'::jsonb,                         'pending'),
    (v_routing_id, 'RTG-TREICH-029', 4, '{"prospection": true, "releve_stock": true, "photos": true}'::jsonb,     'pending'),
    (v_routing_id, 'RTG-TREICH-030', 5, '{"encaissement": true, "merchandising": true, "photos": true}'::jsonb,   'pending');

  RAISE NOTICE 'Samedi 04/04 créé - Cité du Port (5 PDV)';

  RAISE NOTICE '✅ Routings créés avec succès pour la semaine du 30/03 au 04/04/2026';
  RAISE NOTICE '📊 Total: 6 routings, 30 PDV, 30 missions assignées';

END $$;
