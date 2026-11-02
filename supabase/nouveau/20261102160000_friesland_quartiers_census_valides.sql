-- ============================================================================
-- QUARTIERS DU CENSUS CORRIGÉS APRÈS ACCORD DE FRIESLAND (02/11/2026)
--
-- Proposition soumise à Friesland (page « Quartiers du census à corriger »,
-- https://claude.ai/artifact/XZu24E81hmQtUe8cVcySvM), validée le 02/11.
-- Les GPS ne changent pas : seuls le quartier, et pour 10 à 12 le territoire,
-- sont corrigés.
--   1  Duékoué saisi MAN/…                          → DUEKOUE (21)
--   2  Grand-Béréby saisi SAN PEDRO/DAFCI & CORRIDOR → GRAND BEREBY (29)
--   3  Mankono saisi BOUAKE 1/CORRIDOR               → Mankono (14)
--   4  Zaranou saisi ABENGOUROU/GARE DE NIABLE       → Abengourou/ Zaranou (7)
--   5  Bondoukou saisi Abengourou/Relais             → BONDOUKOU (6)
--   6  Brobo saisi M'BAHIAKRO                        → BROBO (3)
--   7  Timbé saisi DABAKALA                          → TIMBE (4)
--   8  Man saisi LOGOUALE                            → MAN/AIR FRANCE (3)
--   9  San-Pédro saisi SASSANDRA (« Cité »)          → SAN PEDRO/NITORO (3)
--  10  Daloa saisi MAN/LYCEE MUNICIPAL → territoire DALOA (DAL) :
--      DALOA/BGOKORA, sauf adresses LOBIA1 → Lobia 1 et LOBIA 2 → Lobia 2 (8)
--  11  Noé et Maféré saisis ATTECOUBE → territoire ABOISSO (ABO) : NOÉ, MAFERE (4)
--  12  Grand-Bassam saisi ZONE 3 (Treichville) → territoire BASSAM (BAS),
--      secteur BASSAM du découpage (15)
--  16  Fiches de test 5e5208d2 et 4a4d7017 désactivées (2)
-- Sans changement : 13 (regroupements gardés), 14 et 15 (contrôle sur place).
--
-- « À choisir » (8, 9, 10) : règle Atom, le quartier de la liste du
-- merchandiser dont le centre (médiane des points de vente) est le plus
-- proche du GPS, sauf quand l'adresse nomme le quartier (Lobia).
--
-- Listes des merchandisers, pour qu'aucune boutique ne sorte d'une liste :
--   cnefcbouake01 (Bouaké) + BROBO, TIMBE ;
--   abidjanfcaboisso (Aboisso) + NOÉ, BASSAM.
--
-- trg_pdv_link_referentiels ne remplit territory_code que s'il est vide :
-- il est donc écrit ici pour 10 à 12. distributor_name ne change pas.
-- Garde : une ligne n'est modifiée que si son quartier est encore celui du
-- 02/11. Sauvegardes : pdv_quartier_avant_20261102,
-- profil_quartiers_avant_20261102. Idempotente.
-- Appliquée le 02/11/2026 par le MCP Supabase (version 20261102151840) :
-- 119 lignes modifiées, chaque boutique reste dans la liste d'un merchandiser.
-- ============================================================================
begin;

create table if not exists public.pdv_quartier_avant_20261102 (
  pdv_id text primary key,
  groupe text not null,
  zone text, quartier text, territory_code text, is_active boolean,
  nouveau_quartier text, nouvelle_zone text, nouveau_territory_code text, nouveau_is_active boolean,
  sauvegarde_le timestamptz not null default now()
);
alter table public.pdv_quartier_avant_20261102 enable row level security;
comment on table public.pdv_quartier_avant_20261102 is
  'Quartiers du census corrigés le 02/11/2026 après accord de Friesland (migration 20261102160000) : état avant.';

create table if not exists public.profil_quartiers_avant_20261102 (
  profile_id uuid primary key,
  email text,
  quartiers_assignes jsonb,
  sauvegarde_le timestamptz not null default now()
);
alter table public.profil_quartiers_avant_20261102 enable row level security;

create temp table _corr (groupe text, pdv_id text, quartier_attendu text, nouveau_quartier text, nouvelle_zone text, nouveau_tc text, actif boolean) on commit drop;
insert into _corr values
  ('G1', '0464c0a5', 'MAN/DOYAGUINE', 'DUEKOUE', null, null, true),
  ('G1', '0476fa0b', 'MAN/AIR FRANCE', 'DUEKOUE', null, null, true),
  ('G1', '1dac0a71', 'MAN/DOYAGUINE', 'DUEKOUE', null, null, true),
  ('G1', '3636083b', 'MAN/DOYAGUINE', 'DUEKOUE', null, null, true),
  ('G1', '4d264ceb', 'MAN/BABADJAN & QUARTIER THERESE', 'DUEKOUE', null, null, true),
  ('G1', '59646a93', 'MAN/AIR FRANCE', 'DUEKOUE', null, null, true),
  ('G1', '5adcffa8', 'MAN/AIR FRANCE', 'DUEKOUE', null, null, true),
  ('G1', '5e1f8ad7', 'MAN/AIR FRANCE', 'DUEKOUE', null, null, true),
  ('G1', '6b72be09', 'MAN/DOYAGUINE', 'DUEKOUE', null, null, true),
  ('G1', '6cef9de4', 'MAN/AIR FRANCE', 'DUEKOUE', null, null, true),
  ('G1', '8df65f27', 'MAN/AIR FRANCE', 'DUEKOUE', null, null, true),
  ('G1', '8f036228', 'MAN/AIR FRANCE', 'DUEKOUE', null, null, true),
  ('G1', 'abaa3ccc', 'MAN/DOYAGUINE', 'DUEKOUE', null, null, true),
  ('G1', 'ad0e270c', 'MAN/BABADJAN & QUARTIER THERESE', 'DUEKOUE', null, null, true),
  ('G1', 'bb74d4c7', 'MAN/AIR FRANCE', 'DUEKOUE', null, null, true),
  ('G1', 'ca06fa0f', 'MAN/DOYAGUINE', 'DUEKOUE', null, null, true),
  ('G1', 'e6dfd5fd', 'MAN/AIR FRANCE', 'DUEKOUE', null, null, true),
  ('G1', 'e75f5a02', 'MAN/AIR FRANCE', 'DUEKOUE', null, null, true),
  ('G1', 'e7b8e03a', 'MAN/BABADJAN & QUARTIER THERESE', 'DUEKOUE', null, null, true),
  ('G1', 'f0087b01', 'MAN/AIR FRANCE', 'DUEKOUE', null, null, true),
  ('G1', 'f8d879fc', 'MAN/BABADJAN & QUARTIER THERESE', 'DUEKOUE', null, null, true),
  ('G2', '03fcd40b', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', '35121d3b', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', '37a55a45', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', '3fbf139f', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', '43fd4666', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', '48df9ac6', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', '4915d58f', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', '4a6a3d48', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', '52b31866', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', '64a962cf', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', '65a6e885', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', '67d7bcbd', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', '731ddd84', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', '75f99195', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', '79759867', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', '848be522', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', '923db99f', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', 'a5e52007', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', 'a6edf4bc', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', 'b3c2dd6c', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', 'b781fd22', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', 'cfb324d0', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', 'd9342283', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', 'e056c83e', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', 'e60d7ae3', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', 'ecbb1d6f', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', 'f47ca465', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', 'f8589e1c', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G2', 'ff84dee6', 'SAN PEDRO/DAFCI & CORRIDOR BEREBY', 'GRAND BEREBY', null, null, true),
  ('G3', '06112c62', 'BOUAKE 1/CORRIDOR', 'Mankono', null, null, true),
  ('G3', '0a80bc2a', 'BOUAKE 1/CORRIDOR', 'Mankono', null, null, true),
  ('G3', '0c50907e', 'BOUAKE 1/CORRIDOR', 'Mankono', null, null, true),
  ('G3', '0caa68fb', 'BOUAKE 1/CORRIDOR', 'Mankono', null, null, true),
  ('G3', '1f71d655', 'BOUAKE 1/CORRIDOR', 'Mankono', null, null, true),
  ('G3', '42788408', 'BOUAKE 1/CORRIDOR', 'Mankono', null, null, true),
  ('G3', '573c8824', 'BOUAKE 1/CORRIDOR', 'Mankono', null, null, true),
  ('G3', '6b463e95', 'BOUAKE 1/CORRIDOR', 'Mankono', null, null, true),
  ('G3', '6eecc082', 'BOUAKE 1/CORRIDOR', 'Mankono', null, null, true),
  ('G3', '86e5de56', 'BOUAKE 1/CORRIDOR', 'Mankono', null, null, true),
  ('G3', 'cf90278e', 'BOUAKE 1/CORRIDOR', 'Mankono', null, null, true),
  ('G3', 'e752d74d', 'BOUAKE 1/CORRIDOR', 'Mankono', null, null, true),
  ('G3', 'e891dc15', 'BOUAKE 1/CORRIDOR', 'Mankono', null, null, true),
  ('G3', 'f94c1259', 'BOUAKE 1/CORRIDOR', 'Mankono', null, null, true),
  ('G4', '2e2286e0', 'ABENGOUROU/GARE DE NIABLE', 'Abengourou/ Zaranou', null, null, true),
  ('G4', '6028d08d', 'ABENGOUROU/GARE DE NIABLE', 'Abengourou/ Zaranou', null, null, true),
  ('G4', '7fc11d80', 'ABENGOUROU/GARE DE NIABLE', 'Abengourou/ Zaranou', null, null, true),
  ('G4', '82db6ae1', 'ABENGOUROU/GARE DE NIABLE', 'Abengourou/ Zaranou', null, null, true),
  ('G4', 'a9fb34de', 'ABENGOUROU/GARE DE NIABLE', 'Abengourou/ Zaranou', null, null, true),
  ('G4', 'ad796175', 'ABENGOUROU/GARE DE NIABLE', 'Abengourou/ Zaranou', null, null, true),
  ('G4', 'f3250133', 'ABENGOUROU/GARE DE NIABLE', 'Abengourou/ Zaranou', null, null, true),
  ('G5', '1979ba0b', 'Abengourou/Relais', 'BONDOUKOU', null, null, true),
  ('G5', '4cf7d98f', 'Abengourou/Relais', 'BONDOUKOU', null, null, true),
  ('G5', '7a418221', 'Abengourou/Relais', 'BONDOUKOU', null, null, true),
  ('G5', 'a5f201aa', 'Abengourou/Relais', 'BONDOUKOU', null, null, true),
  ('G5', 'bd70d102', 'Abengourou/Relais', 'BONDOUKOU', null, null, true),
  ('G5', 'c6d2f9d7', 'Abengourou/Relais', 'BONDOUKOU', null, null, true),
  ('G6', '221f32c3', 'M''BAHIAKRO', 'BROBO', null, null, true),
  ('G6', '4de903cc', 'M''BAHIAKRO', 'BROBO', null, null, true),
  ('G6', 'e5369ac8', 'M''BAHIAKRO', 'BROBO', null, null, true),
  ('G7', '1ca7c565', 'DABAKALA', 'TIMBE', null, null, true),
  ('G7', '52191d51', 'DABAKALA', 'TIMBE', null, null, true),
  ('G7', '9e2742fe', 'DABAKALA', 'TIMBE', null, null, true),
  ('G7', 'e1343cfa', 'DABAKALA', 'TIMBE', null, null, true),
  ('G8', '292a62df', 'LOGOUALE', 'MAN/AIR FRANCE', null, null, true),
  ('G8', '9092266f', 'LOGOUALE', 'MAN/AIR FRANCE', null, null, true),
  ('G8', 'e1661940', 'LOGOUALE', 'MAN/AIR FRANCE', null, null, true),
  ('G9', '4e103466', 'SASSANDRA', 'SAN PEDRO/NITORO', null, null, true),
  ('G9', '9c255acf', 'SASSANDRA', 'SAN PEDRO/NITORO', null, null, true),
  ('G9', 'bdf90c90', 'SASSANDRA', 'SAN PEDRO/NITORO', null, null, true),
  ('T1', '0dfbdb90', 'MAN/LYCEE MUNICIPAL', 'DALOA/BGOKORA', 'DALOA', 'DAL', true),
  ('T1', '3dc1356c', 'MAN/LYCEE MUNICIPAL', 'DALOA/BGOKORA', 'DALOA', 'DAL', true),
  ('T1', 'a3b0c589', 'MAN/LYCEE MUNICIPAL', 'DALOA/BGOKORA', 'DALOA', 'DAL', true),
  ('T1', 'aded2612', 'MAN/LYCEE MUNICIPAL', 'Lobia 2', 'DALOA', 'DAL', true),
  ('T1', 'cc78a7ee', 'MAN/LYCEE MUNICIPAL', 'DALOA/BGOKORA', 'DALOA', 'DAL', true),
  ('T1', 'dc82014a', 'MAN/LYCEE MUNICIPAL', 'DALOA/BGOKORA', 'DALOA', 'DAL', true),
  ('T1', 'e5389efd', 'MAN/LYCEE MUNICIPAL', 'DALOA/BGOKORA', 'DALOA', 'DAL', true),
  ('T1', 'f8c1466a', 'MAN/LYCEE MUNICIPAL', 'Lobia 1', 'DALOA', 'DAL', true),
  ('T2', '36f7c7fd', 'ATTECOUBE', 'NOÉ', 'ABOISSO', 'ABO', true),
  ('T2', '78e2f0b9', 'ATTECOUBE', 'MAFERE', 'ABOISSO', 'ABO', true),
  ('T2', 'a2a532e9', 'ATTECOUBE', 'NOÉ', 'ABOISSO', 'ABO', true),
  ('T2', 'a964fb6c', 'ATTECOUBE', 'NOÉ', 'ABOISSO', 'ABO', true),
  ('T3', '0028e1ea', 'ZONE 3', 'BASSAM', 'BASSAM', 'BAS', true),
  ('T3', '18502a90', 'ZONE 3', 'BASSAM', 'BASSAM', 'BAS', true),
  ('T3', '26ee123c', 'ZONE 3', 'BASSAM', 'BASSAM', 'BAS', true),
  ('T3', '31811c25', 'ZONE 3', 'BASSAM', 'BASSAM', 'BAS', true),
  ('T3', '69a6f71f', 'ZONE 3', 'BASSAM', 'BASSAM', 'BAS', true),
  ('T3', '6edbc91c', 'ZONE 3', 'BASSAM', 'BASSAM', 'BAS', true),
  ('T3', '6f3262c3', 'ZONE 3', 'BASSAM', 'BASSAM', 'BAS', true),
  ('T3', '793565a6', 'ZONE 3', 'BASSAM', 'BASSAM', 'BAS', true),
  ('T3', '89c46a0f', 'ZONE 3', 'BASSAM', 'BASSAM', 'BAS', true),
  ('T3', 'a3fb7e6f', 'ZONE 3', 'BASSAM', 'BASSAM', 'BAS', true),
  ('T3', 'b905a717', 'ZONE 3', 'BASSAM', 'BASSAM', 'BAS', true),
  ('T3', 'b957b8bb', 'ZONE 3', 'BASSAM', 'BASSAM', 'BAS', true),
  ('T3', 'bfb14dfc', 'ZONE 3', 'BASSAM', 'BASSAM', 'BAS', true),
  ('T3', 'd542c1b2', 'ZONE 3', 'BASSAM', 'BASSAM', 'BAS', true),
  ('T3', 'e5b1c828', 'ZONE 3', 'BASSAM', 'BASSAM', 'BAS', true),
  ('X', '4a4d7017', 'LOGOUALE', null, null, null, false),
  ('X', '5e5208d2', 'BOUAKE 1/BROUKRO', null, null, null, false);

insert into public.pdv_quartier_avant_20261102 (pdv_id, groupe, zone, quartier, territory_code, is_active,
  nouveau_quartier, nouvelle_zone, nouveau_territory_code, nouveau_is_active)
select p.pdv_id, c.groupe, p.zone, p.quartier, p.territory_code, p.is_active,
       coalesce(c.nouveau_quartier, p.quartier), coalesce(c.nouvelle_zone, p.zone), coalesce(c.nouveau_tc, p.territory_code), c.actif
from _corr c join public.pdv p using (pdv_id)
where p.quartier is not distinct from c.quartier_attendu
on conflict (pdv_id) do nothing;

update public.pdv p
set quartier = coalesce(c.nouveau_quartier, p.quartier),
    zone = coalesce(c.nouvelle_zone, p.zone),
    territory_code = coalesce(c.nouveau_tc, p.territory_code),
    is_active = c.actif
from _corr c
where p.pdv_id = c.pdv_id
  and p.quartier is not distinct from c.quartier_attendu;

-- Listes des merchandisers
insert into public.profil_quartiers_avant_20261102 (profile_id, email, quartiers_assignes)
select id, email, quartiers_assignes from public.profiles
where email in ('cnefcbouake01@gmail.com', 'abidjanfcaboisso@gmail.com')
on conflict (profile_id) do nothing;

update public.profiles pr
set quartiers_assignes = pr.quartiers_assignes || (
  select coalesce(jsonb_agg(a), '[]'::jsonb) from unnest(ajout.noms) a
  where not pr.quartiers_assignes ? a)
from (values ('cnefcbouake01@gmail.com', array['BROBO', 'TIMBE']),
             ('abidjanfcaboisso@gmail.com', array['NOÉ', 'BASSAM'])) as ajout(email, noms)
where pr.email = ajout.email and jsonb_typeof(pr.quartiers_assignes) = 'array';

commit;
