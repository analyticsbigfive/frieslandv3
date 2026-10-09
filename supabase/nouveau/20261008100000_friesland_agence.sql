-- ============================================================================
-- AGENCES DE MERCHANDISING (paramétrables)
--
-- Réunion client du 08/10/2026 : le merchandiser est l'employé d'une agence,
-- Atom BTL à Abidjan (direction South), une autre agence à l'intérieur
-- (direction North). « Atom » était écrit en dur (CHECK de profiles.employeur,
-- portée des paramètres terrain). Il devient une ligne de la table `agence`,
-- comme l'agence North et Friesland (salariés, pas de programme).
--
-- Le CODE `atom` est conservé : l'app 1.0.12 en production compare
-- `employeur === 'atom'`. Seuls le libellé et la direction sont paramétrables.
--
-- `programme` = les merchandisers de l'agence suivent le programme mensuel
-- (tournée par quotas, écran Programme merchandiser de leur direction).
--
-- Idempotent. Additif : aucune valeur existante de profiles.employeur ne change.
-- ============================================================================
begin;

create table if not exists public.agence (
  code       text primary key check (code ~ '^[a-z0-9-]{2,40}$'),
  nom        text not null,
  -- south = Abidjan, north = intérieur, mt = Modern Trade ; null = toutes.
  direction  text check (direction in ('south', 'north', 'mt')),
  programme  boolean not null default false,
  actif      boolean not null default true,
  ordre      integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agence is
  'Employeur d''un merchandiser : friesland (salarié) ou une agence. direction = South (Abidjan) / North (intérieur) / MT ; programme = tournées par quotas et programme mensuel. Éditable dans Référentiels › Agences.';

insert into public.agence (code, nom, direction, programme, ordre) values
  ('friesland', 'FrieslandCampina', null, false, 10),
  ('atom', 'Atom BTL', 'south', true, 20),
  ('agence-north', 'Agence North (à nommer)', 'north', true, 30)
on conflict (code) do nothing;

drop trigger if exists trg_agence_updated_at on public.agence;
create trigger trg_agence_updated_at
  before update on public.agence
  for each row execute function update_routing_updated_at();

alter table public.agence enable row level security;

drop policy if exists agence_read on public.agence;
create policy agence_read on public.agence
  for select to authenticated using (true);

drop policy if exists agence_write on public.agence;
create policy agence_write on public.agence
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.is_active, true)))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.is_active, true)));

grant select on public.agence to authenticated;
grant insert, update, delete on public.agence to authenticated;

-- ---------------------------------------------------------------------------
-- profiles.employeur : CHECK figé → clé étrangère vers agence
-- ---------------------------------------------------------------------------
-- Valeurs inattendues (aucune attendue) : rattachées à friesland plutôt que de
-- faire échouer la contrainte.
update public.profiles set employeur = 'friesland'
where employeur is null or employeur not in (select code from public.agence);

alter table public.profiles drop constraint if exists profiles_employeur_check;
alter table public.profiles drop constraint if exists profiles_employeur_fkey;
alter table public.profiles add constraint profiles_employeur_fkey
  foreign key (employeur) references public.agence(code) on update cascade;

comment on column public.profiles.employeur is
  'Code de l''agence employeur (table agence) : friesland = salarié FrieslandCampina, atom = Atom BTL (South), agence-north… Lu par l''app (1.0.12 : employeur = ''atom'').';

-- ---------------------------------------------------------------------------
-- parametre_app.portee : « tous » ou un code d'agence
-- ---------------------------------------------------------------------------
alter table public.parametre_app drop constraint if exists parametre_app_portee_check;

create or replace function public.parametre_app_portee_valide()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.portee <> 'tous' and not exists (select 1 from agence a where a.code = new.portee) then
    raise exception 'Portée « % » inconnue : « tous » ou un code d''agence', new.portee;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_parametre_app_portee_valide on public.parametre_app;
create trigger trg_parametre_app_portee_valide
  before insert or update of portee on public.parametre_app
  for each row execute function public.parametre_app_portee_valide();

-- Agences d'un programme pour une direction (null = toutes les directions).
create or replace function public.agences_programme(p_direction text default null)
returns setof text
language sql
stable
set search_path = public
as $$
  select a.code from agence a
  where a.programme and a.actif
    and (p_direction is null or a.direction = p_direction)
$$;

grant execute on function public.agences_programme(text) to authenticated, service_role;

commit;
