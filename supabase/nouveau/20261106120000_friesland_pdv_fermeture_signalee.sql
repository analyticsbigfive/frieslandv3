-- ============================================================================
-- 20261106120000_friesland_pdv_fermeture_signalee.sql
-- « PDV fermé » : le terrain signale un point de vente fermé, preuve à l'appui.
--
-- Règle (demande du 06/11/2026) : on ne déclare un PDV fermé QU'AVEC des
-- photos de la devanture. Le terrain signale, l'admin ou le superviseur
-- décide (même logique que la validation de tournée, motif « ferme ») :
--   - « fermer » : le PDV est désactivé (is_active = false), il sort des listes
--     et des tournées ; ses visites restent ;
--   - « garder » : rien ne change, le signalement est classé.
--
-- Strict côté serveur, pas seulement dans l'app :
--   1. pdv_fermeture : au moins 2 photos (CHECK), GPS obligatoire ;
--   2. declarer_pdv_ferme (seule voie d'écriture, pas de policy INSERT) :
--      chaque photo doit exister dans le bucket visite-images, sous
--      fermetures/<id du signalement>/, déposée par l'agent lui-même ;
--   3. pdv_garde_is_active : seuls admin et superviseur changent is_active.
--      Avant, la policy pdv_update_terrain laissait un merchandiser désactiver
--      un PDV par l'API, sans photo.
--
-- Hors ligne : l'app met les photos puis le signalement dans la file ; la
-- file est rejouée dans l'ordre, les photos arrivent d'abord. Si une photo
-- manque encore, l'appel échoue et sera rejoué (id fixé par l'app : rejouer
-- un signalement déjà reçu ne crée pas de doublon).
--
-- Rejouable : create ... if not exists, create or replace, drop ... if exists.
-- ============================================================================
begin;

create table if not exists public.pdv_fermeture (
  id                uuid primary key,
  pdv_id            text not null references public.pdv(pdv_id) on delete cascade,
  routing_pdv_id    uuid references public.routing_pdv(id) on delete set null,
  declare_par       uuid references public.profiles(id) on delete set null,
  declare_le        timestamptz not null default now(),
  -- Chemins dans le bucket visite-images (fermetures/<id>/1.jpg, 2.jpg).
  photos            text[] not null,
  -- Heure de prise de vue de chaque photo, selon le téléphone (indicatif).
  photos_prises_le  timestamptz[],
  geolocation_lat   double precision not null,
  geolocation_lng   double precision not null,
  precision_gps     integer,
  -- Distance entre l'agent et le repère du PDV au moment du signalement
  -- (null si le PDV n'a pas de position).
  distance_pdv_m    integer,
  commentaire       text,
  decision          text,
  decide_par        uuid references public.profiles(id) on delete set null,
  decide_le         timestamptz,
  constraint pdv_fermeture_photos_min check (cardinality(photos) >= 2),
  constraint pdv_fermeture_decision_valide check (decision is null or decision in ('fermer', 'garder')),
  constraint pdv_fermeture_decision_complete check ((decision is null) = (decide_le is null))
);

comment on table public.pdv_fermeture is
  'PDV signalés fermés par le terrain, avec au moins 2 photos de la devanture. Décision admin/superviseur : fermer (PDV désactivé) ou garder.';

create index if not exists idx_pdv_fermeture_pdv on public.pdv_fermeture(pdv_id);
create index if not exists idx_pdv_fermeture_a_traiter on public.pdv_fermeture(declare_le desc) where decision is null;

alter table public.pdv_fermeture enable row level security;

-- Lecture : l'agent voit ses signalements, admin et superviseur voient tout.
-- Aucune policy d'écriture : on passe par les deux fonctions ci-dessous.
drop policy if exists pdv_fermeture_lecture on public.pdv_fermeture;
create policy pdv_fermeture_lecture on public.pdv_fermeture for select to authenticated
  using (
    declare_par = (select auth.uid())
    or (select public.role_actif_courant()) in ('admin', 'superviseur')
  );

grant select on public.pdv_fermeture to authenticated;

-- ---------------------------------------------------------------------------
-- Signalement par le terrain
-- ---------------------------------------------------------------------------
drop function if exists public.declarer_pdv_ferme(uuid, text, uuid, text[], timestamptz[], double precision, double precision, integer, text);
create function public.declarer_pdv_ferme(
  p_id               uuid,
  p_pdv_id           text,
  p_routing_pdv_id   uuid,
  p_photos           text[],
  p_photos_prises_le timestamptz[],
  p_lat              double precision,
  p_lng              double precision,
  p_precision        integer,
  p_commentaire      text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_existant  public.pdv_fermeture%rowtype;
  v_pdv       record;
  v_photos    text[];
  v_trouvees  integer;
  v_etape_ok  boolean := false;
begin
  if v_uid is null or not public.peut_ecrire_terrain() then
    raise exception 'Seuls les comptes terrain peuvent signaler un point de vente fermé.';
  end if;
  if p_id is null then
    raise exception 'Identifiant du signalement manquant.';
  end if;

  -- Rejeu (file hors ligne) : le signalement est déjà là, on ne refait rien.
  select * into v_existant from public.pdv_fermeture where id = p_id;
  if found then
    if v_existant.declare_par is distinct from v_uid then
      raise exception 'Signalement déjà enregistré par un autre compte.';
    end if;
    return p_id;
  end if;

  select pdv_id, geolocation_lat, geolocation_lng, is_active into v_pdv
  from public.pdv where pdv_id = p_pdv_id;
  if not found then
    raise exception 'Point de vente introuvable.';
  end if;

  -- Étape de tournée : elle doit être celle de l'agent et porter sur ce PDV.
  if p_routing_pdv_id is not null then
    select exists (
      select 1
      from public.routing_pdv rp
      join public.routings r on r.id = rp.routing_id
      where rp.id = p_routing_pdv_id
        and rp.pdv_id = p_pdv_id
        and r.user_id = v_uid
    ) into v_etape_ok;
    if not v_etape_ok then
      raise exception 'Cette étape de tournée n''est pas la vôtre.';
    end if;
  end if;

  -- Hors tournée : le PDV doit être dans le périmètre de l'agent.
  if not v_etape_ok
     and public.role_actif_courant() not in ('admin', 'superviseur')
     and not exists (select 1 from public.pdv_ids_perimetre() x where x = p_pdv_id) then
    raise exception 'Ce point de vente n''est pas dans votre périmètre.';
  end if;

  -- GPS obligatoire, comme pour une visite.
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180
     or (p_lat = 0 and p_lng = 0) then
    raise exception 'Position GPS manquante : impossible de signaler le point de vente fermé.';
  end if;

  -- Photos : au moins 2, distinctes, déposées par l'agent sous fermetures/<id>/.
  select coalesce(array_agg(distinct btrim(x)), '{}') into v_photos
  from unnest(coalesce(p_photos, '{}')) x
  where btrim(x) <> '';

  if cardinality(v_photos) < 2 then
    raise exception 'Deux photos de la devanture sont obligatoires pour signaler un point de vente fermé.';
  end if;
  if exists (select 1 from unnest(v_photos) x where x not like 'fermetures/' || p_id::text || '/%') then
    raise exception 'Photo invalide : elle doit être prise depuis l''écran « PDV fermé ».';
  end if;

  select count(*) into v_trouvees
  from storage.objects o
  where o.bucket_id = 'visite-images'
    and o.name = any(v_photos)
    and (o.owner_id = v_uid::text or o.owner = v_uid);
  if v_trouvees < cardinality(v_photos) then
    raise exception 'Photos de la devanture pas encore reçues (% sur %). Réessayez quand le réseau le permet.',
      v_trouvees, cardinality(v_photos);
  end if;

  -- Deux fois le même fichier ne fait pas deux photos (empreinte identique).
  select count(distinct coalesce(o.metadata->>'eTag', o.name)) into v_trouvees
  from storage.objects o
  where o.bucket_id = 'visite-images'
    and o.name = any(v_photos);
  if v_trouvees < cardinality(v_photos) then
    raise exception 'Deux photos identiques : prenez deux vues différentes de la devanture.';
  end if;

  insert into public.pdv_fermeture (
    id, pdv_id, routing_pdv_id, declare_par, photos, photos_prises_le,
    geolocation_lat, geolocation_lng, precision_gps, distance_pdv_m, commentaire
  ) values (
    p_id, p_pdv_id, p_routing_pdv_id, v_uid, v_photos, p_photos_prises_le,
    p_lat, p_lng, p_precision,
    case when v_pdv.geolocation_lat is not null and v_pdv.geolocation_lng is not null
      then round(public.distance_m(p_lat, p_lng, v_pdv.geolocation_lat, v_pdv.geolocation_lng))::int
    end,
    nullif(btrim(coalesce(p_commentaire, '')), '')
  );

  -- L'étape de la tournée est close (« passée ») : pas de visite possible.
  -- Une étape déjà faite (visite enregistrée) n'est pas réécrite.
  if v_etape_ok then
    update public.routing_pdv
    set status = 'skipped',
        result_notes = 'PDV fermé : photos de la devanture envoyées',
        geolocation_lat = p_lat,
        geolocation_lng = p_lng,
        precision_gps = p_precision,
        updated_at = now()
    where id = p_routing_pdv_id
      and status <> 'completed';
  end if;

  return p_id;
end;
$$;

revoke all on function public.declarer_pdv_ferme(uuid, text, uuid, text[], timestamptz[], double precision, double precision, integer, text) from public, anon;
grant execute on function public.declarer_pdv_ferme(uuid, text, uuid, text[], timestamptz[], double precision, double precision, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Liste admin (écran Points de vente › Fermetures signalées)
-- ---------------------------------------------------------------------------
drop function if exists public.fermetures_pdv_signalees(boolean);
create function public.fermetures_pdv_signalees(p_tout boolean default false)
returns table (
  id               uuid,
  pdv_id           text,
  nom_pdv          text,
  image_url        text,
  zone             text,
  quartier         text,
  pdv_actif        boolean,
  declare_le       timestamptz,
  declarant_nom    text,
  photos           text[],
  photos_prises_le timestamptz[],
  precision_gps    integer,
  distance_pdv_m   integer,
  commentaire      text,
  en_tournee       boolean,
  decision         text,
  decide_le        timestamptz,
  decide_par_nom   text
)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.pdv_id, p.nom_pdv, p.image_url, p.zone, p.quartier, p.is_active is not false,
         f.declare_le, d.nom, f.photos, f.photos_prises_le, f.precision_gps, f.distance_pdv_m,
         f.commentaire, f.routing_pdv_id is not null, f.decision, f.decide_le, x.nom
  from pdv_fermeture f
  join pdv p on p.pdv_id = f.pdv_id
  left join profiles d on d.id = f.declare_par
  left join profiles x on x.id = f.decide_par
  where public.est_admin_ou_superviseur()
    and (p_tout or f.decision is null)
  order by f.decision nulls first, f.declare_le desc
  limit 1000
$$;

revoke all on function public.fermetures_pdv_signalees(boolean) from public, anon;
grant execute on function public.fermetures_pdv_signalees(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Décision admin / superviseur
-- ---------------------------------------------------------------------------
-- « fermer » désactive le PDV et classe tous ses signalements en attente ;
-- « garder » ne classe que celui-ci (un autre agent peut l'avoir vu fermé
-- un autre jour).
drop function if exists public.traiter_fermeture_pdv(uuid, boolean);
create function public.traiter_fermeture_pdv(p_id uuid, p_fermer boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.pdv_fermeture%rowtype;
begin
  if not public.est_admin_ou_superviseur() then
    raise exception 'Réservé à l''administrateur et au superviseur.';
  end if;
  select * into f from public.pdv_fermeture where id = p_id for update;
  if not found then
    return false;
  end if;
  if f.decision is not null then
    raise exception 'Ce signalement a déjà été traité.';
  end if;

  if p_fermer then
    update public.pdv set is_active = false where pdv_id = f.pdv_id and is_active is not false;
    update public.pdv_fermeture
    set decision = 'fermer', decide_par = auth.uid(), decide_le = now()
    where pdv_id = f.pdv_id and decision is null;
  else
    update public.pdv_fermeture
    set decision = 'garder', decide_par = auth.uid(), decide_le = now()
    where pdv_fermeture.id = p_id;
  end if;
  return true;
end;
$$;

revoke all on function public.traiter_fermeture_pdv(uuid, boolean) from public, anon;
grant execute on function public.traiter_fermeture_pdv(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Garde-fou : le terrain ne désactive plus un PDV directement
-- ---------------------------------------------------------------------------
-- auth.uid() est null hors session applicative (migrations, imports, psql) :
-- le garde-fou ne s'y applique pas. Les fonctions admin (traiter_doublon_possible,
-- appliquer_validation_tournee, traiter_fermeture_pdv) tournent sous le compte
-- admin ou superviseur qui les appelle : elles passent.
create or replace function public.pdv_garde_is_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active is distinct from old.is_active
     and auth.uid() is not null
     and coalesce(public.role_actif_courant(), '') not in ('admin', 'superviseur') then
    raise exception 'Seuls un admin ou un superviseur peuvent activer ou désactiver un point de vente. Sur le terrain : « PDV fermé », avec photos de la devanture.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pdv_garde_is_active on public.pdv;
create trigger trg_pdv_garde_is_active
  before update of is_active on public.pdv
  for each row
  execute function public.pdv_garde_is_active();

commit;
