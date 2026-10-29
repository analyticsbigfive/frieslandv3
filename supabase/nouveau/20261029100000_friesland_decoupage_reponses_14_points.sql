-- ============================================================================
-- DÉCOUPAGE DÉFINITIF : RÉPONSES DE FRIESLAND AUX 14 POINTS (29/10/2026)
--
-- Source : feuille « Découpage sectoriel – 14 points à confirmer (28/10/2026) »
-- (10xOgnvPfF8ShX2uRdzPC4ig0V8ieVgBlCvHLxm8uKWI), colonne « Réponse Friesland »,
-- et réunion du 29/10. Numéros de ligne : fichier final
-- (1fBgpZBPDAsq6kdaMxfoevoxiR0NDNR2jwpoBeAxehD0), relu le 29/10, inchangé.
--
-- 20261028140000 avait chargé les 14 lieux en double tels que dans le fichier.
-- Chaque lieu ne garde que la zone retenue :
--   1  SIKENSI              → Souare : retiré de AGBOVILLE VILLE (l. 335)
--   2  N'DOUCI              → Souare : retiré de AGBOVILLE VILLE (l. 334)
--   3  AZAGUIÉ              → Rachid, zone ANYAMA : secteur retiré de la zone
--                             AZAGUIÉ d'Agboville (l. 336) ; ses 4 autres
--                             secteurs restent à Armande
--   6  ANCIENNE GENDARMERIE, BELLE VILLE MORGUE, GARE → zone N'DOTRÉ :
--                             retirés de la zone ANYAMA (l. 270-272)
--   7  KM 17                → SONGON & KM 17 : retiré de MAROC / BAGNON (l. 195)
--   8  CITÉ VERTE           → LUBAFRIQUE / CITÉ VERTE : retiré de MAROC / BAGNON (l. 190)
--   9  ANANERAIE            → SONGON & KM 17 : retiré de SIPOREX / PORT-BOUËT 2 /
--                             ANANERAIE (l. 184) et de MAROC / BAGNON (l. 187),
--                             ajouté à SONGON & KM 17
--   10 GRAND-LAHOU, CRF GRAND-LAHOU → zone GRAND-LAHOU : retirés de
--                             GRAND-LAHOU / FRESCO (l. 218-219)
--   11 ABOISSO              → ABOISSO 1 : retiré de ABOISSO 3 (l. 124)
-- Sans changement : 4 et 5 (Agboville, Adzopé restent secteurs de la zone
-- Anyama, Rachid), 12 (carrefour de Jacqueville déjà dans DABOU), 13 (Alépé),
-- 14 (Adiaké, Assinie à Anne Marie).
--
-- Territoires et zones ne changent pas, ni leurs noms. Les commerciaux sont
-- rattachés par territoire : territoires_assignes ne change pas. Chaque nom
-- retiré existe encore dans la zone retenue (pdv.quartier, ssf_quartier et
-- quartiers_assignes sont du texte ; aucune clé étrangère sur quartier).
--
-- 318 → 306 secteurs (13 retirés, 1 ajouté). Lignes retirées gardées dans
-- decoupage_avant_20261028 (objet quartier_reponses_20261029).
-- Attention : rejouer 20261028140000 réinsérerait les 13 secteurs retirés.
-- Idempotente.
-- ============================================================================
begin;

create temporary table retraits (territoire_code text, zone_nom text, nom text) on commit drop;
insert into retraits values
  ('AGB', 'AGBOVILLE VILLE', 'SIKENSI'),
  ('AGB', 'AGBOVILLE VILLE', 'N''DOUCI'),
  ('AGB', 'AZAGUIÉ', 'AZAGUIÉ'),
  ('ANY', 'ANYAMA', 'ANCIENNE GENDARMERIE'),
  ('ANY', 'ANYAMA', 'BELLE VILLE MORGUE'),
  ('ANY', 'ANYAMA', 'GARE'),
  ('YOP 4', 'MAROC / BAGNON', 'KM 17'),
  ('YOP 4', 'MAROC / BAGNON', 'CITÉ VERTE'),
  ('YOP 4', 'MAROC / BAGNON', 'ANANERAIE'),
  ('YOP 3', 'SIPOREX / PORT-BOUËT 2 / ANANERAIE', 'ANANERAIE'),
  ('DAB', 'GRAND-LAHOU / FRESCO', 'GRAND-LAHOU'),
  ('DAB', 'GRAND-LAHOU / FRESCO', 'CRF GRAND-LAHOU'),
  ('ABO', 'ABOISSO 3', 'ABOISSO');

-- 1. Sauvegarde des secteurs retirés
insert into public.decoupage_avant_20261028 (objet, cle, donnees)
select 'quartier_reponses_20261029', qu.id::text, to_jsonb(qu)
from public.quartier qu
join public.zone z on z.id = qu.zone_id and z.actif and z.code ~ '^Z[0-9]{2}$'
join retraits r on r.territoire_code = z.territoire_code and r.zone_nom = z.nom and r.nom = qu.nom
on conflict do nothing;

-- 2. Retraits
delete from public.quartier qu
using public.zone z, retraits r
where z.id = qu.zone_id and z.actif and z.code ~ '^Z[0-9]{2}$'
  and r.territoire_code = z.territoire_code and r.zone_nom = z.nom and r.nom = qu.nom;

-- 3. ANANERAIE dans SONGON & KM 17, après JUSQU'AU CRF JACQUEVILLE
insert into public.quartier (zone_id, nom, ordre)
select z.id, 'ANANERAIE', 8
from public.zone z
where z.territoire_code = 'YOP 4' and z.nom = 'SONGON & KM 17' and z.actif and z.code ~ '^Z[0-9]{2}$'
on conflict (zone_id, nom) do nothing;

-- 4. Contrôle
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
  if (v_t, v_z, v_q) <> (23, 60, 306) then
    raise exception 'Découpage inattendu : % territoires, % zones, % secteurs (attendu 23, 60, 306)', v_t, v_z, v_q;
  end if;
end $$;

commit;
