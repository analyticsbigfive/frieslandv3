-- ============================================================================
-- FIELD COACHING : vendeur = SSF, coaching Modern Trade, objectif
--
-- Réunion client du 08/10/2026 :
--   - le vendeur coaché en General Trade est un SSF (vendeur du distributeur) :
--     on le relie au référentiel `ssf` (la saisie libre vendeur_nom reste) ;
--   - en Modern Trade, le commercial suit un MERCHANDISER, avec les standards
--     d'exécution MT (part linéaire, visibilité…) qui seront fournis par le
--     client : on crée la structure (type de coaching, merchandiser suivi,
--     grille de critères vide) sans inventer de critère ;
--   - un objectif de field coaching sera fixé : liste vide, à remplir dans
--     Référentiels › Field coaching.
--
-- La grille GT reste celle de utils/fieldCoaching.ts (13 questions).
--
-- Idempotent. Additif : colonnes nullables ou avec défaut (app 1.0.12 inchangée).
-- ============================================================================
begin;

alter table public.field_coaching
  add column if not exists type_coaching text not null default 'gt',
  add column if not exists merchandiser_id uuid references public.profiles(id) on delete set null,
  add column if not exists ssf_id integer references public.ssf(id) on delete set null,
  add column if not exists objectif_code text;

alter table public.field_coaching drop constraint if exists field_coaching_type_coaching_check;
alter table public.field_coaching add constraint field_coaching_type_coaching_check
  check (type_coaching in ('gt', 'mt'));

comment on column public.field_coaching.type_coaching is 'gt = coaching d''un vendeur (SSF) en General Trade ; mt = coaching d''un merchandiser en Modern Trade.';
comment on column public.field_coaching.merchandiser_id is 'Coaching MT : merchandiser suivi par le commercial.';
comment on column public.field_coaching.ssf_id is 'Coaching GT : SSF (vendeur du distributeur) coaché. vendeur_nom garde la saisie libre.';
comment on column public.field_coaching.objectif_code is 'Objectif du coaching (coaching_objectif.code).';

create index if not exists idx_field_coaching_ssf on public.field_coaching(ssf_id);
create index if not exists idx_field_coaching_type on public.field_coaching(type_coaching);

-- ---------------------------------------------------------------------------
-- Objectifs de coaching (valeurs fournies plus tard par le client)
-- ---------------------------------------------------------------------------
create table if not exists public.coaching_objectif (
  code        text primary key check (code ~ '^[a-z0-9_-]{1,60}$'),
  libelle     text not null,
  description text,
  -- null = GT et MT
  type_coaching text check (type_coaching in ('gt', 'mt')),
  ordre       integer not null default 100,
  actif       boolean not null default true,
  updated_at  timestamptz not null default now()
);

comment on table public.coaching_objectif is
  'Objectifs proposés dans le formulaire de field coaching. Vide à la création : valeurs fournies par le client.';

-- ---------------------------------------------------------------------------
-- Critères d'évaluation par grille (MT d'abord ; GT reste dans le code)
-- ---------------------------------------------------------------------------
create table if not exists public.coaching_critere (
  id        serial primary key,
  grille    text not null check (grille in ('gt', 'mt')),
  bloc      text not null,
  code      text not null check (code ~ '^[A-Za-z0-9_.-]{1,60}$'),
  libelle   text not null,
  aide      text,
  ordre     integer not null default 100,
  actif     boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (grille, code)
);

comment on table public.coaching_critere is
  'Critères d''une grille de field coaching. Grille MT (standards d''exécution Modern Trade) à remplir quand le client les fournit ; tant qu''elle est vide, le coaching MT n''est pas proposé.';

do $$
declare t text;
begin
  foreach t in array array['coaching_objectif', 'coaching_critere'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format($p$create policy %I on public.%I for all to authenticated
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.is_active, true)))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.is_active, true)))$p$,
      t || '_write', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function update_routing_updated_at()', 'trg_' || t || '_updated_at', t);
  end loop;
end $$;

grant usage, select on sequence public.coaching_critere_id_seq to authenticated;

alter table public.field_coaching drop constraint if exists field_coaching_objectif_fkey;
alter table public.field_coaching add constraint field_coaching_objectif_fkey
  foreign key (objectif_code) references public.coaching_objectif(code) on update cascade on delete set null;

-- ---------------------------------------------------------------------------
-- Remplissage : SSF des coachings déjà saisis, quand le nom du vendeur
-- correspond à un seul SSF du même distributeur.
-- ---------------------------------------------------------------------------
with candidats as (
  select fc.id as coaching_id, s.id as ssf_id
  from public.field_coaching fc
  join public.ssf s
    on upper(unaccent_safe(trim(s.nom))) = upper(unaccent_safe(trim(fc.vendeur_nom)))
  left join public.distributeur d on d.id = s.distributeur_id
  where fc.ssf_id is null
    and coalesce(trim(fc.vendeur_nom), '') <> ''
    and (fc.distributeur_nom is null or d.nom is null or upper(d.nom) = upper(fc.distributeur_nom))
),
uniques as (
  select coaching_id, min(ssf_id) as ssf_id from candidats group by coaching_id having count(*) = 1
)
update public.field_coaching fc set ssf_id = u.ssf_id
from uniques u where fc.id = u.coaching_id;

commit;
