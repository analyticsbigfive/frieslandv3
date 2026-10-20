-- ============================================================================
-- E-MAIL DE VALIDATION : JETON VÉRIFIÉ EN BASE + SECRETS VAULT (20/10/2026)
-- La fonction Edge notifier-validation-tournee vérifie le jeton envoyé par le
-- déclencheur via verifier_jeton_notification_validation : rien à recopier
-- dans ses propres secrets. Le jeton est tiré au hasard ici, jamais écrit en clair.
-- Idempotente.
-- ============================================================================
begin;

create or replace function public.verifier_jeton_notification_validation(p_jeton text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_jeton, '') <> '' and exists (
    select 1 from vault.decrypted_secrets s
    where s.name = 'edge_notifier_validation_token' and s.decrypted_secret = p_jeton)
$$;
revoke all on function public.verifier_jeton_notification_validation(text) from public, anon, authenticated;
grant execute on function public.verifier_jeton_notification_validation(text) to service_role;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'edge_notifier_validation_url') then
    perform vault.create_secret('https://iirgolfjwdnnesamzcbd.supabase.co/functions/v1/notifier-validation-tournee', 'edge_notifier_validation_url');
  end if;
  if not exists (select 1 from vault.secrets where name = 'edge_notifier_validation_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'edge_notifier_validation_token');
  end if;
end $$;

commit;
