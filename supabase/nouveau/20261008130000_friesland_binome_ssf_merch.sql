-- ============================================================================
-- BINÔMES SSF ↔ MERCHANDISER
--
-- Réunion client du 08/10/2026 : le SSF (vendeur du distributeur) et le
-- merchandiser (agence) dépendent tous deux du commercial ; aucun ne donne
-- d'ordres à l'autre. Leur seul lien est un binôme planifié : tel jour, tel
-- merchandiser travaille avec tel SSF dans telle zone / tels quartiers, pour
-- qu'ils passent dans les mêmes PDV. Ce planning vient de l'agence (fichier
-- « SSF – merch – zone ») : il n'est plus déduit de l'historique des visites.
--
-- La table est la source de vérité du planning ; l'import en tire, comme
-- avant, la sous-zone du SSF (ssf_quartier) et les règles de tournée
-- « SSF — » qui bornent la tournée du jour (etapes_quota_du_jour, inchangée).
--
-- Remplissage initial depuis les règles « SSF — » en place (source
-- « regle-existante »). ssf_semaine lit les binômes, avec la même signature
-- (app 1.0.12), et s'ouvre au commercial pour son équipe.
--
-- Idempotent. Additif.
-- ============================================================================
begin;

create table if not exists public.binome_ssf_merch (
  id              uuid primary key default gen_random_uuid(),
  merchandiser_id uuid not null references public.profiles(id) on delete cascade,
  ssf_id          integer not null references public.ssf(id) on delete cascade,
  -- extract(dow) : 1 = lundi … 6 = samedi (0 = dimanche, accepté).
  jour_semaine    smallint not null check (jour_semaine between 0 and 6),
  -- Libellés tels qu'en base PDV : pdv.zone (= territoire.nom) et pdv.quartier.
  zone            text,
  quartiers       text[] not null default '{}',
  date_debut      date,
  date_fin        date,
  -- regle-existante | client-<fichier> | admin
  source          text,
  import_lot_id   uuid references public.import_lot(id) on delete set null,
  actif           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint binome_ssf_merch_cle unique (merchandiser_id, jour_semaine, ssf_id),
  constraint binome_ssf_merch_dates check (date_fin is null or date_debut is null or date_fin >= date_debut)
);

comment on table public.binome_ssf_merch is
  'Binôme planifié : tel jour de la semaine, tel merchandiser travaille avec tel SSF dans telle zone / tels quartiers. Aucun lien hiérarchique : les deux dépendent du commercial. Clé d''import : (merchandiser, jour, SSF).';

create index if not exists idx_binome_ssf on public.binome_ssf_merch(ssf_id);
create index if not exists idx_binome_merch_jour on public.binome_ssf_merch(merchandiser_id, jour_semaine) where actif;

drop trigger if exists trg_binome_ssf_merch_updated_at on public.binome_ssf_merch;
create trigger trg_binome_ssf_merch_updated_at
  before update on public.binome_ssf_merch
  for each row execute function update_routing_updated_at();

alter table public.binome_ssf_merch enable row level security;

-- Lecture : encadrement, le merchandiser lui-même, le commercial du
-- merchandiser ou du SSF.
drop policy if exists binome_ssf_merch_read on public.binome_ssf_merch;
create policy binome_ssf_merch_read on public.binome_ssf_merch
  for select to authenticated
  using (
    merchandiser_id = auth.uid()
    or public.role_actif_courant() in ('admin', 'superviseur')
    or exists (select 1 from public.profiles m where m.id = merchandiser_id and m.commercial_id = auth.uid())
    or exists (select 1 from public.ssf s where s.id = ssf_id and s.commercial_id = auth.uid())
  );

drop policy if exists binome_ssf_merch_write on public.binome_ssf_merch;
create policy binome_ssf_merch_write on public.binome_ssf_merch
  for all to authenticated
  using (public.role_actif_courant() in ('admin', 'superviseur'))
  with check (public.role_actif_courant() in ('admin', 'superviseur'));

grant select on public.binome_ssf_merch to authenticated;
grant insert, update, delete on public.binome_ssf_merch to authenticated;

-- ---------------------------------------------------------------------------
-- Remplissage initial : règles « SSF — » actives
-- ---------------------------------------------------------------------------
insert into public.binome_ssf_merch (merchandiser_id, ssf_id, jour_semaine, zone, quartiers, date_debut, date_fin, source)
select distinct on (t.user_id, j.jour, t.ssf_id)
  t.user_id, t.ssf_id, j.jour::smallint,
  coalesce(v.zone, t.territoire), coalesce(v.quartiers, '{}'),
  t.date_debut, t.date_fin, 'regle-existante'
from public.routing_templates t
join public.v_ssf_sous_zone v on v.ssf_id = t.ssf_id
cross join lateral unnest(coalesce(t.days_of_week, array[t.day_of_week])) as j(jour)
where t.ssf_id is not null
  and coalesce(t.is_active, true)
  and (t.date_fin is null or t.date_fin >= current_date)
  and j.jour between 0 and 6
order by t.user_id, j.jour, t.ssf_id, t.created_at desc
on conflict (merchandiser_id, jour_semaine, ssf_id) do nothing;

-- ---------------------------------------------------------------------------
-- Planning de la semaine d'un merchandiser : depuis les binômes
-- ---------------------------------------------------------------------------
-- Même signature que 20261007100000 (lu par l'app 1.0.12). Sans binôme actif,
-- repli sur les règles « SSF — » comme avant.
create or replace function public.ssf_semaine(p_user_id uuid)
returns table (
  jour_semaine  integer,
  template_id   uuid,
  libelle       text,
  ssf_id        integer,
  ssf_nom       text,
  ssf_telephone text,
  distributeur  text,
  zone          text,
  quartiers     text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  -- Le merchandiser lit son planning ; son commercial, l'admin et le
  -- superviseur aussi ; service_role / cron (auth.uid() NULL) aussi.
  if auth.uid() is not null and auth.uid() <> p_user_id and not exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')
  ) and not exists (
    select 1 from profiles m where m.id = p_user_id and m.commercial_id = auth.uid()
  ) then
    raise exception 'Accès refusé au planning de cet utilisateur' using errcode = '42501';
  end if;

  if exists (
    select 1 from binome_ssf_merch b
    where b.merchandiser_id = p_user_id and b.actif and (b.date_fin is null or b.date_fin >= current_date)
  ) then
    return query
      select
        b.jour_semaine::int,
        r.id,
        coalesce(r.label, 'SSF — ' || v.nom),
        b.ssf_id,
        v.nom,
        v.telephone,
        v.distributeur,
        coalesce(b.zone, v.zone),
        case when cardinality(b.quartiers) > 0 then b.quartiers else v.quartiers end
      from binome_ssf_merch b
      join v_ssf_sous_zone v on v.ssf_id = b.ssf_id
      left join lateral (
        select t.id, t.label from routing_templates t
        where t.user_id = b.merchandiser_id and t.ssf_id = b.ssf_id and coalesce(t.is_active, true)
          and coalesce(t.days_of_week, array[t.day_of_week]) @> array[b.jour_semaine::int]
        order by t.created_at desc limit 1
      ) r on true
      where b.merchandiser_id = p_user_id
        and b.actif
        and (b.date_fin is null or b.date_fin >= current_date)
      order by b.jour_semaine, v.nom;
    return;
  end if;

  return query
    select
      j.jour::int,
      t.id,
      t.label,
      t.ssf_id,
      v.nom,
      v.telephone,
      coalesce(v.distributeur, t.distributeur),
      coalesce(v.zone, t.territoire),
      v.quartiers
    from routing_templates t
    join v_ssf_sous_zone v on v.ssf_id = t.ssf_id
    cross join lateral unnest(coalesce(t.days_of_week, array[t.day_of_week])) as j(jour)
    where t.user_id = p_user_id
      and t.ssf_id is not null
      and coalesce(t.is_active, true)
      and (t.date_fin is null or t.date_fin >= current_date)
    order by j.jour, t.created_at;
end;
$$;

comment on function public.ssf_semaine(uuid) is
  'Planning hebdomadaire d''un merchandiser : pour chaque jour (0 = dimanche), son binôme SSF, le distributeur du SSF, la zone et les quartiers. Lit binome_ssf_merch, sinon les règles « SSF — ».';

revoke all on function public.ssf_semaine(uuid) from public, anon;
grant execute on function public.ssf_semaine(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Journal des imports : routing SSF depuis l'export DMS
-- ---------------------------------------------------------------------------
alter table public.import_lot drop constraint if exists import_lot_type_check;
alter table public.import_lot add constraint import_lot_type_check
  check (type in ('dms-pdv', 'merch-dms', 'routing-atom', 'ssf-sous-zones', 'routing-ssf-dms'));

commit;
