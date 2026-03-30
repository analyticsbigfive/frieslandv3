-- ============================================================
-- Migration Supabase - Friesland Bonnet Rouge
-- 003_seed_zones_secteurs.sql
-- Seed complet des zones_secteurs depuis CSV (831 lignes)
-- Généré automatiquement par scripts/generate-seed-sql.mjs
-- ============================================================

-- Nettoyage
TRUNCATE public.zones_secteurs RESTART IDENTITY CASCADE;

-- ============================================================
-- INSERT BATCH: zones_secteurs
-- Colonnes: zone, secteur, merchandiser, email_merchandiser,
--           sales_rep, email_sales_rep, region
-- ============================================================
-- Note: Les Secteur IDs originaux du CSV (1-596, MT-xxx, MISEAJOUR-xxx)
-- sont remplacés par des IDs auto-incrémentés (SERIAL).
-- L'ancien ID CSV est conservé en commentaire pour traçabilité.

-- Batch 1 (lignes 1 à 100)
INSERT INTO public.zones_secteurs (zone, secteur, merchandiser, email_merchandiser, sales_rep, email_sales_rep, region) VALUES
  ('ABOBO 1', 'PLATEAU DOKOUI', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 1
  ('ABOBO 1', 'ABOBOTE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 2
  ('ABOBO 1', 'SAMAKE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 3
  ('ABOBO 1', 'ABOBO BAOULE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 4
  ('ABOBO 1', 'BELLEVILLE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 5
  ('ABOBO 1', 'BIABOU', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 6
  ('ABOBO 1', 'AHOUE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 7
  ('ABOBO 1', 'ALEPE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 8
  ('ABOBO 1', 'ABOBO CENTRE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 9
  ('ABOBO 1', 'SOGEPHIA', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 10
  ('ABOBO 1', 'PLAQUE 1&2', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 11
  ('ABOBO 1', '4 ETAGES', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 12
  ('ABOBO 1', 'HOUPHOUET BOIGNY', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 13
  ('ABOBO 1', 'AGBEIKOI', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 14
  ('ABOBO 1', 'AVENUE KAZA', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 15
  ('ABOBO 1', 'AKEIKOI', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 16
  ('ABOBO 1', 'LYCEE MUNICIPAL', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 17
  ('ABOBO 1', 'BC', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 18
  ('ABOBO 1', 'CAMP COMMANDO', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 19
  ('ABOBO 1', 'GAGNOA GARE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 20
  ('ABOBO 1', 'POMPE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 21
  ('ABOBO 1', 'DEPOT 9', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 22
  ('ABOBO 1', 'AGRIPAC', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 23
  ('ABOBO 1', 'PLATEAU DOKOUI', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 24
  ('ABOBO 1', 'MARAHOUE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 25
  ('ABOBO 1', 'ABOBOTE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 26
  ('ABOBO 1', 'SAMAKE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 27
  ('ABOBO 2', 'ANADOR', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 28
  ('ABOBO 2', 'DERRIERE RAILS', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 29
  ('ABOBO 2', 'ANONKOUA KOUTE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 30
  ('ABOBO 2', 'CITE ONUCI', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 31
  ('ABOBO 2', 'SOTRAPIM', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 32
  ('ABOBO 2', 'NDOTRE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 33
  ('ABOBO 2', 'KOBAKRO', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 34
  ('ABOBO 2', 'ANYAMA', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 35
  ('ABOBO 2', 'EBIMPE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 36
  ('ABOBO 2', 'PK 18', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 37
  ('ABOBO 2', 'AZAGUIE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 38
  ('ABOBO 2', 'WILLIAMSVILLE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 39
  ('ABOBO 2', 'PAILLET', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 40
  ('ADJAME', '220 LGTs', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ABIDJAN 2'), -- CSV ID: 41
  ('ADJAME', 'SAINT MICHEL', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ABIDJAN 2'), -- CSV ID: 42
  ('ADJAME', 'DELEGATION', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ABIDJAN 2'), -- CSV ID: 43
  ('ADJAME', 'FORUM', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ABIDJAN 2'), -- CSV ID: 44
  ('ADJAME', 'DALLAS', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ABIDJAN 2'), -- CSV ID: 45
  ('ADJAME', 'RENAULT', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ABIDJAN 2'), -- CSV ID: 46
  ('ADJAME', 'MARCHE GOURO', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ABIDJAN 2'), -- CSV ID: 47
  ('ADJAME', 'BRACODI', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ABIDJAN 2'), -- CSV ID: 48
  ('ADJAME', 'MOSQUEE', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ABIDJAN 2'), -- CSV ID: 49
  ('ATTECOUBE-PLATEAU', 'BRAMAKOTE', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ABIDJAN 2'), -- CSV ID: 50
  ('ATTECOUBE-PLATEAU', 'PLATEAU', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ABIDJAN 2'), -- CSV ID: 51
  ('ATTECOUBE-PLATEAU', 'ATTECOUBE', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ABIDJAN 2'), -- CSV ID: 52
  ('ATTECOUBE-PLATEAU', 'AGBAN VILLAGE', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ABIDJAN 2'), -- CSV ID: 53
  ('ATTECOUBE-PLATEAU', 'CITE FERMONT', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ARMANDE KOUAKOUSSUI', 'abidjannordfcadjame@gmail.com', 'ABIDJAN 2'), -- CSV ID: 54
  ('COCODY 1', 'ANGRE', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 55
  ('COCODY 1', 'MAHOU', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 56
  ('COCODY 1', 'BESSIKOI', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 57
  ('COCODY 1', 'PALMERAIE', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 58
  ('COCODY 1', 'BONOUMIN', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 59
  ('COCODY 1', 'ATTOBAN', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 60
  ('COCODY 1', '2 PLATEAUX', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 61
  ('COCODY 1', 'FAYA', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 62
  ('COCODY 1', 'ANGRE', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 63
  ('COCODY 1', 'CITE SIR', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 64
  ('COCODY 1', 'MAHOU', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 65
  ('COCODY 1', 'BESSIKOI', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 66
  ('COCODY 1', 'PALMERAIE', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 67
  ('COCODY 1', 'BONOUMIN', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 68
  ('COCODY 1', 'ATTOBAN', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 69
  ('COCODY 1', '2 PLATEAUX', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 70
  ('COCODY 1', 'FAYA A GAUCHE', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 71
  ('COCODY 1', 'CITE SIR', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 72
  ('COCODY 1', 'DJOROBITE', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 73
  ('COCODY 2', 'COCODY CENTRE -', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 74
  ('COCODY 2', 'DANGA', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 75
  ('COCODY 2', 'BLOCKAUSS', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 76
  ('COCODY 2', 'ANONO', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 77
  ('COCODY 2', 'RIVIERA 2', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 78
  ('COCODY 2', 'RIVIERA 3', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 79
  ('COCODY 2', 'M''POUTO', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 80
  ('COCODY 2', 'M''BADON', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 81
  ('COCODY 2', 'AKOUEDO', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 82
  ('COCODY 2', 'ABATTA', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 83
  ('COCODY 2', 'FAYA A DROITE', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 84
  ('COCODY 2', 'BINGERVILLE', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'MURIEL SIOTENE', 'abidjannordfccocody1@gmail.com', 'ABIDJAN 1'), -- CSV ID: 85
  ('YOPOUGON 1', 'SICOGI', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 86
  ('YOPOUGON 1', 'SELMER', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 87
  ('YOPOUGON 1', 'WASSAKARA', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 88
  ('YOPOUGON 1', 'INSTITUT DES AVEUGLES', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 89
  ('YOPOUGON 1', 'GFCI', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 90
  ('YOPOUGON 1', 'NOUVEAU QUARTIER', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 91
  ('YOPOUGON 1', 'MILLIONNAIRE', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 92
  ('YOPOUGON 1', 'TOIT ROUGE', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 93
  ('YOPOUGON 1', 'MOSSIKRO', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 94
  ('YOPOUGON 1', 'LOCODJRO', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 95
  ('YOPOUGON 1', 'ABOBODOUME', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 96
  ('YOPOUGON 1', 'KOWEIT', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 97
  ('YOPOUGON 2', 'CAMP MILITAIRE', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 98
  ('YOPOUGON 2', 'KOUTE', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 99
  ('YOPOUGON 2', 'SIDECI', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2') -- CSV ID: 100;

-- Batch 2 (lignes 101 à 200)
INSERT INTO public.zones_secteurs (zone, secteur, merchandiser, email_merchandiser, sales_rep, email_sales_rep, region) VALUES
  ('YOPOUGON 2', 'BEAGO', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 101
  ('YOPOUGON 2', 'NIANGOU SUD', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 102
  ('YOPOUGON 2', 'AZITO', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 103
  ('YOPOUGON 2', 'SICOGI', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 104
  ('YOPOUGON 2', 'SOGEPHIA', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 105
  ('YOPOUGON 2', 'BASE CIE', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 106
  ('YOPOUGON 2', 'CARREFOUR TEXACO', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 107
  ('YOPOUGON 2', 'CITE NOVALIM', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 108
  ('YOPOUGON 2', 'PHOENIX', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'SOUARE IBRAHIMA', 'abidjannordfcyopougon1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 109
  ('YOPOUGON 3', 'KM 22 ATTINGUIE', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 110
  ('YOPOUGON 3', 'ANDOKOI', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 111
  ('YOPOUGON 3', 'ZONE INDUSTRIELLE', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 112
  ('YOPOUGON 3', 'GESCO', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 113
  ('YOPOUGON 3', 'PORT BOUET 2', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 114
  ('YOPOUGON 3', 'CITE MAMIE ADJOUA', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 115
  ('YOPOUGON 3', 'GABRIEL GARE-', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 116
  ('YOPOUGON 3', 'SIPOREX', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 117
  ('YOPOUGON 3', 'BANCO', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 118
  ('YOPOUGON 3', 'MICAO', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 119
  ('YOPOUGON 3', 'ABOULAYE DIALLO', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 120
  ('YOPOUGON 3', 'SIKENSI', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 121
  ('YOPOUGON 3', 'N''DOUCI', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 122
  ('YOPOUGON 4', 'CARREFOUR KIMI', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 123
  ('YOPOUGON 4', 'MAROC', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 124
  ('YOPOUGON 4', 'CITE VERTE', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 125
  ('YOPOUGON 4', 'LIEVRE ROUGE', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 126
  ('YOPOUGON 4', 'LOKOUA', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 127
  ('YOPOUGON 4', 'ACADEMIE', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 128
  ('YOPOUGON 4', 'DIOP', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 129
  ('YOPOUGON 4', 'MARCHE BAGNON', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 130
  ('YOPOUGON 4', 'KM176SONGON', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 131
  ('YOPOUGON 4', 'JACQUEVILLE', 'GAI KAMI', 'abidjannordfcyopougon1@gmail.com', 'KOUAKOUSSUI ALIDA', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 132
  ('YOPOUGON 4', 'DABOU', 'GAI KAMI', 'abidjannordfcyopougon1@gmail.com', 'KOUAKOUSSUI ALIDA', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 133
  ('YOPOUGON 4', 'GRAND LAHOU', 'GAI KAMI', 'abidjannordfcyopougon1@gmail.com', 'KOUAKOUSSUI ALIDA', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 134
  ('YOPOUGON 4', 'FRESCO', 'GAI KAMI', 'abidjannordfcyopougon1@gmail.com', 'KOUAKOUSSUI ALIDA', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: 135
  ('ADZOPE', '3 RIVIERES', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 136
  ('ADZOPE', 'ADJIKOUA', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 137
  ('ADZOPE', 'AHOUABO', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 138
  ('ADZOPE', 'AKADJI', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 139
  ('ADZOPE', 'AMANPETABOUA', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 140
  ('ADZOPE', 'ANCIENNE GARE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 141
  ('ADZOPE', 'ANCIENNE INSPECTION', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 142
  ('ADZOPE', 'CARREFOUR COMPAS', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 143
  ('ADZOPE', 'CHÂTEAU', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 144
  ('ADZOPE', 'COMMERCE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 145
  ('ADZOPE', 'CORRIDOR D''ABIDJAN', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 146
  ('ADZOPE', 'DERRIERE TERRAIN', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 147
  ('ADZOPE', 'DIOULAKRO', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 148
  ('ADZOPE', 'DJALINDJI', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 149
  ('ADZOPE', 'EGLISE METHODISTE', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 150
  ('ADZOPE', 'HABITAT', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 151
  ('ADZOPE', 'HOPITAL GENERAL', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 152
  ('ADZOPE', 'COMANKOUA', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 153
  ('ADZOPE', 'KONE MAMADOU', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'RACHID ASSIROU', 'abidjannordabobo1@gmail.com', 'ABIDJAN 2'), -- CSV ID: 154
  ('PORT-BOUET', 'AKWABA', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'abnordabobo2@gmail.com', 'ABIDJAN 1'), -- CSV ID: 155
  ('PORT-BOUET', 'PHARE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'abnordabobo2@gmail.com', 'ABIDJAN 1'), -- CSV ID: 156
  ('PORT-BOUET', 'PETIT BASSAM', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'abnordabobo2@gmail.com', 'ABIDJAN 1'), -- CSV ID: 157
  ('PORT-BOUET', 'VRIDI CITE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'abnordabobo2@gmail.com', 'ABIDJAN 1'), -- CSV ID: 158
  ('PORT-BOUET', 'VRIDI CANAL', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'abnordabobo2@gmail.com', 'ABIDJAN 1'), -- CSV ID: 159
  ('PORT-BOUET', 'ZIMBABWE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'abnordabobo2@gmail.com', 'ABIDJAN 1'), -- CSV ID: 160
  ('PORT-BOUET', 'AEROPORT', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'abnordabobo2@gmail.com', 'ABIDJAN 1'), -- CSV ID: 161
  ('PORT-BOUET', 'DERRIERE WARF', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'abnordabobo2@gmail.com', 'ABIDJAN 1'), -- CSV ID: 162
  ('PORT-BOUET', 'ADJOUFFOU', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'abnordabobo2@gmail.com', 'ABIDJAN 1'), -- CSV ID: 163
  ('PORT-BOUET', 'PORT BOUET CENTRE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'abnordabobo2@gmail.com', 'ABIDJAN 1'), -- CSV ID: 164
  ('PORT-BOUET', 'JEAN FOLIE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'abnordabobo2@gmail.com', 'ABIDJAN 1'), -- CSV ID: 165
  ('PORT-BOUET', 'GONZAGUEVILLE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'abnordabobo2@gmail.com', 'ABIDJAN 1'), -- CSV ID: 166
  ('PORT-BOUET', 'ANANI', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'abnordabobo2@gmail.com', 'ABIDJAN 1'), -- CSV ID: 167
  ('PORT-BOUET', 'MODESTE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'abnordabobo2@gmail.com', 'ABIDJAN 1'), -- CSV ID: 168
  ('PORT-BOUET', 'ADJAHUI', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'abnordabobo2@gmail.com', 'ABIDJAN 1'), -- CSV ID: 169
  ('PORT-BOUET', 'ABATTOIR', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'abnordabobo2@gmail.com', 'ABIDJAN 1'), -- CSV ID: 170
  ('TREICHVILLE', 'Aras', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfctreichville@gmail.com', 'ABIDJAN 1'), -- CSV ID: 171
  ('TREICHVILLE', 'Belleville', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfctreichville@gmail.com', 'ABIDJAN 1'), -- CSV ID: 172
  ('TREICHVILLE', 'Biafra', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfctreichville@gmail.com', 'ABIDJAN 1'), -- CSV ID: 173
  ('TREICHVILLE', 'Quartier Appolo', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfctreichville@gmail.com', 'ABIDJAN 1'), -- CSV ID: 174
  ('TREICHVILLE', 'France Amerique', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfctreichville@gmail.com', 'ABIDJAN 1'), -- CSV ID: 175
  ('TREICHVILLE', 'Cité du port', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfctreichville@gmail.com', 'ABIDJAN 1'), -- CSV ID: 176
  ('TREICHVILLE', 'ZONE 3', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfctreichville@gmail.com', 'ABIDJAN 1'), -- CSV ID: 177
  ('MARCORY', 'Hibiscus', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 178
  ('MARCORY', 'Groupement foncier', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 179
  ('MARCORY', 'INJS', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 180
  ('MARCORY', 'Zone 4', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 181
  ('MARCORY', 'Remblais', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 182
  ('MARCORY', 'Sicogi', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 183
  ('MARCORY', 'Residentiel', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 184
  ('MARCORY', 'Massarana', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 185
  ('MARCORY', 'Champroux', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 186
  ('MARCORY', 'BIAO', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 187
  ('MARCORY', 'Anoumanbo', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 188
  ('MARCORY', 'Sans- fil', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 189
  ('MARCORY', 'Sainte-thérese', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 190
  ('MARCORY', 'KPF', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 191
  ('KOUMASSI', 'MARAIS', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 192
  ('KOUMASSI', 'KAHIRA', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 193
  ('KOUMASSI', 'ROCHELLE', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 194
  ('KOUMASSI', 'MARCHE DJE KONAN', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 195
  ('KOUMASSI', 'SICOGI 1', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 196
  ('KOUMASSI', 'SICOGI 2', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 197
  ('KOUMASSI', 'SICOGI 3', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 198
  ('KOUMASSI', 'ABIA SUD', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 199
  ('KOUMASSI', 'SOWETO', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1') -- CSV ID: 200;

-- Batch 3 (lignes 201 à 300)
INSERT INTO public.zones_secteurs (zone, secteur, merchandiser, email_merchandiser, sales_rep, email_sales_rep, region) VALUES
  ('KOUMASSI', 'GENIE', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 201
  ('KOUMASSI', 'CAMPEMENT', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 202
  ('KOUMASSI', 'QUARTIER DIVO', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 203
  ('KOUMASSI', 'KOUMASSI 32', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 204
  ('KOUMASSI', 'ZONE INDUSTRIELLE', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 205
  ('KOUMASSI', 'TERMINUS 05', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 206
  ('KOUMASSI', 'REMBLAIS', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 207
  ('KOUMASSI', 'AHOUSSABOUGOU', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 208
  ('KOUMASSI', 'PRODOMO', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'N''GUESSAN OPHELIA', 'abidjansudfcmarcory@gmail.com', 'ABIDJAN 1'), -- CSV ID: 209
  ('ADIAKE', 'ETUEBOUE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 210
  ('ADIAKE', 'ABOUTOU', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 211
  ('ADIAKE', 'ADIAKE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 212
  ('ADIAKE', 'ANGA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 213
  ('ADIAKE', 'ATTIEKOI/EKROMIABLA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 214
  ('ADIAKE', 'BINDO-BEGNIN', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 215
  ('ADIAKE', 'EH OUSSOU', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 216
  ('ADIAKE', 'EPLEMAN', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 217
  ('ADIAKE', 'GNAMIEN DISSOU', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 218
  ('ADIAKE', 'KACOUKRO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 219
  ('ADIAKE', 'MAURICEKRO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 220
  ('ADIAKE', 'ROA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 221
  ('ADIAKE', 'ASSOMLAN', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 222
  ('ADIAKE', 'ASSOUANKAKRO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 223
  ('ADIAKE', 'BONDOUKOU', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 224
  ('ADIAKE', 'DADIEKRO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 225
  ('ADIAKE', 'DJIM IN IKOFFIKRO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 226
  ('ADIAKE', 'EROKOUA N/ELOKOUA N', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 227
  ('ADIAKE', 'ETUESSIKA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 228
  ('ADIAKE', 'KON GODJA N', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 229
  ('ADIAKE', 'MELEKOUKRO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 230
  ('ADIAKE', 'N''GALWA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 231
  ('ADIAKE', 'PETIT PARIS', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 232
  ('ADIAKE', 'N''GALWA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 233
  ('ADIAKE', 'PETIT PARIS', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 234
  ('ASSINIE MAFIA', 'ASSINIE FRANCE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 235
  ('ASSINIE MAFIA', 'ASSINIE MAFIA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 236
  ('ASSINIE MAFIA', 'ASSINIE SAGBADOU', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 237
  ('ASSINIE MAFIA', 'ASSOUINDE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 238
  ('ASSINIE MAFIA', 'EBOTIA M', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 239
  ('ASSINIE MAFIA', 'ESSANKRO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 240
  ('ASSINIE MAFIA', 'MABIA NEHA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 241
  ('ASSINIE MAFIA', 'MANDJIAN', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 242
  ('ETUEBOUE', 'ABIATY', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 243
  ('ETUEBOUE', 'ABYMOHOUA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 244
  ('ETUEBOUE', 'ADJOUA N MOUHA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 245
  ('ETUEBOUE', 'AFFOREN OU POSTE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 246
  ('ETUEBOUE', 'ANGBOUDJOU', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 247
  ('ETUEBOUE', 'AKOUNOUGBE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 248
  ('ETUEBOUE', 'APKA GNE POSTE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 249
  ('ETUEBOUE', 'EBOUANDO 1', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 250
  ('ETUEBOUE', 'EBOUA NDO 2', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 251
  ('ETUEBOUE', 'EGBEI', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 252
  ('ETUEBOUE', 'EH ON O EGNANGANOU', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 253
  ('ETUEBOUE', 'ELIMA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 254
  ('ETUEBOUE', 'ESSOUKPORETY', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 255
  ('ETUEBOUE', 'ETUEBOUE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 256
  ('ETUEBOUE', 'KACOUKRO LAGUNE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 257
  ('BONOUA', 'ADIAHO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 258
  ('BONOUA', 'BONOUA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 259
  ('BONOUA', 'SAMO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 260
  ('BONOUA', 'TCHINTCHEBE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 261
  ('BONOUA', 'YAOU', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 262
  ('BONOUA', 'ABROBAKRO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 263
  ('BONOUA', 'ADOSSO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 264
  ('BONOUA', 'ALOHORE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 265
  ('BONOUA', 'ASSE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 266
  ('BONOUA', 'ASSE MAFIA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 267
  ('BONOUA', 'HEBE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 268
  ('BONOUA', 'LARABIA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 269
  ('BONOUA', 'MEDINA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 270
  ('BONOUA', 'MOHAME', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 271
  ('BONOUA', 'WOGNINKRO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 272
  ('ABOISSO', 'ABOISSO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 273
  ('ABOISSO', 'ADAOU', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 274
  ('ABOISSO', 'ADJOUAN', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 275
  ('ABOISSO', 'AYAME', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 276
  ('ABOISSO', 'BIANOUA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 277
  ('ABOISSO', 'KOUAKRO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 278
  ('ABOISSO', 'MAFERE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 279
  ('ABOISSO', 'YAOU', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 280
  ('ABOISSO', 'ASSOUBA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 281
  ('ABOISSO', 'AYEBO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 282
  ('ABOISSO', 'BAKRO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 283
  ('ABOISSO', 'EBOKOFFIKRO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 284
  ('ABOISSO', 'EHOLIE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 285
  ('ABOISSO', 'MAUBERT', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 286
  ('ABOISSO', 'NINGUE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 287
  ('ADAOU', 'ADAOU', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 288
  ('ADAOU', 'AHIGBE KOFFIKRO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 289
  ('ADAOU', 'AMANIKRO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 290
  ('ADAOU', 'AYENOUA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 291
  ('AYAME', 'AYAME', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 292
  ('BIANOUAN', 'BIANOUA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 293
  ('MAFERE', 'MAFERE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 294
  ('NOUAMOI', 'NOUAMOU', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 295
  ('TIAPOUM', 'TIAPOUM', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABIDJAN 1'), -- CSV ID: 296
  ('BASSAM 1', 'Mockeyville', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM'), -- CSV ID: 297
  ('BASSAM 1', 'Université Américaine', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM'), -- CSV ID: 298
  ('BASSAM 1', 'Edoukou Miezan', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM'), -- CSV ID: 299
  ('BASSAM 1', 'Quartier Artisanal', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM') -- CSV ID: 300;

-- Batch 4 (lignes 301 à 400)
INSERT INTO public.zones_secteurs (zone, secteur, merchandiser, email_merchandiser, sales_rep, email_sales_rep, region) VALUES
  ('BASSAM 1', 'Modeste', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM'), -- CSV ID: 301
  ('BASSAM 1', 'Anani', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM'), -- CSV ID: 302
  ('BASSAM 1', 'Moosou 1', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM'), -- CSV ID: 303
  ('Bassam 2', 'Vetoco', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM'), -- CSV ID: 304
  ('Bassam 2', 'Moosou2', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM'), -- CSV ID: 305
  ('Bassam 2', 'Imperial', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM'), -- CSV ID: 306
  ('Bassam 2', 'Dos', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM'), -- CSV ID: 307
  ('Bassam 2', 'Quartier France', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM'), -- CSV ID: 308
  ('Bassam 2', 'Dioulabougou', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM'), -- CSV ID: 309
  ('Bassam 2', 'Azureti', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM'), -- CSV ID: 310
  ('Bassam 1 et 2', 'Anani', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM'), -- CSV ID: 311
  ('Bassam 1 et 2', 'Dos', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM'), -- CSV ID: 312
  ('Bassam 1 et 2', 'Dioulabougo', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM'), -- CSV ID: 313
  ('Bassam 1 et 2', 'Petit marché', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BASSAM'), -- CSV ID: 314
  ('Bonoua 1 et 2', '8 kilos', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BONOUA'), -- CSV ID: 315
  ('Bonoua 1 et 2', 'Yaou', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BONOUA'), -- CSV ID: 316
  ('Bonoua 1 et 2', 'Centre ville', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BONOUA'), -- CSV ID: 317
  ('Bonoua 1 et 2', 'Begneri', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BONOUA'), -- CSV ID: 318
  ('Bonoua 1 et 2', 'Samo', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BONOUA'), -- CSV ID: 319
  ('Bonoua 1 et 2', 'Assinie', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BONOUA'), -- CSV ID: 320
  ('Bonoua 1', '8 kilos', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BONOUA'), -- CSV ID: 321
  ('Bonoua 1', 'Yaou', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BONOUA'), -- CSV ID: 322
  ('Bonoua 1', 'Centre ville', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BONOUA'), -- CSV ID: 323
  ('Bonoua 1', 'Begneri', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'BONOUA'), -- CSV ID: 324
  ('Aboisso 1', 'Djeliba', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 325
  ('Aboisso 1', 'Tp', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 326
  ('Aboisso 1', 'Parcerelle', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 327
  ('Aboisso 1', 'Konan kan', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 328
  ('Aboisso 1', 'Bois blanc', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 329
  ('Aboisso 1', 'Ayebo', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 330
  ('Aboisso 1', 'Adaou', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 331
  ('Aboisso 2', 'Diatekro', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 332
  ('Aboisso 2', 'Sokora', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 333
  ('Aboisso 2', 'Commerce', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 334
  ('Aboisso 2', 'Wattville', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 335
  ('Aboisso 2', 'Belleville', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 336
  ('Aboisso 2', 'Sos', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 337
  ('Aboisso 2', 'Dosobah', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 338
  ('Aboisso 2', 'Cité koumi', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 339
  ('Aboisso 2', 'Lycée', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 340
  ('Aboisso 2', 'Krindjabo', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 341
  ('Aboisso 2', 'Kolaiwa', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 342
  ('Aboisso 2', 'Sanhouman', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 343
  ('Aboisso 3', 'Ayamé', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 344
  ('Aboisso 3', 'Ebikra', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 345
  ('Aboisso 3', 'Akresie', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 346
  ('Aboisso 3', 'N''zikro', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 347
  ('Aboisso 3', 'Babadougou', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 348
  ('Aboisso 3', 'Eboué', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 349
  ('Aboisso 3', 'Aby', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 350
  ('Aboisso 3', 'Adjouan', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 351
  ('Aboisso 3', 'Moyassué', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 352
  ('Aboisso 3', 'Akakro', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 353
  ('Aboisso 3', 'V1', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 354
  ('Aboisso 3', 'V2', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 355
  ('Aboisso 3', 'Kridjabo', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 356
  ('Aboisso 3', 'Kassikro', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 357
  ('Aboiso 1 à 3 et Adiaké', 'Adiaké', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 358
  ('Aboiso 1 à 3 et Adiaké', 'Aboisso', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 359
  ('Aboiso 1 à 3 et Adiaké', 'Ayamé', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 360
  ('Aboiso 1 à 3 et Adiaké', 'Krindjabo', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 361
  ('Aboiso 1 à 3 et Adiaké', 'Noé', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 362
  ('Aboiso 1 à 3 et Adiaké', 'Asse', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 363
  ('Aboiso 1 à 3 et Adiaké', 'Larabia', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 364
  ('Aboiso 1 à 3 et Adiaké', 'Kohoukro', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 365
  ('Aboiso 1 à 3 et Adiaké', 'Nzikro LIMITE', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 366
  ('Aboiso 1 à 3 et Adiaké', 'SOUMIÉ', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 367
  ('Aboiso 1 à 3 et Adiaké', 'N''ZIKRO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 368
  ('Aboiso 1 à 3 et Adiaké', 'KOFFIKRO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 369
  ('Aboiso 1 à 3 et Adiaké', 'BABADOUGOU', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 370
  ('Aboiso 1 à 3 et Adiaké', 'CAREFOU AHENOUA', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 371
  ('Aboiso 1 à 3 et Adiaké', 'DIATOKRO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 372
  ('Aboiso 1 à 3 et Adiaké', 'ADAOU', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 373
  ('Aboiso 1 à 3 et Adiaké', 'AHEBO', 'FIOSSI KENA', 'abidjanfcaboisso@gmail.com', 'AZOUMI KENA', 'abidjanfcaboisso@gmail.com', 'ABOISSO'), -- CSV ID: 374
  ('ABENGOUROU', 'ABENGOUROU/ADAOU', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 375
  ('ABENGOUROU', 'ABENGOUROU/AGNIKRO', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 376
  ('ABENGOUROU', 'ABENGOUROU/BAOULEKRO', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 377
  ('ABENGOUROU', 'ABENGOUROU/CAFETOU', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 378
  ('ABENGOUROU', 'ABENGOUROU/DIOULAKRO', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 379
  ('ABENGOUROU', 'ABENGOUROU/LOBIKRO', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 380
  ('ABENGOUROU', 'ABENGOUROU/QUARTIER HKB', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 381
  ('ABENGOUROU', 'ABENGOUROU/QUARTIER CHÂTEAU', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 382
  ('ABENGOUROU', 'ABENGOUROU/NOUVEAU QUARTIER', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 383
  ('ABENGOUROU', 'ABENGOUROU/MOSSIKRO', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 384
  ('ABENGOUROU', 'ABENGOUROU/GRAND MARCHE', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 385
  ('ABENGOUROU', 'ABENGOUROU/COMMERCE', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 386
  ('ABENGOUROU', 'ABENGOUROU/CAMP MILITAIRE', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 387
  ('ABENGOUROU', 'ABENGOUROU/PLATEAU', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 388
  ('ABENGOUROU', 'ABENGOUROU/GARE DE NIABLE', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 389
  ('ABENGOUROU', 'ABENGOUROU/SOUGALOBOUGOU', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 390
  ('ABENGOUROU', 'KOUAKRO', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 391
  ('ABENGOUROU', 'NZEBENOU', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 392
  ('ABENGOUROU', 'AMELEKIA', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 393
  ('ABENGOUROU', 'SANKADIOKRO', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 394
  ('ABENGOUROU', 'YAKASSE FEYASSE', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 395
  ('ABENGOUROU', 'AGNIBILEKRO', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 396
  ('ABENGOUROU', 'KOUN FAO', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 397
  ('ABENGOUROU', 'TANDA', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 398
  ('ABENGOUROU', 'BONDOUKOU', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 399
  ('ABENGOUROU', 'BOUNA', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE') -- CSV ID: 400;

-- Batch 5 (lignes 401 à 500)
INSERT INTO public.zones_secteurs (zone, secteur, merchandiser, email_merchandiser, sales_rep, email_sales_rep, region) VALUES
  ('ABENGOUROU', 'BONAHOUIN', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 401
  ('ABENGOUROU', 'ARRAH', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 402
  ('ABENGOUROU', 'KOTOBI', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 403
  ('ABENGOUROU', 'DAOUKRO', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: 404
  ('BOUAKE 1', 'BOUAKE/GONFREVILLE', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 405
  ('BOUAKE 1', 'BOUAKE/SICOGI', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 406
  ('BOUAKE 1', 'BOUAKE/MUNICIPAL', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 407
  ('BOUAKE 1', 'BODOKRO', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 408
  ('BOUAKE 1', 'BOUAKE 1/AHOUGNANSOU', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 409
  ('BOUAKE 1', 'BOUAKE 1/CORRIDOR', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 410
  ('BOUAKE 1', 'BOUAKE 1/ADJEYAOKRO', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 411
  ('BOUAKE 1', 'BOUAKE 1/CIDT', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 412
  ('BOUAKE 1', 'BOUAKE 1/SOCOPAO', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 413
  ('BOUAKE 1', 'BOUAKE 1/KÔKÔ', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 414
  ('BOUAKE 1', 'BOUAKE 1/NDAKRO', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 415
  ('BOUAKE 1', 'BOUAKE 1/DAR ES SALAM', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 416
  ('BOUAKE 1', 'BOUAKE 1/NGATTAKRO', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 417
  ('BOUAKE 1', 'BOUAKE 1/BROUKRO', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 418
  ('BOUAKE 1', 'BOUAKE 1/ZONE', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 419
  ('BOUAKE 1', 'BOUAKE 1/HOUPHOUET VILLE', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 420
  ('BOUAKE 1', 'BEOUMI', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 421
  ('BOUAKE 1', 'SAKASSOU', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 422
  ('BOUAKE 1', 'DJEBONOUA', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 423
  ('BOUAKE 1', 'TIEBISSOU', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 424
  ('BOUAKE 2', 'BOUAKE 2/CAMPEMENT', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 425
  ('BOUAKE 2', 'OUELLE', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 426
  ('BOUAKE 2', 'BOUAKE 2/MARCHE', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 427
  ('BOUAKE 2', 'BOUAKE 2/CORRIDOR SUD', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 428
  ('BOUAKE 2', 'BOUAKE 2/AIR FRANCE 3', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 429
  ('BOUAKE 2', 'BOUAKE 2/AIR FRANCE 2', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 430
  ('BOUAKE 2', 'BOUAKE 2/AIR FRANCE 1', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 431
  ('BOUAKE 2', 'BOUAKE 2/NIMBO', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 432
  ('BOUAKE 2', 'BOUAKE 2/COMMERCE', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 433
  ('BOUAKE 2', 'BOUAKE 2/SOKOURA', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 434
  ('BOUAKE 2', 'BOUAKE 2/KENEDY & BROMAKOTE', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 435
  ('BOUAKE 2', 'BOUAKE 2/BELLEVILLE 1', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 436
  ('BOUAKE 2', 'BOUAKE 2/BELLEVILLE 2', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 437
  ('BOUAKE 2', 'BOUAKE 2/DJAMOUROU', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 438
  ('BOUAKE 2', 'BOUAKE 2/DAR ES SALAM 1', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 439
  ('BOUAKE 2', 'BOUAKE 2/ DAR ES SALAM 2', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 440
  ('BOUAKE 2', 'KATIOLA', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 441
  ('BOUAKE 2', 'DABAKALA', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 442
  ('BOUAKE 2', 'BOBLENOU', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 443
  ('BOUAKE 2', 'KOTIAKRO & CORRIDOR NORD', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 444
  ('BOUAKE 2', 'M''BAHIAKRO', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: 445
  ('KORHOGO', 'KORHOGO/NOUVEAU QUARTIER', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 446
  ('KORHOGO', 'KORHOGO/ROUTE LYCEE & QUARTIER 14', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 447
  ('KORHOGO', 'KORHOGO/AIR FRANCE & SINISTRE', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 448
  ('KORHOGO', 'KORHOGO/ROUTE AEROPORT', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 449
  ('KORHOGO', 'KORHOGO/SOBA', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 450
  ('KORHOGO', 'KORHOGO/KASSIRIME', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 451
  ('KORHOGO', 'KORHOGO/TCHEKELEZO', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 452
  ('KORHOGO', 'KORHOGO/BELLEVILLE', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 453
  ('KORHOGO', 'KORHOGO/PETIT PARIS', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 454
  ('KORHOGO', 'KORHOGO/QUARTIER CHAMPAGNARD & OCHINNIN', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 455
  ('KORHOGO', 'KORHOGO/NATIO & ZONE INDUSTRIELLE', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 456
  ('KORHOGO', 'KOKO MOSQUEE', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 457
  ('KORHOGO', 'HAOUSSABOUGOU', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 458
  ('KORHOGO', 'SOZOROUBOUGOU', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 459
  ('KORHOGO', 'KOKO NAGUIN', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 460
  ('KORHOGO', 'BONAFORO/ DELAFOSSE', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 461
  ('KORHOGO', 'COCODY', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 462
  ('KORHOGO', 'KLOFOHAKAHA/NAGNENEFOUN', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 463
  ('KORHOGO', 'KOKO MATERNITE/MONGAHA', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 464
  ('KORHOGO', 'TEGUERE/RESIDENTIEL', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 465
  ('KORHOGO', 'NOUVEAU QUARTIER', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 466
  ('KORHOGO', 'TENGRELA', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 467
  ('KORHOGO', 'GBON', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 468
  ('KORHOGO', 'KOUTO', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 469
  ('KORHOGO', 'BOUNDIALI', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 470
  ('KORHOGO', 'NIAPE', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 471
  ('KORHOGO', 'KONG', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 472
  ('KORHOGO', 'FERKESSEDOUGOU', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 473
  ('KORHOGO', 'SINEMATIALI', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'COULIBALY PADIE', 'cnefckorhogo@gmail.com', 'CNE'), -- CSV ID: 474
  ('YAMOUSSOUKRO', 'YAMOUSSOUKRO/GARE ROUTIERE', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 475
  ('YAMOUSSOUKRO', 'YAKRO/HABITAT', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 476
  ('YAMOUSSOUKRO', 'YAKRO/ASSABOU', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 477
  ('YAMOUSSOUKRO', 'YAKRO/220LGTS', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 478
  ('YAMOUSSOUKRO', 'YAKRO/ENERGIE', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 479
  ('YAMOUSSOUKRO', 'YAKRO/DIOULABOUGOU 1', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 480
  ('YAMOUSSOUKRO', 'YAKRO/DIOULABOUGOU 2', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 481
  ('YAMOUSSOUKRO', 'YAKRO/SOPIM', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 482
  ('YAMOUSSOUKRO', 'YAKRO/KOKRENOU', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 483
  ('YAMOUSSOUKRO', 'YAKRO/MAKORA', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 484
  ('YAMOUSSOUKRO', 'YAKRO/NANAN & MILLIONNAIRE', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 485
  ('YAMOUSSOUKRO', 'YAKRO/KAMI & EBENEZER', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 486
  ('YAMOUSSOUKRO', 'YAKRO/KPANGBASSOU & 227', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 487
  ('YAMOUSSOUKRO', 'YAKRO/MOROFE', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 488
  ('YAMOUSSOUKRO', 'ZATTA & BOUAFLE', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 489
  ('YAMOUSSOUKRO', 'ZUENOULA', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 490
  ('YAMOUSSOUKRO', 'SEMAN & TIEBISSOU', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 491
  ('YAMOUSSOUKRO', 'TOUMODI', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 492
  ('YAMOUSSOUKRO', 'TIEBISSOU', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'ASSAMOI TRESOR', 'cnefcyamoussoukro@gmail.com', 'CNE'), -- CSV ID: 493
  ('DALOA', 'DALOA/QUARTIER MARESSE', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: 494
  ('DALOA', 'DALOA/EVECHE', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: 495
  ('DALOA', 'DALOA/TAZIBOU', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: 496
  ('DALOA', 'DALOA/ORLY 1', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: 497
  ('DALOA', 'DALOA/ORLY 2', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: 498
  ('DALOA', 'DALOA/HUBERSON', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: 499
  ('DALOA', 'DALOA/TEXAS', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO') -- CSV ID: 500;

-- Batch 6 (lignes 501 à 600)
INSERT INTO public.zones_secteurs (zone, secteur, merchandiser, email_merchandiser, sales_rep, email_sales_rep, region) VALUES
  ('DALOA', 'DALOA/BGOKORA', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: 501
  ('DALOA', 'DALOA/KENEDY', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: 502
  ('DALOA', 'DALOA/BGELLEVILLE', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: 503
  ('DALOA', 'DALOA/FADIGUA', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: 504
  ('DALOA', 'DALOA/MILLIONNAIRE', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: 505
  ('DALOA', 'DALOA/QUARTIER MARRAIN', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'C'), -- CSV ID: 506
  ('DALOA', 'BONOUFLA', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: 507
  ('GAGNOA', 'GAGNOA/ZAPATA', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 508
  ('GAGNOA', 'GAGNOA/GARAHIO', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 509
  ('GAGNOA', 'GAGNOA/DELBO 1 & 2', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 510
  ('GAGNOA', 'GAGNOA/CISSE KAMOUROU', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 511
  ('GAGNOA', 'GAGNOA/DIOULABOUGOU', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 512
  ('GAGNOA', 'GAGNOA/SOLEIL', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 513
  ('GAGNOA', 'GAGNOA/DJANCA', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 514
  ('GAGNOA', 'GAGNOA/CAMP FONCTIONNAIRE', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 515
  ('GAGNOA', 'GAGNOA/AFRIDOUGOU', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 516
  ('GAGNOA', 'GAGNOA/SECTEUR CIB & GUESSIO', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 517
  ('GAGNOA', 'GAGNOA/ZAPATA RESIDENTIEL', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 518
  ('GAGNOA', 'GAGNOA/SECTEUR COMMERCE', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 519
  ('GAGNOA', 'GAGNOA/CAFOP & GODIABRE', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 520
  ('GAGNOA', 'GAGNOA/MAHIDIO', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 521
  ('GAGNOA', 'GAGNOA/CHATEAU', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 522
  ('GAGNOA', 'GAGNOA/BARHUO', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 523
  ('GAGNOA', 'GAGNOA/BABRE', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 524
  ('GAGNOA', 'DIVO', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 525
  ('GAGNOA', 'OUME', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 526
  ('GAGNOA', 'LAKOTA', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 527
  ('GAGNOA', 'HIRE', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 528
  ('GAGNOA', 'TIASSALE', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 529
  ('GAGNOA', 'NDOUCI', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'KACOU LEONARD', 'cnofcgagnoa@gmail.com', 'CNO'), -- CSV ID: 530
  ('MAN', 'MAN/BABADJAN & QUARTIER THERESE', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 531
  ('MAN', 'MAN/CAMP DES', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 532
  ('MAN', 'MAN/DOYAGUINE', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 533
  ('MAN', 'MAN/LYCEE MUNICIPAL', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 534
  ('MAN', 'MAN/QUARTIER SARI', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 535
  ('MAN', 'MAN/AIR FRANCE', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 536
  ('MAN', 'MAN/CAMPUS', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 537
  ('MAN', 'MAN/LIBREVILLE', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 538
  ('MAN', 'KPANGOUIN', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 539
  ('MAN', 'DUEKOUE', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 540
  ('MAN', 'GUIGLO', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 541
  ('MAN', 'FACOBLY & KOUIBLY', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 542
  ('MAN', 'ZELE', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 543
  ('MAN', 'BANGOLO', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 544
  ('MAN', 'LOGOUALE', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 545
  ('MAN', 'GRAND GBAPLEU', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 546
  ('MAN', 'DANANE', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 547
  ('MAN', 'ZOUNHIEN', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 548
  ('MAN', 'ODIENNE', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: 549
  ('SAN PEDRO', 'SAN PEDRO/BARDOT 18', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 550
  ('SAN PEDRO', 'SAN PEDRO/COLAS', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 551
  ('SAN PEDRO', 'SAN PEDRO/TERRE ROUGE', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 552
  ('SAN PEDRO', 'SAN PEDRO/CMA & JB', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 553
  ('SAN PEDRO', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 554
  ('SAN PEDRO', 'SAN PEDRO/JULES FERRY & MANZAN -', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 555
  ('SAN PEDRO', 'SAN PEDRO/QUARTIER LAC - CITE', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 556
  ('SAN PEDRO', 'SAN PEDRO/NITORO', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 557
  ('SAN PEDRO', 'SAN PEDRO/FRANCOPHONIE', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 558
  ('SAN PEDRO', 'SAN PEDRO/SEWEKE', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 559
  ('SAN PEDRO', 'SAN PEDRO/GARE', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 560
  ('SAN PEDRO', 'SAN PEDRO/SOTREF & COLOMBIE', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 561
  ('SAN PEDRO', 'GRAND BEREBY', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 562
  ('SAN PEDRO', 'SOGB', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 563
  ('SAN PEDRO', 'TABOU', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 564
  ('SAN PEDRO', 'SASSANDRA', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 565
  ('SAN PEDRO', 'GABIADJI', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 566
  ('SAN PEDRO', 'TOUIHI', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: 567
  ('SOUBRE', 'SOUBRE/CAMP MANOIR', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 568
  ('SOUBRE', 'SOUBRE/ABATTOIR', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 569
  ('SOUBRE', 'SOUBRE/GKAKALEKPA', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 570
  ('SOUBRE', 'SOUBRE/GRIPAZO', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 571
  ('SOUBRE', 'SOUBRE/NAMBOUHI', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 572
  ('SOUBRE', 'SOUBRE/KPEHIRI', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 573
  ('SOUBRE', 'SOUBRE/KENNEDY', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 574
  ('SOUBRE', 'SOUBRE/COMMERCE', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 575
  ('SOUBRE', 'SOUBRE/GABON', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 576
  ('SOUBRE', 'SOUBRE/CHÂTEAU', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 577
  ('SOUBRE', 'SOUBRE/CHOCOYO', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 578
  ('SOUBRE', 'SOUBRE/DALLAS', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 579
  ('SOUBRE', 'SOUBRE/GBAZEBRE', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 580
  ('SOUBRE', 'YABAYO', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 581
  ('SOUBRE', 'BUYO', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 582
  ('SOUBRE', 'ISSIA', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 583
  ('SOUBRE', 'MEAGUI', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 584
  ('SOUBRE', 'GUEYO', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 585
  ('SOUBRE', 'OKROUYO', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 586
  ('SOUBRE', '4 CARREFOURS', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 587
  ('SOUBRE', 'GRAND ZATTRY', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 588
  ('SOUBRE', 'ZAKEOUA', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 589
  ('SOUBRE', 'TAPEGUIA', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 590
  ('SOUBRE', 'GBAKAYO', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 591
  ('SOUBRE', 'MAYO', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 592
  ('SOUBRE', 'LILIYO', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 593
  ('SOUBRE', 'OTAWA', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 594
  ('SOUBRE', 'DAPEYO', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'cnofcsoubre@gmail.com', 'CNO'), -- CSV ID: 595
  ('MODERN TRADE', 'YOPOUGON MT', NULL, 'yopmodernetrade23@gmail.com', NULL, 'yopmodernetrade23@gmail.com', 'MODERN TRADE'), -- CSV ID: 596
  ('ABOBO', '4 ETAGES', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-428
  ('ABOBO', 'ABOBO BAOULE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-429
  ('ABOBO', 'ABOBO CENTRE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-430
  ('ABOBO', 'ABOBOTE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE') -- CSV ID: MT-431;

-- Batch 7 (lignes 601 à 700)
INSERT INTO public.zones_secteurs (zone, secteur, merchandiser, email_merchandiser, sales_rep, email_sales_rep, region) VALUES
  ('ABOBO', 'ABOBOTE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-432
  ('ABOBO', 'AGBEIKOI', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-433
  ('ABOBO', 'AGRIPAC', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-434
  ('ABOBO', 'AHOUE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-435
  ('ABOBO', 'AKEIKOI', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-436
  ('ABOBO', 'ALEPE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-437
  ('ABOBO', 'ANADOR', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-438
  ('ABOBO', 'ANONKOUA KOUTE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-439
  ('ABOBO', 'ANYAMA', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-440
  ('ABOBO', 'AVENUE KAZA', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-441
  ('ABOBO', 'BC', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-442
  ('ABOBO', 'BELLEVILLE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-443
  ('ABOBO', 'BIABOU', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-444
  ('ABOBO', 'CAMP COMMANDO', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-445
  ('ABOBO', 'CITE ONUCI', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-446
  ('ABOBO', 'DEPOT 9', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-447
  ('ABOBO', 'DERRIERE RAILS', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-448
  ('ABOBO', 'EBIMPE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-449
  ('ABOBO', 'GAGNOA GARE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-450
  ('ABOBO', 'HOUPHOUET BOIGNY', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-451
  ('ABOBO', 'KOBAKRO', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-452
  ('ABOBO', 'LYCEE MUNICIPAL', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-453
  ('ABOBO', 'MARAHOUE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-454
  ('ABOBO', 'NDOTRE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-455
  ('ABOBO', 'PAILLET', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-456
  ('ABOBO', 'PK 18', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-457
  ('ABOBO', 'PLAQUE 1&2', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-458
  ('ABOBO', 'PLATEAU DOKOUI', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-459
  ('ABOBO', 'PLATEAU DOKOUI', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-460
  ('ABOBO', 'POMPE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-461
  ('ABOBO', 'SAMAKE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-462
  ('ABOBO', 'SAMAKE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-463
  ('ABOBO', 'SOGEPHIA', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-464
  ('ABOBO', 'SOTRAPIM', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-465
  ('BINGERVILLE', 'GBAGBA', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-466
  ('BINGERVILLE', 'MARCHE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-467
  ('BINGERVILLE', 'SICOGI', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-468
  ('COCODY', '2 PLATEAUX', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-469
  ('COCODY', '2 PLATEAUX', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-470
  ('COCODY', 'ABATTA', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-471
  ('COCODY', 'AKOUEDO', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-472
  ('COCODY', 'ANGRE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-473
  ('COCODY', 'ANGRE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-474
  ('COCODY', 'ANONO', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-475
  ('COCODY', 'ATTOBAN', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-476
  ('COCODY', 'ATTOBAN', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-477
  ('COCODY', 'BESSIKOI', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-478
  ('COCODY', 'BESSIKOI', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-479
  ('COCODY', 'BINGERVILLE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-480
  ('COCODY', 'BLOCKAUSS', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-481
  ('COCODY', 'BONOUMIN', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-482
  ('COCODY', 'BONOUMIN', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-483
  ('COCODY', 'CITE SIR', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-484
  ('COCODY', 'CITE SIR', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-485
  ('COCODY', 'COCODY CENTRE -', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-486
  ('COCODY', 'DANGA', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-487
  ('COCODY', 'DJOROBITE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-488
  ('COCODY', 'FAYA', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-489
  ('COCODY', 'FAYA A DROITE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-490
  ('COCODY', 'FAYA A GAUCHE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-491
  ('COCODY', 'MAHOU', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-492
  ('COCODY', 'MAHOU', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-493
  ('COCODY', 'M''BADON', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-494
  ('COCODY', 'M''POUTO', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-495
  ('COCODY', 'PALMERAIE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-496
  ('COCODY', 'PALMERAIE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-497
  ('COCODY', 'RIVIERA 2', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-498
  ('COCODY', 'RIVIERA 3', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-499
  ('ADJAME', 'DALLAS', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-501
  ('ADJAME', 'FORUM', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-502
  ('ADJAME', 'MOSQUEE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-503
  ('ADJAME', 'LIBERTE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-504
  ('ADJAME', 'WILLIAMSVILLE', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-505
  ('ADJAME', 'RENAULT', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-506
  ('ADJAME', '220 LOGEMENTS', 'ISMAEL KOUAKOU', 'kouakouismael.pro@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-507
  ('ATTECOUBE', 'MOSSIKRO', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-508
  ('ATTECOUBE', 'LOCODJRO', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-509
  ('ATTECOUBE', 'ABOBODOUME', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-510
  ('ATTECOUBE', 'BRAMAKOTE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-511
  ('ATTECOUBE', 'AGBAN VILLAGE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-512
  ('ATTECOUBE', 'CITE FERMONT', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-513
  ('ATTECOUBE', 'ATTECOUBE CENTRE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'AKUNDAH ANNE MARIE', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-514
  ('KOUMASSI', 'DJE KONAN', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-515
  ('KOUMASSI', 'INCHALLAH', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-516
  ('KOUMASSI', 'AGOUTI', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-517
  ('KOUMASSI', 'PANGOLIN', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-518
  ('KOUMASSI', 'NOUVEAU MARCHE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-519
  ('KOUMASSI', 'KOUMASSI 05', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-520
  ('KOUMASSI', 'REMBLAIS', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-521
  ('KOUMASSI', 'KAHIRA', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-522
  ('KOUMASSI', 'MARAIS', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-523
  ('KOUMASSI', 'SOWETO', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-524
  ('KOUMASSI', 'SICOGI', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-525
  ('MARCORY', 'MARCORY CENTRE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-526
  ('MARCORY', 'ZONE 4', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-527
  ('MARCORY', 'BIETRY', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-528
  ('MARCORY', 'REMBLAIS', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-529
  ('MARCORY', 'STE BERNADETTE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-530
  ('MARCORY', 'STE THERESE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-531
  ('MARCORY', 'RESIDENTIELLE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE') -- CSV ID: MT-532;

-- Batch 8 (lignes 701 à 800)
INSERT INTO public.zones_secteurs (zone, secteur, merchandiser, email_merchandiser, sales_rep, email_sales_rep, region) VALUES
  ('MARCORY', 'INJS', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-533
  ('MARCORY', 'CHAMPROUX', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-534
  ('MARCORY', 'ANOUMANBO', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-535
  ('MARCORY', 'SANS-FIL', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-536
  ('MARCORY', 'KBF', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-537
  ('MARCORY', 'GROUPEMENT FONCIER', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-538
  ('MARCORY', 'MASSARANA', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-539
  ('PLATEAU', 'RUE DE COMMERCE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-540
  ('PLATEAU', 'RUE DES BANQUES', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-541
  ('PLATEAU', 'NOSTALGIE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-542
  ('PLATEAU', 'PRESIDENCE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-543
  ('PLATEAU', 'LONGCHAMP', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-544
  ('PLATEAU', 'VOIE LAGUNAIRE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-545
  ('PORT-BOUET', 'PORT-BOUET CENTRE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-546
  ('PORT-BOUET', 'GONZAGUE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-547
  ('PORT-BOUET', 'VRIDI', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-548
  ('PORT-BOUET', 'ROND POINT ANANI', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-549
  ('PORT-BOUET', 'AEROPORT', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-550
  ('PORT-BOUET', 'ABATTOIR', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-551
  ('PORT-BOUET', 'JEAN FOLIE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-552
  ('TREICHVILLE', 'KM4', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-553
  ('TREICHVILLE', 'PORT', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-554
  ('TREICHVILLE', 'France AMERIQUE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-555
  ('TREICHVILLE', 'BELLEVILLE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-556
  ('TREICHVILLE', 'RONDPOINT', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-557
  ('TREICHVILLE', 'AVENUE 2', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-558
  ('TREICHVILLE', 'ZONE 3', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-559
  ('TREICHVILLE', 'ARRAS', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-560
  ('TREICHVILLE', 'BIAFRA', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-561
  ('YOPOUGON', 'ACADEMIE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-562
  ('YOPOUGON', 'ANANERAIE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-563
  ('YOPOUGON', 'BANCO', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-564
  ('YOPOUGON', 'CAMP MILITAIRE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-565
  ('YOPOUGON', 'GABRIEL GARE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-566
  ('YOPOUGON', 'GESCO', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-567
  ('YOPOUGON', 'KOUTE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-568
  ('YOPOUGON', 'KOWEIT', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-569
  ('YOPOUGON', 'MAROC', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-570
  ('YOPOUGON', 'MILLIONNAIRE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-571
  ('YOPOUGON', 'NIANGON A DROITE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-572
  ('YOPOUGON', 'NIANGON A GAUCHE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-573
  ('YOPOUGON', 'NOUVEAU QUARTIER', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-574
  ('YOPOUGON', 'PALAIS', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-575
  ('YOPOUGON', 'WASSAKARA', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-576
  ('YOPOUGON', 'SELMER', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-577
  ('YOPOUGON', 'SIDECI', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-578
  ('YOPOUGON', 'SIPOREX', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-579
  ('YOPOUGON', 'SOGEFIA', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-580
  ('YOPOUGON', 'TOIT ROUGE', 'SONIA AKON', 'akonsoniasunshine@gmail.com', 'SONIA AKON', 'annydivine49@gmail.com', 'MODERN TRADE'), -- CSV ID: MT-581
  ('DALOA', 'Labia', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-434
  ('DALOA', 'Grande mosquée', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-435
  ('DALOA', 'Commerce', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-436
  ('DALOA', 'Hopital general CHR', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-437
  ('DALOA', 'BCEAO', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-438
  ('DALOA', 'Grand marché', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-439
  ('DALOA', 'Soleil 1', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-440
  ('DALOA', 'soleil 2', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-441
  ('DALOA', 'Kennedy 1', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-442
  ('DALOA', 'Kennedy 2', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-443
  ('DALOA', 'Belle cote', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-444
  ('DALOA', 'Quartier suisse', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-445
  ('DALOA', 'Millionnaire', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-446
  ('DALOA', 'Huberson', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-447
  ('DALOA', 'Orly 1', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-448
  ('DALOA', 'Orly 2', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-449
  ('DALOA', 'Orly 3', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-450
  ('DALOA', 'Gbeulville', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-451
  ('DALOA', 'Fatiga', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-452
  ('DALOA', 'Abattoir 1', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-453
  ('DALOA', 'Abattoir 2', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-454
  ('DALOA', 'Garage', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-455
  ('DALOA', 'Orly Plateau', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-456
  ('DALOA', 'Marin', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-457
  ('DALOA', 'Orly Marché', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-458
  ('DALOA', 'Savonnerie', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-459
  ('DALOA', 'Tazibouo 1', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-460
  ('DALOA', 'Tazibouo 2', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-461
  ('DALOA', 'Tazibouo 3', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-462
  ('DALOA', 'Balouzon', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-463
  ('DALOA', 'Sapia', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-464
  ('DALOA', 'Gbokora', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-465
  ('DALOA', 'Tagoura', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-466
  ('DALOA', 'Zaguiguia', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-467
  ('DALOA', 'Lobia 1', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-468
  ('DALOA', 'Lobia 2', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-469
  ('DALOA', 'Cafop', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-470
  ('DALOA', 'Archives', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-471
  ('DALOA', 'Tazibouo Plateau', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-472
  ('DALOA', 'Evéché', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-473
  ('ABENGOUROU', 'Abengourou/Relais', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: MISEAJOUR-476
  ('ABENGOUROU', 'Abengourou/ Zaranou', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: MISEAJOUR-477
  ('ABENGOUROU', 'Abengourou/Arrah', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: MISEAJOUR-478
  ('ABENGOUROU', 'Abengourou/Bongouanou', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: MISEAJOUR-479
  ('ABENGOUROU', 'Abengourou/M''batto', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'ZANGA OUATTARA', 'cnefcabengourou@gmail.com', 'CNE'), -- CSV ID: MISEAJOUR-480
  ('DALOA', 'Vavoua', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-481
  ('DALOA', 'Gonate', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-482
  ('DALOA', 'Bonon', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-483
  ('DALOA', 'Seguela', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-484
  ('BOUAKE 1', 'Botro', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: MISEAJOUR-485
  ('BOUAKE 1', 'Beaufort', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE') -- CSV ID: MISEAJOUR-486;

-- Batch 9 (lignes 801 à 831)
INSERT INTO public.zones_secteurs (zone, secteur, merchandiser, email_merchandiser, sales_rep, email_sales_rep, region) VALUES
  ('BOUAKE 1', 'Maroc', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: MISEAJOUR-487
  ('BOUAKE 1', 'Commerce', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: MISEAJOUR-488
  ('BOUAKE 1', 'Diabo', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: MISEAJOUR-489
  ('BOUAKE 1', 'Teningoué', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: MISEAJOUR-490
  ('BOUAKE 1', 'Mankono', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: MISEAJOUR-491
  ('BOUAKE 1', 'Tollakouadiokro', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'Guea Hermann', 'cnefcbouake01@gmail.com', 'CNE'), -- CSV ID: MISEAJOUR-492
  ('MAN', 'Kongouin', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-493
  ('MAN', 'Koko', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-494
  ('MAN', 'Lycée', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-495
  ('MAN', 'Club Lycée', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-496
  ('MAN', 'Dioulabougou', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-497
  ('MAN', 'Blolequin', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'SEWINDE NOUHOUN', 'nsinwinde@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-498
  ('SAN PEDRO', 'Méagui', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'EBROTTIE MIAN CHRISTIAN INNOCENT', 'fcouestsanpedro@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-499
  ('YOPOUGON 4', 'NIANGON NORD', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: MISEAJOUR-500
  ('YOPOUGON 4', 'SICOGI ATTIE', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: MISEAJOUR-501
  ('YOPOUGON 4', 'BON PRIX', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: MISEAJOUR-502
  ('YOPOUGON 4', 'LUBAFRIQUE', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: MISEAJOUR-503
  ('YOPOUGON 4', 'TEXACO', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'GAI KAMI', 'abidjannordfcyopougon3@gmail.com', 'ABIDJAN 2'), -- CSV ID: MISEAJOUR-504
  ('YAMOUSSOUKRO', 'BOCANDA', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-505
  ('YAMOUSSOUKRO', 'SINFRA', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-506
  ('YAMOUSSOUKRO', 'DIMBOKRO', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-507
  ('YAMOUSSOUKRO', 'INPHB', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-508
  ('YAMOUSSOUKRO', 'Cafop', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-509
  ('YAMOUSSOUKRO', '100 LOGEMENTS GARCON', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-510
  ('YAMOUSSOUKRO', '50 Logements', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-511
  ('YAMOUSSOUKRO', 'Attiegouakro', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-512
  ('YAMOUSSOUKRO', 'Logbakro', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-513
  ('YAMOUSSOUKRO', 'Akpessekro', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-514
  ('YAMOUSSOUKRO', 'Duokro', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-515
  ('YAMOUSSOUKRO', 'Kpoussoussou', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO'), -- CSV ID: MISEAJOUR-516
  ('YAMOUSSOUKRO', 'Belleville', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'N''DJA KOFFI FLORENT', 'cnofcdaloa@gmail.com', 'CNO') -- CSV ID: MISEAJOUR-517;

-- ============================================================
-- Vérification post-import
-- ============================================================
-- SELECT count(*) as total, count(DISTINCT zone) as zones, count(DISTINCT region) as regions
-- FROM public.zones_secteurs;
-- Attendu: ~831 total, ~50+ zones, ~10+ régions
