-- ============================================================================
-- DÉCOUPAGE SECTORIEL DÉFINITIF SOUTH 1 / SOUTH 2 (28/10/2026)
--
-- Source : Google Sheet de Jean Luc « Decoupage Sectoriel Definitif », onglet
-- final (1fBgpZBPDAsq6kdaMxfoevoxiR0NDNR2jwpoBeAxehD0), 339 lignes : 23
-- territoires, 60 zones, 318 secteurs (21 lignes répétées chargées une fois).
-- Noms : colonne « Nom à charger » du Sheet de validation
-- (1J5IDfTUsWAE6_Ef9txpTI2b4Kq2E9bCKW2LIAQ4z-gg). Territoires et zones gardent
-- le nom du fichier ; 11 secteurs ont une faute de lettres corrigée.
--
-- Territoire → table territoire, zone → table zone, secteur → table quartier.
--   · COCODY (COC) remplace Cocody 1 et Cocody 2 (archivés) ; PORT-BOUËT 2
--     (PRB 2), BONOUA (BNA) et YOPOUGON 1 & 2 PÉRIPHÉRIE (PERI) sont créés ;
--     PRB devient PORT-BOUËT 1, DAB YOPOUGON 3 & 4 PÉRIPHÉRIES, PLA
--     ATTÉCOUBÉ-PLATEAU (passe en South 2).
--   · Les anciennes zones sont archivées (actif = false), jamais supprimées :
--     la suppression emporterait quartiers et distributeurs par zone, et les
--     anciens pdv.area_code doivent rester lisibles.
--   · Libellé de territoire des boutiques (pdv.zone) aligné seulement pour les
--     territoires renommés ou fusionnés. Les territoires scindés (Port-Bouët,
--     Bassam/Bonoua, Anyama/N'Dotré, Bingerville) attendent le reclassement ;
--     d'ici là les alias gardent ces boutiques visibles.
--   · Les 10 comptes des 8 commerciaux reçoivent les territoires du fichier.
--     zone_assignee est vidé : l'app mobile 1.0.15 filtre sur pdv.zone exact
--     et ne montrerait qu'un seul territoire. Liste de quartiers seulement pour
--     les territoires partagés (Cocody : Murielle / Anne Marie ; Port-Bouët :
--     Anne Marie / Kena), avec les orthographes actuelles des boutiques.
--   · 14 cas restent à arbitrer par Friesland (même lieu dans deux zones ou
--     chez deux commerciaux) : chargés tels que dans le fichier.
--
-- Retour arrière : decoupage_avant_20261028 garde territoire, zone, quartier,
-- alias, distributeurs et SSF par territoire, périmètres des 10 comptes et
-- libellés des boutiques modifiées.
-- Idempotente.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Sauvegarde (une seule fois)
-- ---------------------------------------------------------------------------
create table if not exists public.decoupage_avant_20261028 (
  objet    text not null,
  cle      text not null,
  donnees  jsonb not null,
  garde_le timestamptz not null default now(),
  primary key (objet, cle)
);
comment on table public.decoupage_avant_20261028 is 'Sauvegarde avant le découpage définitif South 1 / South 2 du 28/10/2026 (retour arrière).';
alter table public.decoupage_avant_20261028 enable row level security;

insert into public.decoupage_avant_20261028 (objet, cle, donnees)
select 'territoire', t.code, to_jsonb(t) from public.territoire t
where t.sous_region_code in ('SOUTH1', 'SOUTH2') and t.code <> 'MT'
on conflict do nothing;
insert into public.decoupage_avant_20261028 (objet, cle, donnees)
select 'zone', z.id::text, to_jsonb(z) from public.zone z where z.territoire_code in ('BIN', 'TRE', 'MAR', 'KOU', 'PRB', 'BAS', 'ABO', 'YOP 1', 'YOP 2', 'YOP 3', 'YOP 4', 'DAB', 'ABO 1', 'ABO 2', 'ANY', 'ADJ', 'PLA', 'ADZ', 'AGB', 'COC 1', 'COC 2')
on conflict do nothing;
insert into public.decoupage_avant_20261028 (objet, cle, donnees)
select 'quartier', qu.id::text, to_jsonb(qu) from public.quartier qu
join public.zone z on z.id = qu.zone_id where z.territoire_code in ('BIN', 'TRE', 'MAR', 'KOU', 'PRB', 'BAS', 'ABO', 'YOP 1', 'YOP 2', 'YOP 3', 'YOP 4', 'DAB', 'ABO 1', 'ABO 2', 'ANY', 'ADJ', 'PLA', 'ADZ', 'AGB', 'COC 1', 'COC 2')
on conflict do nothing;
insert into public.decoupage_avant_20261028 (objet, cle, donnees)
select 'territoire_alias', a.alias, to_jsonb(a) from public.territoire_alias a
on conflict do nothing;
insert into public.decoupage_avant_20261028 (objet, cle, donnees)
select 'territoire_distributeur', td.territoire_id || '-' || td.distributeur_id, to_jsonb(td)
from public.territoire_distributeur td join public.territoire t on t.id = td.territoire_id
where t.code in ('BIN', 'TRE', 'MAR', 'KOU', 'PRB', 'BAS', 'ABO', 'YOP 1', 'YOP 2', 'YOP 3', 'YOP 4', 'DAB', 'ABO 1', 'ABO 2', 'ANY', 'ADJ', 'PLA', 'ADZ', 'AGB', 'COC 1', 'COC 2')
on conflict do nothing;
insert into public.decoupage_avant_20261028 (objet, cle, donnees)
select 'ssf_territoire', st.ssf_id || '-' || st.territoire_code, to_jsonb(st)
from public.ssf_territoire st where st.territoire_code in ('BIN', 'TRE', 'MAR', 'KOU', 'PRB', 'BAS', 'ABO', 'YOP 1', 'YOP 2', 'YOP 3', 'YOP 4', 'DAB', 'ABO 1', 'ABO 2', 'ANY', 'ADJ', 'PLA', 'ADZ', 'AGB', 'COC 1', 'COC 2')
on conflict do nothing;
insert into public.decoupage_avant_20261028 (objet, cle, donnees)
select 'profil', p.id::text, jsonb_build_object('email', p.email, 'zone_assignee', p.zone_assignee,
  'territoires_assignes', p.territoires_assignes, 'quartiers_assignes', p.quartiers_assignes, 'region', p.region)
from public.profiles p where p.email in ('muriel.siotene@friesland.ci', 'abidjannordfccocody1@gmail.com', 'annydivine49@gmail.com', 'abidjansudfcmarcory@gmail.com', 'abidjansudfctreichville@gmail.com', 'azoumi.kena@friesland.ci', 'abidjannordfcyopougon1@gmail.com', 'abidjannordfcyopougon3@gmail.com', 'abidjannordabobo1@gmail.com', 'abidjannordfcadjame@gmail.com')
on conflict do nothing;
insert into public.decoupage_avant_20261028 (objet, cle, donnees)
select 'pdv', p.pdv_id, jsonb_build_object('zone', p.zone, 'territory_code', p.territory_code)
from public.pdv p where p.zone in ('COCODY 1', 'COCODY 2', 'COCODY', 'ATTECOUBE-PLATEAU', 'PLATEAU', 'ATTECOUBE', 'ADJAME', 'ADZOPE', 'Marcory', 'Treichville', 'Yopougon 1', 'Bassam')
on conflict do nothing;
insert into public.decoupage_avant_20261028 (objet, cle, donnees)
select 'ssf_quartier', sq.id::text, to_jsonb(sq) from public.ssf_quartier sq
where sq.zone in ('COCODY 1', 'COCODY 2', 'COCODY', 'ATTECOUBE-PLATEAU', 'PLATEAU', 'ATTECOUBE', 'ADJAME', 'ADZOPE', 'Marcory', 'Treichville', 'Yopougon 1', 'Bassam')
on conflict do nothing;
insert into public.decoupage_avant_20261028 (objet, cle, donnees)
select 'routing_templates', rt.id::text, jsonb_build_object('territoire', rt.territoire) from public.routing_templates rt
where rt.territoire in ('COCODY 1', 'COCODY 2', 'COCODY', 'ATTECOUBE-PLATEAU', 'PLATEAU', 'ATTECOUBE', 'ADJAME', 'ADZOPE', 'Marcory', 'Treichville', 'Yopougon 1', 'Bassam')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. Territoires et zones archivables
-- ---------------------------------------------------------------------------
alter table public.territoire add column if not exists actif boolean not null default true;
alter table public.zone add column if not exists actif boolean not null default true;
comment on column public.territoire.actif is 'false = archivé (ancien découpage), masqué dans l''app.';
comment on column public.zone.actif is 'false = archivée (ancien découpage), masquée dans l''app ; les anciens pdv.area_code y pointent encore.';

-- ---------------------------------------------------------------------------
-- 3. Territoires
-- ---------------------------------------------------------------------------
-- Anciens Cocody : libèrent leur nom avant la création de COCODY.
update public.territoire set nom = 'Cocody 1 (archivé)', actif = false where code = 'COC 1';
update public.territoire set nom = 'Cocody 2 (archivé)', actif = false where code = 'COC 2';

update public.territoire set nom = 'BINGERVILLE', sous_region_code = 'SOUTH1', actif = true where code = 'BIN';
insert into public.territoire (code, nom, sous_region_code)
select 'COC', 'COCODY', 'SOUTH1'
where not exists (select 1 from public.territoire where code = 'COC');
update public.territoire set nom = 'COCODY', sous_region_code = 'SOUTH1', actif = true where code = 'COC';
update public.territoire set nom = 'TREICHVILLE', sous_region_code = 'SOUTH1', actif = true where code = 'TRE';
update public.territoire set nom = 'MARCORY', sous_region_code = 'SOUTH1', actif = true where code = 'MAR';
update public.territoire set nom = 'KOUMASSI', sous_region_code = 'SOUTH1', actif = true where code = 'KOU';
update public.territoire set nom = 'PORT-BOUËT 1', sous_region_code = 'SOUTH1', actif = true where code = 'PRB';
insert into public.territoire (code, nom, sous_region_code)
select 'PRB 2', 'PORT-BOUËT 2', 'SOUTH1'
where not exists (select 1 from public.territoire where code = 'PRB 2');
update public.territoire set nom = 'PORT-BOUËT 2', sous_region_code = 'SOUTH1', actif = true where code = 'PRB 2';
update public.territoire set nom = 'BASSAM', sous_region_code = 'SOUTH1', actif = true where code = 'BAS';
insert into public.territoire (code, nom, sous_region_code)
select 'BNA', 'BONOUA', 'SOUTH1'
where not exists (select 1 from public.territoire where code = 'BNA');
update public.territoire set nom = 'BONOUA', sous_region_code = 'SOUTH1', actif = true where code = 'BNA';
update public.territoire set nom = 'ABOISSO', sous_region_code = 'SOUTH1', actif = true where code = 'ABO';
update public.territoire set nom = 'YOPOUGON 1', sous_region_code = 'SOUTH2', actif = true where code = 'YOP 1';
update public.territoire set nom = 'YOPOUGON 2', sous_region_code = 'SOUTH2', actif = true where code = 'YOP 2';
insert into public.territoire (code, nom, sous_region_code)
select 'PERI', 'YOPOUGON 1 & 2 PÉRIPHÉRIE', 'SOUTH2'
where not exists (select 1 from public.territoire where code = 'PERI');
update public.territoire set nom = 'YOPOUGON 1 & 2 PÉRIPHÉRIE', sous_region_code = 'SOUTH2', actif = true where code = 'PERI';
update public.territoire set nom = 'YOPOUGON 3', sous_region_code = 'SOUTH2', actif = true where code = 'YOP 3';
update public.territoire set nom = 'YOPOUGON 4', sous_region_code = 'SOUTH2', actif = true where code = 'YOP 4';
update public.territoire set nom = 'YOPOUGON 3 & 4 PÉRIPHÉRIES', sous_region_code = 'SOUTH2', actif = true where code = 'DAB';
update public.territoire set nom = 'ABOBO 1', sous_region_code = 'SOUTH2', actif = true where code = 'ABO 1';
update public.territoire set nom = 'ABOBO 2', sous_region_code = 'SOUTH2', actif = true where code = 'ABO 2';
update public.territoire set nom = 'ANYAMA', sous_region_code = 'SOUTH2', actif = true where code = 'ANY';
update public.territoire set nom = 'ADJAMÉ', sous_region_code = 'SOUTH2', actif = true where code = 'ADJ';
update public.territoire set nom = 'ATTÉCOUBÉ-PLATEAU', sous_region_code = 'SOUTH2', actif = true where code = 'PLA';
update public.territoire set nom = 'ADZOPÉ', sous_region_code = 'SOUTH2', actif = true where code = 'ADZ';
update public.territoire set nom = 'AGBOVILLE', sous_region_code = 'SOUTH2', actif = true where code = 'AGB';

-- Distributeurs des nouveaux territoires : ceux des territoires d'origine.
insert into public.territoire_distributeur (territoire_id, distributeur_id)
select n.id, td.distributeur_id
from (values ('COC', 'COC 1'), ('COC', 'COC 2'), ('PRB 2', 'PRB'), ('BNA', 'BAS')) as m(nouveau, origine)
join public.territoire n on n.code = m.nouveau
join public.territoire o on o.code = m.origine
join public.territoire_distributeur td on td.territoire_id = o.id
on conflict do nothing;

-- SSF de Cocody 1 et Cocody 2 : regroupés sur COCODY.
insert into public.ssf_territoire (ssf_id, territoire_code, nb_visites, principal)
select st.ssf_id, 'COC', sum(st.nb_visites), bool_or(st.principal)
from public.ssf_territoire st where st.territoire_code in ('COC 1', 'COC 2')
group by st.ssf_id
on conflict do nothing;
delete from public.ssf_territoire where territoire_code in ('COC 1', 'COC 2');

-- Zones de Cocody 1 et Cocody 2 : sous COCODY (elles seront archivées).
update public.zone set territoire_code = 'COC' where territoire_code in ('COC 1', 'COC 2');

-- Alias : anciens noms et libellés encore portés par les boutiques et les profils.
insert into public.territoire_alias (alias, territoire_code) values
  ('COCODY 1', 'COC'),
  ('COCODY 2', 'COC'),
  ('Cocody 1', 'COC'),
  ('Cocody 2', 'COC'),
  ('COCODY', 'COC'),
  ('Cocody1', 'COC'),
  ('Cocody 11', 'COC'),
  ('Cocody2', 'COC'),
  ('Cicody 2', 'COC'),
  ('PORT-BOUET', 'PRB 2'),
  ('Port bouet', 'PRB 2'),
  ('PORT BOUET', 'PRB 2'),
  ('Gonzague', 'PRB 2'),
  ('Gonzaque ville', 'PRB 2'),
  ('Port Bouet ( Gonzague rue catholique)', 'PRB 2'),
  ('Port bouet (gonzague)', 'PRB 2'),
  ('Port bouet( Gonzague)', 'PRB 2'),
  ('Bassam', 'BAS'),
  ('Marcory', 'MAR'),
  ('Treichville', 'TRE'),
  ('ADJAME', 'ADJ'),
  ('ADZOPE', 'ADZ'),
  ('Yopougon 1', 'YOP 1'),
  ('PLATEAU', 'PLA'),
  ('Plateau', 'PLA'),
  ('ATTECOUBE', 'PLA'),
  ('ATTECOUBE-PLATEAU', 'PLA'),
  ('Dabou', 'DAB'),
  ('DABOU', 'DAB'),
  ('PÉRIPHÉRIE', 'PERI')
on conflict (alias) do update set territoire_code = excluded.territoire_code;

-- ---------------------------------------------------------------------------
-- 4. Zones : anciennes archivées, 60 nouvelles (code Z01, Z02… par territoire)
-- ---------------------------------------------------------------------------
update public.zone set actif = false
where territoire_code in ('BIN', 'COC', 'TRE', 'MAR', 'KOU', 'PRB', 'PRB 2', 'BAS', 'BNA', 'ABO', 'YOP 1', 'YOP 2', 'PERI', 'YOP 3', 'YOP 4', 'DAB', 'ABO 1', 'ABO 2', 'ANY', 'ADJ', 'PLA', 'ADZ', 'AGB') and actif and coalesce(code, '') !~ '^Z[0-9]{2}$';

with nouvelles (territoire_code, code, nom, rang) as (values
  ('BIN', 'Z01', 'FAYA NOUVEAU GOUDRON', 1),
  ('BIN', 'Z02', 'BINGERVILLE CENTRE', 2),
  ('BIN', 'Z03', 'GBAGBA', 3),
  ('COC', 'Z01', 'COCODY 1', 4),
  ('COC', 'Z02', 'COCODY 2', 5),
  ('TRE', 'Z01', 'TREICHVILLE', 6),
  ('MAR', 'Z01', 'MARCORY 1', 7),
  ('MAR', 'Z02', 'MARCORY 2', 8),
  ('KOU', 'Z01', 'KOUMASSI 1', 9),
  ('KOU', 'Z02', 'KOUMASSI 2', 10),
  ('PRB', 'Z01', 'PORT-BOUËT 1', 11),
  ('PRB 2', 'Z01', 'PORT-BOUËT 2', 12),
  ('PRB 2', 'Z02', 'PORT-BOUËT 3', 13),
  ('PRB 2', 'Z03', 'PORT-BOUËT 4', 14),
  ('PRB 2', 'Z04', 'PORT-BOUËT 5', 15),
  ('BAS', 'Z01', 'BASSAM 1', 16),
  ('BAS', 'Z02', 'BASSAM 2', 17),
  ('BNA', 'Z01', 'BONOUA 1 & 2', 18),
  ('ABO', 'Z01', 'ABOISSO 1', 19),
  ('ABO', 'Z02', 'ABOISSO 2', 20),
  ('ABO', 'Z03', 'ABOISSO 3', 21),
  ('YOP 1', 'Z01', 'YOPOUGON 1 & 2', 22),
  ('YOP 1', 'Z02', 'WASSAKARA', 23),
  ('YOP 1', 'Z03', 'YOPOUGON SABLE', 24),
  ('YOP 1', 'Z04', 'NIANGON NORD', 25),
  ('YOP 1', 'Z05', 'TOIT ROUGE', 26),
  ('YOP 2', 'Z01', 'NIANGON SUD', 27),
  ('YOP 2', 'Z02', 'KOUTÉ', 28),
  ('YOP 2', 'Z03', 'KOWEÏT', 29),
  ('PERI', 'Z01', 'SIKENSI, N''DOUCI, TIASSALÉ', 30),
  ('YOP 3', 'Z01', 'ANDOKOI & ZONE INDUSTRIELLE', 31),
  ('YOP 3', 'Z02', 'LUBAFRIQUE / CITÉ VERTE', 32),
  ('YOP 3', 'Z03', 'SIPOREX / PORT-BOUËT 2 / ANANERAIE', 33),
  ('YOP 4', 'Z01', 'MAROC / BAGNON', 34),
  ('YOP 4', 'Z02', 'MAROC / SICOGI ATTIÉ / NIANGON', 35),
  ('YOP 4', 'Z03', 'SONGON & KM 17', 36),
  ('DAB', 'Z01', 'DABOU', 37),
  ('DAB', 'Z02', 'GRAND-LAHOU / FRESCO', 38),
  ('DAB', 'Z03', 'GRAND-LAHOU', 39),
  ('ABO 1', 'Z01', 'DOKUI', 40),
  ('ABO 1', 'Z02', 'AVOCATIER', 41),
  ('ABO 1', 'Z03', 'KENNEDY', 42),
  ('ABO 1', 'Z04', 'AKEIKOI', 43),
  ('ABO 1', 'Z05', 'GENDARMERIE', 44),
  ('ABO 1', 'Z06', 'SOGEFIA', 45),
  ('ABO 1', 'Z07', 'ABOBO GARE', 46),
  ('ABO 2', 'Z01', 'MOSQUÉE BLANCHE', 47),
  ('ABO 2', 'Z02', 'ONUCI', 48),
  ('ABO 2', 'Z03', 'CMA', 49),
  ('ANY', 'Z01', 'ANYAMA', 50),
  ('ANY', 'Z02', 'N''DOTRÉ', 51),
  ('ADJ', 'Z01', 'ADJAMÉ 1', 52),
  ('ADJ', 'Z02', 'ADJAMÉ 2', 53),
  ('ADJ', 'Z03', 'ADJAMÉ 3', 54),
  ('ADJ', 'Z04', 'ADJAMÉ 4', 55),
  ('PLA', 'Z01', 'ATTÉCOUBÉ - PLATEAU 1', 56),
  ('ADZ', 'Z01', 'ADZOPÉ VILLE', 57),
  ('ADZ', 'Z02', 'PÉRIPHÉRIES', 58),
  ('AGB', 'Z01', 'AGBOVILLE VILLE', 59),
  ('AGB', 'Z02', 'AZAGUIÉ', 60)
), a_creer as (
  select n.* from nouvelles n
  where not exists (select 1 from public.zone z where z.territoire_code = n.territoire_code and z.code = n.code and z.nom = n.nom)
)
insert into public.zone (code, nom, territoire_code, actif)
select code, nom, territoire_code, true
from a_creer order by rang;

-- ---------------------------------------------------------------------------
-- 5. Secteurs (table quartier), dans l'ordre du fichier
-- ---------------------------------------------------------------------------
insert into public.quartier (zone_id, nom, ordre)
select z.id, s.nom, s.ordre
from (values
  ('BIN', 'FAYA NOUVEAU GOUDRON', 'FEH KESSÉ', 1),
  ('BIN', 'FAYA NOUVEAU GOUDRON', 'AKANDJÉ', 2),
  ('BIN', 'FAYA NOUVEAU GOUDRON', 'LAURIER 15', 3),
  ('BIN', 'FAYA NOUVEAU GOUDRON', 'SANTÉ', 4),
  ('BIN', 'BINGERVILLE CENTRE', 'BINGERVILLE CENTRE', 1),
  ('BIN', 'GBAGBA', 'GBAGBA', 1),
  ('BIN', 'GBAGBA', 'BERLIN', 2),
  ('BIN', 'GBAGBA', 'SAVANE', 3),
  ('BIN', 'GBAGBA', 'MACHOUX', 4),
  ('BIN', 'GBAGBA', 'SICOGI', 5),
  ('COC', 'COCODY 1', 'MAHOU', 1),
  ('COC', 'COCODY 1', '7ÈME TRANCHE', 2),
  ('COC', 'COCODY 1', '8ÈME TRANCHE', 3),
  ('COC', 'COCODY 1', 'DJIBI', 4),
  ('COC', 'COCODY 1', 'LES CITÉS', 5),
  ('COC', 'COCODY 1', 'ANGRÉ CHÂTEAU', 6),
  ('COC', 'COCODY 1', 'DJOROGOBITÉ 1', 7),
  ('COC', 'COCODY 1', 'DJOROGOBITÉ 2', 8),
  ('COC', 'COCODY 1', 'BESSIKOI', 9),
  ('COC', 'COCODY 1', 'GESTOCI', 10),
  ('COC', 'COCODY 1', 'PALMERAIE', 11),
  ('COC', 'COCODY 1', 'ATTOBAN', 12),
  ('COC', 'COCODY 1', 'BONOUMIN', 13),
  ('COC', 'COCODY 1', 'FAYA', 14),
  ('COC', 'COCODY 1', 'AKOUÉDO', 15),
  ('COC', 'COCODY 1', 'ABATTA', 16),
  ('COC', 'COCODY 1', 'FAYA FIN GOUDRON', 17),
  ('COC', 'COCODY 1', 'CITÉ SIR', 18),
  ('COC', 'COCODY 2', 'LYCÉE TECHNIQUE', 1),
  ('COC', 'COCODY 2', 'VALLON', 2),
  ('COC', 'COCODY 2', 'COLOMBIE', 3),
  ('COC', 'COCODY 2', '2 PLATEAUX LES PERLES', 4),
  ('COC', 'COCODY 2', 'DANGA', 5),
  ('COC', 'COCODY 2', 'COCODY CENTRE', 6),
  ('COC', 'COCODY 2', 'BLOCKAUSS', 7),
  ('COC', 'COCODY 2', 'RIVIERA 2', 8),
  ('COC', 'COCODY 2', 'ANONO', 9),
  ('COC', 'COCODY 2', 'RIVIERA 3', 10),
  ('COC', 'COCODY 2', 'M''POUTO', 11),
  ('COC', 'COCODY 2', 'CIAD', 12),
  ('COC', 'COCODY 2', 'M''BADON', 13),
  ('TRE', 'TREICHVILLE', 'ARRAS', 1),
  ('TRE', 'TREICHVILLE', 'BELLEVILLE', 2),
  ('TRE', 'TREICHVILLE', 'BIAFRA', 3),
  ('TRE', 'TREICHVILLE', 'QUARTIER APOLLO', 4),
  ('TRE', 'TREICHVILLE', 'ZONE 3', 5),
  ('MAR', 'MARCORY 1', 'RÉSIDENTIEL', 1),
  ('MAR', 'MARCORY 1', 'CHAMPROUX', 2),
  ('MAR', 'MARCORY 1', 'GROUPEMENT', 3),
  ('MAR', 'MARCORY 1', 'HIBISCUS', 4),
  ('MAR', 'MARCORY 1', 'MASSARANA', 5),
  ('MAR', 'MARCORY 2', 'SICOGI', 1),
  ('MAR', 'MARCORY 2', 'REMBLAIS', 2),
  ('MAR', 'MARCORY 2', 'ANOUMABO', 3),
  ('MAR', 'MARCORY 2', 'SANS FIL', 4),
  ('MAR', 'MARCORY 2', 'ZONE 4', 5),
  ('KOU', 'KOUMASSI 1', 'REMBLAIS', 1),
  ('KOU', 'KOUMASSI 1', 'MARAIS', 2),
  ('KOU', 'KOUMASSI 1', 'DIVO', 3),
  ('KOU', 'KOUMASSI 1', 'KOUMASSI 32', 4),
  ('KOU', 'KOUMASSI 1', 'TERMINUS 05', 5),
  ('KOU', 'KOUMASSI 1', 'HAOUSSABOUGOU', 6),
  ('KOU', 'KOUMASSI 1', '3 AMPOULES', 7),
  ('KOU', 'KOUMASSI 2', 'CITÉ 147', 1),
  ('KOU', 'KOUMASSI 2', 'PRODOMO', 2),
  ('KOU', 'KOUMASSI 2', 'SOPIM', 3),
  ('KOU', 'KOUMASSI 2', 'CAMPEMENT', 4),
  ('KOU', 'KOUMASSI 2', 'SOWETO', 5),
  ('KOU', 'KOUMASSI 2', 'SICOGI', 6),
  ('KOU', 'KOUMASSI 2', 'MARCHÉ DJE KONAN', 7),
  ('KOU', 'KOUMASSI 2', 'SOLEIL', 8),
  ('KOU', 'KOUMASSI 2', 'GELTI', 9),
  ('PRB', 'PORT-BOUËT 1', 'PORT-BOUËT CENTRE', 1),
  ('PRB', 'PORT-BOUËT 1', 'AÉROPORT', 2),
  ('PRB', 'PORT-BOUËT 1', 'ADJAHUI', 3),
  ('PRB', 'PORT-BOUËT 1', 'CITÉ POLICIÈRE', 4),
  ('PRB', 'PORT-BOUËT 1', 'VRIDI', 5),
  ('PRB 2', 'PORT-BOUËT 2', 'GONZAGUEVILLE', 1),
  ('PRB 2', 'PORT-BOUËT 2', 'CRF MOTARD', 2),
  ('PRB 2', 'PORT-BOUËT 2', 'CRF CHIEN', 3),
  ('PRB 2', 'PORT-BOUËT 2', '1ER ARRÊT', 4),
  ('PRB 2', 'PORT-BOUËT 2', '2E ARRÊT', 5),
  ('PRB 2', 'PORT-BOUËT 3', 'ANANI', 1),
  ('PRB 2', 'PORT-BOUËT 3', 'PETIT BASSAM', 2),
  ('PRB 2', 'PORT-BOUËT 4', 'CORRIDOR', 1),
  ('PRB 2', 'PORT-BOUËT 4', 'JEAN FOLLY', 2),
  ('PRB 2', 'PORT-BOUËT 4', 'ADJOUFFOU', 3),
  ('PRB 2', 'PORT-BOUËT 5', 'TERRE ROUGE', 1),
  ('PRB 2', 'PORT-BOUËT 5', 'ABRAHAM', 2),
  ('BAS', 'BASSAM 1', 'BASSAM', 1),
  ('BAS', 'BASSAM 2', 'MOOSSOU 2', 1),
  ('BAS', 'BASSAM 2', 'QUARTIER FRANCE', 2),
  ('BAS', 'BASSAM 2', 'AZURETTI', 3),
  ('BAS', 'BASSAM 2', 'VILLAGE ARTISANAL', 4),
  ('BAS', 'BASSAM 2', 'GRAND MARCHÉ', 5),
  ('BAS', 'BASSAM 2', 'PETIT MARCHÉ', 6),
  ('BAS', 'BASSAM 2', 'IMPÉRIAL', 7),
  ('BAS', 'BASSAM 2', 'MODESTE', 8),
  ('BAS', 'BASSAM 2', 'MOOSSOU', 9),
  ('BAS', 'BASSAM 2', 'EDOUKOU MIEZAN', 10),
  ('BNA', 'BONOUA 1 & 2', '8 KILOS', 1),
  ('BNA', 'BONOUA 1 & 2', 'YAOU', 2),
  ('BNA', 'BONOUA 1 & 2', 'CENTRE-VILLE', 3),
  ('BNA', 'BONOUA 1 & 2', 'BEGNERI', 4),
  ('BNA', 'BONOUA 1 & 2', 'SAMO', 5),
  ('BNA', 'BONOUA 1 & 2', 'ASSINIE', 6),
  ('BNA', 'BONOUA 1 & 2', 'ROND-POINT', 7),
  ('BNA', 'BONOUA 1 & 2', 'ADIAKÉ', 8),
  ('ABO', 'ABOISSO 1', 'ABOISSO', 1),
  ('ABO', 'ABOISSO 2', 'DIATEKRO', 1),
  ('ABO', 'ABOISSO 2', 'SOKORA', 2),
  ('ABO', 'ABOISSO 2', 'COMMERCE', 3),
  ('ABO', 'ABOISSO 2', 'SOS', 4),
  ('ABO', 'ABOISSO 2', 'DOSOBAH', 5),
  ('ABO', 'ABOISSO 2', 'CITÉ KOUMI', 6),
  ('ABO', 'ABOISSO 2', 'LYCÉE', 7),
  ('ABO', 'ABOISSO 2', 'KOLAIWA', 8),
  ('ABO', 'ABOISSO 2', 'SANHOUMAN', 9),
  ('ABO', 'ABOISSO 3', 'AYAMÉ', 1),
  ('ABO', 'ABOISSO 3', 'N''ZIKRO', 2),
  ('ABO', 'ABOISSO 3', 'MOUYASSUÉ', 3),
  ('ABO', 'ABOISSO 3', 'KRINDJABO', 4),
  ('ABO', 'ABOISSO 3', 'ABOISSO', 5),
  ('ABO', 'ABOISSO 3', 'TIAPOUM', 6),
  ('ABO', 'ABOISSO 3', 'NOÉ', 7),
  ('YOP 1', 'YOPOUGON 1 & 2', 'YOPOUGON 1 & 2', 1),
  ('YOP 1', 'WASSAKARA', 'WASSAKARA', 1),
  ('YOP 1', 'WASSAKARA', 'SELMER', 2),
  ('YOP 1', 'WASSAKARA', 'SICOGI', 3),
  ('YOP 1', 'YOPOUGON SABLE', 'YOPOUGON SABLE', 1),
  ('YOP 1', 'YOPOUGON SABLE', 'MILLIONNAIRE', 2),
  ('YOP 1', 'YOPOUGON SABLE', 'NOUVEAU QUARTIER', 3),
  ('YOP 1', 'NIANGON NORD', 'NIANGON NORD', 1),
  ('YOP 1', 'NIANGON NORD', 'SIDECI', 2),
  ('YOP 1', 'TOIT ROUGE', 'TOIT ROUGE', 1),
  ('YOP 1', 'TOIT ROUGE', 'LOCODJORO', 2),
  ('YOP 1', 'TOIT ROUGE', 'ATTÉCOUBÉ MOSSIKRO', 3),
  ('YOP 2', 'NIANGON SUD', 'NIANGON SUD', 1),
  ('YOP 2', 'NIANGON SUD', 'AZITO', 2),
  ('YOP 2', 'KOUTÉ', 'KOUTÉ', 1),
  ('YOP 2', 'KOUTÉ', 'PETIT TOIT ROUGE', 2),
  ('YOP 2', 'KOUTÉ', 'BÉAGO', 3),
  ('YOP 2', 'KOWEÏT', 'KOWEÏT', 1),
  ('YOP 2', 'KOWEÏT', 'SANTÉ', 2),
  ('YOP 2', 'KOWEÏT', 'ABOBO DOUMÉ', 3),
  ('YOP 2', 'KOWEÏT', 'AGBAYATÉ', 4),
  ('YOP 2', 'KOWEÏT', 'YOPOUGON SANTÉ', 5),
  ('PERI', 'SIKENSI, N''DOUCI, TIASSALÉ', 'SIKENSI', 1),
  ('PERI', 'SIKENSI, N''DOUCI, TIASSALÉ', 'N''DOUCI', 2),
  ('PERI', 'SIKENSI, N''DOUCI, TIASSALÉ', 'TIASSALÉ', 3),
  ('YOP 3', 'ANDOKOI & ZONE INDUSTRIELLE', 'ANDOKOI', 1),
  ('YOP 3', 'ANDOKOI & ZONE INDUSTRIELLE', 'ZONE INDUSTRIELLE', 2),
  ('YOP 3', 'ANDOKOI & ZONE INDUSTRIELLE', 'PRISON CIVILE', 3),
  ('YOP 3', 'ANDOKOI & ZONE INDUSTRIELLE', 'SODEFOR ET CITÉ ADO MICAO', 4),
  ('YOP 3', 'ANDOKOI & ZONE INDUSTRIELLE', 'GESCO', 5),
  ('YOP 3', 'ANDOKOI & ZONE INDUSTRIELLE', 'PK 22 ET ATTINGUIÉ', 6),
  ('YOP 3', 'LUBAFRIQUE / CITÉ VERTE', 'ACADÉMIE', 1),
  ('YOP 3', 'LUBAFRIQUE / CITÉ VERTE', 'CITÉ VERTE', 2),
  ('YOP 3', 'LUBAFRIQUE / CITÉ VERTE', 'SODEFOR', 3),
  ('YOP 3', 'LUBAFRIQUE / CITÉ VERTE', 'MARCHÉ LUBAFRIQUE', 4),
  ('YOP 3', 'LUBAFRIQUE / CITÉ VERTE', 'DERRIÈRE PHCIE MATY', 5),
  ('YOP 3', 'SIPOREX / PORT-BOUËT 2 / ANANERAIE', 'SIPOREX', 1),
  ('YOP 3', 'SIPOREX / PORT-BOUËT 2 / ANANERAIE', 'BANCO 2', 2),
  ('YOP 3', 'SIPOREX / PORT-BOUËT 2 / ANANERAIE', 'ABDOULAYE DIALLO', 3),
  ('YOP 3', 'SIPOREX / PORT-BOUËT 2 / ANANERAIE', 'PORT-BOUËT 2', 4),
  ('YOP 3', 'SIPOREX / PORT-BOUËT 2 / ANANERAIE', 'ANANERAIE', 5),
  ('YOP 3', 'SIPOREX / PORT-BOUËT 2 / ANANERAIE', 'BATIM', 6),
  ('YOP 3', 'SIPOREX / PORT-BOUËT 2 / ANANERAIE', 'MAMIE ADJOUA', 7),
  ('YOP 4', 'MAROC / BAGNON', 'ANANERAIE', 1),
  ('YOP 4', 'MAROC / BAGNON', 'BAGOUÉ', 2),
  ('YOP 4', 'MAROC / BAGNON', 'ÉCOLE LIBANAISE', 3),
  ('YOP 4', 'MAROC / BAGNON', 'CITÉ VERTE', 4),
  ('YOP 4', 'MAROC / BAGNON', 'BAGNON', 5),
  ('YOP 4', 'MAROC / BAGNON', 'LIÈVRE ROUGE', 6),
  ('YOP 4', 'MAROC / BAGNON', 'ANCIEN CORRIDOR', 7),
  ('YOP 4', 'MAROC / BAGNON', 'VILLAGE ADJAMÉ', 8),
  ('YOP 4', 'MAROC / BAGNON', 'KM 17', 9),
  ('YOP 4', 'MAROC / SICOGI ATTIÉ / NIANGON', 'T47', 1),
  ('YOP 4', 'MAROC / SICOGI ATTIÉ / NIANGON', 'SICOGI PMI ATTIÉ', 2),
  ('YOP 4', 'MAROC / SICOGI ATTIÉ / NIANGON', 'NIANGON À DROITE', 3),
  ('YOP 4', 'MAROC / SICOGI ATTIÉ / NIANGON', 'NIANGON TEXACO', 4),
  ('YOP 4', 'MAROC / SICOGI ATTIÉ / NIANGON', 'CRF POLICIER & BOBY', 5),
  ('YOP 4', 'MAROC / SICOGI ATTIÉ / NIANGON', 'OBAMA', 6),
  ('YOP 4', 'MAROC / SICOGI ATTIÉ / NIANGON', 'KIMI', 7),
  ('YOP 4', 'SONGON & KM 17', 'KM 17', 1),
  ('YOP 4', 'SONGON & KM 17', 'BIMBRESSO', 2),
  ('YOP 4', 'SONGON & KM 17', 'CRF PASTEUR', 3),
  ('YOP 4', 'SONGON & KM 17', 'AU GRAVIER', 4),
  ('YOP 4', 'SONGON & KM 17', 'LA FORÊT', 5),
  ('YOP 4', 'SONGON & KM 17', 'SONGON', 6),
  ('YOP 4', 'SONGON & KM 17', 'JUSQU''AU CRF JACQUEVILLE', 7),
  ('DAB', 'DABOU', 'CARREFOUR JACQUEVILLE', 1),
  ('DAB', 'DABOU', 'JACQUEVILLE VILLE', 2),
  ('DAB', 'DABOU', 'DABOU', 3),
  ('DAB', 'DABOU', 'N''ZEKREZESSOU', 4),
  ('DAB', 'DABOU', 'DABOU VILLE', 5),
  ('DAB', 'DABOU', 'PALMERAIE', 6),
  ('DAB', 'DABOU', 'CAFOP', 7),
  ('DAB', 'DABOU', 'RÉSIDENTIEL 1', 8),
  ('DAB', 'GRAND-LAHOU / FRESCO', 'GRAND-LAHOU', 1),
  ('DAB', 'GRAND-LAHOU / FRESCO', 'CRF GRAND-LAHOU', 2),
  ('DAB', 'GRAND-LAHOU / FRESCO', 'CRF FRESCO', 3),
  ('DAB', 'GRAND-LAHOU / FRESCO', 'FRESCO VILLE ET PÉRIPHÉRIES', 4),
  ('DAB', 'GRAND-LAHOU', 'GRAND-LAHOU', 1),
  ('DAB', 'GRAND-LAHOU', 'CRF GRAND-LAHOU VILLAGES PÉRIPHÉRIQUES', 2),
  ('ABO 1', 'DOKUI', 'DOKUI', 1),
  ('ABO 1', 'DOKUI', 'ANADOR', 2),
  ('ABO 1', 'DOKUI', 'COCO SERVICE DERRIÈRE UNIVERSITÉ ABOBO-ADJAMÉ', 3),
  ('ABO 1', 'DOKUI', 'ALÉPÉ', 4),
  ('ABO 1', 'AVOCATIER', 'AVOCATIER', 1),
  ('ABO 1', 'AVOCATIER', 'BC PALAIS DE JUSTICE', 2),
  ('ABO 1', 'AVOCATIER', 'AUTOROUTE', 3),
  ('ABO 1', 'AVOCATIER', 'NOUVELLE GARE', 4),
  ('ABO 1', 'AVOCATIER', 'AGNISSANKOI', 5),
  ('ABO 1', 'KENNEDY', 'SAMANKÉ', 1),
  ('ABO 1', 'KENNEDY', 'CLOUÉTCHA', 2),
  ('ABO 1', 'KENNEDY', 'ABOBO BAOULÉ', 3),
  ('ABO 1', 'KENNEDY', 'BIABOU', 4),
  ('ABO 1', 'AKEIKOI', 'AKEIKOI', 1),
  ('ABO 1', 'AKEIKOI', 'HABITAT', 2),
  ('ABO 1', 'AKEIKOI', 'AGBEKOI', 3),
  ('ABO 1', 'AKEIKOI', 'HOUPHOUËT-BOIGNY', 4),
  ('ABO 1', 'GENDARMERIE', 'LYCÉE MODERNE', 1),
  ('ABO 1', 'GENDARMERIE', 'ÉTOILE', 2),
  ('ABO 1', 'GENDARMERIE', 'GENDARMERIE', 3),
  ('ABO 1', 'GENDARMERIE', 'BON PRIX GENDARMERIE', 4),
  ('ABO 1', 'GENDARMERIE', '3 CHATONS', 5),
  ('ABO 1', 'SOGEFIA', 'CITÉ POLICIÈRE', 1),
  ('ABO 1', 'SOGEFIA', 'CAMP COMMANDO', 2),
  ('ABO 1', 'SOGEFIA', 'CNPS', 3),
  ('ABO 1', 'SOGEFIA', 'AVENUE KAZA', 4),
  ('ABO 1', 'SOGEFIA', 'COLATIER', 5),
  ('ABO 1', 'ABOBO GARE', 'ABOBO GARE', 1),
  ('ABO 1', 'ABOBO GARE', 'MAIRIE', 2),
  ('ABO 2', 'MOSQUÉE BLANCHE', 'MOSQUÉE BLANCHE', 1),
  ('ABO 2', 'MOSQUÉE BLANCHE', 'ANONKOI KOUTÉ', 2),
  ('ABO 2', 'MOSQUÉE BLANCHE', 'MARAHOUÉ', 3),
  ('ABO 2', 'MOSQUÉE BLANCHE', 'AGRIPARC', 4),
  ('ABO 2', 'ONUCI', 'SODECI', 1),
  ('ABO 2', 'ONUCI', 'ONUCI', 2),
  ('ABO 2', 'ONUCI', 'SOTRAPIM', 3),
  ('ABO 2', 'ONUCI', 'CARREFOUR DIALLO', 4),
  ('ABO 2', 'ONUCI', 'TAXI BAGAGE', 5),
  ('ABO 2', 'CMA', 'CMA', 1),
  ('ABO 2', 'CMA', 'COCCINELLE', 2),
  ('ABO 2', 'CMA', 'CONCORDE', 3),
  ('ABO 2', 'CMA', 'BOIS SEC', 4),
  ('ABO 2', 'CMA', 'DÉLICE DE FRANCE', 5),
  ('ABO 2', 'CMA', 'ANCIEN MARCHÉ', 6),
  ('ABO 2', 'CMA', 'UNICAFÉ', 7),
  ('ABO 2', 'CMA', 'FEU ANCIENNE GENDARMERIE', 8),
  ('ANY', 'ANYAMA', 'ANCIENNE GENDARMERIE', 1),
  ('ANY', 'ANYAMA', 'BELLE VILLE MORGUE', 2),
  ('ANY', 'ANYAMA', 'GARE', 3),
  ('ANY', 'ANYAMA', 'ADZOPÉ', 4),
  ('ANY', 'ANYAMA', 'AGBOVILLE', 5),
  ('ANY', 'ANYAMA', 'CHÂTEAU', 6),
  ('ANY', 'ANYAMA', 'MARCHÉ COLA', 7),
  ('ANY', 'ANYAMA', 'MARCHÉ D''ANYAMA', 8),
  ('ANY', 'ANYAMA', 'DON ORION', 9),
  ('ANY', 'ANYAMA', 'AZAGUIÉ', 10),
  ('ANY', 'ANYAMA', 'BLIDA AZAGUIÉ AWA ATTINGUIÉ', 11),
  ('ANY', 'ANYAMA', 'ANYAMA', 12),
  ('ANY', 'ANYAMA', 'PLAQUE ARABE', 13),
  ('ANY', 'ANYAMA', 'ANYAMA RÉSIDENTIEL', 14),
  ('ANY', 'ANYAMA', 'ÉBIMPÉ', 15),
  ('ANY', 'ANYAMA', 'MARCHÉ CHAKA KONÉ', 16),
  ('ANY', 'N''DOTRÉ', 'AXE AUTOROUTE N''DOTRÉ', 1),
  ('ANY', 'N''DOTRÉ', 'DANDI', 2),
  ('ANY', 'N''DOTRÉ', 'COMPLEXE', 3),
  ('ANY', 'N''DOTRÉ', 'MAIRIE', 4),
  ('ANY', 'N''DOTRÉ', 'ANCIENNE GENDARMERIE', 5),
  ('ANY', 'N''DOTRÉ', 'BELLE VILLE MORGUE', 6),
  ('ANY', 'N''DOTRÉ', 'GARE', 7),
  ('ANY', 'N''DOTRÉ', 'BANDJI', 8),
  ('ANY', 'N''DOTRÉ', 'N''DOTRÉ EXTENSION', 9),
  ('ANY', 'N''DOTRÉ', 'CÉLESTE', 10),
  ('ANY', 'N''DOTRÉ', 'NOUVELLE CASSE', 11),
  ('ANY', 'N''DOTRÉ', 'ARC-EN-CIEL', 12),
  ('ANY', 'N''DOTRÉ', 'DANDY', 13),
  ('ANY', 'N''DOTRÉ', 'KOBAKRO', 14),
  ('ANY', 'N''DOTRÉ', 'TERRE ROUGE', 15),
  ('ANY', 'N''DOTRÉ', 'AKWABA', 16),
  ('ADJ', 'ADJAMÉ 1', '220 LOGEMENTS', 1),
  ('ADJ', 'ADJAMÉ 1', 'LIBERTÉ', 2),
  ('ADJ', 'ADJAMÉ 1', 'QUARTIER LATIN', 3),
  ('ADJ', 'ADJAMÉ 1', 'BRACODI', 4),
  ('ADJ', 'ADJAMÉ 1', 'RENAULT', 5),
  ('ADJ', 'ADJAMÉ 2', 'WILLIAMSVILLE', 1),
  ('ADJ', 'ADJAMÉ 2', 'MACACI', 2),
  ('ADJ', 'ADJAMÉ 2', 'PAILLET', 3),
  ('ADJ', 'ADJAMÉ 2', 'VIDANGE', 4),
  ('ADJ', 'ADJAMÉ 2', 'HMA', 5),
  ('ADJ', 'ADJAMÉ 3', 'SAPEURS-POMPIERS', 1),
  ('ADJ', 'ADJAMÉ 3', 'SAINT-MICHEL', 2),
  ('ADJ', 'ADJAMÉ 3', 'QUARTIER ÉBRIÉ', 3),
  ('ADJ', 'ADJAMÉ 3', 'DALLAS', 4),
  ('ADJ', 'ADJAMÉ 4', 'BROMAKOTÉ', 1),
  ('ADJ', 'ADJAMÉ 4', 'DÉLÉGATION', 2),
  ('ADJ', 'ADJAMÉ 4', 'CITÉ RAN', 3),
  ('PLA', 'ATTÉCOUBÉ - PLATEAU 1', 'AGBAN VILLAGE', 1),
  ('PLA', 'ATTÉCOUBÉ - PLATEAU 1', 'CITÉ FAIRMONT', 2),
  ('PLA', 'ATTÉCOUBÉ - PLATEAU 1', 'ATTÉCOUBÉ CENTRE', 3),
  ('PLA', 'ATTÉCOUBÉ - PLATEAU 1', 'PLATEAU CENTRE', 4),
  ('PLA', 'ATTÉCOUBÉ - PLATEAU 1', 'MARCHÉ DE FRUITS', 5),
  ('ADZ', 'ADZOPÉ VILLE', 'ADZOPÉ VILLE', 1),
  ('ADZ', 'PÉRIPHÉRIES', 'AKOUPÉ', 1),
  ('ADZ', 'PÉRIPHÉRIES', 'YAKASSÉ-ATTOBROU', 2),
  ('ADZ', 'PÉRIPHÉRIES', 'ANDÉ', 3),
  ('ADZ', 'PÉRIPHÉRIES', 'YAKASSÉ-MÉ', 4),
  ('AGB', 'AGBOVILLE VILLE', 'AGBOVILLE VILLE', 1),
  ('AGB', 'AGBOVILLE VILLE', 'N''DOUCI', 2),
  ('AGB', 'AGBOVILLE VILLE', 'SIKENSI', 3),
  ('AGB', 'AZAGUIÉ', 'AZAGUIÉ', 1),
  ('AGB', 'AZAGUIÉ', 'PETIT YAPO', 2),
  ('AGB', 'AZAGUIÉ', 'GRAND YAPO', 3),
  ('AGB', 'AZAGUIÉ', 'RUBINO', 4),
  ('AGB', 'AZAGUIÉ', 'CÉCHI', 5)
) as s(territoire_code, zone_nom, nom, ordre)
join public.zone z on z.territoire_code = s.territoire_code and z.nom = s.zone_nom and z.actif and z.code ~ '^Z[0-9]{2}$'
on conflict (zone_id, nom) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Libellé de territoire des boutiques (renommés ou fusionnés seulement)
--    Le déclencheur pdv_link_referentiels remplirait distributeur et zone des
--    boutiques qui n'en ont pas : simple changement de libellé, on le coupe.
-- ---------------------------------------------------------------------------
alter table public.pdv disable trigger trg_pdv_link_referentiels;
update public.pdv set zone = 'COCODY', territory_code = 'COC' where zone in ('COCODY 1', 'COCODY 2', 'COCODY');
update public.pdv set zone = 'ATTÉCOUBÉ-PLATEAU', territory_code = 'PLA' where zone in ('ATTECOUBE-PLATEAU', 'PLATEAU', 'ATTECOUBE');
update public.pdv set zone = 'ADJAMÉ' where zone in ('ADJAME');
update public.pdv set zone = 'ADZOPÉ' where zone in ('ADZOPE');
update public.pdv set zone = 'MARCORY' where zone in ('Marcory');
update public.pdv set zone = 'TREICHVILLE' where zone in ('Treichville');
update public.pdv set zone = 'YOPOUGON 1' where zone in ('Yopougon 1');
update public.pdv set zone = 'BASSAM' where zone in ('Bassam');
alter table public.pdv enable trigger trg_pdv_link_referentiels;

-- Même libellé dans les sous-zones des SSF (comparées au territoire de la
-- boutique par etapes_quota_du_jour_avant_quartiers) et dans les règles de
-- tournée. Cocody 1 et Cocody 2 fusionnent : une ligne en double par SSF et
-- quartier est retirée (gardée dans la sauvegarde).
with m(ancien, nouveau) as (values
  ('COCODY 1', 'COCODY'),
  ('COCODY 2', 'COCODY'),
  ('COCODY', 'COCODY'),
  ('ATTECOUBE-PLATEAU', 'ATTÉCOUBÉ-PLATEAU'),
  ('PLATEAU', 'ATTÉCOUBÉ-PLATEAU'),
  ('ATTECOUBE', 'ATTÉCOUBÉ-PLATEAU'),
  ('ADJAME', 'ADJAMÉ'),
  ('ADZOPE', 'ADZOPÉ'),
  ('Marcory', 'MARCORY'),
  ('Treichville', 'TREICHVILLE'),
  ('Yopougon 1', 'YOPOUGON 1'),
  ('Bassam', 'BASSAM')
), d as (
  select sq.id, row_number() over (partition by sq.ssf_id, coalesce(m.nouveau, sq.zone), sq.quartier order by sq.id) as rang
  from public.ssf_quartier sq left join m on m.ancien = sq.zone
)
delete from public.ssf_quartier where id in (select id from d where rang > 1);
update public.ssf_quartier set zone = 'COCODY' where zone in ('COCODY 1', 'COCODY 2', 'COCODY');
update public.ssf_quartier set zone = 'ATTÉCOUBÉ-PLATEAU' where zone in ('ATTECOUBE-PLATEAU', 'PLATEAU', 'ATTECOUBE');
update public.ssf_quartier set zone = 'ADJAMÉ' where zone in ('ADJAME');
update public.ssf_quartier set zone = 'ADZOPÉ' where zone in ('ADZOPE');
update public.ssf_quartier set zone = 'MARCORY' where zone in ('Marcory');
update public.ssf_quartier set zone = 'TREICHVILLE' where zone in ('Treichville');
update public.ssf_quartier set zone = 'YOPOUGON 1' where zone in ('Yopougon 1');
update public.ssf_quartier set zone = 'BASSAM' where zone in ('Bassam');
update public.routing_templates set territoire = 'COCODY' where territoire in ('COCODY 1', 'COCODY 2', 'COCODY');
update public.routing_templates set territoire = 'ATTÉCOUBÉ-PLATEAU' where territoire in ('ATTECOUBE-PLATEAU', 'PLATEAU', 'ATTECOUBE');
update public.routing_templates set territoire = 'ADJAMÉ' where territoire in ('ADJAME');
update public.routing_templates set territoire = 'ADZOPÉ' where territoire in ('ADZOPE');
update public.routing_templates set territoire = 'MARCORY' where territoire in ('Marcory');
update public.routing_templates set territoire = 'TREICHVILLE' where territoire in ('Treichville');
update public.routing_templates set territoire = 'YOPOUGON 1' where territoire in ('Yopougon 1');
update public.routing_templates set territoire = 'BASSAM' where territoire in ('Bassam');

-- ---------------------------------------------------------------------------
-- 7. Commerciaux (10 comptes, 8 personnes)
-- ---------------------------------------------------------------------------
update public.profiles set zone_assignee = null, region = 'ABIDJAN 1',
  territoires_assignes = '["BINGERVILLE", "COCODY"]'::jsonb,
  quartiers_assignes = '["MAHOU", "7ÈME TRANCHE", "8ÈME TRANCHE", "DJIBI", "LES CITÉS", "ANGRÉ CHÂTEAU", "DJOROGOBITÉ 1", "DJOROGOBITÉ 2", "BESSIKOI", "GESTOCI", "PALMERAIE", "ATTOBAN", "BONOUMIN", "FAYA", "AKOUÉDO", "ABATTA", "FAYA FIN GOUDRON", "CITÉ SIR", "FEH KESSÉ", "AKANDJÉ", "LAURIER 15", "SANTÉ", "BINGERVILLE CENTRE", "GBAGBA", "BERLIN", "SAVANE", "MACHOUX", "SICOGI", "ANGRE", "CITE SIR", "DJOROBITE", "AKOUEDO", "FAYA A DROITE", "BINGERVILLE", "MARCHE", "2 PLATEAUX"]'::jsonb
where email in ('muriel.siotene@friesland.ci') and role = 'commercial';
update public.profiles set zone_assignee = null, region = 'ABIDJAN 1',
  territoires_assignes = '["COCODY", "PORT-BOUËT 2", "BASSAM", "BONOUA"]'::jsonb,
  quartiers_assignes = '["LYCÉE TECHNIQUE", "VALLON", "COLOMBIE", "2 PLATEAUX LES PERLES", "DANGA", "COCODY CENTRE", "BLOCKAUSS", "RIVIERA 2", "ANONO", "RIVIERA 3", "M''POUTO", "CIAD", "M''BADON", "GONZAGUEVILLE", "CRF MOTARD", "CRF CHIEN", "1ER ARRÊT", "2E ARRÊT", "ANANI", "PETIT BASSAM", "TERRE ROUGE", "ABRAHAM", "BASSAM", "MOOSSOU 2", "QUARTIER FRANCE", "AZURETTI", "VILLAGE ARTISANAL", "GRAND MARCHÉ", "PETIT MARCHÉ", "IMPÉRIAL", "MODESTE", "MOOSSOU", "EDOUKOU MIEZAN", "8 KILOS", "YAOU", "CENTRE-VILLE", "BEGNERI", "SAMO", "ASSINIE", "ROND-POINT", "ADIAKÉ", "COCODY CENTRE -", "ROND POINT ANANI", "2 PLATEAUX", "DERRIERE WARF", "PHARE", "ABATTOIR", "AKWABA", "MARCHE DE NUIT"]'::jsonb
where email in ('abidjannordfccocody1@gmail.com', 'annydivine49@gmail.com') and role = 'commercial';
update public.profiles set zone_assignee = null, region = 'ABIDJAN 1',
  territoires_assignes = '["TREICHVILLE", "MARCORY", "KOUMASSI"]'::jsonb,
  quartiers_assignes = '[]'::jsonb
where email in ('abidjansudfcmarcory@gmail.com', 'abidjansudfctreichville@gmail.com') and role = 'commercial';
update public.profiles set zone_assignee = null, region = 'ABIDJAN 1',
  territoires_assignes = '["PORT-BOUËT 1", "PORT-BOUËT 2", "ABOISSO"]'::jsonb,
  quartiers_assignes = '["PORT-BOUËT CENTRE", "AÉROPORT", "ADJAHUI", "CITÉ POLICIÈRE", "VRIDI", "CORRIDOR", "JEAN FOLLY", "ADJOUFFOU", "ABOISSO", "DIATEKRO", "SOKORA", "COMMERCE", "SOS", "DOSOBAH", "CITÉ KOUMI", "LYCÉE", "KOLAIWA", "SANHOUMAN", "AYAMÉ", "N''ZIKRO", "MOUYASSUÉ", "KRINDJABO", "TIAPOUM", "NOÉ", "PORT BOUET CENTRE", "VRIDI CITE", "VRIDI CANAL", "AEROPORT", "JEAN FOLIE", "DERRIERE WARF", "PHARE", "ABATTOIR", "AKWABA", "MARCHE DE NUIT"]'::jsonb
where email in ('azoumi.kena@friesland.ci') and role = 'commercial';
update public.profiles set zone_assignee = null, region = 'ABIDJAN 2',
  territoires_assignes = '["YOPOUGON 1", "YOPOUGON 2", "YOPOUGON 1 & 2 PÉRIPHÉRIE"]'::jsonb,
  quartiers_assignes = '[]'::jsonb
where email in ('abidjannordfcyopougon1@gmail.com') and role = 'commercial';
update public.profiles set zone_assignee = null, region = 'ABIDJAN 2',
  territoires_assignes = '["YOPOUGON 3", "YOPOUGON 4", "YOPOUGON 3 & 4 PÉRIPHÉRIES"]'::jsonb,
  quartiers_assignes = '[]'::jsonb
where email in ('abidjannordfcyopougon3@gmail.com') and role = 'commercial';
update public.profiles set zone_assignee = null, region = 'ABIDJAN 2',
  territoires_assignes = '["ABOBO 1", "ABOBO 2", "ANYAMA", "ADZOPÉ"]'::jsonb,
  quartiers_assignes = '[]'::jsonb
where email in ('abidjannordabobo1@gmail.com') and role = 'commercial';
update public.profiles set zone_assignee = null, region = 'ABIDJAN 2',
  territoires_assignes = '["ADJAMÉ", "ATTÉCOUBÉ-PLATEAU", "AGBOVILLE"]'::jsonb,
  quartiers_assignes = '[]'::jsonb
where email in ('abidjannordfcadjame@gmail.com') and role = 'commercial';

-- ---------------------------------------------------------------------------
-- 8. Contrôle : la transaction échoue si le chargement ne correspond pas au fichier
-- ---------------------------------------------------------------------------
do $$
declare v_t int; v_z int; v_q int;
begin
  select count(*) into v_t from public.territoire
    where sous_region_code in ('SOUTH1', 'SOUTH2') and code <> 'MT' and actif;
  select count(*) into v_z from public.zone z join public.territoire t on t.code = z.territoire_code
    where t.sous_region_code in ('SOUTH1', 'SOUTH2') and t.code <> 'MT' and z.actif;
  select count(*) into v_q from public.quartier qu join public.zone z on z.id = qu.zone_id
    join public.territoire t on t.code = z.territoire_code
    where t.sous_region_code in ('SOUTH1', 'SOUTH2') and t.code <> 'MT' and z.actif;
  if (v_t, v_z, v_q) <> (23, 60, 318) then
    raise exception 'Découpage incomplet : % territoires, % zones, % secteurs (attendu 23, 60, 318)', v_t, v_z, v_q;
  end if;
end $$;

commit;
