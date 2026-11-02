-- ============================================================================
-- GPS ABERRANTS HORS ATOM : RAMENÉS AU CENTRE DE LEUR VILLE (02/11/2026)
--
-- Règle de Jean Luc (02/11) : un point de vente dont le GPS est aberrant est
-- placé au centre de sa ville ; comme pour Atom, le merchandiser qui l'a dans
-- son routing fixe la vraie position à la première visite. C'est déjà le cas :
-- pdv_gps_depuis_visite remplace le GPS tant que gps_source n'est pas terrain,
-- admin, creation ou visite_validee, et la tablette ne contrôle pas la distance
-- avant ce premier repère (utils/repereGps.ts).
--
-- Nouvelle valeur gps_source = 'centre-ville' : position provisoire, pour les
-- retrouver et ne jamais les prendre pour un repère.
--
-- Recherche du 02/11, points de vente actifs hors Atom (ni pdv_atom, ni import
-- Atom), position pas encore relevée sur place :
--   - à plus de 30 km du centre de leur ville (quartier « VILLE/… ») : 245 + 171,
--     presque tous avec un GPS juste et un quartier mal saisi (Doropo classé à
--     Bouna, Grand-Béréby à San Pedro, Maroc de Bouaké, Belle ville de Duékoué
--     classée à Man) ;
--   - sans autre point de vente à moins de ~10 km : villages réels (Niellé,
--     Dianra, Bouko, Noé) ;
--   - même boutique enregistrée plusieurs fois, une fiche loin des autres :
--     seul Toure Oumar.
-- Un seul GPS certainement faux : Toure Oumar (80e82c42, census, ABENGOUROU/
-- PLATEAU), placé au nord du Ghana (10.655782, -1.521787). Les cas douteux sont
-- dans le Google Sheet « Points de vente mal placés hors Atom – 02/11/2026 ».
--
-- Centre d'Abengourou : latitude et longitude médianes des 1 774 points de
-- vente hors Atom du quartier ABENGOUROU/…, calculées le 02/11 (6.727265,
-- -3.498215), à 2,2 km de l'autre fiche Toure Oumar (662d6c81).
--
-- Appliquée sans utilisateur connecté : pdv_gps_admin ne marque pas « admin ».
-- Retour arrière : update depuis pdv_gps_avant_20261102. Idempotente.
-- ============================================================================
begin;

alter table public.pdv drop constraint if exists pdv_gps_source_valide;
alter table public.pdv add constraint pdv_gps_source_valide check (
  gps_source is null or gps_source = any (array[
    'dms', 'dms-absent', 'dms-depot', 'terrain', 'admin', 'atom', 'atom-absent', 'atom-fichier',
    'itinerant', 'creation', 'visite_validee', 'centre-ville']));

create table if not exists public.pdv_gps_avant_20261102 (
  pdv_id text primary key,
  ancien_lat double precision,
  ancien_lng double precision,
  ancienne_source text,
  ville text not null,
  centre_lat double precision not null,
  centre_lng double precision not null,
  motif text not null,
  sauvegarde_le timestamptz not null default now()
);
alter table public.pdv_gps_avant_20261102 enable row level security;
comment on table public.pdv_gps_avant_20261102 is
  'Sauvegarde des GPS ramenés au centre de leur ville le 02/11/2026 (migration 20261102120000).';

create temp table _gps_centre_ville (pdv_id text, ville text, centre_lat double precision, centre_lng double precision, motif text) on commit drop;
insert into _gps_centre_ville values
  ('80e82c42', 'ABENGOUROU', 6.727265, -3.498215, 'GPS au nord du Ghana ; deux autres fiches de la même boutique au Plateau d''Abengourou');

insert into public.pdv_gps_avant_20261102 (pdv_id, ancien_lat, ancien_lng, ancienne_source, ville, centre_lat, centre_lng, motif)
select p.pdv_id, p.geolocation_lat, p.geolocation_lng, p.gps_source, c.ville, c.centre_lat, c.centre_lng, c.motif
from _gps_centre_ville c
join public.pdv p on p.pdv_id = c.pdv_id
on conflict (pdv_id) do nothing;

-- Seulement si la position n'a pas déjà été relevée sur place entre-temps.
update public.pdv p
set geolocation_lat = c.centre_lat,
    geolocation_lng = c.centre_lng,
    gps_source = 'centre-ville',
    gps_precision_m = null,
    gps_maj_le = now()
from _gps_centre_ville c
where p.pdv_id = c.pdv_id
  and coalesce(p.gps_source, '') not in ('terrain', 'admin', 'creation', 'visite_validee', 'centre-ville')
  and not exists (select 1 from public.pdv_atom a where a.pdv_id = p.pdv_id);

commit;
