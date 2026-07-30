-- ============================================================================
-- MARQUES CONCURRENTES EN RÉFÉRENTIEL (réunion 23/07, tâche 5)
--
-- Les marques suivies (Cowmilk, Nido, Laity, Top Lait, Top Saho, Candia…)
-- étaient codées en dur dans le formulaire mobile ET dans le dashboard
-- concurrence. Le client veut pouvoir en ajouter depuis les paramètres, sans
-- redéploiement : elles deviennent un référentiel, géré dans l'admin comme
-- les autres (onglet Référentiels).
--
-- `code` est la clé sous laquelle le statut de la marque est écrit dans
-- visites.data.concurrence.<famille>.<code>. Il est figé à la création : en
-- changer orphelinerait tous les relevés déjà collectés sous l'ancienne clé.
-- Désactiver une marque (actif = false) la retire des formulaires sans perdre
-- l'historique.
--
-- Idempotent. Additif. Le seed reprend exactement les marques historiques du
-- formulaire, sous leurs clés JSONB existantes.
-- ============================================================================
begin;

create table if not exists marque_concurrente (
  id uuid primary key default gen_random_uuid(),
  famille text not null check (famille in ('evap', 'imp', 'scm', 'uht')),
  -- Clé JSONB du statut dans les visites. Unique par famille : la même marque
  -- peut exister dans deux familles (Nido en EVAP 150g et en IMP).
  code text not null,
  nom text not null,
  actif boolean not null default true,
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  unique (famille, code)
);

comment on table marque_concurrente is
  'Référentiel des marques concurrentes suivies dans le relevé de visite. Gérées depuis l''admin (Référentiels), plus codées en dur.';
comment on column marque_concurrente.code is
  'Clé du statut dans visites.data.concurrence.<famille>.<code>. Figée à la création — en changer orphelinerait les relevés existants.';

alter table marque_concurrente enable row level security;
drop policy if exists marque_concurrente_read on marque_concurrente;
create policy marque_concurrente_read on marque_concurrente
  for select to authenticated using (true);
drop policy if exists marque_concurrente_write on marque_concurrente;
create policy marque_concurrente_write on marque_concurrente
  for all to authenticated using (true) with check (true);

insert into marque_concurrente (famille, code, nom, ordre) values
  ('evap', 'cowmilk',   'Cowmilk',   1),
  ('evap', 'nido_150g', 'NIDO 150g', 2),
  ('imp',  'nido',      'Nido',      1),
  ('imp',  'laity',     'Laity',     2),
  ('imp',  'top_lait',  'Top Lait',  3),
  ('scm',  'top_saho',  'Top Saho',  1),
  ('uht',  'candia',    'Candia',    1)
on conflict (famille, code) do nothing;

commit;
