-- ============================================================================
-- Migration : STATUT DE CYCLE DE VIE DE LA VISITE (LOT 2 du plan de refonte)
-- Deux axes distincts, volontairement séparés :
--   - status      : axe métier — validation par un gestionnaire ;
--   - sync_status : axe technique — transport device -> serveur (déjà présent).
-- Une visite peut être status='soumis' ET sync_status='pending' (saisie sur le
-- terrain, pas encore remontée). Le brouillon reste local (localStorage) : une
-- visite n'atteint la base qu'une fois soumise, d'où le défaut 'soumis'.
-- Rejouable : le runner scripts/run-big-five-migrations.sh réapplique le dossier
-- entier à chaque exécution (pas de table de suivi de migrations).
-- Dépend de 130200 (est_gestionnaire_perfect_store) et de la table visites
-- (créée par le socle historique supabase/_archive/001b_create.sql).
-- ============================================================================
begin;

alter table public.visites
  add column if not exists status text not null default 'soumis';

alter table public.visites
  add column if not exists synced_at timestamptz;

alter table public.visites drop constraint if exists visites_status_check;
alter table public.visites
  add constraint visites_status_check check (status in ('soumis', 'validé', 'rejeté'));

-- Historique : tout ce qui est déjà en base a forcément été soumis et reçu.
update public.visites
set synced_at = coalesce(updated_at, created_at)
where synced_at is null;

create index if not exists idx_visites_status on public.visites(status);

-- synced_at = date de réception serveur. Renseigné côté base pour ne pas
-- dépendre de l'horloge du device (souvent fausse hors ligne).
create or replace function public.visites_touch_synced_at()
returns trigger
language plpgsql
as $$
begin
  new.synced_at = now();
  return new;
end;
$$;

drop trigger if exists trg_visites_touch_synced_at on public.visites;
create trigger trg_visites_touch_synced_at
  before insert or update on public.visites
  for each row
  execute function public.visites_touch_synced_at();

-- Seuls admin/superviseur valident ou rejettent une visite.
-- auth.uid() est null hors session applicative (psql, migrations, seeds) :
-- le garde-fou ne s'y applique pas, sinon ce fichier ne serait pas rejouable.
create or replace function public.visites_garde_statut()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('validé', 'rejeté')
     and auth.uid() is not null
     and not public.est_gestionnaire_perfect_store() then
    raise exception 'Seuls un admin ou un superviseur peuvent valider ou rejeter une visite.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_visites_garde_statut on public.visites;
create trigger trg_visites_garde_statut
  before update of status on public.visites
  for each row
  execute function public.visites_garde_statut();

commit;
