-- ============================================================================
-- ROUTING DU SSF ET CONTRÔLE D'ÉCART AVEC LA TOURNÉE DU MERCHANDISER
--
-- Réunion client du 08/10/2026 : le SSF et le merchandiser du binôme doivent
-- passer dans les mêmes PDV. Le routing du SSF vient du DMS : l'export clients
-- donne pour chaque client (customer_code = pdv.mdm) son vendeur
-- (salesman_name = SSF). Pas de jour dans l'export : jour_semaine = 0 veut dire
-- « tous les jours » ; un fichier qui donne le jour le renseigne (1-6).
--
-- Écart d'un jour : les PDV de la tournée d'un merchandiser qui ne sont dans
-- le routing d'aucun SSF de son binôme ce jour-là. Deux fonctions :
--   - ecarts_binome_resume(date) : une ligne par merchandiser ;
--   - ecarts_binome(date, merchandiser) : le détail des PDV.
--
-- Idempotent. Additif.
-- ============================================================================
begin;

create table if not exists public.ssf_pdv (
  ssf_id        integer not null references public.ssf(id) on delete cascade,
  pdv_id        text not null references public.pdv(pdv_id) on delete cascade,
  -- 0 = tous les jours (export DMS sans jour) ; 1 = lundi … 6 = samedi.
  jour_semaine  smallint not null default 0 check (jour_semaine between 0 and 6),
  -- dms-<fichier> | admin
  source        text,
  import_lot_id uuid references public.import_lot(id) on delete set null,
  created_at    timestamptz not null default now(),
  primary key (ssf_id, pdv_id, jour_semaine)
);

comment on table public.ssf_pdv is
  'Routing du SSF : PDV (clients DMS) qu''il visite, par jour de semaine (0 = tous les jours). Alimenté par Admin › Imports terrain › Routing SSF (export DMS).';

create index if not exists idx_ssf_pdv_pdv on public.ssf_pdv(pdv_id);

alter table public.ssf_pdv enable row level security;

drop policy if exists ssf_pdv_read on public.ssf_pdv;
create policy ssf_pdv_read on public.ssf_pdv
  for select to authenticated using (true);

drop policy if exists ssf_pdv_write on public.ssf_pdv;
create policy ssf_pdv_write on public.ssf_pdv
  for all to authenticated
  using (public.role_actif_courant() in ('admin', 'superviseur'))
  with check (public.role_actif_courant() in ('admin', 'superviseur'));

grant select on public.ssf_pdv to authenticated;
grant insert, update, delete on public.ssf_pdv to authenticated;

-- ---------------------------------------------------------------------------
-- Contrôle d'écart
-- ---------------------------------------------------------------------------
-- Accès : admin et superviseur voient tout ; un commercial, les merchandisers
-- de son équipe ; les autres rien. security definer pour lire les tournées de
-- l'équipe malgré la RLS des routings.
create or replace function public.ecarts_binome_resume(p_date date default current_date)
returns table (
  merchandiser_id uuid,
  nom             text,
  email           text,
  employeur       text,
  direction       text,
  commercial_id   uuid,
  routing_id      uuid,
  ssf_ids         integer[],
  ssf_noms        text,
  nb_pdv          integer,
  nb_hors_routing integer,
  -- ok | hors_routing_ssf | routing_ssf_absent | sans_binome
  statut          text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_role text := (select p.role from profiles p where p.id = auth.uid());
  v_dow  smallint := extract(dow from p_date)::smallint;
begin
  if auth.uid() is not null and coalesce(v_role, '') not in ('admin', 'superviseur', 'commercial') then
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
      and (auth.uid() is null or v_role in ('admin', 'superviseur') or m.commercial_id = auth.uid())
  ),
  binomes as (
    select b.merchandiser_id, b.ssf_id
    from binome_ssf_merch b
    where b.actif and b.jour_semaine = v_dow
      and (b.date_debut is null or b.date_debut <= p_date)
      and (b.date_fin is null or b.date_fin >= p_date)
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
$$;

comment on function public.ecarts_binome_resume(date) is
  'Contrôle d''écart d''un jour : par merchandiser, son binôme SSF, le nombre de PDV de sa tournée et ceux hors du routing de ses SSF du jour (statut ok / hors_routing_ssf / routing_ssf_absent / sans_binome).';

revoke all on function public.ecarts_binome_resume(date) from public, anon;
grant execute on function public.ecarts_binome_resume(date) to authenticated, service_role;

create or replace function public.ecarts_binome(p_date date, p_merchandiser uuid)
returns table (
  pdv_id        text,
  nom_pdv       text,
  zone          text,
  quartier      text,
  canal         text,
  -- SSF du DMS qui suivent ce PDV (tous jours confondus), pour aider à corriger.
  ssf_du_pdv    text,
  dans_routing  boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_role text := (select p.role from profiles p where p.id = auth.uid());
  v_dow  smallint := extract(dow from p_date)::smallint;
begin
  if auth.uid() is not null and coalesce(v_role, '') not in ('admin', 'superviseur')
     and not exists (select 1 from profiles m where m.id = p_merchandiser and m.commercial_id = auth.uid()) then
    raise exception 'Accès refusé au contrôle d''écart' using errcode = '42501';
  end if;

  return query
  select
    p.pdv_id, p.nom_pdv, p.zone, p.quartier, p.sous_categorie_pdv,
    (select string_agg(distinct s.nom, ', ') from ssf_pdv sp join ssf s on s.id = sp.ssf_id where sp.pdv_id = p.pdv_id),
    exists (
      select 1 from binome_ssf_merch b
      join ssf_pdv sp on sp.ssf_id = b.ssf_id and sp.pdv_id = rp.pdv_id and sp.jour_semaine in (0, v_dow)
      where b.merchandiser_id = p_merchandiser and b.actif and b.jour_semaine = v_dow
        and (b.date_debut is null or b.date_debut <= p_date)
        and (b.date_fin is null or b.date_fin >= p_date)
    )
  from routings rt
  join routing_pdv rp on rp.routing_id = rt.id
  join pdv p on p.pdv_id = rp.pdv_id
  where rt.user_id = p_merchandiser and rt.date_routing = p_date and rt.status <> 'cancelled'
  order by 7, p.zone, p.quartier, p.nom_pdv;
end;
$$;

comment on function public.ecarts_binome(date, uuid) is
  'Détail du contrôle d''écart : PDV de la tournée du jour d''un merchandiser, dans ou hors du routing des SSF de son binôme.';

revoke all on function public.ecarts_binome(date, uuid) from public, anon;
grant execute on function public.ecarts_binome(date, uuid) to authenticated, service_role;

commit;
