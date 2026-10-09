-- ============================================================================
-- DIRECTION D'UN COMPTE : South (Abidjan) / North (intérieur) / MT
--
-- Réunion client du 08/10/2026 : trois directions, Abidjan (Emmanuel),
-- intérieur (Assamoi), Modern Trade (Zinji). Les écrans d'adoption et
-- l'inventaire des licences se filtrent par direction ; le field coaching MT
-- concerne les commerciaux de la direction MT.
--
-- South et North se déduisent des territoires du profil (territoire →
-- sous-région → région SOUTHDIV / NORTHDIV) ; MT ne se déduit pas (un
-- commercial MT couvre des supermarchés d'Abidjan) : il se règle à la main
-- dans Paramètres › Utilisateurs. Une personne peut avoir deux comptes (ex.
-- commercial MT + merchandiser) : chaque compte a sa direction.
--
-- Idempotent. Additif (colonne nullable, remplie pour les comptes existants).
-- ============================================================================
begin;

alter table public.profiles add column if not exists direction text;
alter table public.profiles drop constraint if exists profiles_direction_check;
alter table public.profiles add constraint profiles_direction_check
  check (direction is null or direction in ('south', 'north', 'mt'));

comment on column public.profiles.direction is
  'Direction du compte : south (Abidjan), north (intérieur), mt (Modern Trade). Déduite des territoires à défaut de saisie ; MT réglé par l''admin.';

create index if not exists idx_profiles_direction on public.profiles(direction);

-- Direction déduite des territoires (alias compris), sinon de l'agence.
-- Plusieurs régions : celle qui a le plus de territoires, South à égalité.
create or replace function public.direction_deduite(p_territoires jsonb, p_zone text, p_employeur text)
returns text
language sql
stable
set search_path = public
as $$
  with noms as (
    select jsonb_array_elements_text(coalesce(p_territoires, '[]'::jsonb)) as n
    union
    select p_zone where coalesce(p_zone, '') <> ''
  ),
  regions as (
    select sr.region_code, count(*) as nb
    from territoires_etendus(array(select n from noms)) e(nom)
    join territoire t on t.nom = e.nom
    join sous_region sr on sr.code = t.sous_region_code
    group by sr.region_code
  )
  select coalesce(
    (select case r.region_code when 'SOUTHDIV' then 'south' when 'NORTHDIV' then 'north' end
     from regions r order by r.nb desc, (r.region_code = 'SOUTHDIV') desc limit 1),
    (select a.direction from agence a where a.code = p_employeur)
  )
$$;

grant execute on function public.direction_deduite(jsonb, text, text) to authenticated, service_role;

-- Direction effective d'un profil : saisie, sinon déduite.
create or replace function public.direction_du_profil(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.direction, direction_deduite(p.territoires_assignes, p.zone_assignee, p.employeur))
  from profiles p where p.id = p_user_id
$$;

revoke all on function public.direction_du_profil(uuid) from public, anon;
grant execute on function public.direction_du_profil(uuid) to authenticated, service_role;

-- Remplissage initial : seulement les profils sans direction.
update public.profiles p
set direction = direction_deduite(p.territoires_assignes, p.zone_assignee, p.employeur)
where p.direction is null
  and direction_deduite(p.territoires_assignes, p.zone_assignee, p.employeur) is not null;

-- La direction se modifie depuis l'administration uniquement (comme le rôle et
-- le périmètre) : même trigger, une colonne de plus.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if (new.role                 is distinct from old.role)
  or (new.is_active            is distinct from old.is_active)
  or (new.zone_assignee        is distinct from old.zone_assignee)
  or (new.territoires_assignes is distinct from old.territoires_assignes)
  or (new.quartiers_assignes   is distinct from old.quartiers_assignes)
  or (new.commercial_id        is distinct from old.commercial_id)
  -- Colonnes déjà protégées en production (ne pas les perdre en redéfinissant).
  or (new.routing_mode         is distinct from old.routing_mode)
  or (new.profil_canonique_id  is distinct from old.profil_canonique_id)
  or (new.direction            is distinct from old.direction)
  then
    if auth.uid() is not null
       and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
      raise exception 'Rôle, activation, périmètre et direction se modifient depuis l''administration (profil %)', new.id
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end $$;

commit;
