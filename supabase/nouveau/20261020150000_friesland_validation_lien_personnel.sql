-- ============================================================================
-- VALIDATION DES TOURNÉES : LIEN PERSONNEL PAR MERCHANDISER (20/10/2026)
-- Les merchandisers n'utilisent pas leurs e-mails : on leur envoie sur
-- WhatsApp un lien personnel qui ouvre directement leur fiche
-- (/validation-tournee?t=<jeton>). Le jeton fait 128 bits, tiré au hasard ;
-- le code à 4 chiffres reste en secours. « Nouveau code » dans l'admin
-- change aussi le lien (l'ancien ne marche plus).
-- Idempotente.
-- ============================================================================
begin;

alter table public.validation_tournee_merch
  add column if not exists lien_jeton text not null default encode(extensions.gen_random_bytes(16), 'hex');
create unique index if not exists validation_tournee_merch_lien_idx on public.validation_tournee_merch (lien_jeton);

-- Fiche du lien si le mois est ouvert, sinon null.
create or replace function public.verifier_lien_validation(p_jeton text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from validation_tournee_merch m
  join validation_tournee_campagne c on c.id = m.campagne_id and c.statut = 'ouverte'
  where p_jeton ~ '^[0-9a-f]{32}$' and m.lien_jeton = p_jeton
$$;
revoke all on function public.verifier_lien_validation(text) from public, anon, authenticated;
grant execute on function public.verifier_lien_validation(text) to service_role;

commit;
