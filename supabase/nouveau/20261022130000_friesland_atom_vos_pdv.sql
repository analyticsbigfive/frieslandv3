-- ============================================================================
-- « VOS PDV » : L'APP NE MONTRE À UN MERCHANDISER ATOM QUE SA LISTE (22/10/2026)
--
-- Décision de Jean Luc, accord de Friesland : les territoires du fichier
-- Friesland ne collent pas au terrain et cachaient des PDV de la liste des
-- merchandisers ; on se fie à ce qu'ils ont validé. Les zones d'Atom ne
-- s'affichent pas dans l'app.
--
-- « Vos PDV » d'un merchandiser Atom (pdv_ids_merch_atom) :
--   · sa liste validée : les PDV de ses quartiers (pdv_quartier_tournee) avec
--     le distributeur d'une ligne de son routing, comme la page de validation ;
--   · les PDV de ses tournées d'hier et des jours à venir ;
--   · les PDV visités avec l'app ces 60 derniers jours (pas les visites
--     importées ATOM-…, historique des fichiers d'Atom) ;
--   · les PDV qu'il a créés.
-- Plus les PDV des anciennes règles (listes DMS des règles quota) ni ceux des
-- tournées passées : ils ne sont plus lisibles par lui.
--
-- L'app 1.0.15 filtre encore côté téléphone (territoires, zone exacte et
-- quartiers du profil, pages/mobile/visites/new.vue) : synchroniser_zones_atom
-- vide la zone et les quartiers du profil et met en territoires ceux où se
-- trouvent ses PDV, pour que l'app n'en cache aucun. Lancée par le cron de
-- 02 h 50 (avant la génération des tournées de 03 h), jamais pendant une visite
-- (prevent_profile_privilege_escalation refuserait l'écriture au merchandiser).
--
-- Rien ne change pour Friesland, les commerciaux, l'agence ni le compte QA Atom.
--
-- Retour arrière :
--   update profiles p set zone_assignee = a.zone_assignee,
--     territoires_assignes = a.territoires_assignes, quartiers_assignes = a.quartiers_assignes
--   from profil_zones_avant_vos_pdv a where a.profile_id = p.id;
--   select cron.unschedule('synchroniser_zones_atom');
--   puis recréer pdv_ids_perimetre (20261010110000_friesland_role_agence_cloisonnement)
--   et pdv_ids_tournee (20261016100000_friesland_perimetre_tournee).
-- Idempotente.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Les PDV d'un merchandiser Atom
-- ---------------------------------------------------------------------------
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
  -- Visites faites avec l'app ces 60 derniers jours (historique de l'app).
  select v.pdv_id
  from visites v
  where v.user_id = p_user and v.date_visite >= current_date - 60
    and v.pdv_id is not null and v.visite_id not like 'ATOM-%'
  union
  -- PDV créés sur place.
  select p.pdv_id from pdv p where p.created_by = p_user
$$;

-- ---------------------------------------------------------------------------
-- 2. Ce que la base laisse lire
-- ---------------------------------------------------------------------------
-- Comme 20261010110000, plus une branche pour les merchandisers Atom.
create or replace function public.pdv_ids_perimetre()
returns setof text
language sql
stable
security definer
rows 2000
set search_path = public
as $$
  with moi as materialized (
    select pr.id, pr.role,
      -- Merchandiser Atom (hors compte de test) : ses PDV, pas un territoire.
      (pr.role = 'merchandiser' and pr.employeur = 'atom'
       and coalesce(pr.email, '') not like '%@friesland-test.ci') as atom,
      case
        when jsonb_typeof(pr.territoires_assignes) = 'array' and jsonb_array_length(pr.territoires_assignes) > 0
          then (select array_agg(t) from jsonb_array_elements_text(pr.territoires_assignes) t where t <> '')
        when pr.zone_assignee is not null and pr.zone_assignee <> '' then array[pr.zone_assignee]
        else array[]::text[]
      end as territoires,
      case
        when jsonb_typeof(pr.quartiers_assignes) = 'array'
          then (select coalesce(array_agg(q), array[]::text[]) from jsonb_array_elements_text(pr.quartiers_assignes) q where q <> '')
        else array[]::text[]
      end as quartiers
    -- Un compte agence voit les PDV de son agence (pdv_ids_agence), pas un périmètre.
    from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role <> 'agence'
  ),
  terr as materialized (
    select m.atom, m.territoires, m.quartiers,
           coalesce((select array_agg(x) from public.territoires_etendus(m.territoires) x), array[]::text[]) as noms
    from moi m
  )
  -- Deux branches sans OR sur une constante : le planificateur utilise l'index.
  select p.pdv_id
  from terr t
  join public.pdv p on p.zone = any(t.noms)
  where not t.atom and cardinality(t.territoires) > 0
    and (cardinality(t.quartiers) = 0 or p.quartier is null or p.quartier = any(t.quartiers))
  union all
  select p.pdv_id
  from terr t
  join public.pdv p on true
  where not t.atom and cardinality(t.territoires) = 0
    and (cardinality(t.quartiers) = 0 or p.quartier is null or p.quartier = any(t.quartiers))
  union all
  select x.pdv_id
  from moi m
  cross join lateral public.pdv_ids_merch_atom(m.id) as x(pdv_id)
  where m.atom;
$$;

-- Comme 20261016100000, sauf pour un merchandiser Atom : pas les PDV des
-- règles (anciennes listes DMS), tournées d'hier et à venir seulement, visites
-- de l'app seulement (mêmes bornes que pdv_ids_merch_atom).
create or replace function public.pdv_ids_tournee()
returns setof text
language sql
stable
security definer
rows 500
set search_path = public
as $$
  with equipe as materialized (
    -- Soi-même (compte actif) + son équipe si commercial.
    select pr.id,
           (pr.role = 'merchandiser' and pr.employeur = 'atom'
            and coalesce(pr.email, '') not like '%@friesland-test.ci') as atom
    from public.profiles pr
    where pr.id = auth.uid() and pr.is_active = true
    union
    select m.x, false from public.merch_ids_commercial() as m(x)
  )
  select rp.pdv_id
  from equipe e
  join public.routings r on r.user_id = e.id
   and r.date_routing >= case when e.atom then current_date - 1 else current_date - 60 end
  join public.routing_pdv rp on rp.routing_id = r.id
  union
  select tp.pdv_id
  from equipe e
  join public.routing_templates t on t.user_id = e.id and t.is_active
  join public.routing_template_pdv tp on tp.template_id = t.id
  where not e.atom
  union
  select v.pdv_id
  from equipe e
  join public.visites v on v.user_id = e.id and v.date_visite >= current_date - 60
  where v.pdv_id is not null and not (e.atom and v.visite_id like 'ATOM-%')
$$;

-- ---------------------------------------------------------------------------
-- 3. Profils : l'app 1.0.15 ne doit cacher aucun de ses PDV
-- ---------------------------------------------------------------------------
create table if not exists public.profil_zones_avant_vos_pdv (
  profile_id           uuid primary key references public.profiles(id) on delete cascade,
  zone_assignee        text,
  territoires_assignes jsonb,
  quartiers_assignes   jsonb,
  garde_le             timestamptz not null default now()
);
comment on table public.profil_zones_avant_vos_pdv is
  'Zones des merchandisers Atom avant « vos PDV » (22/10/2026), pour revenir en arrière.';
alter table public.profil_zones_avant_vos_pdv enable row level security;
drop policy if exists profil_zones_avant_lecture on public.profil_zones_avant_vos_pdv;
create policy profil_zones_avant_lecture on public.profil_zones_avant_vos_pdv for select to authenticated
  using (public.est_admin_ou_superviseur());

-- Zone et quartiers vides (l'app filtrait le formulaire de visite sur la zone
-- exacte et les quartiers du profil) ; territoires = ceux qui couvrent la zone
-- d'au moins un de ses PDV (pdv_ids_merch_atom), avec les mêmes alias que l'app.
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
           coalesce((select jsonb_agg(distinct a.nom order by a.nom)
                     from zones z join alias a on a.zone = z.zone
                     where z.id = m.id), '[]'::jsonb) as territoires
    from merchs m
  )
  update profiles p
  set zone_assignee = null,
      quartiers_assignes = '[]'::jsonb,
      territoires_assignes = c.territoires
  from cibles c
  where p.id = c.id
    and (p.zone_assignee is not null
         or p.quartiers_assignes is distinct from '[]'::jsonb
         or p.territoires_assignes is distinct from c.territoires);
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$$;

-- Droits : pdv_ids_merch_atom ne sert qu'à la base (appelée par les fonctions
-- ci-dessus, en droits du propriétaire).
revoke all on function public.pdv_ids_merch_atom(uuid) from public, anon, authenticated;
grant execute on function public.pdv_ids_merch_atom(uuid) to service_role;
revoke all on function public.synchroniser_zones_atom() from public, anon;
grant execute on function public.synchroniser_zones_atom() to authenticated, service_role;
grant execute on function public.pdv_ids_perimetre() to anon, authenticated, service_role;
grant execute on function public.pdv_ids_tournee() to anon, authenticated, service_role;

-- 02 h 50 à Abidjan (UTC+0), avant la génération des tournées de 03 h.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'synchroniser_zones_atom') then
    perform cron.unschedule('synchroniser_zones_atom');
  end if;
  perform cron.schedule('synchroniser_zones_atom', '50 2 * * *', 'select public.synchroniser_zones_atom()');
end $$;

-- Premier passage.
select public.synchroniser_zones_atom();

commit;
