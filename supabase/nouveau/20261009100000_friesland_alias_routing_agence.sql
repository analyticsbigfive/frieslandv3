-- ============================================================================
-- ALIAS DU ROUTING MENSUEL D'ATOM — réponses du client du 9 octobre 2026
--
-- À appliquer APRÈS les 7 migrations de la PR #14 (la 20261008130000 ouvre
-- les types d'alias « quartier » et « commercial »).
--
-- 1. Lieux : Atom confirme les quartiers proposés dans
--    points-de-visite-a-confirmer.xlsx. Seules les propositions du secteur du
--    merchandiser sont reprises ; « Port-Bouët 2 » est le quartier de
--    Yopougon (pas la commune de Port-Bouët). Les lieux sans proposition, ou
--    seulement hors secteur, restent à rattacher (jours au portefeuille).
-- 2. SSF : quatre correspondances confirmées par Atom, et deux orthographes
--    du fichier (même distributeur, une lettre d'écart).
-- 3. Commercial : « Mme Tea » = Anne-Marie, commerciale de Guihi Bernadin.
--
-- Motifs déjà normalisés (majuscules, sans accents ni ponctuation), comme
-- motifAlias (scripts/lib/commun.mjs). Modifiables ensuite dans
-- Référentiels › Distribution › Alias d'import. Idempotent.
-- ============================================================================
begin;

insert into public.alias_import (type, motif, mode, cible, commentaire) values
  ('quartier', 'ABOBO 4 ETAGES', 'exact', 'ABOBO 1›ABOBO CENTRE | ABOBO 1›ABOBOTE | ABOBO 1›ABOBO BAOULE', 'Abobo : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'AGBEKOI', 'exact', 'ABOBO 1›AGBEIKOI', 'Abobo : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'GARE ABOBO', 'exact', 'ABOBO 1›ABOBO CENTRE | ABOBO 1›ABOBOTE | ABOBO 1›ABOBO BAOULE', 'Abobo : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'LYCEE MODERNE ABOBO', 'exact', 'ABOBO 1›ABOBO CENTRE | ABOBO 1›ABOBOTE | ABOBO 1›ABOBO BAOULE', 'Abobo : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'MUSEE D ABOBO', 'exact', 'ABOBO 1›ABOBO CENTRE | ABOBO 1›ABOBOTE | ABOBO 1›ABOBO BAOULE', 'Abobo : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'NOUVELLE GARE', 'exact', 'ABOBO 1›GAGNOA GARE', 'Abobo : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'PLAQUE 1', 'exact', 'ABOBO 1›PLAQUE 1&2', 'Abobo : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ABOBO BAOULE 2', 'exact', 'ABOBO 1›ABOBO BAOULE | ABOBO›ABOBO BAOULE | ABOBO 1›ABOBO CENTRE', 'Abobo - Anyama : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ABOBO BELLE VIE', 'exact', 'ABOBO 1›ABOBO CENTRE | ABOBO 1›ABOBOTE | ABOBO 1›BELLEVILLE', 'Abobo - Anyama : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ANADOR 2', 'exact', 'ABOBO 2›ANADOR', 'Abobo - Anyama : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'BELLE VIE', 'exact', 'ABOBO 1›BELLEVILLE | ABOBO›BELLEVILLE', 'Abobo - Anyama : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'DOKUI', 'exact', 'ABOBO 1›PLATEAU DOKOUI | ABOBO›PLATEAU DOKOUI', 'Abobo - Anyama : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'N DOTRE', 'exact', 'ABOBO 2›NDOTRE | ABOBO›NDOTRE', 'Abobo - Anyama : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', '220 LOGEMENTS 1', 'exact', 'ADJAME›220 LOGEMENTS | ADJAME›220 LGTs', 'Adjamé - Attécoubé - Williamsville : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', '220 LOGEMENTS 2', 'exact', 'ADJAME›220 LOGEMENTS | ADJAME›220 LGTs', 'Adjamé - Attécoubé - Williamsville : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ATTECOUBE 1', 'exact', 'ATTECOUBE-PLATEAU›ATTECOUBE | ATTECOUBE›ATTECOUBE CENTRE', 'Adjamé - Attécoubé - Williamsville : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ATTECOUBE 2', 'exact', 'ATTECOUBE-PLATEAU›ATTECOUBE | ATTECOUBE›ATTECOUBE CENTRE', 'Adjamé - Attécoubé - Williamsville : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'BRACODI 1', 'exact', 'ADJAME›BRACODI', 'Adjamé - Attécoubé - Williamsville : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'BRACODI 2', 'exact', 'ADJAME›BRACODI', 'Adjamé - Attécoubé - Williamsville : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'BRAMAKOTE 1', 'exact', 'ATTECOUBE-PLATEAU›BRAMAKOTE', 'Adjamé - Attécoubé - Williamsville : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'BRAMAKOTE 2', 'exact', 'ATTECOUBE-PLATEAU›BRAMAKOTE', 'Adjamé - Attécoubé - Williamsville : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'CITE FAIRMONT ET ATTECOUBE 2', 'exact', 'ATTECOUBE-PLATEAU›ATTECOUBE | ATTECOUBE›ATTECOUBE CENTRE', 'Adjamé - Attécoubé - Williamsville : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'DALLAS 1', 'exact', 'ADJAME›DALLAS', 'Adjamé - Attécoubé - Williamsville : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'DALLAS 2', 'exact', 'ADJAME›DALLAS', 'Adjamé - Attécoubé - Williamsville : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'SAINT MICHEL 1', 'exact', 'ADJAME›SAINT MICHEL', 'Adjamé - Attécoubé - Williamsville : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'WILLIAMSVILLE 1', 'exact', 'ADJAME›WILLIAMSVILLE', 'Adjamé - Attécoubé - Williamsville : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', '2 PLATEAUX BLEU MARINE', 'exact', 'COCODY 1›2 PLATEAUX | COCODY›2 PLATEAUX', 'Cocody - 2 Plateaux - Riviera : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', '2 PLATEAUX CASA', 'exact', 'COCODY 1›2 PLATEAUX | COCODY›2 PLATEAUX', 'Cocody - 2 Plateaux - Riviera : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', '2 PLATEAUX COLOMBIE', 'exact', 'COCODY 1›2 PLATEAUX | COCODY›2 PLATEAUX', 'Cocody - 2 Plateaux - Riviera : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', '2 PLATEAUX VALON', 'exact', 'COCODY 1›2 PLATEAUX | COCODY›2 PLATEAUX', 'Cocody - 2 Plateaux - Riviera : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ANONO 1 ET 2', 'exact', 'COCODY 2›ANONO | COCODY›ANONO', 'Cocody - 2 Plateaux - Riviera : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ANONO 3', 'exact', 'COCODY 2›ANONO | COCODY›ANONO', 'Cocody - 2 Plateaux - Riviera : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ANONO 4', 'exact', 'COCODY 2›ANONO | COCODY›ANONO', 'Cocody - 2 Plateaux - Riviera : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'BLOCKOSS ET COCODY CENTRE', 'exact', 'COCODY 2›COCODY CENTRE | COCODY›COCODY CENTRE -', 'Cocody - 2 Plateaux - Riviera : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'DANGA CITE DES ARTS', 'exact', 'COCODY›DANGA', 'Cocody - 2 Plateaux - Riviera : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'M POUTO ET CAD', 'exact', 'COCODY 2›M''POUTO | COCODY›M''POUTO', 'Cocody - 2 Plateaux - Riviera : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'MAHOU DOKOUI', 'exact', 'COCODY 1›MAHOU | COCODY›MAHOU', 'Cocody - 2 Plateaux - Riviera : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'RIVIERA', 'exact', 'COCODY 2›RIVIERA 2 | COCODY 2›RIVIERA 3 | COCODY›RIVIERA 3', 'Cocody - 2 Plateaux - Riviera : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ABATTA VILLAGE', 'exact', 'COCODY 2›ABATTA | COCODY›ABATTA', 'Cocody - Angré - Abatta : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'AKOUEDO ATTIE', 'exact', 'COCODY 2›AKOUEDO | COCODY›AKOUEDO', 'Cocody - Angré - Abatta : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ANGRE 8E TRANCHE', 'exact', 'COCODY 1›ANGRE | COCODY›ANGRE', 'Cocody - Angré - Abatta : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ANGRE CHATEAU', 'exact', 'COCODY 1›ANGRE | COCODY›ANGRE', 'Cocody - Angré - Abatta : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ANGRE CHU', 'exact', 'COCODY 1›ANGRE | COCODY›ANGRE', 'Cocody - Angré - Abatta : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ANGRE MAHOU 1', 'exact', 'COCODY 1›ANGRE | COCODY 1›MAHOU | COCODY›ANGRE', 'Cocody - Angré - Abatta : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ANGRE MAHOU 2', 'exact', 'COCODY 1›ANGRE | COCODY 1›MAHOU | COCODY›ANGRE', 'Cocody - Angré - Abatta : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'DJOROBITE 1', 'exact', 'COCODY 1›DJOROBITE | COCODY›DJOROBITE', 'Cocody - Angré - Abatta : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'DJOROBITE 2', 'exact', 'COCODY 1›DJOROBITE | COCODY›DJOROBITE', 'Cocody - Angré - Abatta : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'FAYA EPHRATA', 'exact', 'COCODY 1›FAYA | COCODY 2›FAYA | COCODY›FAYA', 'Cocody - Angré - Abatta : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'PALMERAIE BONOUMIN', 'exact', 'COCODY 1›PALMERAIE | COCODY 1›BONOUMIN | COCODY›PALMERAIE', 'Cocody - Angré - Abatta : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'PALMERAIE ENICA', 'exact', 'COCODY 1›PALMERAIE | COCODY›PALMERAIE', 'Cocody - Angré - Abatta : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'BIA SUD', 'exact', 'KOUMASSI›ABIA SUD', 'Koumassi : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'DIVO', 'exact', 'KOUMASSI›QUARTIER DIVO', 'Koumassi : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'KOUMASSI 05', 'exact', 'KOUMASSI›KOUMASSI 32', 'Koumassi : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'KOUMASSI 147', 'exact', 'KOUMASSI›KOUMASSI 32', 'Koumassi : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'KOUMASSI FANNY', 'exact', 'KOUMASSI›KOUMASSI 32', 'Koumassi : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'MARCHE DE KOUMASSI', 'exact', 'KOUMASSI›KOUMASSI 32', 'Koumassi : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ANOUMABO', 'exact', 'MARCORY›Anoumanbo | MARCORY TREICHVILLE›Anoumanbo | Marcory›Anoumanbo', 'Marcory - Treichville : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'BELLE VILLE', 'exact', 'TREICHVILLE›Belleville | TREICHVILLE›BELLEVILLE', 'Marcory - Treichville : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'CENTRE COMMERCIAL', 'exact', 'MARCORY›MARCORY CENTRE', 'Marcory - Treichville : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ZONE PORTUAIRE', 'exact', 'TREICHVILLE›Cité du port | TREICHVILLE›PORT', 'Marcory - Treichville : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ANANERAIE ENTENNE', 'exact', 'YOPOUGON›ANANERAIE', 'Yopougon 1 & 2 : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ANANERAIE LKM', 'exact', 'YOPOUGON›ANANERAIE', 'Yopougon 1 & 2 : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ANDOKOI 1', 'exact', 'YOPOUGON 3›ANDOKOI', 'Yopougon 1 & 2 : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'ANDOKOI 2', 'exact', 'YOPOUGON 3›ANDOKOI', 'Yopougon 1 & 2 : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'BAGNON', 'exact', 'YOPOUGON 4›MARCHE BAGNON | YOPOUGON 3›MARCHE BAGNON', 'Yopougon 1 & 2 : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'MAROC 1', 'exact', 'YOPOUGON 4›MAROC | YOPOUGON›MAROC | YOPOUGON 3›MAROC', 'Yopougon 1 & 2 : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'MAROC 2', 'exact', 'YOPOUGON 4›MAROC | YOPOUGON›MAROC | YOPOUGON 3›MAROC', 'Yopougon 1 & 2 : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'MAROC 3', 'exact', 'YOPOUGON 4›MAROC | YOPOUGON›MAROC | YOPOUGON 3›MAROC', 'Yopougon 1 & 2 : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'MAROC 4', 'exact', 'YOPOUGON 4›MAROC | YOPOUGON›MAROC | YOPOUGON 3›MAROC', 'Yopougon 1 & 2 : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'PORT BOUET 2 1', 'exact', 'YOPOUGON 3›PORT BOUET 2', 'Yopougon 1 & 2 : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'PORT BOUET 2 2', 'exact', 'YOPOUGON 3›PORT BOUET 2', 'Yopougon 1 & 2 : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'SONGON', 'exact', 'YOPOUGON 4›KM176 SONGON | YOPOUGON 3›KM176 SONGON', 'Yopougon 1 & 2 : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'KOWEIT 2 ET AGBAYATE 1', 'exact', 'YOPOUGON 2›KOWEIT | YOPOUGON›KOWEIT', 'Yopougon 3 & 4 : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'PETIT TOIT ROUGE', 'exact', 'YOPOUGON 1›TOIT ROUGE | YOPOUGON›TOIT ROUGE | YOPOUGON 3›LIEVRE ROUGE', 'Yopougon 3 & 4 : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'SABLE ET INSTITUT DES AVEUGLES', 'exact', 'YOPOUGON 1›INSTITUT DES AVEUGLES', 'Yopougon 3 & 4 : proposition confirmée par Atom le 09/10/2026'),
  ('quartier', 'SIDECI LEM', 'exact', 'YOPOUGON 2›SIDECI | YOPOUGON›SIDECI', 'Yopougon 3 & 4 : proposition confirmée par Atom le 09/10/2026'),
  ('ssf', 'LIDY', 'exact', 'Miss Lydie', 'Atom 09/10 : Lidy = Miss Lydie'),
  ('ssf', 'M DALI', 'exact', 'Dali Romuald Gnakouri', 'Atom 09/10 : M. Dali = Dali Romuald Gnakouri'),
  ('ssf', 'YAO JAURES', 'exact', 'Kouakou Kouassi Jean Jaurès', 'Atom 09/10 : Yao Jaurès = Kouakou Kouassi Jean Jaurès'),
  ('ssf', 'ETIENNE', 'exact', 'Aka Kablan Étienne', 'Atom 09/10 : Étienne = Aka Kablan Étienne'),
  ('ssf', 'DIABY ISMAEL', 'exact', 'Diaby Ismaila', 'Orthographe du fichier (même distributeur)'),
  ('ssf', 'KOUASSI APOLLINAIRE', 'exact', 'Kouassi Appolinaire', 'Orthographe du fichier (même distributeur)'),
  ('commercial', 'MME TEA', 'exact', 'abidjannordfccocody1@gmail.com', 'Atom 09/10 : Mme Tea Anne-Marie = NGUESSAN AKUNDAH ANNE MARIE')
on conflict (type, motif, mode) do nothing;

commit;
