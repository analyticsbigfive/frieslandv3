-- ============================================================================
-- PROPOSITION — À RELIRE AVANT TOUTE APPLICATION (16/10/2026)
-- Ce n'est PAS une migration : à coller dans l'éditeur SQL seulement après
-- accord, partie par partie. AJOUTS UNIQUEMENT : rien n'est retiré ni réécrit.
--
-- Contexte : après la réaffectation des merchandisers Atom (16/10, 16:14-16:35),
-- la tournée de chacun passe par des PDV hors des territoires/quartiers de sa
-- fiche. La migration 20261016100000 règle déjà l'affichage des tournées.
-- Les ajouts ci-dessous servent au reste de l'app (liste des PDV, carte,
-- choix du quartier dans « Créer un PDV », liste des distributeurs).
--
-- POINTS À TRANCHER AVANT (non traités ici) :
--   - Lignes 4 et 5 de la liste Atom : ZOGBOLOU KEVIN (prévu Yop 1 & 2) a ses
--     règles sur Yop 1, 3, 4 ; DEHEO WILFRIED (prévu Yop 3 & 4) sur Yop 1, 2, 4
--     et Attécoubé. Les deux semblent inversés.
--   - Territoires en plus de la liste sur les fiches : ABBE (COCODY 1, Plateau),
--     GUIHI (COCODY 1), ZOGBOLOU et DEHEO (Yop 1 à 4), YAO VENANCE (ABOBO 2,
--     COCODY 1, ADJAME), SEREGONE (Abobo 1). Laissés tels quels.
--   - PORT BOUET : le seul compte (MOUSTAPHA N'DIAYE, portbouetone@gmail.com)
--     est désactivé ; aucun merch actif.
--   - Les adresses @atom-btl.com de la liste n'existent pas : les merchs se
--     connectent toujours avec leur gmail.
--   - GUIHI BERNADIN : 1 PDV au quartier « COCODY CENTRE - » (nom mal saisi),
--     non ajouté : corriger plutôt le quartier du PDV.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Territoires et quartiers à AJOUTER aux fiches (ordre existant conservé,
--    seuls les éléments absents sont ajoutés à la fin).
-- ----------------------------------------------------------------------------
begin;

with ajout(id, nom, territoires, quartiers) as (values
  ('bc8a316f-daa2-47d4-aabc-e7c311540636'::uuid, 'ABBE FREDERIC',
     '["ABOBO 2"]'::jsonb,
     '["2 PLATEAUX","220 LGTs","ATTECOUBE","BRAMAKOTE","DELEGATION"]'::jsonb),
  ('32c4977a-fd80-4c5a-b137-f10f18f174fc', 'DEHEO WILFRIED',
     '[]', '["PORT BOUET 2","SICOGI"]'),
  ('b2c92c6f-6841-4ded-97cd-61172b55b7cb', 'GUI STEPHANE',
     '[]', '["Groupement foncier","KBF","Quartier Appolo","Residentiel","Sicogi",
             "Aras","Belleville","Biafra","Champroux","Hibiscus","Massarana","Remblais"]'),
  ('e46a2ae6-9144-42e7-8534-7bd0d3b80be5', 'KOUADIO ATOFFE GUY ANICET',
     '[]', '["MARCHE DJE KONAN","Sicogi","SICOGI 1","SICOGI 2","SICOGI 3"]'),
  ('9fc8dc2f-54af-45d7-9025-373657e9508c', 'KOUAME HELLARION',
     '["COCODY 2","ATTECOUBE-PLATEAU"]', '["ABATTA","AKOUEDO","ATTECOUBE"]'),
  ('c4f8d184-718a-4f45-8ac1-1e2a90e20da3', 'SEREGONE SCHADRACK',
     '["ADJAME"]', '["4 ETAGES","ABOBO CENTRE","AKEIKOI","DERRIERE RAILS","GAGNOA GARE",
                     "HOUPHOUET BOIGNY","MOSQUEE","SOGEPHIA"]'),
  ('107d190d-25c0-4bf4-afb8-9383bb48bcdd', 'YAO VENANCE',
     '[]', '["ABOBO BAOULE","AVENUE KAZA","BELLEVILLE","CAMP COMMANDO","MOSQUEE","PK 18"]'),
  ('a8b6f8af-e4c2-4e4a-99dc-3d7592fc1bef', 'ZOGBOLOU KEVIN',
     '[]', '["BASE CIE","MILLIONNAIRE","NIANGON","NIANGON NORD","SICOGI","WASSAKARA"]')
)
update public.profiles p set
  territoires_assignes = coalesce(p.territoires_assignes, '[]'::jsonb) || coalesce((
    select jsonb_agg(x) from jsonb_array_elements_text(a.territoires) x
    where not coalesce(p.territoires_assignes, '[]'::jsonb) ? x), '[]'::jsonb),
  quartiers_assignes = coalesce(p.quartiers_assignes, '[]'::jsonb) || coalesce((
    select jsonb_agg(x) from jsonb_array_elements_text(a.quartiers) x
    where not coalesce(p.quartiers_assignes, '[]'::jsonb) ? x), '[]'::jsonb),
  updated_at = now()
from ajout a
where p.id = a.id and p.nom = a.nom;   -- double contrôle id + nom

-- Contrôle : 8 lignes attendues ; vérifier avant de valider.
select nom, territoires_assignes, jsonb_array_length(quartiers_assignes) nb_quartiers
from public.profiles where employeur = 'atom' and role = 'merchandiser' and is_active order by nom;

-- commit;   -- ← décommenter seulement si le contrôle est bon, sinon : rollback;

-- ----------------------------------------------------------------------------
-- 2. Distributeurs des secteurs « AUTRES » : reprendre ceux de leur territoire.
--    Ces secteurs n'ont aucun distributeur rattaché, donc « Créer un PDV » n'y
--    proposait que les nationaux. Rien n'est supprimé ; doublons ignorés.
--    Secteurs concernés : AUTRES ABOBO 1 / 2, COCODY 2, KOUMASSI, MARCORY,
--    TREICHVILLE, YOPOUGON 1 à 4 (+ zones d'Aboisso et Bassam sans lien).
-- ----------------------------------------------------------------------------
begin;

-- Aperçu de ce qui sera ajouté :
select z.code, z.nom, d.nom as distributeur
from public.zone z
join public.territoire t on t.code = z.territoire_code
join public.territoire_distributeur td on td.territoire_id = t.id
join public.distributeur d on d.id = td.distributeur_id and not d.national
where not exists (select 1 from public.zone_distributeur zd where zd.zone_id = z.id)
order by z.territoire_code, z.code;

insert into public.zone_distributeur (zone_id, distributeur_id)
select z.id, td.distributeur_id
from public.zone z
join public.territoire t on t.code = z.territoire_code
join public.territoire_distributeur td on td.territoire_id = t.id
join public.distributeur d on d.id = td.distributeur_id and not d.national
where not exists (select 1 from public.zone_distributeur zd where zd.zone_id = z.id)
on conflict do nothing;

-- commit;   -- ← décommenter seulement après relecture de l'aperçu, sinon : rollback;
