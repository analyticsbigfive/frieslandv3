-- ============================================================================
-- RÉPARTITION COMMERCIAUX / MERCHANDISEURS (retour client du 8 septembre 2026)
--
-- Le client a renvoyé complété le fichier « Répartition commerciaux /
-- merchandiseurs » : numéros de téléphone manquants, commercial responsable de
-- chaque merchandiseur, et quatre corrections d'affectation sur Abidjan.
--
-- 1. Téléphones : 19 profils sur 37 n'avaient aucun numéro. Sans numéro, le
--    bouton WhatsApp des actions commerciales ne s'affiche pas
--    (`normaliserTelephoneInternational` renvoie null). Stockés en forme
--    canonique « +225 » + 10 chiffres, comme les deux profils déjà corrects.
--
-- 2. Abidjan — Abobo : les NOMS des deux comptes étaient inversés. Le compte
--    d'Abobo 2 portait le nom du merchandiseur d'Abobo 1. Les comptes n'ont
--    aucune visite enregistrée : le renommage ne réattribue aucun historique.
--    On en profite pour donner un seul territoire à chacun (le compte d'Abobo 1
--    traînait aussi ABOBO 2, désormais couvert par le compte d'Abobo 2).
--
-- 3. Abidjan — Yopougon : les TERRITOIRES étaient inversés entre le compte de
--    Yopougon 1&2 et celui de Yopougon 3&4.
--
-- 4. Rattachements : 11 merchandiseurs reçoivent leur commercial responsable.
--    Lien organisationnel uniquement (« mon équipe », relances) : le périmètre
--    de lecture reste territorial.
--
-- Arbitrages sur les zones d'ombre du fichier :
--   · Le fichier désignait « FIOSSI KENA » comme son propre responsable, ce que
--     la base refuse. Même numéro et mêmes territoires qu'Azoumi Kena : lu comme
--     Azoumi Kena.
--   · Deux commerciaux ont chacun deux comptes homonymes (OPHELIA, ANNE MARIE).
--     Le fichier ne donne que le nom : on rattache sur les comptes métier
--     (abidjansudfcmarcory@, abidjannordfccocody1@).
--
-- Clé de toutes les mises à jour : `profiles.email`.
-- Idempotent. Additif.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Téléphones (format +225 + 10 chiffres)
-- ---------------------------------------------------------------------------
update public.profiles p
set telephone = v.tel, updated_at = now()
from (values
  -- merchandiseurs
  ('attecoubeone@gmail.com',            '+2250500107118'),
  ('marcorytreichone@gmail.com',        '+2250715525765'),
  ('yopougontwo@gmail.com',             '+2250747079677'),
  ('cocodytwo@gmail.com',               '+2250709200789'),
  ('abidjanfcaboisso@gmail.com',        '+2250586155010'),
  ('koumassione@gmail.com',             '+2250707706587'),
  ('cocodyone@gmail.com',               '+2250702692056'),
  ('portbouetmerchone@gmail.com',       '+2250545560446'),
  ('abobomerchone@gmail.com',           '+2250778229082'),
  ('abobomerchtwo@gmail.com',           '+2250703101373'),
  ('yopougonone@gmail.com',             '+2250716292643'),
  -- commerciaux (deux comptes homonymes partagent le même numéro)
  ('abidjannordfcadjame@gmail.com',     '+2250586152657'),
  ('azoumi.kena@friesland.ci',          '+2250586155010'),
  ('abidjannordfcyopougon3@gmail.com',  '+2250544460338'),
  ('muriel.siotene@friesland.ci',       '+2250566086368'),
  ('abidjansudfcmarcory@gmail.com',     '+2250586152660'),
  ('abidjansudfctreichville@gmail.com', '+2250586152660'),
  ('abidjannordfccocody1@gmail.com',    '+2250586155700'),
  ('annydivine49@gmail.com',            '+2250586155700'),
  ('abidjannordabobo1@gmail.com',       '+2250585720133'),
  ('abidjannordfcyopougon1@gmail.com',  '+2250545460642')
) as v(email, tel)
where p.email = v.email
  and p.telephone is distinct from v.tel;

-- ---------------------------------------------------------------------------
-- 2 & 3. Corrections Abidjan : noms d'Abobo, territoires de Yopougon
--
-- Les libellés en majuscules reprennent exactement `pdv.zone` : la jointure de
-- `pdv_ids_perimetre()` est une égalité stricte de chaîne.
-- `zone_assignee` reste aligné sur le premier territoire (repli historique).
-- ---------------------------------------------------------------------------
update public.profiles p
set nom = v.nom,
    territoires_assignes = v.territoires::jsonb,
    zone_assignee = v.zone,
    updated_at = now()
from (values
  ('abobomerchone@gmail.com', 'Yao Venance',      '["ABOBO 1"]',                  'ABOBO 1'),
  ('abobomerchtwo@gmail.com', 'Seregoné Chadrac', '["ABOBO 2"]',                  'ABOBO 2'),
  ('yopougonone@gmail.com',   'Zogbolou Kevin',   '["YOPOUGON 1","YOPOUGON 2"]',  'YOPOUGON 1'),
  ('yopougontwo@gmail.com',   'Deheo Wilfried',   '["YOPOUGON 3","YOPOUGON 4"]',  'YOPOUGON 3')
) as v(email, nom, territoires, zone)
where p.email = v.email;

-- ---------------------------------------------------------------------------
-- 4. Rattachement merchandiseur → commercial
--
-- La jointure sur l'e-mail du responsable garantit qu'on ne crée pas de lien si
-- le compte commercial venait à manquer (ligne simplement ignorée).
-- ---------------------------------------------------------------------------
update public.profiles m
set commercial_id = c.id, updated_at = now()
from (values
  ('attecoubeone@gmail.com',      'abidjannordfcadjame@gmail.com'),     -- ARMANDE KOUAKOUSSUI
  ('marcorytreichone@gmail.com',  'abidjansudfcmarcory@gmail.com'),     -- N'GUESSAN OPHELIA
  ('koumassione@gmail.com',       'abidjansudfcmarcory@gmail.com'),     -- N'GUESSAN OPHELIA
  ('yopougontwo@gmail.com',       'abidjannordfcyopougon3@gmail.com'),  -- GAI KAMI
  ('yopougonone@gmail.com',       'abidjannordfcyopougon1@gmail.com'),  -- SOUARE IBRAHIMA
  ('cocodytwo@gmail.com',         'abidjannordfccocody1@gmail.com'),    -- NGUESSAN AKUNDAH ANNE MARIE
  ('portbouetmerchone@gmail.com', 'abidjannordfccocody1@gmail.com'),    -- NGUESSAN AKUNDAH ANNE MARIE
  ('cocodyone@gmail.com',         'muriel.siotene@friesland.ci'),       -- Muriel Siotene
  ('abidjanfcaboisso@gmail.com',  'azoumi.kena@friesland.ci'),          -- Azoumi Kena (cf. arbitrage)
  ('abobomerchone@gmail.com',     'abidjannordabobo1@gmail.com'),       -- RACHID ASSIROU
  ('abobomerchtwo@gmail.com',     'abidjannordabobo1@gmail.com')        -- RACHID ASSIROU
) as v(merch_email, commercial_email)
join public.profiles c on c.email = v.commercial_email
where m.email = v.merch_email
  and m.commercial_id is distinct from c.id;

commit;
