-- ============================================================================
-- RÔLE « AGENCE » : LE RESPONSABLE DU ROUTING D'UNE AGENCE (décision du 09/10/2026)
--
-- Elias (Atom BTL) doit charger et corriger lui-même le routing mensuel de
-- ses merchandisers, sans le rôle admin qui ouvre tout FrieslandCampina. Un
-- compte « agence » est rattaché à son agence par profiles.employeur (atom,
-- agence-north…) et ne voit que les merchandisers de cette agence :
--   - lecture : leurs PDV (portefeuille, tournées, visites, territoires),
--     tournées, règles, routing mensuel, visites, positions de tournée,
--     versions installées ; l'Activité, le Perfect Store et le Programme
--     merchandiser se calculent donc sur l'agence (vues en security_invoker) ;
--   - écriture : le routing mensuel de ses merchandisers, ses propres lots
--     d'import « routing-mensuel », les alias de type « quartier » ;
--   - contrôle d'écart SSF ↔ merch de ses merchandisers.
-- L'import passe par /api/admin/imports/[type]/appliquer (clé service_role) :
-- la portée y est vérifiée opération par opération (portee-agence.mjs).
--
-- Politiques AJOUTÉES (permissives) : rien ne change pour les autres rôles.
-- Un compte agence ne peut changer ni son rôle ni son agence (profiles_update_own,
-- proteger_employeur_profil). Idempotent.
-- ============================================================================
begin;

-- 1. Le rôle, toujours rattaché à une agence (sinon : aucune portée).
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['admin', 'superviseur', 'merchandiser', 'commercial', 'agence']));
alter table public.profiles drop constraint if exists profiles_agence_rattachee;
alter table public.profiles add constraint profiles_agence_rattachee
  check (role <> 'agence' or (employeur is not null and employeur <> 'friesland'));

-- 2. Portée du compte connecté.
create or replace function public.agence_courante()
returns text
language sql stable security definer
set search_path to 'public'
as $$
  select p.employeur from public.profiles p
  where p.id = auth.uid() and p.role = 'agence' and coalesce(p.is_active, true)
    and p.employeur is not null and p.employeur <> 'friesland'
  limit 1
$$;

create or replace function public.merch_ids_agence()
returns setof uuid
language sql stable security definer rows 50
set search_path to 'public'
as $$
  select m.id from public.profiles m
  where m.role = 'merchandiser' and m.employeur = public.agence_courante()
$$;

-- PDV de l'agence : territoires de ses merchandisers, leurs portefeuilles
-- (règles), leurs tournées et leurs visites. Vide pour tout autre compte.
create or replace function public.pdv_ids_agence()
returns setof text
language sql stable security definer rows 20000
set search_path to 'public'
as $$
  with merch as materialized (
    select m.id, m.territoires_assignes, m.zone_assignee
    from public.profiles m
    where m.role = 'merchandiser' and m.employeur = public.agence_courante()
  ),
  territoires as materialized (
    select coalesce(array_agg(distinct t.nom), array[]::text[]) as noms
    from (
      select jsonb_array_elements_text(case when jsonb_typeof(m.territoires_assignes) = 'array' then m.territoires_assignes else '[]'::jsonb end) as nom
      from merch m
      union all
      select m.zone_assignee from merch m
    ) t
    where t.nom is not null and t.nom <> ''
  ),
  zones as materialized (
    select coalesce(array_agg(z), array[]::text[]) as noms
    from territoires t, public.territoires_etendus(t.noms) z
  )
  select p.pdv_id from zones z join public.pdv p on p.zone = any(z.noms)
  union
  select tp.pdv_id from public.routing_template_pdv tp
  join public.routing_templates t on t.id = tp.template_id
  join merch m on m.id = t.user_id
  union
  select rp.pdv_id from public.routing_pdv rp
  join public.routings r on r.id = rp.routing_id
  join merch m on m.id = r.user_id
  union
  select v.pdv_id from public.visites v
  join merch m on m.id = v.user_id
$$;

revoke all on function public.agence_courante() from public, anon;
revoke all on function public.merch_ids_agence() from public, anon;
revoke all on function public.pdv_ids_agence() from public, anon;
grant execute on function public.agence_courante() to authenticated;
grant execute on function public.merch_ids_agence() to authenticated;
grant execute on function public.pdv_ids_agence() to authenticated;

-- 3. Lecture limitée à l'agence.
drop policy if exists pdv_select_agence on public.pdv;
create policy pdv_select_agence on public.pdv for select to authenticated
  using ((select public.agence_courante()) is not null and pdv_id in (select public.pdv_ids_agence()));

drop policy if exists visites_select_agence on public.visites;
create policy visites_select_agence on public.visites for select to authenticated
  using (user_id in (select public.merch_ids_agence()));

drop policy if exists routings_select_agence on public.routings;
create policy routings_select_agence on public.routings for select to authenticated
  using (user_id in (select public.merch_ids_agence()));

drop policy if exists routing_pdv_select_agence on public.routing_pdv;
create policy routing_pdv_select_agence on public.routing_pdv for select to authenticated
  using (routing_id in (select r.id from public.routings r where r.user_id in (select public.merch_ids_agence())));

drop policy if exists routing_templates_select_agence on public.routing_templates;
create policy routing_templates_select_agence on public.routing_templates for select to authenticated
  using (user_id in (select public.merch_ids_agence()));

drop policy if exists routing_template_pdv_select_agence on public.routing_template_pdv;
create policy routing_template_pdv_select_agence on public.routing_template_pdv for select to authenticated
  using (template_id in (select t.id from public.routing_templates t where t.user_id in (select public.merch_ids_agence())));

drop policy if exists version_installee_select_agence on public.version_installee;
create policy version_installee_select_agence on public.version_installee for select to authenticated
  using (user_id in (select public.merch_ids_agence()));

drop policy if exists position_tournee_select_agence on public.position_tournee;
create policy position_tournee_select_agence on public.position_tournee for select to authenticated
  using (user_id in (select public.merch_ids_agence()));

-- 4. Écriture : routing mensuel de ses merchandisers, ses lots, alias de quartier.
drop policy if exists routing_mensuel_agence on public.routing_mensuel;
create policy routing_mensuel_agence on public.routing_mensuel for all to authenticated
  using (merchandiser_id in (select public.merch_ids_agence()))
  with check (merchandiser_id in (select public.merch_ids_agence()));

drop policy if exists import_lot_agence on public.import_lot;
create policy import_lot_agence on public.import_lot for all to authenticated
  using ((select public.agence_courante()) is not null and type = 'routing-mensuel' and cree_par = (select auth.uid()))
  with check ((select public.agence_courante()) is not null and type = 'routing-mensuel' and cree_par = (select auth.uid()));

drop policy if exists alias_import_agence on public.alias_import;
create policy alias_import_agence on public.alias_import for all to authenticated
  using ((select public.agence_courante()) is not null and type = 'quartier')
  with check ((select public.agence_courante()) is not null and type = 'quartier');

-- 5. Planning et contrôle d'écart : ses merchandisers.
create or replace function public.peut_lire_routing(p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select auth.uid() is null
      or auth.uid() = p_user_id
      or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur'))
      or exists (select 1 from profiles m where m.id = p_user_id and m.commercial_id = auth.uid())
      or p_user_id in (select public.merch_ids_agence())
$function$;

create or replace function public.ecarts_binome_resume(p_date date default current_date)
 returns table(merchandiser_id uuid, nom text, email text, employeur text, direction text, commercial_id uuid, routing_id uuid, ssf_ids integer[], ssf_noms text, nb_pdv integer, nb_hors_routing integer, statut text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_role text := (select p.role from profiles p where p.id = auth.uid());
  v_agence text := public.agence_courante();
  v_dow  smallint := extract(dow from p_date)::smallint;
  v_semaine integer := semaine_routing(p_date);
begin
  if auth.uid() is not null and coalesce(v_role, '') not in ('admin', 'superviseur', 'commercial')
     and v_agence is null then
    raise exception 'Accès refusé au contrôle d''écart' using errcode = '42501';
  end if;

  return query
  with tournees as (
    select rt.id as routing_id, rt.user_id
    from routings rt
    join profiles m on m.id = rt.user_id
    where rt.date_routing = p_date
      and rt.status <> 'cancelled'
      and m.role = 'merchandiser'
      and (auth.uid() is null or v_role in ('admin', 'superviseur') or m.commercial_id = auth.uid()
           or (v_agence is not null and m.employeur = v_agence))
  ),
  binomes as (
    select b.merchandiser_id, b.ssf_id
    from routing_mensuel b
    where b.actif and b.ssf_id is not null
      and b.jour_semaine = v_dow and b.semaine_du_mois = v_semaine
  ),
  etapes as (
    select t.routing_id, t.user_id, rp.pdv_id,
      exists (
        select 1 from binomes b
        join ssf_pdv sp on sp.ssf_id = b.ssf_id and sp.pdv_id = rp.pdv_id and sp.jour_semaine in (0, v_dow)
        where b.merchandiser_id = t.user_id
      ) as dans_routing
    from tournees t
    join routing_pdv rp on rp.routing_id = t.routing_id
  ),
  par_merch as (
    select e.user_id, min(e.routing_id::text)::uuid as routing_id,
      count(*)::int as nb_pdv,
      (count(*) filter (where not e.dans_routing))::int as nb_hors
    from etapes e group by e.user_id
  ),
  ssf_du_jour as (
    select b.merchandiser_id,
      array_agg(b.ssf_id order by s.nom) as ids,
      string_agg(s.nom, ', ' order by s.nom) as noms,
      bool_or(exists (select 1 from ssf_pdv sp where sp.ssf_id = b.ssf_id and sp.jour_semaine in (0, v_dow))) as routing_connu
    from binomes b join ssf s on s.id = b.ssf_id
    group by b.merchandiser_id
  )
  select
    m.id, m.nom, m.email, m.employeur, coalesce(m.direction, direction_deduite(m.territoires_assignes, m.zone_assignee, m.employeur)),
    m.commercial_id, pm.routing_id, sj.ids, sj.noms, pm.nb_pdv,
    case when sj.routing_connu then pm.nb_hors else null end,
    case
      when sj.merchandiser_id is null then 'sans_binome'
      when not sj.routing_connu then 'routing_ssf_absent'
      when pm.nb_hors > 0 then 'hors_routing_ssf'
      else 'ok'
    end
  from par_merch pm
  join profiles m on m.id = pm.user_id
  left join ssf_du_jour sj on sj.merchandiser_id = pm.user_id
  order by m.nom;
end;
$function$;

create or replace function public.ecarts_binome(p_date date, p_merchandiser uuid)
 returns table(pdv_id text, nom_pdv text, zone text, quartier text, canal text, ssf_du_pdv text, dans_routing boolean)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_role text := (select p.role from profiles p where p.id = auth.uid());
  v_dow  smallint := extract(dow from p_date)::smallint;
  v_semaine integer := semaine_routing(p_date);
begin
  if auth.uid() is not null and coalesce(v_role, '') not in ('admin', 'superviseur')
     and not exists (select 1 from profiles m where m.id = p_merchandiser and m.commercial_id = auth.uid())
     and p_merchandiser not in (select public.merch_ids_agence()) then
    raise exception 'Accès refusé au contrôle d''écart' using errcode = '42501';
  end if;

  return query
  select
    p.pdv_id, p.nom_pdv, p.zone, p.quartier, p.sous_categorie_pdv,
    (select string_agg(distinct s.nom, ', ') from ssf_pdv sp join ssf s on s.id = sp.ssf_id where sp.pdv_id = p.pdv_id),
    exists (
      select 1 from routing_mensuel b
      join ssf_pdv sp on sp.ssf_id = b.ssf_id and sp.pdv_id = rp.pdv_id and sp.jour_semaine in (0, v_dow)
      where b.merchandiser_id = p_merchandiser and b.actif and b.ssf_id is not null
        and b.jour_semaine = v_dow and b.semaine_du_mois = v_semaine
    )
  from routings rt
  join routing_pdv rp on rp.routing_id = rt.id
  join pdv p on p.pdv_id = rp.pdv_id
  where rt.user_id = p_merchandiser and rt.date_routing = p_date and rt.status <> 'cancelled'
  order by 7, p.zone, p.quartier, p.nom_pdv;
end;
$function$;

-- 6. Sections du back-office : tableau de bord, Activité, Routing & Planning,
--    Programme, Écarts (principal) et Visites. Les écrans propres à l'agence
--    (Versions de l'app, Imports terrain, Référentiels › Routing mensuel) sont
--    ouverts par le front, page par page.
insert into public.role_section_access (role, section, can_access) values
  ('agence', 'principal', true), ('agence', 'visites', true),
  ('agence', 'perfect-store', false), ('agence', 'pdv', false), ('agence', 'visibilite', false),
  ('agence', 'concurrence', false), ('agence', 'produits', false), ('agence', 'actions', false),
  ('agence', 'parametres', false)
on conflict (role, section) do nothing;

commit;
