-- ============================================================================
-- EMPLOYEUR DU MERCHANDISER (Friesland / Atom BTL) + RÉFÉRENTIEL SSF
--
-- Deux populations de merchandisers, deux logiques de tournée :
--   - Friesland (intérieur du pays) : tout le périmètre, chaque jour ;
--   - Atom BTL (agence, Abidjan) : quotas journaliers par canal, chaque PDV
--     une fois par mois (programme « Bonnet Rouge », 420 PDV/agent/mois).
-- Jusqu'ici la distinction ne tenait qu'au préfixe du libellé de la règle
-- (« Portefeuille DMS » / « Portefeuille périmètre »). Elle devient un champ
-- du profil, lu par l'admin, les scripts et la matérialisation des tournées.
--
-- Le référentiel `ssf` (sales force du distributeur, « avec qui » la visite a
-- été faite) et les colonnes `visites.ssf_id / distributeur_brut / ssf_brut`
-- existaient déjà en production (créés le 05/10/2026 depuis l'export Atom de
-- septembre) sans migration dans le dépôt : ils sont repris ici tels quels.
--
-- Idempotent. Additif.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. profiles.employeur
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists employeur text not null default 'friesland';

alter table public.profiles drop constraint if exists profiles_employeur_check;
alter table public.profiles add constraint profiles_employeur_check
  check (employeur in ('friesland', 'atom'));

comment on column public.profiles.employeur is
  'friesland = salarié Friesland (tournée = tout le périmètre) ; atom = merchandiser Atom BTL (tournée par quotas journaliers, programme mensuel).';

-- Les dix comptes Atom de la liste client du 24/09/2026
-- (scripts/sync-merch-accounts-2026-09-24.mjs) et leurs anciens comptes.
update public.profiles
set employeur = 'atom'
where lower(email) in (
  'attecoubeone@gmail.com', 'cocodyone@gmail.com', 'cocodymerchtwo@gmail.com',
  'yopougonone@gmail.com', 'yopougonmerchtwo@gmail.com', 'abobomerchone@gmail.com',
  'abobomerchtwo@gmail.com', 'marcorytreichone@gmail.com', 'koumassimerchone@gmail.com',
  'portbouetone@gmail.com',
  -- anciens comptes des mêmes personnes (à désactiver, voir nettoyage)
  'cocodytwo@gmail.com', 'yopougontwo@gmail.com', 'koumassione@gmail.com', 'portbouetmerchone@gmail.com'
) and employeur <> 'atom';

-- Un utilisateur ne change pas lui-même d'employeur : la politique de mise à
-- jour de son propre profil (stores/auth.ts fait un .select() complet après
-- update) reste valable, mais la colonne est verrouillée par trigger pour les
-- non-admins.
create or replace function public.proteger_employeur_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.employeur is distinct from old.employeur then
    if not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'superviseur')
    ) and auth.uid() is not null then
      new.employeur := old.employeur;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_employeur_profil on public.profiles;
create trigger trg_proteger_employeur_profil
  before update of employeur on public.profiles
  for each row execute function public.proteger_employeur_profil();

-- ---------------------------------------------------------------------------
-- 2. Référentiel SSF (sales force du distributeur)
-- ---------------------------------------------------------------------------
create table if not exists public.ssf (
  id              serial primary key,
  nom             text not null,
  -- Toutes les orthographes rencontrées dans les exports, séparées par « | ».
  nom_brut        text,
  telephone       text,
  distributeur_id integer references public.distributeur(id) on delete set null,
  actif           boolean not null default true,
  -- Rattachement au distributeur déduit d'un export, à confirmer par le client.
  a_confirmer     boolean not null default false,
  source          text,
  commentaire     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.ssf is
  'Sales force du distributeur (SSF) : la personne du distributeur avec qui le merchandiser fait sa visite. Alimenté depuis les exports Atom, complété par l''admin.';

create index if not exists idx_ssf_distributeur on public.ssf(distributeur_id);

alter table public.ssf enable row level security;

drop policy if exists ssf_read on public.ssf;
create policy ssf_read on public.ssf
  for select to authenticated using (true);

drop policy if exists ssf_write on public.ssf;
create policy ssf_write on public.ssf
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')));

grant select on public.ssf to authenticated;
grant insert, update, delete on public.ssf to authenticated;
grant usage, select on sequence public.ssf_id_seq to authenticated;

-- ---------------------------------------------------------------------------
-- 2 bis. Origine GPS « atom » : PDV créés depuis l'export de visites Atom
-- ---------------------------------------------------------------------------
alter table public.pdv drop constraint if exists pdv_gps_source_valide;
alter table public.pdv add constraint pdv_gps_source_valide
  check (gps_source is null or gps_source in ('dms', 'dms-absent', 'dms-depot', 'terrain', 'admin', 'atom', 'atom-absent'));

-- ---------------------------------------------------------------------------
-- 3. Colonnes de la visite : distributeur et SSF
-- ---------------------------------------------------------------------------
alter table public.visites add column if not exists distributeur_id integer references public.distributeur(id) on delete set null;
alter table public.visites add column if not exists ssf_id integer references public.ssf(id) on delete set null;
alter table public.visites add column if not exists distributeur_brut text;
alter table public.visites add column if not exists ssf_brut text;

comment on column public.visites.distributeur_id is 'Distributeur de la visite (référentiel). Déduit du PDV si absent.';
comment on column public.visites.ssf_id is 'SSF (vendeur du distributeur) présent pendant la visite.';
comment on column public.visites.distributeur_brut is 'Nom du distributeur tel que saisi ou exporté, avant rapprochement.';
comment on column public.visites.ssf_brut is 'Nom du SSF tel que saisi ou exporté, avant rapprochement.';

create index if not exists idx_visites_ssf on public.visites(ssf_id);
create index if not exists idx_visites_distributeur on public.visites(distributeur_id);

-- Distributeur déduit du PDV quand la visite n'en porte pas : l'app mobile
-- 1.0.10 ne le saisit pas, le reporting Atom l'exige.
create or replace function public.visite_distributeur_par_defaut()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.distributeur_id is null then
    select d.id into new.distributeur_id
    from public.pdv p
    join public.distributeur d on upper(d.nom) = upper(p.distributor_name)
    where p.pdv_id = new.pdv_id
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_visite_distributeur_par_defaut on public.visites;
create trigger trg_visite_distributeur_par_defaut
  before insert on public.visites
  for each row execute function public.visite_distributeur_par_defaut();

commit;
