-- ============================================================================
-- Positions GPS des tournées terrain (application mobile native).
-- - un point ≈ toutes les 1 à 2 minutes pendant une tournée (début/fin
--   déclenchés par le commercial), envoyé par batch depuis l'app ;
-- - id généré côté client : le renvoi d'un batch après coupure réseau est
--   idempotent (upsert ignoreDuplicates → on conflict do nothing) ;
-- - insertion par le propriétaire uniquement, lecture par le propriétaire
--   et les gestionnaires (admin/superviseur), trace immuable (pas
--   d'update/delete pour les rôles terrain).
-- Dépend de 20260630120000 (profiles) et réutilise
-- public.est_gestionnaire_perfect_store() (20260630130200).
-- ============================================================================
begin;

create table if not exists public.position_tournee (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  tournee_id  uuid not null,
  lat         double precision not null,
  lng         double precision not null,
  accuracy    double precision,
  speed       double precision,
  captured_at timestamptz not null,
  -- horodatage serveur : référence fiable si l'horloge du téléphone dérive
  created_at  timestamptz not null default now()
);

comment on table public.position_tournee is
  'Points GPS captés par l''app mobile native pendant les tournées terrain.';

create index if not exists idx_position_tournee_user_date
  on public.position_tournee (user_id, captured_at desc);

create index if not exists idx_position_tournee_tournee
  on public.position_tournee (tournee_id, captured_at);

alter table public.position_tournee enable row level security;

drop policy if exists "position_tournee_insert_own" on public.position_tournee;
create policy "position_tournee_insert_own" on public.position_tournee
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "position_tournee_select" on public.position_tournee;
create policy "position_tournee_select" on public.position_tournee
  for select to authenticated
  using (auth.uid() = user_id or public.est_gestionnaire_perfect_store());

commit;
