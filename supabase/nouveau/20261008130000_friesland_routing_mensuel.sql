-- ============================================================================
-- ROUTING MENSUEL DES MERCHANDISERS (fichier de l'agence)
--
-- Réunion client du 08/10/2026 : le SSF (vendeur du distributeur) et le
-- merchandiser (agence) dépendent tous deux du commercial ; aucun ne dirige
-- l'autre. L'agence envoie le « déploiement mensuel des merchandisers par
-- zone et par SSF » (fichier d'Elias, Atom) : pour chaque merchandiser, chaque
-- jour (lundi → samedi) de chaque semaine du mois (1 à 4), un point de visite
-- et, s'il y en a un, le SSF avec qui il travaille ce jour-là.
--
--   1. routing_mensuel : une ligne par case merchandiser × jour × semaine
--      (clé d'import, pas de doublon). SSF facultatif (« Aucun SSF »).
--   2. Règles de tournée : semaines_du_mois (null = toutes) et repli (la
--      règle de portefeuille ne s'applique que les jours où aucune autre
--      règle ne s'applique : 5e semaine, case vide, lieu non reconnu).
--   3. 5e semaine du mois (29 → 31) : paramètre terrain routing_semaine_5
--      (0 = portefeuille seul, 1 = reprendre la semaine 1, 4 = la semaine 4).
--   4. ssf_semaine (app 1.0.12, même signature) lit le routing de la semaine
--      en cours ; routing_semaine (app suivante) y ajoute lieu et cases sans SSF.
--   5. Alias d'import de type « quartier » : point de visite du fichier →
--      quartier(s) des PDV, validé une fois pour toutes.
--
-- Remplissage initial : les règles « SSF — » en place, sur les 4 semaines.
-- Idempotent. Additif (colonnes nullables ou avec défaut neutre).
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Règles de tournée : semaines du mois et règle de repli
-- ---------------------------------------------------------------------------
alter table public.routing_templates
  add column if not exists semaines_du_mois integer[],
  add column if not exists repli boolean not null default false;

alter table public.routing_templates drop constraint if exists routing_templates_semaines_du_mois_check;
alter table public.routing_templates add constraint routing_templates_semaines_du_mois_check
  check (semaines_du_mois is null or semaines_du_mois <@ array[1, 2, 3, 4, 5]);

comment on column public.routing_templates.semaines_du_mois is
  'Semaines du mois où la règle s''applique (1 = jours 1-7, …, 5 = jours 29-31) ; null = toutes. Routing mensuel de l''agence.';
comment on column public.routing_templates.repli is
  'Règle de repli (portefeuille) : ne s''applique que les jours où aucune autre règle du merchandiser ne s''applique.';

-- Semaine du mois d'une date : 1 (jours 1-7) … 5 (jours 29-31).
create or replace function public.semaine_du_mois(p_date date)
returns integer
language sql
immutable
as $$ select ((extract(day from p_date)::int - 1) / 7) + 1 $$;

insert into public.parametre_app (cle, portee, valeur, libelle, description, unite, min, max, ordre) values
  ('routing_semaine_5', 'tous', 0, 'Routing de la 5e semaine du mois',
   'Jours 29 à 31 (5e lundi, 5e mardi…) : 0 = portefeuille seul (quotas) ; 1 = reprendre le routing de la semaine 1 ; 4 = reprendre la semaine 4.', null, 0, 4, 95)
on conflict (cle, portee) do nothing;

-- Semaine du routing mensuel qui s'applique à une date (5e semaine : paramètre).
create or replace function public.semaine_routing(p_date date)
returns integer
language sql
stable
set search_path = public
as $$
  select case
    when semaine_du_mois(p_date) < 5 then semaine_du_mois(p_date)
    else coalesce(nullif(parametre_app_valeur('routing_semaine_5')::int, 0), 5)
  end
$$;

grant execute on function public.semaine_du_mois(date) to authenticated, service_role;
grant execute on function public.semaine_routing(date) to authenticated, service_role;

-- Règles d'un merchandiser pour une date : jours, période, exceptions (comme
-- avant), semaine du mois, puis les règles de repli seulement si aucune autre.
create or replace function public.routing_regles_du_jour(p_user_id uuid, p_date date)
returns setof public.routing_templates
language sql stable
set search_path = public
as $$
  with candidates as (
    select t.*
    from routing_templates t
    where t.user_id = p_user_id
      and coalesce(t.is_active, true)
      -- extract(dow) : 0 = dimanche, même convention que JS getDay().
      and coalesce(t.days_of_week, array[t.day_of_week]) @> array[extract(dow from p_date)::int]
      and (t.date_debut is null or p_date >= t.date_debut)
      and (t.date_fin is null or p_date <= t.date_fin)
      and (t.semaines_du_mois is null or t.semaines_du_mois @> array[semaine_routing(p_date)])
      -- Règle suspendue en entier sur cette date (exception sans pdv_id).
      and not exists (
        select 1 from routing_template_exception e
        where e.template_id = t.id
          and e.pdv_id is null
          and p_date between e.date_debut and e.date_fin
      )
  )
  select c.* from candidates c
  where not coalesce(c.repli, false)
     or not exists (select 1 from candidates d where not coalesce(d.repli, false))
$$;

-- ---------------------------------------------------------------------------
-- 2. Routing mensuel : une case par merchandiser × jour × semaine
-- ---------------------------------------------------------------------------
create table if not exists public.routing_mensuel (
  id              uuid primary key default gen_random_uuid(),
  merchandiser_id uuid not null references public.profiles(id) on delete cascade,
  -- extract(dow) : 1 = lundi … 6 = samedi (0 = dimanche, accepté).
  jour_semaine    smallint not null check (jour_semaine between 0 and 6),
  semaine_du_mois smallint not null check (semaine_du_mois between 1 and 5),
  -- Secteur du fichier (« Yopougon 1 & 2 ») et lieu tel qu'écrit par l'agence.
  secteur         text,
  point_visite    text,
  -- Quartier(s) reconnus dans les PDV : pdv.zone (= territoire.nom) et pdv.quartier.
  zone            text,
  quartiers       text[] not null default '{}',
  -- SSF du jour (null : « Aucun SSF »), son engin (Mini van, Moto, Grossiste…).
  ssf_id          integer references public.ssf(id) on delete set null,
  ssf_texte       text,
  type_engin      text,
  -- Commercial (Sales rep) et distributeur indiqués par l'agence pour cette case.
  commercial_id   uuid references public.profiles(id) on delete set null,
  distributeur    text,
  -- regle-existante | client-<fichier> | admin
  source          text,
  import_lot_id   uuid references public.import_lot(id) on delete set null,
  actif           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint routing_mensuel_cle unique (merchandiser_id, jour_semaine, semaine_du_mois)
);

comment on table public.routing_mensuel is
  'Routing mensuel de l''agence : pour chaque merchandiser, jour et semaine du mois, le point de visite, ses quartiers et le SSF éventuel (binôme sans lien hiérarchique : tous deux dépendent du commercial). Clé d''import : (merchandiser, jour, semaine).';

create index if not exists idx_routing_mensuel_ssf on public.routing_mensuel(ssf_id);
create index if not exists idx_routing_mensuel_jour on public.routing_mensuel(merchandiser_id, jour_semaine, semaine_du_mois) where actif;

drop trigger if exists trg_routing_mensuel_updated_at on public.routing_mensuel;
create trigger trg_routing_mensuel_updated_at
  before update on public.routing_mensuel
  for each row execute function update_routing_updated_at();

alter table public.routing_mensuel enable row level security;

-- Lecture : encadrement, le merchandiser lui-même, son commercial ou celui du SSF.
drop policy if exists routing_mensuel_read on public.routing_mensuel;
create policy routing_mensuel_read on public.routing_mensuel
  for select to authenticated
  using (
    merchandiser_id = auth.uid()
    or public.role_actif_courant() in ('admin', 'superviseur')
    or exists (select 1 from public.profiles m where m.id = merchandiser_id and m.commercial_id = auth.uid())
    or exists (select 1 from public.ssf s where s.id = ssf_id and s.commercial_id = auth.uid())
  );

drop policy if exists routing_mensuel_write on public.routing_mensuel;
create policy routing_mensuel_write on public.routing_mensuel
  for all to authenticated
  using (public.role_actif_courant() in ('admin', 'superviseur'))
  with check (public.role_actif_courant() in ('admin', 'superviseur'));

grant select on public.routing_mensuel to authenticated;
grant insert, update, delete on public.routing_mensuel to authenticated;

-- Remplissage initial : règles « SSF — » actives, sur les 4 semaines.
insert into public.routing_mensuel (merchandiser_id, jour_semaine, semaine_du_mois, zone, quartiers, ssf_id, ssf_texte, source)
select distinct on (t.user_id, j.jour, s.semaine)
  t.user_id, j.jour::smallint, s.semaine::smallint,
  coalesce(v.zone, t.territoire), coalesce(v.quartiers, '{}'), t.ssf_id, v.nom, 'regle-existante'
from public.routing_templates t
join public.v_ssf_sous_zone v on v.ssf_id = t.ssf_id
cross join lateral unnest(coalesce(t.days_of_week, array[t.day_of_week])) as j(jour)
cross join generate_series(1, 4) as s(semaine)
where t.ssf_id is not null
  and coalesce(t.is_active, true)
  and (t.date_fin is null or t.date_fin >= current_date)
  and j.jour between 0 and 6
order by t.user_id, j.jour, s.semaine, t.created_at desc
on conflict (merchandiser_id, jour_semaine, semaine_du_mois) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Planning de la semaine en cours
-- ---------------------------------------------------------------------------
-- Accès commun : le merchandiser, son commercial, admin et superviseur,
-- service_role / cron (auth.uid() NULL).
create or replace function public.peut_lire_routing(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is null
      or auth.uid() = p_user_id
      or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur'))
      or exists (select 1 from profiles m where m.id = p_user_id and m.commercial_id = auth.uid())
$$;

revoke all on function public.peut_lire_routing(uuid) from public, anon;
grant execute on function public.peut_lire_routing(uuid) to authenticated, service_role;

-- Semaine (lundi → samedi) contenant p_date : une ligne par case du routing
-- mensuel qui s'applique ce jour-là, avec ou sans SSF (app suivante, admin).
create or replace function public.routing_semaine(p_user_id uuid, p_date date default current_date)
returns table (
  jour_semaine  integer,
  date_jour     date,
  semaine       integer,
  secteur       text,
  point_visite  text,
  zone          text,
  quartiers     text[],
  ssf_id        integer,
  ssf_nom       text,
  ssf_telephone text,
  distributeur  text,
  type_engin    text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not peut_lire_routing(p_user_id) then
    raise exception 'Accès refusé au planning de cet utilisateur' using errcode = '42501';
  end if;

  return query
    with jours as (
      select (date_trunc('week', p_date)::date + (j - 1)) as d, j as dow
      from generate_series(1, 6) as j
    )
    select
      j.dow, j.d, semaine_routing(j.d),
      r.secteur, r.point_visite, r.zone, r.quartiers,
      r.ssf_id, coalesce(s.nom, r.ssf_texte), s.telephone,
      coalesce(dist.nom, r.distributeur), r.type_engin
    from jours j
    join routing_mensuel r
      on r.merchandiser_id = p_user_id and r.actif
     and r.jour_semaine = j.dow and r.semaine_du_mois = semaine_routing(j.d)
    left join ssf s on s.id = r.ssf_id
    left join distributeur dist on dist.id = s.distributeur_id
    order by j.dow;
end;
$$;

comment on function public.routing_semaine(uuid, date) is
  'Routing de la semaine (lundi → samedi) contenant la date : pour chaque jour, le point de visite, ses quartiers et le SSF éventuel (routing mensuel de l''agence). Un jour absent = portefeuille.';

revoke all on function public.routing_semaine(uuid, date) from public, anon;
grant execute on function public.routing_semaine(uuid, date) to authenticated, service_role;

-- Même signature que 20261007100000 (lu par l'app 1.0.12) : les SSF de la
-- semaine en cours (cases sans SSF exclues : la 1.0.12 attend un SSF par
-- ligne). Sans routing mensuel actif, repli sur les règles « SSF — ».
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
  if not peut_lire_routing(p_user_id) then
    raise exception 'Accès refusé au planning de cet utilisateur' using errcode = '42501';
  end if;

  if exists (select 1 from routing_mensuel r where r.merchandiser_id = p_user_id and r.actif) then
    return query
      select
        rs.jour_semaine,
        regle.id,
        coalesce(regle.label, 'SSF — ' || rs.ssf_nom),
        rs.ssf_id,
        rs.ssf_nom,
        rs.ssf_telephone,
        rs.distributeur,
        rs.zone,
        rs.quartiers
      from routing_semaine(p_user_id, current_date) rs
      left join lateral (
        select t.id, t.label from routing_regles_du_jour(p_user_id, rs.date_jour) t
        where t.ssf_id = rs.ssf_id
        order by t.created_at desc limit 1
      ) regle on true
      where rs.ssf_id is not null;
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
  'SSF de la semaine en cours d''un merchandiser (routing mensuel, sinon règles « SSF — ») : jour (0 = dimanche), règle, SSF, distributeur, zone, quartiers. Lu par l''app 1.0.12.';

revoke all on function public.ssf_semaine(uuid) from public, anon;
grant execute on function public.ssf_semaine(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Journal des imports et alias « quartier »
-- ---------------------------------------------------------------------------
alter table public.import_lot drop constraint if exists import_lot_type_check;
alter table public.import_lot add constraint import_lot_type_check
  check (type in ('dms-pdv', 'merch-dms', 'routing-atom', 'ssf-sous-zones', 'routing-ssf-dms', 'routing-mensuel'));

-- quartier : point de visite du fichier → « ZONE›QUARTIER » (plusieurs séparés par « | »).
alter table public.alias_import drop constraint if exists alias_import_type_check;
alter table public.alias_import add constraint alias_import_type_check
  check (type in ('merchandiser', 'distributeur', 'ssf', 'quartier', 'commercial'));

commit;
