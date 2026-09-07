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

-- ---------------------------------------------------------------------------
-- Correction du téléphone d'un contact depuis l'application mobile.
--
-- La politique profiles_update_own interdit de modifier un autre profil. Cette
-- fonction, SECURITY DEFINER, ouvre exactement une brèche : le téléphone, et
-- seulement pour l'encadrement sur son périmètre. Elle vit en base plutôt que
-- dans une route serveur pour être appelable depuis l'APK, qui n'embarque pas
-- de serveur Nuxt.
--   - chacun son propre numéro ;
--   - admin et superviseur : tout contact non-admin ;
--   - commercial : un merchandiseur qui lui est assigné ou qui partage un de
--     ses territoires (alias compris, via territoires_etendus).
-- ---------------------------------------------------------------------------
create or replace function public.maj_telephone_contact(p_id uuid, p_telephone text)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_moi_role   text;
  v_moi_terr   text[];
  v_cible      record;
  v_tel        text := nullif(btrim(coalesce(p_telephone, '')), '');
  v_chiffres   text;
  v_terr_cible text[];
begin
  if auth.uid() is null then
    raise exception 'Session expirée, reconnectez-vous';
  end if;
  if v_tel is null then
    raise exception 'Le numéro de téléphone est requis';
  end if;
  v_tel := left(v_tel, 50);
  v_chiffres := regexp_replace(v_tel, '[^0-9]', '', 'g');
  if length(v_chiffres) < 8 or length(v_chiffres) > 15 then
    raise exception 'Numéro illisible. Exemple attendu : 07 08 09 10 11';
  end if;

  select role,
         case
           when jsonb_typeof(territoires_assignes) = 'array' and jsonb_array_length(territoires_assignes) > 0
             then (select array_agg(t) from jsonb_array_elements_text(territoires_assignes) t where t <> '')
           when zone_assignee is not null and zone_assignee <> '' then array[zone_assignee]
           else array[]::text[]
         end
    into v_moi_role, v_moi_terr
  from public.profiles where id = auth.uid() and is_active = true;

  if v_moi_role is null then
    raise exception 'Compte inactif';
  end if;

  select id, role, commercial_id,
         case
           when jsonb_typeof(territoires_assignes) = 'array' and jsonb_array_length(territoires_assignes) > 0
             then (select array_agg(t) from jsonb_array_elements_text(territoires_assignes) t where t <> '')
           when zone_assignee is not null and zone_assignee <> '' then array[zone_assignee]
           else array[]::text[]
         end as terrs
    into v_cible
  from public.profiles where id = p_id;

  if v_cible.id is null then
    raise exception 'Contact introuvable';
  end if;

  if v_cible.id <> auth.uid() then
    if v_moi_role not in ('admin', 'superviseur', 'commercial') then
      raise exception 'Action réservée à l''encadrement';
    end if;
    if v_cible.role = 'admin' then
      raise exception 'Le numéro d''un administrateur se modifie dans l''administration';
    end if;
    if v_moi_role = 'commercial' then
      if v_cible.role <> 'merchandiser' then
        raise exception 'Vous ne pouvez corriger que le numéro d''un merchandiseur';
      end if;
      if coalesce(v_cible.commercial_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid()
         and cardinality(v_moi_terr) > 0 then
        v_terr_cible := v_cible.terrs;
        if v_terr_cible is null or cardinality(v_terr_cible) = 0
           or not exists (
             select 1
             from public.territoires_etendus(v_moi_terr) e
             join unnest(v_terr_cible) c on upper(unaccent_safe(c)) = upper(unaccent_safe(e))
           ) then
          raise exception 'Ce merchandiseur n''est pas dans votre périmètre';
        end if;
      end if;
    end if;
  end if;

  update public.profiles set telephone = v_tel where id = p_id;
  return v_tel;
end $$;

revoke all on function public.maj_telephone_contact(uuid, text) from public;
grant execute on function public.maj_telephone_contact(uuid, text) to authenticated;

commit;
