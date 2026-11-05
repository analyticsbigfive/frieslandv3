-- ============================================================================
-- DISTRIBUTEUR, TERRITOIRE ET QUARTIER DES BOUTIQUES CRÉÉES SUR LE TERRAIN
-- (05/11/2026, demande de Jean Luc après la plainte de Gui Stéphane)
--
-- Constat : depuis la nuit du 22 au 23/10, synchroniser_zones_atom (« vos
-- PDV ») vide zone_assignee et quartiers_assignes des profils Atom. Le
-- formulaire de création (PDVQuickCreateModal, app 1.0.19) n'a plus de liste
-- de quartiers : Quartier et Zone deviennent des cases libres, remplies à
-- l'envers (« Treicheville » / « Belle ville »), le territoire n'est plus
-- résolu et le premier distributeur national, ADIALEA RCI, est pré-rempli.
-- 138 boutiques actives créées dans l'app n'avaient pas le distributeur du
-- routing de leur créateur (134 ADIALEA RCI, 2 PROSUMA CASH PORT, 2 PRODISMA),
-- et 122 de leurs visites portaient ce mauvais distributeur.
--
-- Règle (validée par Jean Luc le 05/11) : une boutique créée par un compte
-- qui a un routing actif prend
--   * le distributeur de son routing (un seul : celui-là ; plusieurs : celui
--     du point de visite le plus proche du GPS) ;
--   * le territoire (zone = nom du territoire, territory_code, région) du PDV
--     importé le plus proche (created_by vide, territoire actif, ≤ 300 m) ;
--   * comme quartier, le point de visite le plus proche (mot d'Atom) s'il
--     est à 1,5 km au plus ; sinon le quartier du voisin importé, et la
--     boutique est signalée (champ « alerte » du journal).
--
-- 1. corriger_pdv_terrain(pdv) : la règle, sans effet de bord.
-- 2. trg_pdv_creation_terrain (BEFORE INSERT, passe avant
--    trg_pdv_link_referentiels) : garde-fou pour l'app 1.0.19 et la file hors
--    ligne, jusqu'au formulaire corrigé. Chaque changement est noté dans
--    pdv_correction_terrain.
-- 3. Rattrapage des boutiques existantes et de leurs visites, avec
--    sauvegardes. Idempotente : ne touche que les boutiques encore hors
--    distributeur du routing.
--
-- Appliquée le 05/11/2026 par le MCP Supabase après une répétition complète
-- annulée : 138 boutiques corrigées (journal : 138 distributeurs, 137 zones
-- et territoires, 118 quartiers, 2 alertes « loin du routing » : c682f8f0 à
-- 9,7 km, c9989b7b à 3 km), 122 visites corrigées, synced_at inchangé.
-- ============================================================================
begin;

-- Journal des corrections (insertions et rattrapage).
create table if not exists public.pdv_correction_terrain (
  id bigserial primary key,
  pdv_id text not null,
  cree_par uuid,
  origine text not null,              -- 'creation' (trigger) ou 'rattrapage_20261105'
  champ text not null,
  avant text,
  apres text,
  corrige_le timestamptz not null default now()
);
create index if not exists pdv_correction_terrain_pdv_idx on public.pdv_correction_terrain (pdv_id);
alter table public.pdv_correction_terrain enable row level security;
drop policy if exists pdv_correction_terrain_lecture on public.pdv_correction_terrain;
create policy pdv_correction_terrain_lecture on public.pdv_correction_terrain
  for select using (role_actif_courant() = any (array['admin', 'superviseur']));
comment on table public.pdv_correction_terrain is
  'Distributeur, territoire et quartier corrigés sur les boutiques créées dans l''app (migration 20261105150000).';

-- 1. La règle -----------------------------------------------------------------
create or replace function public.corriger_pdv_terrain(p public.pdv)
returns public.pdv
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dists text[];
  v_point_dist text;
  v_point_nom text;
  v_point_m numeric;
  v_voisin_quartier text;
  v_terr_code text;
  v_terr_nom text;
  v_region text;
  v_area text;
  v_area_dist text;
begin
  if p.created_by is null then
    return p;
  end if;

  select array_agg(distinct r.distributeur) filter (where r.distributeur is not null)
    into v_dists
  from routing_mensuel r
  where r.merchandiser_id = p.created_by and r.actif;
  if v_dists is null or cardinality(v_dists) = 0 then
    return p;  -- pas de routing : rien à imposer
  end if;

  if p.geolocation_lat is not null and p.geolocation_lng is not null then
    -- Point de visite le plus proche (même règle que les listes Atom).
    select r.distributeur, r.point_visite,
           6371000 * 2 * asin(sqrt(
             power(sin(radians(r.latitude - p.geolocation_lat) / 2), 2)
           + cos(radians(p.geolocation_lat)) * cos(radians(r.latitude))
           * power(sin(radians(r.longitude - p.geolocation_lng) / 2), 2)))
      into v_point_dist, v_point_nom, v_point_m
    from routing_mensuel r
    where r.merchandiser_id = p.created_by and r.actif
      and r.latitude is not null and r.longitude is not null
    order by power(r.latitude - p.geolocation_lat, 2)
           + power((r.longitude - p.geolocation_lng) * cos(radians(p.geolocation_lat)), 2)
    limit 1;

    -- PDV importé le plus proche, sur un territoire actif, à 300 m au plus.
    select t.code, t.nom, n.region, n.area_code, n.distributor_name, n.quartier
      into v_terr_code, v_terr_nom, v_region, v_area, v_area_dist, v_voisin_quartier
    from pdv n
    join territoire t on t.code = n.territory_code and t.actif
    where n.is_active and n.created_by is null and n.pdv_id <> p.pdv_id
      and n.geolocation_lat between p.geolocation_lat - 0.003 and p.geolocation_lat + 0.003
      and n.geolocation_lng between p.geolocation_lng - 0.003 and p.geolocation_lng + 0.003
      and 6371000 * 2 * asin(sqrt(
            power(sin(radians(n.geolocation_lat - p.geolocation_lat) / 2), 2)
          + cos(radians(p.geolocation_lat)) * cos(radians(n.geolocation_lat))
          * power(sin(radians(n.geolocation_lng - p.geolocation_lng) / 2), 2))) <= 300
    order by power(n.geolocation_lat - p.geolocation_lat, 2)
           + power((n.geolocation_lng - p.geolocation_lng) * cos(radians(p.geolocation_lat)), 2)
    limit 1;
  end if;

  -- Distributeur : celui du routing.
  if p.distributor_name is null or not (p.distributor_name = any (v_dists)) then
    p.distributor_name := case
      when cardinality(v_dists) = 1 then v_dists[1]
      else coalesce(v_point_dist, v_dists[1])
    end;
  end if;

  -- Territoire : celui du voisin importé.
  if v_terr_code is not null then
    p.zone := v_terr_nom;
    p.territory_code := v_terr_code;
    if v_region is not null then
      p.region := v_region;
    end if;
    -- Area du voisin seulement s'il a le même distributeur ; sinon
    -- pdv_link_referentiels la retrouve depuis le quartier quand il peut.
    p.area_code := case when v_area_dist is not distinct from p.distributor_name then v_area else null end;
  end if;

  -- Quartier : le point de visite le plus proche, s'il est à 1,5 km au plus ;
  -- sinon celui du voisin importé (la boutique est loin de son routing).
  if v_point_nom is not null and v_point_m <= 1500 then
    p.quartier := v_point_nom;
  elsif v_voisin_quartier is not null then
    p.quartier := v_voisin_quartier;
  end if;

  return p;
end;
$$;

comment on function public.corriger_pdv_terrain(public.pdv) is
  'Boutique créée par un compte qui a un routing : distributeur du routing, territoire du PDV importé le plus proche, quartier = point de visite le plus proche (migration 20261105150000).';

-- Note chaque champ changé.
create or replace function public.noter_correction_terrain(p_avant public.pdv, p_apres public.pdv, p_origine text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_point_m numeric;
begin
  -- Boutique à plus de 1,5 km de tout point de visite de son créateur : à
  -- signaler (créée hors de son secteur, ou GPS à vérifier).
  if p_avant.created_by is not null and p_avant.geolocation_lat is not null and p_avant.geolocation_lng is not null then
    select min(6371000 * 2 * asin(sqrt(
             power(sin(radians(r.latitude - p_avant.geolocation_lat) / 2), 2)
           + cos(radians(p_avant.geolocation_lat)) * cos(radians(r.latitude))
           * power(sin(radians(r.longitude - p_avant.geolocation_lng) / 2), 2))))
      into v_point_m
    from routing_mensuel r
    where r.merchandiser_id = p_avant.created_by and r.actif and r.latitude is not null;
    if v_point_m > 1500 then
      insert into pdv_correction_terrain (pdv_id, cree_par, origine, champ, avant, apres)
      values (p_avant.pdv_id, p_avant.created_by, p_origine, 'alerte',
              'loin_du_routing', round(v_point_m)::text || ' m du point de visite le plus proche');
    end if;
  end if;

  insert into pdv_correction_terrain (pdv_id, cree_par, origine, champ, avant, apres)
  select p_avant.pdv_id, p_avant.created_by, p_origine, c.champ, c.avant, c.apres
  from (values
    ('distributor_name', p_avant.distributor_name, p_apres.distributor_name),
    ('zone', p_avant.zone, p_apres.zone),
    ('territory_code', p_avant.territory_code, p_apres.territory_code),
    ('region', p_avant.region, p_apres.region),
    ('area_code', p_avant.area_code, p_apres.area_code),
    ('quartier', p_avant.quartier, p_apres.quartier)
  ) as c(champ, avant, apres)
  where c.avant is distinct from c.apres;
end;
$$;

-- 2. Garde-fou à la création -----------------------------------------------------
create or replace function public.pdv_creation_terrain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_corrige public.pdv;
begin
  if new.created_by is null then
    return new;
  end if;
  -- Une erreur ici ne doit jamais empêcher la boutique d'être enregistrée.
  begin
    v_corrige := corriger_pdv_terrain(new);
    perform noter_correction_terrain(new, v_corrige, 'creation');
    new := v_corrige;
  exception when others then
    raise warning 'pdv_creation_terrain % : %', new.pdv_id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_pdv_creation_terrain on public.pdv;
create trigger trg_pdv_creation_terrain
  before insert on public.pdv
  for each row execute function public.pdv_creation_terrain();

-- 3. Rattrapage -------------------------------------------------------------------
create table if not exists public.pdv_distributeur_avant_20261105 (
  pdv_id text primary key,
  created_by uuid,
  distributor_name text, zone text, territory_code text, region text, area_code text, quartier text,
  sauvegarde_le timestamptz not null default now()
);
alter table public.pdv_distributeur_avant_20261105 enable row level security;
comment on table public.pdv_distributeur_avant_20261105 is
  'Boutiques créées dans l''app avant correction du distributeur (migration 20261105150000).';

create table if not exists public.visite_distributeur_avant_20261105 (
  visite_uuid uuid primary key,
  pdv_id text,
  distributeur_id bigint,
  sauvegarde_le timestamptz not null default now()
);
alter table public.visite_distributeur_avant_20261105 enable row level security;
comment on table public.visite_distributeur_avant_20261105 is
  'Visites des boutiques corrigées, distributeur avant correction (migration 20261105150000).';

-- Boutiques encore hors du distributeur de leur routing.
create temporary table cibles on commit drop as
select p.pdv_id
from pdv p
where p.is_active and p.created_by is not null
  and exists (
    select 1 from routing_mensuel r
    where r.merchandiser_id = p.created_by and r.actif and r.distributeur is not null)
  and not exists (
    select 1 from routing_mensuel r
    where r.merchandiser_id = p.created_by and r.actif and r.distributeur = p.distributor_name);

insert into pdv_distributeur_avant_20261105 (pdv_id, created_by, distributor_name, zone, territory_code, region, area_code, quartier)
select p.pdv_id, p.created_by, p.distributor_name, p.zone, p.territory_code, p.region, p.area_code, p.quartier
from pdv p join cibles c on c.pdv_id = p.pdv_id
on conflict (pdv_id) do nothing;

-- Calculé une fois, avant toute mise à jour (les voisins sont des PDV
-- importés : la mise à jour ne change pas le calcul des autres lignes).
create temporary table corriges on commit drop as
select (corriger_pdv_terrain(p)).*
from pdv p join cibles c on c.pdv_id = p.pdv_id;

select noter_correction_terrain(p, corriger_pdv_terrain(p), 'rattrapage_20261105')
from pdv p join cibles c on c.pdv_id = p.pdv_id;

update pdv p
set distributor_name = x.distributor_name,
    zone = x.zone,
    territory_code = x.territory_code,
    region = x.region,
    area_code = x.area_code,
    quartier = x.quartier
from corriges x
where p.pdv_id = x.pdv_id;

-- Visites de ces boutiques : distributeur du PDV corrigé.
insert into visite_distributeur_avant_20261105 (visite_uuid, pdv_id, distributeur_id)
select v.id, v.pdv_id, v.distributeur_id
from visites v
join cibles c on c.pdv_id = v.pdv_id
on conflict (visite_uuid) do nothing;

-- visites_touch_synced_at remettrait synced_at à maintenant : la date de
-- synchronisation de ces visites ne doit pas changer.
alter table visites disable trigger trg_visites_touch_synced_at;

update visites v
set distributeur_id = d.id
from pdv p
join distributeur d on upper(d.nom) = upper(p.distributor_name)
where p.pdv_id in (select pdv_id from cibles)
  and v.pdv_id = p.pdv_id
  and v.distributeur_id is distinct from d.id;

alter table visites enable trigger trg_visites_touch_synced_at;

commit;
