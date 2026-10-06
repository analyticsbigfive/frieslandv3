-- ============================================================================
-- TOURNÉES ATOM PAR QUOTAS JOURNALIERS (programme « Bonnet Rouge »)
--
-- Règle client (slide « Objectifs quantitatifs ») : chaque merchandiser Atom
-- visite par jour un nombre fixe de PDV par canal, et chaque PDV UNE fois dans
-- le mois (420 PDV/agent/mois, 10 agents, 4 200 PDV). S'il n'y a pas assez de
-- superettes / aboki / pushcarts / porridges, on complète avec des boutiques.
--
--   Canal           Lun Mar Mer Jeu Ven Sam   /sem
--   Superette        2   2   2   2   1   1     10
--   Boutique        13  13  13  13  11   6     69
--   Aboki & Kiosque  2   2   2   2   1   1     10
--   Pushcart         2   2   2   2   1   1     10
--   Porridge         1   1   1   1   1   1      6
--   Total           20  20  20  20  15  10    105
--
-- CE QUI NE CHANGE PAS : la règle reste `routing_templates` + son portefeuille
-- `routing_template_pdv` (= clients DMS du merchandiser), la tournée reste
-- matérialisée dans `routings` / `routing_pdv`, l'app mobile ne change pas.
--
-- CE QUI CHANGE : une règle en `mode = 'quota'` ne verse plus tout son
-- portefeuille dans la tournée du jour. `materialiser_routing_jour` y pioche,
-- par canal, les premiers PDV non encore planifiés ni visités dans le mois
-- civil, dans l'ordre du portefeuille (déjà trié par proximité). Le 1er du
-- mois, tout le portefeuille redevient éligible.
--
-- Pré-génération : un job pg_cron matérialise chaque nuit J → J+7 pour tous les
-- merchandisers actifs, pour que l'app ouverte sans réseau trouve sa tournée.
--
-- Idempotent. Les règles existantes restent en `mode = 'perimetre'`.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Mode de la règle
-- ---------------------------------------------------------------------------
alter table public.routing_templates add column if not exists mode text not null default 'perimetre';
alter table public.routing_templates drop constraint if exists routing_templates_mode_check;
alter table public.routing_templates add constraint routing_templates_mode_check
  check (mode in ('perimetre', 'quota'));

comment on column public.routing_templates.mode is
  'perimetre = tout le portefeuille chaque jour d''application (Friesland) ; quota = N PDV par canal et par jour, chaque PDV une fois par mois civil (Atom).';

-- Les règles « Portefeuille DMS » des comptes Atom passent en mode quota.
update public.routing_templates t
set mode = 'quota'
from public.profiles p
where p.id = t.user_id
  and p.employeur = 'atom'
  and t.label like 'Portefeuille DMS%'
  and t.mode <> 'quota';

-- ---------------------------------------------------------------------------
-- 2. Grille de quotas (modifiable par l'admin, Référentiels › Quotas Atom)
-- ---------------------------------------------------------------------------
create table if not exists public.routing_quota_canal (
  canal        text not null,
  -- 0 = dimanche … 6 = samedi (convention extract(dow) / JS getDay()).
  jour_semaine integer not null check (jour_semaine between 0 and 6),
  quota        integer not null check (quota >= 0),
  updated_at   timestamptz not null default now(),
  primary key (canal, jour_semaine)
);

comment on table public.routing_quota_canal is
  'Quota journalier de PDV par canal Atom et jour de semaine (tournées en mode quota). Un canal absent un jour = 0.';

insert into public.routing_quota_canal (canal, jour_semaine, quota)
select c.canal, j.jour, c.q[j.i]
from (values
  ('Superette',        array[2, 2, 2, 2, 1, 1]),
  ('Boutique',         array[13, 13, 13, 13, 11, 6]),
  ('Aboki & Kiosque',  array[2, 2, 2, 2, 1, 1]),
  ('Pushcart',         array[2, 2, 2, 2, 1, 1]),
  ('Porridge',         array[1, 1, 1, 1, 1, 1])
) as c(canal, q)
cross join (values (1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 6)) as j(jour, i)
on conflict (canal, jour_semaine) do nothing;

alter table public.routing_quota_canal enable row level security;
drop policy if exists routing_quota_canal_read on public.routing_quota_canal;
create policy routing_quota_canal_read on public.routing_quota_canal
  for select to authenticated using (true);
drop policy if exists routing_quota_canal_write on public.routing_quota_canal;
create policy routing_quota_canal_write on public.routing_quota_canal
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')));
grant select, insert, update, delete on public.routing_quota_canal to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Canal Atom d'un PDV, d'après sa sous-catégorie
-- ---------------------------------------------------------------------------
-- Les sous-catégories du référentiel (Boutique A/B/C, Superettes A/B/C,
-- Kiosk A/B, Pushcard A/B, Porridge, Table Top…) et les libellés historiques
-- (Superette GT, Kiosque, Pushcart) sont ramenés aux 5 canaux de la grille.
-- Grossistes, supermarchés, pharmacies, boulangeries : NULL, hors quota.
create or replace function public.canal_atom(p_sous_categorie text)
returns text
language sql
immutable
as $$
  select case
    when p_sous_categorie is null then null
    when upper(p_sous_categorie) ~ 'PORRIDGE' then 'Porridge'
    when upper(p_sous_categorie) ~ 'PUSHCAR' then 'Pushcart'
    when upper(p_sous_categorie) ~ 'ABOKI|KIOS|TABLE TOP|TABLIER' then 'Aboki & Kiosque'
    when upper(p_sous_categorie) ~ 'SUPERETTE|MINIMARKET' then 'Superette'
    when upper(p_sous_categorie) ~ 'BOUTIQUE' then 'Boutique'
    else null
  end
$$;

comment on function public.canal_atom(text) is
  'Canal de la grille de quotas Atom (Superette, Boutique, Aboki & Kiosque, Pushcart, Porridge) pour une sous-catégorie PDV ; NULL = hors quota.';

grant execute on function public.canal_atom(text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 4. Étapes d'une règle en mode quota pour un jour donné
-- ---------------------------------------------------------------------------
/**
 * PDV à visiter ce jour pour les règles « quota » d'un merchandiser.
 *
 * Candidats : PDV des règles quota du jour, non exclus par exception, dont le
 * canal est dans la grille, et NI planifiés dans une tournée du mois civil
 * (toute date, y compris à venir : la pré-génération J+7 « réserve » ses PDV)
 * NI déjà visités dans le mois (visites de l'app et visites importées).
 *
 * Par canal : les `quota(canal, jour)` premiers dans l'ordre du portefeuille.
 * Déficit (pas assez de PDV d'un canal) : complété par des boutiques, comme
 * le demande le client. Déficit global : tournée plus courte, sans erreur.
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

  -- Quota par canal, dans l'ordre du portefeuille.
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
-- 5. Matérialisation : règles périmètre en entier + règles quota piochées
-- ---------------------------------------------------------------------------
create or replace function public.materialiser_routing_jour(p_user_id uuid, p_date date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_routing_id uuid;
  v_template_id uuid;
  v_nb integer;
begin
  -- Un merchandiser ne matérialise que ses tournées ; l'admin / superviseur
  -- celles de tout le monde ; le cron (auth.uid() NULL) aussi.
  if auth.uid() is not null and auth.uid() <> p_user_id and not exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')
  ) then
    raise exception 'materialiser_routing_jour : accès refusé';
  end if;

  select id into v_routing_id
  from routings
  where user_id = p_user_id and date_routing = p_date
  limit 1;

  -- IDEMPOTENTE : une tournée existante est rendue telle quelle, jamais
  -- recalculée (l'app appelle cette fonction à chaque ouverture).
  if v_routing_id is not null then
    return v_routing_id;
  end if;

  create temp table if not exists _etapes_jour (
    pdv_id text, ordre integer, objectifs jsonb, template_id uuid
  ) on commit drop;
  truncate _etapes_jour;

  -- Règles périmètre : tout le portefeuille, exceptions PDV retirées.
  insert into _etapes_jour (pdv_id, ordre, objectifs, template_id)
  select
    tp.pdv_id,
    row_number() over (order by r.created_at, tp.position_order)::int,
    coalesce(tp.objectifs, '{}'::jsonb),
    r.id
  from routing_regles_du_jour(p_user_id, p_date) r
  join routing_template_pdv tp on tp.template_id = r.id
  where r.mode = 'perimetre'
    and not exists (
      select 1 from routing_template_exception e
      where e.template_id = r.id and e.pdv_id = tp.pdv_id
        and p_date between e.date_debut and e.date_fin
    );

  -- Règles quota : sélection du jour.
  if exists (select 1 from routing_regles_du_jour(p_user_id, p_date) r where r.mode = 'quota') then
    insert into _etapes_jour (pdv_id, ordre, objectifs, template_id)
    select q.pdv_id, 100000 + q.ordre, q.objectifs,
      (select r.id from routing_regles_du_jour(p_user_id, p_date) r where r.mode = 'quota' order by r.created_at limit 1)
    from etapes_quota_du_jour(p_user_id, p_date) q;
  end if;

  select count(distinct e.pdv_id), min(e.template_id::text)::uuid
  into v_nb, v_template_id
  from _etapes_jour e;

  -- Aucune étape : pas de tournée vide.
  if coalesce(v_nb, 0) = 0 then
    return null;
  end if;

  insert into routings(user_id, date_routing, status, source, template_id, created_by)
  values (p_user_id, p_date, 'pending', 'regle', v_template_id, p_user_id)
  returning id into v_routing_id;

  -- distinct on (pdv_id) : un même PDV dans deux règles ne donne qu'une étape.
  insert into routing_pdv(routing_id, pdv_id, position_order, objectifs, status)
  select v_routing_id, e.pdv_id, row_number() over (order by e.ordre), e.objectifs, 'pending'
  from (
    select distinct on (x.pdv_id) x.pdv_id, x.objectifs, x.ordre
    from _etapes_jour x
    order by x.pdv_id, x.ordre
  ) e;

  return v_routing_id;
end;
$$;

revoke execute on function public.materialiser_routing_jour(uuid, date) from public, anon;
grant execute on function public.materialiser_routing_jour(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Pré-génération nocturne J → J+7 (pg_cron, déjà installé pour les stats)
-- ---------------------------------------------------------------------------
create or replace function public.pregenerer_tournees(p_jours integer default 7)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_user record;
begin
  -- Lancée par pg_cron (propriétaire, auth.uid() NULL) ou par un admin depuis
  -- l'éditeur SQL / l'admin. Jamais par un merchandiser : la matérialisation
  -- de tout le parc est coûteuse.
  if auth.uid() is not null and not exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')
  ) then
    raise exception 'pregenerer_tournees : réservé aux administrateurs';
  end if;
  p_jours := least(greatest(coalesce(p_jours, 7), 0), 31);

  for v_user in
    select p.id from profiles p
    where p.role = 'merchandiser' and coalesce(p.is_active, true)
  loop
    begin
      v_total := v_total + coalesce(
        materialiser_routings_periode(v_user.id, current_date, current_date + p_jours), 0);
    exception when others then
      raise warning 'pregenerer_tournees % : %', v_user.id, sqlerrm;
    end;
  end loop;
  return v_total;
end;
$$;

revoke execute on function public.pregenerer_tournees(integer) from public, anon;
grant execute on function public.pregenerer_tournees(integer) to authenticated; -- garde admin/superviseur dans la fonction

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'pregenerer_tournees';
    -- 03:00 UTC = 03:00 Abidjan, avant l'arrivée des merchandisers sur le terrain.
    perform cron.schedule('pregenerer_tournees', '0 3 * * *', 'select public.pregenerer_tournees(7)');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Suivi du programme Atom (admin)
-- ---------------------------------------------------------------------------
-- Par merchandiser Atom et par mois : portefeuille, PDV planifiés, visités,
-- en perfect store (niveau du dernier calcul), reste à planifier. Lecture seule.
-- security_invoker : la RLS de profiles / routings / visites s'applique au
-- lecteur (un merchandiser ne voit que ses lignes, l'admin voit tout).
drop view if exists public.v_programme_atom;
create view public.v_programme_atom with (security_invoker = true) as
with regles as (
  select t.user_id, t.id as template_id
  from routing_templates t
  join profiles p on p.id = t.user_id
  where p.employeur = 'atom' and t.mode = 'quota' and coalesce(t.is_active, true)
),
mois as (
  select date_trunc('month', current_date)::date as debut,
         (date_trunc('month', current_date) + interval '1 month - 1 day')::date as fin
),
portefeuille as (
  select r.user_id, count(distinct tp.pdv_id) as nb_portefeuille,
         count(distinct tp.pdv_id) filter (where canal_atom(p.sous_categorie_pdv) is not null) as nb_eligibles
  from regles r
  join routing_template_pdv tp on tp.template_id = r.template_id
  join pdv p on p.pdv_id = tp.pdv_id
  group by r.user_id
),
planifies as (
  select rt.user_id, count(distinct rp.pdv_id) as nb_planifies
  from routings rt
  join routing_pdv rp on rp.routing_id = rt.id
  cross join mois m
  where rt.date_routing between m.debut and m.fin and rt.status <> 'cancelled'
  group by rt.user_id
),
visitees as (
  select v.user_id,
         count(distinct v.pdv_id) as nb_visites,
         count(distinct v.pdv_id) filter (where rps.niveau is not null and rps.niveau <> 'aucun') as nb_perfect_store
  from visites v
  cross join mois m
  left join resultat_perfect_store rps on rps.visite_id = v.id
  where v.date_visite >= m.debut and v.date_visite < m.fin + 1
  group by v.user_id
)
select
  p.id as user_id,
  p.nom,
  p.email,
  m.debut as mois,
  coalesce(pf.nb_portefeuille, 0) as nb_portefeuille,
  coalesce(pf.nb_eligibles, 0)    as nb_eligibles,
  coalesce(pl.nb_planifies, 0)    as nb_planifies,
  coalesce(vi.nb_visites, 0)      as nb_visites,
  coalesce(vi.nb_perfect_store, 0) as nb_perfect_store,
  420 as objectif_mensuel,
  greatest(420 - coalesce(vi.nb_visites, 0), 0) as reste_a_visiter
from profiles p
cross join mois m
left join portefeuille pf on pf.user_id = p.id
left join planifies pl on pl.user_id = p.id
left join visitees vi on vi.user_id = p.id
where p.employeur = 'atom' and p.role = 'merchandiser' and coalesce(p.is_active, true)
order by p.nom;

grant select on public.v_programme_atom to authenticated;

commit;
