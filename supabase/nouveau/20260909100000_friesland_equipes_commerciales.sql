-- ============================================================================
-- ÉQUIPES COMMERCIALES (demande du 7 septembre 2026)
--
-- Jusqu'ici, « l'équipe » d'un commercial était déduite du recoupement des
-- territoires : deux merchandiseurs d'un même territoire étaient
-- indiscernables, et un merchandiseur d'un autre territoire restait invisible
-- même s'il lui rendait compte réellement.
--
-- `profiles.commercial_id` nomme explicitement le commercial responsable.
-- C'est un lien ORGANISATIONNEL : il n'entre pas dans le calcul du périmètre.
-- `pdv_ids_perimetre()` et les politiques sur `visites` restent territoriales,
-- pour qu'aucun écran ne se vide tant que l'assignation n'est pas saisie.
--
-- Idempotent. Additif.
-- ============================================================================
begin;

alter table public.profiles add column if not exists commercial_id uuid references public.profiles(id) on delete set null;
create index if not exists idx_profiles_commercial on public.profiles (commercial_id);

comment on column public.profiles.commercial_id is
  'Commercial responsable de ce merchandiseur. Lien organisationnel : filtres « mon équipe » et relances, sans effet sur le périmètre de lecture (territorial).';

-- Cohérence : on ne rattache qu'à un commercial (ou un admin), jamais à
-- soi-même. Un CHECK ne peut pas interroger une autre ligne, d'où le trigger.
create or replace function public.profiles_commercial_id_valide()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_role text;
begin
  if new.commercial_id is null then
    return new;
  end if;
  if new.commercial_id = new.id then
    raise exception 'Un profil ne peut pas être son propre commercial responsable';
  end if;
  select role into v_role from public.profiles where id = new.commercial_id;
  if v_role is null then
    raise exception 'Commercial responsable introuvable';
  end if;
  if v_role not in ('commercial', 'admin') then
    raise exception 'Le responsable doit être un commercial (rôle reçu : %)', v_role;
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_commercial_id_valide on public.profiles;
create trigger trg_profiles_commercial_id_valide
  before insert or update of commercial_id on public.profiles
  for each row execute function public.profiles_commercial_id_valide();

commit;
