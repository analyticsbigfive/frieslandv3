-- ============================================================================
-- ALIAS DE TERRITOIRE (retour démo du 7 sept. 2026)
--
-- Des profils et des PDV portent des libellés de territoire absents du
-- référentiel `territoire` (« MARCORY TREICHVILLE », « YOPOUGON »,
-- « ATTECOUBE-PLATEAU »…). Plutôt que réécrire 25 000 PDV, on rattache chaque
-- libellé à un territoire réel : le périmètre d'un profil s'étend
-- automatiquement aux alias de ses territoires, et un profil qui porte encore
-- un alias voit aussi le territoire réel.
--
-- Miroir client : utils/territoires.ts (etendreTerritoires).
-- Idempotent. Additif.
-- ============================================================================
begin;

create table if not exists public.territoire_alias (
  alias           text primary key,
  territoire_code text not null references public.territoire(code) on delete cascade,
  created_at      timestamptz not null default now()
);
comment on table public.territoire_alias is 'Libellé de territoire hors référentiel (pdv.zone, profiles.territoires_assignes) rattaché à un territoire réel.';

alter table public.territoire_alias enable row level security;
drop policy if exists territoire_alias_read on public.territoire_alias;
create policy territoire_alias_read on public.territoire_alias for select to authenticated using (true);
drop policy if exists territoire_alias_write on public.territoire_alias;
create policy territoire_alias_write on public.territoire_alias for all to authenticated
  using (est_gestionnaire_perfect_store()) with check (est_gestionnaire_perfect_store());

-- Seed des alias déjà connus des scripts d'harmonisation, seulement si la
-- cible existe.
insert into public.territoire_alias (alias, territoire_code)
select v.alias, v.code from (values
  ('ATTECOUBE-PLATEAU', 'PLA'),
  ('ATTECOUBE', 'PLA'),
  ('PORT-BOUET', 'PRB'),
  ('YOPOUGON', 'YOP 1'),
  ('MARCORY TREICHVILLE', 'MAR')
) as v(alias, code)
where exists (select 1 from public.territoire t where t.code = v.code)
on conflict (alias) do nothing;

-- unaccent n'est pas garanti : repli sans accents via translate.
create or replace function public.unaccent_safe(p text)
returns text language sql immutable as $$
  select translate(coalesce(p, ''), 'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñ', 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn');
$$;

-- Noms de territoires étendus : entrée = noms tels que stockés sur le profil.
create or replace function public.territoires_etendus(p_noms text[])
returns setof text
language sql stable
set search_path = public
as $$
  with entree as (
    select distinct upper(unaccent_safe(n)) as k, n from unnest(coalesce(p_noms, array[]::text[])) n where n <> ''
  ),
  codes as (
    select t.code from public.territoire t join entree e on upper(unaccent_safe(t.nom)) = e.k
    union
    select a.territoire_code from public.territoire_alias a join entree e on upper(unaccent_safe(a.alias)) = e.k
  )
  select n from entree
  union
  select t.nom from public.territoire t join codes c on c.code = t.code
  union
  select upper(t.nom) from public.territoire t join codes c on c.code = t.code
  union
  select a.alias from public.territoire_alias a join codes c on c.code = a.territoire_code;
$$;

-- Périmètre : les fonctions du lot 2/3 passent par territoires_etendus.
create or replace function public.pdv_ids_perimetre()
returns setof text
language sql stable security definer
set search_path = public
rows 2000
as $$
  with moi as (
    select pr.role,
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
    from public.profiles pr where pr.id = auth.uid() and pr.is_active = true
  ),
  terr as (
    select coalesce((select array_agg(x) from public.territoires_etendus(m.territoires) x), array[]::text[]) as noms, m.quartiers, m.territoires
    from moi m
  )
  select p.pdv_id
  from terr t
  join public.pdv p
    on (cardinality(t.territoires) = 0 or p.zone = any(t.noms))
   and (cardinality(t.quartiers) = 0 or p.quartier is null or p.quartier = any(t.quartiers));
$$;

create or replace function public.pdv_dans_perimetre(p_pdv_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_active = true and pr.role in ('admin','superviseur')
  ) or p_pdv_id in (select public.pdv_ids_perimetre());
$$;

create or replace function public.pdv_dans_perimetre_commercial(p_pdv_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.role_actif_courant() = 'commercial' and p_pdv_id in (select public.pdv_ids_perimetre());
$$;

commit;
