-- ============================================================================
-- VALIDATION DES ZONES ET SECTEURS + E-MAIL QUAND UN MERCHANDISER A FINI (20/10/2026)
--
-- Friesland et Atom ne découpent pas Abidjan de la même façon : le secteur du
-- routing Atom (« Yopougon 3 & 4 ») ne correspond pas aux territoires
-- Friesland du compte (« Yopougon 1 »). Chaque merchandiser confirme, sur la
-- page /validation-tournee, ce qu'il couvre vraiment :
--   - secteur Atom (routing_mensuel.secteur) ;
--   - territoires Friesland (profiles.territoires_assignes / zone_assignee) ;
--   - quartiers Friesland (profiles.quartiers_assignes) : il coche ceux qu'il
--     ne couvre pas ;
--   - et écrit les zones manquantes.
--
-- E-mail : quand une fiche passe à « validee », pg_net appelle la fonction
-- Edge notifier-validation-tournee (même principe que notifier-action).
-- Secrets attendus dans Vault :
--   · 'edge_notifier_validation_url'   → https://<projet>.supabase.co/functions/v1/notifier-validation-tournee
--   · 'edge_notifier_validation_token' → identique au secret NOTIFIER_SECRET de la fonction
-- Tant qu'ils sont absents, rien ne part, sans erreur.
-- Idempotente.
-- ============================================================================
begin;

create table if not exists public.validation_tournee_zone (
  id                  uuid primary key default gen_random_uuid(),
  validation_merch_id uuid not null references public.validation_tournee_merch(id) on delete cascade,
  type                text not null check (type in ('secteur_atom', 'territoire_friesland', 'quartier_friesland')),
  libelle             text not null,
  decision            text not null check (decision in ('oui', 'non')),
  commentaire         text,
  traite              boolean not null default false,
  maj_le              timestamptz not null default now(),
  unique (validation_merch_id, type, libelle)
);

alter table public.validation_tournee_merch add column if not exists zones_remarque text;
alter table public.validation_tournee_merch add column if not exists notifie_le timestamptz;

alter table public.validation_tournee_zone enable row level security;
drop policy if exists vt_zone_acces on public.validation_tournee_zone;
create policy vt_zone_acces on public.validation_tournee_zone for all to authenticated
  using (public.est_admin_ou_superviseur() or validation_merch_id in (
    select v.id from public.validation_tournee_merch v where v.merchandiser_id in (select public.merch_ids_agence())))
  with check (public.est_admin_ou_superviseur() or validation_merch_id in (
    select v.id from public.validation_tournee_merch v where v.merchandiser_id in (select public.merch_ids_agence())));

create or replace function public.notifier_validation_tournee()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url   text;
  v_token text;
begin
  if new.statut <> 'validee' or old.statut = 'validee' then
    return new;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'edge_notifier_validation_url';
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'edge_notifier_validation_token';
  if v_url is null or v_token is null then
    return new;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notifier-secret', v_token),
    body := jsonb_build_object('validation_id', new.id),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;
comment on function public.notifier_validation_tournee is
  'Prévient la fonction Edge notifier-validation-tournee qu''un merchandiser a validé sa fiche. Silencieux si les secrets Vault ne sont pas posés.';

drop trigger if exists trg_validation_tournee_notifier on public.validation_tournee_merch;
create trigger trg_validation_tournee_notifier
  after update of statut on public.validation_tournee_merch
  for each row execute function public.notifier_validation_tournee();

revoke all on function public.notifier_validation_tournee() from public, anon, authenticated;

commit;
