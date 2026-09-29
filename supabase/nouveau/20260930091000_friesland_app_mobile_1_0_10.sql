-- ============================================================================
-- APP MOBILE 1.0.10 : GPS relevé sur le terrain + mise à jour obligatoire
--
-- 1. Traçabilité GPS des PDV. L'import DMS du 29/09 crée ~2 000 PDV sans
--    coordonnées (absentes du DMS, ou point partagé par 10 clients et plus =
--    dépôt du distributeur). Le merchandiser les géolocalise à sa première
--    visite ; on garde d'où vient chaque position.
--      gps_source : dms | terrain | admin, ou pourquoi elle manque
--                   (dms-absent, dms-depot)
-- 2. RPC geolocaliser_pdv : n'écrit que sur un PDV SANS coordonnées, du
--    périmètre de l'appelant, avec une précision de 30 m ou mieux. Jamais
--    d'écrasement d'une position existante.
-- 3. version_app : version minimale de l'app mobile. En dessous, l'app affiche
--    un écran bloquant avec le lien de téléchargement. Lisible sans connexion
--    (le contrôle a lieu au lancement) : ne contient rien de sensible.
-- 4. version_installee : version de l'app déclarée au lancement par chaque
--    utilisateur, pour savoir qui a mis à jour avant de relever la version
--    minimale. Indépendante des notifications push (appareil_push n'est rempli
--    que si Firebase est configuré). Lisible par admin et superviseur.
--
-- Idempotent. Additif.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Traçabilité GPS
-- ---------------------------------------------------------------------------
alter table public.pdv add column if not exists gps_source text;
alter table public.pdv add column if not exists gps_precision_m integer;
alter table public.pdv add column if not exists gps_maj_par uuid references public.profiles(id) on delete set null;
alter table public.pdv add column if not exists gps_maj_le timestamptz;

alter table public.pdv drop constraint if exists pdv_gps_source_valide;
alter table public.pdv add constraint pdv_gps_source_valide
  check (gps_source is null or gps_source in ('dms', 'dms-absent', 'dms-depot', 'terrain', 'admin'));

comment on column public.pdv.gps_source is
  'Origine des coordonnées : dms, terrain (relevé par un merchandiser), admin. Sans coordonnées : dms-absent (absentes du DMS) ou dms-depot (point partagé par 10 clients et plus, écarté).';
comment on column public.pdv.gps_precision_m is 'Précision annoncée par le téléphone au relevé terrain, en mètres.';
comment on column public.pdv.gps_maj_par is 'Auteur du dernier relevé de coordonnées.';
comment on column public.pdv.gps_maj_le is 'Date du dernier relevé de coordonnées.';

-- ---------------------------------------------------------------------------
-- 2. Relevé terrain
-- ---------------------------------------------------------------------------
create or replace function public.geolocaliser_pdv(
  p_pdv_id text,
  p_lat double precision,
  p_lng double precision,
  p_precision integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if not public.peut_ecrire_terrain() then
    return false;
  end if;
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180
     or (p_lat = 0 and p_lng = 0) then
    return false;
  end if;
  if p_precision is null or p_precision < 0 or p_precision > 30 then
    return false;
  end if;
  if not exists (select 1 from public.pdv_ids_perimetre() x where x = p_pdv_id) then
    return false;
  end if;

  update public.pdv
  set geolocation_lat = p_lat,
      geolocation_lng = p_lng,
      gps_source = 'terrain',
      gps_precision_m = p_precision,
      gps_maj_par = auth.uid(),
      gps_maj_le = now()
  where pdv_id = p_pdv_id
    and (geolocation_lat is null or geolocation_lng is null);

  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

revoke all on function public.geolocaliser_pdv(text, double precision, double precision, integer) from public, anon;
grant execute on function public.geolocaliser_pdv(text, double precision, double precision, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Version minimale de l'app
-- ---------------------------------------------------------------------------
create table if not exists public.version_app (
  plateforme         text primary key check (plateforme in ('android', 'ios')),
  version_code_min   integer not null default 1 check (version_code_min > 0),
  version_nom_min    text,
  url_telechargement text,
  message            text,
  updated_at         timestamptz not null default now()
);

comment on table public.version_app is
  'Version minimale de l''app mobile par plateforme. En dessous de version_code_min (versionCode Android), l''app bloque et propose url_telechargement.';

alter table public.version_app enable row level security;

drop policy if exists version_app_read on public.version_app;
create policy version_app_read on public.version_app
  for select to anon, authenticated using (true);

drop policy if exists version_app_write on public.version_app;
create policy version_app_write on public.version_app
  for all to authenticated
  using (public.est_gestionnaire_perfect_store())
  with check (public.est_gestionnaire_perfect_store());

grant select on public.version_app to anon, authenticated;
grant insert, update, delete on public.version_app to authenticated;

insert into public.version_app (plateforme, version_code_min, version_nom_min, message)
values ('android', 11, '1.0.9', 'Une nouvelle version de l''application est disponible. Installez-la pour continuer.')
on conflict (plateforme) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Version installée par utilisateur
-- ---------------------------------------------------------------------------
create table if not exists public.version_installee (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  plateforme   text not null default 'android' check (plateforme in ('android', 'ios')),
  version_code integer not null,
  version_nom  text,
  vu_le        timestamptz not null default now()
);

comment on table public.version_installee is
  'Dernière version de l''app mobile ouverte par chaque utilisateur (déclarée au lancement).';

alter table public.version_installee enable row level security;

drop policy if exists version_installee_select on public.version_installee;
create policy version_installee_select on public.version_installee
  for select to authenticated
  using ((select auth.uid()) = user_id or (select public.role_actif_courant()) in ('admin', 'superviseur'));

drop policy if exists version_installee_insert_moi on public.version_installee;
create policy version_installee_insert_moi on public.version_installee
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists version_installee_update_moi on public.version_installee;
create policy version_installee_update_moi on public.version_installee
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.version_installee to authenticated;

commit;
