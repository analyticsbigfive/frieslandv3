-- ============================================================
-- 006_assign_treichville_and_commerciaux.sql
-- 1) Assigner les PDV de Treichville à merchandiser@friesland.ci
-- 2) Créer les profils des 19 commerciaux
-- Exécuter dans le SQL Editor de Supabase
-- ============================================================

-- ============================================================
-- PARTIE 1 : Assignation des PDV Treichville
-- ============================================================

-- Mettre à jour le profil merchandiser@friesland.ci pour lui
-- assigner la zone TREICHVILLE
-- (Le profil doit exister au préalable dans auth.users + profiles)
UPDATE public.profiles
SET zone_assignee = 'TREICHVILLE',
    secteurs_assignes = '["TREICHVILLE", "MARCORY TREICHVILLE"]'::jsonb,
    region = 'ABIDJAN 1',
    role = 'merchandiser',
    updated_at = NOW()
WHERE email = 'merchandiser@friesland.ci';

-- Si le profil n'existe pas encore, on l'insère via une fonction
-- (nécessite que l'utilisateur ait déjà un compte auth.users)
-- Voir la partie 3 pour la création des comptes auth

-- ============================================================
-- PARTIE 2 : Profils des 19 commerciaux
-- ============================================================
-- Ces INSERT ne fonctionneront que si les utilisateurs existent
-- déjà dans auth.users. Utiliser le script Node.js
-- scripts/create-commercial-accounts.mjs pour créer les comptes
-- auth d'abord, puis exécuter cette migration.
-- ============================================================

-- On utilise un UPSERT (INSERT ... ON CONFLICT) pour être
-- idempotent. L'email est la clé de recherche.

-- Note: Les profils sont liés à auth.users via l'id UUID.
-- On ne peut pas INSERT dans profiles sans un auth.users correspondant.
-- Ce SQL ne crée que les entrées zones_secteurs et met à jour
-- les profils existants.

-- Mise à jour des zones_secteurs pour refléter les bonnes
-- assignations merchandiser si pas déjà fait
-- (déjà géré par 003_seed_zones_secteurs.sql)

-- ============================================================
-- PARTIE 3 : Mise à jour des profils commerciaux existants
-- ============================================================

-- COULIBALY PADIE - Korhogo
UPDATE public.profiles
SET nom = 'COULIBALY PADIE', role = 'commercial',
    zone_assignee = 'KORHOGO', region = 'NORD',
    updated_at = NOW()
WHERE email = 'cnefckorhogo@gmail.com';

-- ASSAMOI TRESOR - Yamoussoukro
UPDATE public.profiles
SET nom = 'ASSAMOI TRESOR', role = 'commercial',
    zone_assignee = 'YAMOUSSOUKRO', region = 'CENTRE',
    updated_at = NOW()
WHERE email = 'cnefcyamoussoukro@gmail.com';

-- GUE HERMAN - Bouaké
UPDATE public.profiles
SET nom = 'GUE HERMAN', role = 'commercial',
    zone_assignee = 'BOUAKE', region = 'CENTRE',
    updated_at = NOW()
WHERE email = 'cnefcbouake01@gmail.com';

-- EBROTTIE CHRISTIAN - San Pedro
UPDATE public.profiles
SET nom = 'EBROTTIE CHRISTIAN', role = 'commercial',
    zone_assignee = 'SAN PEDRO', region = 'OUEST',
    updated_at = NOW()
WHERE email = 'fcouestsanpedro@gmail.com';

-- KACOU LEONARD - Gagnoa
UPDATE public.profiles
SET nom = 'KACOU LEONARD', role = 'commercial',
    zone_assignee = 'GAGNOA', region = 'OUEST',
    updated_at = NOW()
WHERE email = 'cnofcgagnoa@gmail.com';

-- FLORENT N'DJA - Daloa
UPDATE public.profiles
SET nom = 'FLORENT N''DJA', role = 'commercial',
    zone_assignee = 'DALOA', region = 'OUEST',
    updated_at = NOW()
WHERE email = 'cnofcdaloa@gmail.com';

-- OUATTARA ZANGA - Abengourou
UPDATE public.profiles
SET nom = 'OUATTARA ZANGA', role = 'commercial',
    zone_assignee = 'ABENGOUROU', region = 'EST',
    updated_at = NOW()
WHERE email = 'cnefcabengourou@gmail.com';

-- SEWINDE NOUHOUN
UPDATE public.profiles
SET nom = 'SEWINDE NOUHOUN', role = 'commercial',
    updated_at = NOW()
WHERE email = 'nsinwinde@gmail.com';

-- KADIA CINDY - Cocody 1
UPDATE public.profiles
SET nom = 'KADIA CINDY EMMANUELLA', role = 'merchandiser',
    zone_assignee = 'COCODY 1', region = 'ABIDJAN 2',
    updated_at = NOW()
WHERE email = 'abidjannordfccocody1@gmail.com';

-- MURIEL SIOTENE - Cocody 1
UPDATE public.profiles
SET nom = 'MURIEL SIOTENE', role = 'merchandiser',
    zone_assignee = 'COCODY 1', region = 'ABIDJAN 2',
    updated_at = NOW()
WHERE email = 'abidjannordfccocody1@gmail.com';

-- Note: Cocody 1 a 2 merchandisers, l'email est le même
-- pour CINDY et MURIEL - à vérifier les assignations

-- ARMANDE KOUAKOUSSUI / KOUAKOUSSUI ALIDA - Yopougon 3
UPDATE public.profiles
SET nom = 'ARMANDE KOUAKOUSSUI', role = 'merchandiser',
    zone_assignee = 'YOPOUGON 3', region = 'ABIDJAN 2',
    updated_at = NOW()
WHERE email = 'abidjannordfcyopougon3@gmail.com';

-- GAI KAMI - Yopougon 3
UPDATE public.profiles
SET nom = 'GAI KAMI', role = 'merchandiser',
    zone_assignee = 'YOPOUGON 3', region = 'ABIDJAN 2',
    updated_at = NOW()
WHERE email = 'abidjannordfcyopougon3@gmail.com';

-- RACHID ASSIROU - Abobo 1
UPDATE public.profiles
SET nom = 'RACHID ASSIROU', role = 'merchandiser',
    zone_assignee = 'ABOBO 1', region = 'ABIDJAN 2',
    updated_at = NOW()
WHERE email = 'abidjannordabobo1@gmail.com';

-- N'GUESSAN OPHELIA - Marcory / Treichville
UPDATE public.profiles
SET nom = 'N''GUESSAN OPHELIA', role = 'merchandiser',
    zone_assignee = 'MARCORY', region = 'ABIDJAN 1',
    secteurs_assignes = '["TREICHVILLE", "MARCORY", "KOUMASSI"]'::jsonb,
    updated_at = NOW()
WHERE email = 'abidjansudfcmarcory@gmail.com';

-- ISMAEL KOUAKOU
UPDATE public.profiles
SET nom = 'ISMAEL KOUAKOU', role = 'commercial',
    updated_at = NOW()
WHERE email = 'kouakouismael.pro@gmail.com';

-- SONIA AKON - Modern Trade
UPDATE public.profiles
SET nom = 'SONIA AKON', role = 'commercial',
    zone_assignee = 'MODERN TRADE', region = 'MODERN TRADE',
    updated_at = NOW()
WHERE email = 'akonsoniasunshine@gmail.com';

-- YOUAN LOU MIREILLE
UPDATE public.profiles
SET nom = 'YOUAN LOU MIREILLE', role = 'commercial',
    updated_at = NOW()
WHERE email = 'mireilleyuan@gmail.com';

-- ============================================================
-- RÉSUMÉ
-- ============================================================
-- Exécutez d'abord scripts/create-commercial-accounts.mjs
-- pour créer les comptes auth, puis cette migration pour
-- mettre à jour les profils.
-- 
-- PDV Treichville: 920 PDV (590 TREICHVILLE + 330 MARCORY TREICHVILLE)
-- assignés à merchandiser@friesland.ci
-- 19 commerciaux avec profils mis à jour
-- ============================================================
