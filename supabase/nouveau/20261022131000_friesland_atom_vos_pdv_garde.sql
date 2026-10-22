-- ============================================================================
-- « VOS PDV » : GARDE-FOUS (22/10/2026, suite de 20261022130000)
--
-- Revue de sécurité de 20261022130000 :
--   1. profiles.employeur décide qu'un merchandiser ne lit que ses PDV, mais
--      l'intéressé pouvait le modifier lui-même (profiles_update_own ne le
--      fige pas, prevent_profile_privilege_escalation non plus) : en passant
--      à « friesland », il retrouvait tous les PDV de ses territoires. Il est
--      maintenant réservé à l'administration, comme le rôle et les zones
--      (l'app ne propose que nom, téléphone et photo).
--   2. Une visite saisie sur n'importe quel PDV le faisait entrer dans « ses
--      PDV » (pdv_ids_merch_atom), donc dans son périmètre : lisible, et sa
--      position fixée à cette visite. Les visites n'en font plus partie ;
--      l'historique reste lisible par pdv_ids_tournee, comme pour tous.
--   3. synchroniser_zones_atom n'écrit jamais une liste de territoires vide
--      (vide = tous les PDV hors de la branche Atom de pdv_ids_perimetre).
-- Idempotente.
-- ============================================================================
begin;

-- 1. L'employeur se change depuis l'administration --------------------------
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (new.role                 is distinct from old.role)
  or (new.is_active            is distinct from old.is_active)
  or (new.zone_assignee        is distinct from old.zone_assignee)
  or (new.territoires_assignes is distinct from old.territoires_assignes)
  or (new.quartiers_assignes   is distinct from old.quartiers_assignes)
  or (new.commercial_id        is distinct from old.commercial_id)
  or (new.routing_mode         is distinct from old.routing_mode)
  or (new.profil_canonique_id  is distinct from old.profil_canonique_id)
  or (new.direction            is distinct from old.direction)
  -- « Vos PDV » (20261022130000) : l'employeur décide de ce que lit un merchandiser.
  or (new.employeur            is distinct from old.employeur)
  then
    if auth.uid() is not null
       and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
      raise exception 'Rôle, activation, périmètre, employeur et direction se modifient depuis l''administration (profil %)', new.id
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end $$;

-- 2. Ses PDV, sans les visites --------------------------------------------------
create or replace function public.pdv_ids_merch_atom(p_user uuid)
returns setof text
language sql
stable
security definer
rows 1500
set search_path = public
as $$
  -- Liste validée : quartier du point de visite, distributeur de son routing.
  select q.pdv_id
  from pdv_quartier_tournee q
  join pdv p on p.pdv_id = q.pdv_id
  where q.merchandiser_id = p_user and coalesce(p.is_active, true)
    and exists (select 1 from routing_mensuel r
                where r.merchandiser_id = p_user and r.actif
                  and r.distributeur is not distinct from p.distributor_name)
  union
  -- Tournées d'hier et à venir (une visite synchronisée en retard).
  select rp.pdv_id
  from routings r
  join routing_pdv rp on rp.routing_id = r.id
  where r.user_id = p_user and r.date_routing >= current_date - 1
  union
  -- PDV créés sur place.
  select p.pdv_id from pdv p where p.created_by = p_user
$$;

-- 3. Jamais de territoires vides ------------------------------------------------
create or replace function public.synchroniser_zones_atom()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nb integer;
begin
  -- Admin (seul rôle autorisé par prevent_profile_privilege_escalation) ou cron.
  if auth.uid() is not null
     and not exists (select 1 from profiles me where me.id = auth.uid() and me.role = 'admin') then
    raise exception 'synchroniser_zones_atom : réservé aux administrateurs' using errcode = '42501';
  end if;

  insert into profil_zones_avant_vos_pdv (profile_id, zone_assignee, territoires_assignes, quartiers_assignes)
  select m.id, m.zone_assignee, m.territoires_assignes, m.quartiers_assignes
  from profiles m
  where m.role = 'merchandiser' and m.employeur = 'atom' and coalesce(m.is_active, true)
    and coalesce(m.email, '') not like '%@friesland-test.ci'
  on conflict (profile_id) do nothing;

  with merchs as (
    select m.id from profiles m
    where m.role = 'merchandiser' and m.employeur = 'atom' and coalesce(m.is_active, true)
      and coalesce(m.email, '') not like '%@friesland-test.ci'
  ),
  zones as (
    select distinct m.id, p.zone
    from merchs m
    cross join lateral pdv_ids_merch_atom(m.id) as x(pdv_id)
    join pdv p on p.pdv_id = x.pdv_id
    where p.zone is not null
  ),
  alias as materialized (
    select t.nom, e.x as zone
    from territoire t
    cross join lateral territoires_etendus(array[t.nom]) as e(x)
  ),
  cibles as (
    select m.id,
           (select jsonb_agg(distinct a.nom order by a.nom)
            from zones z join alias a on a.zone = z.zone
            where z.id = m.id) as territoires
    from merchs m
  )
  update profiles p
  set zone_assignee = null,
      quartiers_assignes = '[]'::jsonb,
      -- Aucun territoire trouvé : on garde ceux d'avant (vide = tous les PDV).
      territoires_assignes = coalesce(c.territoires, p.territoires_assignes)
  from cibles c
  where p.id = c.id
    and (p.zone_assignee is not null
         or p.quartiers_assignes is distinct from '[]'::jsonb
         or p.territoires_assignes is distinct from coalesce(c.territoires, p.territoires_assignes));
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$$;

revoke all on function public.pdv_ids_merch_atom(uuid) from public, anon, authenticated;
grant execute on function public.pdv_ids_merch_atom(uuid) to service_role;
revoke all on function public.synchroniser_zones_atom() from public, anon;
grant execute on function public.synchroniser_zones_atom() to authenticated, service_role;

-- Territoires recalculés sans les visites.
select public.synchroniser_zones_atom();

commit;
