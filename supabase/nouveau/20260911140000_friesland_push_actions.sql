-- ============================================================================
-- NOTIFICATIONS PUSH SUR LES ACTIONS ASSIGNÉES
--
-- L'app prévient déjà le merchandiseur en direct (toast + badge, Realtime dans
-- layouts/mobile.vue) — mais seulement si l'application est ouverte. Sur le
-- terrain elle ne l'est pas : le commercial doit relancer par WhatsApp.
--
-- Cette migration pose la moitié « base de données » de la notification push :
--   1. `appareil_push` : les jetons FCM des téléphones. Un jeton par appareil,
--      une personne pouvant en avoir plusieurs (téléphone perso + pro).
--   2. Un déclencheur qui appelle la fonction Edge `notifier-action` dès qu'une
--      action est créée ou réassignée à quelqu'un d'autre.
--
-- L'envoi lui-même est fait par la fonction Edge : Postgres ne sait pas signer
-- un jeton OAuth Google. L'URL et la clé d'appel sont lues dans Vault, pour ne
-- pas les écrire en clair dans le code du déclencheur.
--
-- `replica identity full` : sans elle, les événements Realtime de suppression
-- ne portent que la clé primaire, donc le filtre `assigne_a=eq.<moi>` ne matche
-- pas et le badge du merchandiseur ne redescend pas quand une action est
-- supprimée. La table est petite, le surcoût de réplication est négligeable.
--
-- Idempotent. Additif.
-- ============================================================================
begin;

create extension if not exists pg_net with schema extensions;

alter table public.action_commerciale replica identity full;

-- ---------------------------------------------------------------------------
-- Jetons d'appareil
-- ---------------------------------------------------------------------------
create table if not exists public.appareil_push (
  jeton       text primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  plateforme  text not null default 'android' check (plateforme in ('android', 'ios', 'web')),
  modele      text,
  cree_le     timestamptz not null default now(),
  vu_le       timestamptz not null default now()
);

create index if not exists idx_appareil_push_user on public.appareil_push (user_id);

comment on table public.appareil_push is
  'Jetons FCM des appareils. Un même utilisateur peut en avoir plusieurs ; un jeton change à la réinstallation de l''app.';
comment on column public.appareil_push.vu_le is
  'Dernière fois que l''app a confirmé ce jeton. Sert à purger les appareils dormants.';

alter table public.appareil_push enable row level security;

-- Chacun ne voit et n'écrit que ses propres appareils. L'envoi passe par la
-- fonction Edge en service_role, qui contourne la RLS.
drop policy if exists appareil_push_select_moi on public.appareil_push;
create policy appareil_push_select_moi on public.appareil_push
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists appareil_push_insert_moi on public.appareil_push;
create policy appareil_push_insert_moi on public.appareil_push
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists appareil_push_update_moi on public.appareil_push;
create policy appareil_push_update_moi on public.appareil_push
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists appareil_push_delete_moi on public.appareil_push;
create policy appareil_push_delete_moi on public.appareil_push
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Appel de la fonction Edge à la création / réassignation d'une action
--
-- Le déclencheur ne fait qu'un appel HTTP asynchrone (pg_net) : il ne bloque ni
-- ne fait échouer l'insertion si la notification part mal. Une action non
-- notifiée reste visible dans l'app — l'inverse (perdre l'action pour cause de
-- push en panne) serait inacceptable.
--
-- Secrets attendus dans Vault (`select vault.create_secret(...)`) :
--   · 'edge_notifier_action_url'   → https://<projet>.supabase.co/functions/v1/notifier-action
--   · 'edge_notifier_action_token' → clé service_role du projet
-- Tant qu'ils sont absents, le déclencheur ne fait rien, sans erreur.
-- ---------------------------------------------------------------------------
create or replace function public.notifier_action_assignee()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url   text;
  v_token text;
begin
  -- Rien à notifier si l'action n'est assignée à personne, ou si la mise à jour
  -- ne change pas l'assigné (changement de statut, de commentaire…).
  if new.assigne_a is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.assigne_a is not distinct from new.assigne_a then
    return new;
  end if;

  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'edge_notifier_action_url';
  select decrypted_secret into v_token
  from vault.decrypted_secrets where name = 'edge_notifier_action_token';

  if v_url is null or v_token is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body := jsonb_build_object('action_id', new.id),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

comment on function public.notifier_action_assignee is
  'Prévient la fonction Edge notifier-action qu''une action vient d''être assignée. Silencieux si les secrets Vault ne sont pas posés.';

drop trigger if exists trg_action_commerciale_push on public.action_commerciale;
create trigger trg_action_commerciale_push
  after insert or update of assigne_a on public.action_commerciale
  for each row execute function public.notifier_action_assignee();

commit;
