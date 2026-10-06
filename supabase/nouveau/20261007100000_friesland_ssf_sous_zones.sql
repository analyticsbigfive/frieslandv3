-- ============================================================================
-- SOUS-ZONES SSF (merchandisers Atom)
--
-- Décision client (réunion du 06/10/2026) : chaque zone est découpée en
-- sous-zones ; chaque sous-zone est couverte par un SSF (vendeur du
-- distributeur qui accompagne le merchandiser). Le merchandiser travaille dans
-- la sous-zone de son SSF du jour, sans en sortir ; le planning se fait par
-- jour de semaine (une sous-zone le lundi, une autre le mardi…).
--
-- Modèle :
--   - sous-zone d'un SSF = ensemble de quartiers (pdv.zone + pdv.quartier),
--     table ssf_quartier, éditable dans Référentiels › Distribution ;
--   - planning = une règle quota par merchandiser × SSF, avec ses jours
--     (routing_templates.ssf_id + days_of_week), éditable dans Routing › Règles ;
--   - etapes_quota_du_jour pioche d'abord dans le portefeuille de la règle,
--     puis complète avec les PDV actifs de la sous-zone du SSF (PDV créés sur
--     le terrain compris), toujours un PDV au plus une fois par mois.
--
-- Alimentation initiale : scripts/deriver-ssf-sous-zones.mjs (dérivé des
-- visites Atom importées), puis l'Excel « SSF ↔ zones » du client.
--
-- Idempotent. Sans effet sur l'app 1.0.10 (colonnes nullables).
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Plusieurs règles par merchandiser
-- ---------------------------------------------------------------------------
-- 20260717160000 déclarait unique (user_id, day_of_week) ; createTemplate et
-- les scripts posent day_of_week = days_of_week[1] : deux règles d'un même
-- merchandiser commençant le même jour seraient refusées. On lève la
-- contrainte (ou l'index unique équivalent) s'il est encore en place.
do $$
declare
  v_nom text;
  v_cols int2[];
begin
  select array_agg(attnum order by attnum) into v_cols
  from pg_attribute
  where attrelid = 'public.routing_templates'::regclass
    and attname in ('user_id', 'day_of_week');

  for v_nom in
    select conname from pg_constraint
    where conrelid = 'public.routing_templates'::regclass
      and contype = 'u'
      and (select array_agg(k order by k) from unnest(conkey) k) = v_cols
  loop
    execute format('alter table public.routing_templates drop constraint %I', v_nom);
    raise notice 'Contrainte % levée', v_nom;
  end loop;

  for v_nom in
    select ic.relname
    from pg_index i
    join pg_class ic on ic.oid = i.indexrelid
    where i.indrelid = 'public.routing_templates'::regclass
      and i.indisunique and not i.indisprimary
      and (select array_agg(k order by k) from unnest(i.indkey::int2[]) k) = v_cols
      and not exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)
  loop
    execute format('drop index public.%I', v_nom);
    raise notice 'Index unique % supprimé', v_nom;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Sous-zone d'un SSF : ses quartiers
-- ---------------------------------------------------------------------------
create table if not exists public.ssf_quartier (
  id          serial primary key,
  ssf_id      integer not null references public.ssf(id) on delete cascade,
  -- Libellés tels qu'en base PDV : pdv.zone (= territoire.nom) et pdv.quartier.
  zone        text not null,
  quartier    text not null,
  -- derive-visites-<mois> | client-<fichier> | admin
  source      text,
  a_confirmer boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (ssf_id, zone, quartier)
);

comment on table public.ssf_quartier is
  'Sous-zone d''un SSF : quartiers (pdv.zone + pdv.quartier) qu''il couvre. Borne les PDV des règles de tournée liées au SSF. Éditable dans Référentiels › Distribution › SSF ↔ Quartiers.';

create index if not exists idx_ssf_quartier_zone_quartier on public.ssf_quartier(zone, quartier);
create index if not exists idx_ssf_quartier_ssf on public.ssf_quartier(ssf_id);

drop trigger if exists trg_ssf_quartier_updated_at on public.ssf_quartier;
create trigger trg_ssf_quartier_updated_at
  before update on public.ssf_quartier
  for each row execute function update_routing_updated_at();

alter table public.ssf_quartier enable row level security;

drop policy if exists ssf_quartier_read on public.ssf_quartier;
create policy ssf_quartier_read on public.ssf_quartier
  for select to authenticated using (true);

drop policy if exists ssf_quartier_write on public.ssf_quartier;
create policy ssf_quartier_write on public.ssf_quartier
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')));

grant select on public.ssf_quartier to authenticated;
grant insert, update, delete on public.ssf_quartier to authenticated;
grant usage, select on sequence public.ssf_quartier_id_seq to authenticated;

-- Vue d'ensemble : une ligne par SSF, avec sa zone dominante (celle qui a le
-- plus de quartiers) et la liste de ses quartiers.
drop view if exists public.v_ssf_sous_zone;
create view public.v_ssf_sous_zone with (security_invoker = true) as
with par_zone as (
  select sq.ssf_id, sq.zone, count(*) as nb
  from public.ssf_quartier sq
  group by sq.ssf_id, sq.zone
),
dominante as (
  select distinct on (ssf_id) ssf_id, zone
  from par_zone
  order by ssf_id, nb desc, zone
)
select
  s.id as ssf_id,
  s.nom,
  s.telephone,
  s.distributeur_id,
  d.nom as distributeur,
  s.actif,
  s.a_confirmer as ssf_a_confirmer,
  dom.zone as zone,
  coalesce(array_agg(distinct sq.zone) filter (where sq.zone is not null), '{}') as zones,
  coalesce(array_agg(sq.quartier order by sq.zone, sq.quartier) filter (where sq.quartier is not null), '{}') as quartiers,
  count(sq.id)::int as nb_quartiers,
  coalesce(bool_or(sq.a_confirmer), false) as sous_zone_a_confirmer
from public.ssf s
left join public.ssf_quartier sq on sq.ssf_id = s.id
left join dominante dom on dom.ssf_id = s.id
left join public.distributeur d on d.id = s.distributeur_id
group by s.id, s.nom, s.telephone, s.distributeur_id, d.nom, s.actif, s.a_confirmer, dom.zone;

comment on view public.v_ssf_sous_zone is
  'Un SSF par ligne : distributeur, zone dominante, quartiers de sa sous-zone.';

grant select on public.v_ssf_sous_zone to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Règle de tournée ↔ SSF
-- ---------------------------------------------------------------------------
alter table public.routing_templates
  add column if not exists ssf_id integer references public.ssf(id) on delete set null;

create index if not exists idx_routing_templates_ssf on public.routing_templates(ssf_id);

comment on column public.routing_templates.ssf_id is
  'SSF (vendeur du distributeur) qui accompagne le merchandiser les jours de cette règle. Sa sous-zone (ssf_quartier) complète les PDV éligibles des tournées par quotas.';

-- La fonction renvoie routing_templates.* : on la recrée telle quelle pour que
-- son type de retour inclue ssf_id dès cette migration.
create or replace function public.routing_regles_du_jour(p_user_id uuid, p_date date)
returns setof public.routing_templates
language sql stable
set search_path = public
as $$
  select t.*
  from routing_templates t
  where t.user_id = p_user_id
    and coalesce(t.is_active, true)
    -- extract(dow) : 0 = dimanche, même convention que JS getDay().
    and coalesce(t.days_of_week, array[t.day_of_week]) @> array[extract(dow from p_date)::int]
    and (t.date_debut is null or p_date >= t.date_debut)
    and (t.date_fin is null or p_date <= t.date_fin)
    -- Règle suspendue en entier sur cette date (exception sans pdv_id).
    and not exists (
      select 1 from routing_template_exception e
      where e.template_id = t.id
        and e.pdv_id is null
        and p_date between e.date_debut and e.date_fin
    );
$$;

-- ---------------------------------------------------------------------------
-- 4. Étapes du jour : portefeuille d'abord, puis la sous-zone du SSF
-- ---------------------------------------------------------------------------
/**
 * PDV à visiter ce jour pour les règles « quota » d'un merchandiser.
 *
 * Candidats, dans cet ordre :
 *   1. les PDV des règles quota du jour (portefeuille, ordre GPS de la règle) ;
 *   2. (nouveau) pour une règle liée à un SSF, les PDV actifs des quartiers de
 *      sa sous-zone qui ne sont pas déjà candidats — un PDV créé sur le terrain
 *      dans la sous-zone devient ainsi éligible sans relancer de script.
 * Exclus dans les deux cas : canal hors grille, exception de la règle, PDV
 * déjà planifié dans une tournée du mois civil (y compris à venir) ou déjà
 * visité dans le mois.
 *
 * Par canal : les `quota(canal, jour)` premiers. Déficit d'un canal : complété
 * par des boutiques. Déficit global : tournée plus courte, sans erreur.
 */
create or replace function public.etapes_quota_du_jour(p_user_id uuid, p_date date)
returns table (pdv_id text, ordre integer, canal text, objectifs jsonb)
language plpgsql
set search_path = public
as $$
declare
  v_debut_mois date := date_trunc('month', p_date)::date;
  v_fin_mois   date := (date_trunc('month', p_date) + interval '1 month - 1 day')::date;
  v_dow        integer := extract(dow from p_date)::int;
  v_deficit    integer := 0;
  -- pas « r » : plpgsql substituerait la variable à l'alias r des requêtes.
  v_q record;
begin
  create temp table if not exists _candidats (
    pdv_id text, ordre integer, canal text, objectifs jsonb, pris boolean default false
  ) on commit drop;
  truncate _candidats;

  -- 1. Portefeuille des règles quota du jour.
  insert into _candidats (pdv_id, ordre, canal, objectifs)
  select distinct on (tp.pdv_id)
    tp.pdv_id,
    row_number() over (order by r.created_at, tp.position_order)::int,
    canal_atom(p.sous_categorie_pdv),
    coalesce(tp.objectifs, '{}'::jsonb)
  from routing_regles_du_jour(p_user_id, p_date) r
  join routing_template_pdv tp on tp.template_id = r.id
  join pdv p on p.pdv_id = tp.pdv_id
  where r.mode = 'quota'
    and coalesce(p.is_active, true)
    and canal_atom(p.sous_categorie_pdv) is not null
    and not exists (
      select 1 from routing_template_exception e
      where e.template_id = r.id and e.pdv_id = tp.pdv_id
        and p_date between e.date_debut and e.date_fin
    )
    and not exists (
      select 1
      from routing_pdv rp
      join routings rt on rt.id = rp.routing_id
      where rt.user_id = p_user_id
        and rt.date_routing between v_debut_mois and v_fin_mois
        and rt.status <> 'cancelled'
        and rp.pdv_id = tp.pdv_id
    )
    and not exists (
      select 1 from visites v
      where v.user_id = p_user_id
        and v.pdv_id = tp.pdv_id
        and v.date_visite >= v_debut_mois
        and v.date_visite < v_fin_mois + 1
    )
  order by tp.pdv_id, r.created_at, tp.position_order;

  -- 2. Sous-zone du SSF des règles du jour : PDV pas encore candidats, après
  --    le portefeuille (ordre ≥ 50000), regroupés par quartier.
  insert into _candidats (pdv_id, ordre, canal, objectifs)
  select distinct on (p.pdv_id)
    p.pdv_id,
    50000 + row_number() over (
      order by r.created_at, sq.zone, sq.quartier, p.geolocation_lat nulls last, p.geolocation_lng nulls last, p.pdv_id
    )::int,
    canal_atom(p.sous_categorie_pdv),
    jsonb_build_object('releve_stock', true, 'photos', true)
  from routing_regles_du_jour(p_user_id, p_date) r
  join ssf_quartier sq on sq.ssf_id = r.ssf_id
  join pdv p on p.zone = sq.zone and p.quartier = sq.quartier
  where r.mode = 'quota'
    and r.ssf_id is not null
    and coalesce(p.is_active, true)
    and canal_atom(p.sous_categorie_pdv) is not null
    and not exists (select 1 from _candidats c where c.pdv_id = p.pdv_id)
    and not exists (
      select 1 from routing_template_exception e
      where e.template_id = r.id and e.pdv_id = p.pdv_id
        and p_date between e.date_debut and e.date_fin
    )
    and not exists (
      select 1
      from routing_pdv rp
      join routings rt on rt.id = rp.routing_id
      where rt.user_id = p_user_id
        and rt.date_routing between v_debut_mois and v_fin_mois
        and rt.status <> 'cancelled'
        and rp.pdv_id = p.pdv_id
    )
    and not exists (
      select 1 from visites v
      where v.user_id = p_user_id
        and v.pdv_id = p.pdv_id
        and v.date_visite >= v_debut_mois
        and v.date_visite < v_fin_mois + 1
    )
  order by p.pdv_id, r.created_at;

  -- Quota par canal, dans l'ordre (portefeuille puis sous-zone).
  for v_q in select q.canal, q.quota from routing_quota_canal q where q.jour_semaine = v_dow loop
    update _candidats c set pris = true
    where c.pdv_id in (
      select c2.pdv_id from _candidats c2
      where c2.canal = v_q.canal and not c2.pris
      order by c2.ordre limit v_q.quota
    );
    v_deficit := v_deficit + v_q.quota - (select count(*) from _candidats c3 where c3.canal = v_q.canal and c3.pris);
  end loop;

  -- Complément en boutiques (NB du client).
  if v_deficit > 0 then
    update _candidats c set pris = true
    where c.pdv_id in (
      select c2.pdv_id from _candidats c2
      where c2.canal = 'Boutique' and not c2.pris
      order by c2.ordre limit v_deficit
    );
  end if;

  return query
    select c.pdv_id, c.ordre, c.canal, c.objectifs
    from _candidats c where c.pris order by c.ordre;
end;
$$;

grant execute on function public.etapes_quota_du_jour(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Planning de la semaine d'un merchandiser (mobile, admin, guides)
-- ---------------------------------------------------------------------------
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
begin
  -- Le merchandiser lit son planning ; admin et superviseur celui de tous ;
  -- service_role / cron (auth.uid() NULL) aussi.
  if auth.uid() is not null and auth.uid() <> p_user_id and not exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')
  ) then
    raise exception 'Accès refusé au planning de cet utilisateur' using errcode = '42501';
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
  'Planning hebdomadaire d''un merchandiser : pour chaque jour (0 = dimanche), la règle, son SSF, son distributeur, sa zone et les quartiers de la sous-zone.';

revoke all on function public.ssf_semaine(uuid) from public, anon;
grant execute on function public.ssf_semaine(uuid) to authenticated, service_role;

commit;
