-- ============================================================================
-- LOT 2.6 (1.0.4) : RATTRAPAGE DE SCHÉMA — colonnes lues par l'app mais
-- jamais créées par une migration du dépôt.
--
-- profiles.territoires_assignes  lu par stores/auth.ts, stores/pdv.ts,
--                                stores/routing.ts, types/index.ts
-- profiles.quartiers_assignes    renommée par 20260716230000 (depuis
--                                secteurs_assignes) mais jamais créée
-- pdv.territory_code, pdv.area_code  remplies par le trigger
--                                pdv_link_referentiels (20260716230000)
--
-- Types constatés en production le 7 sept. 2026 (OpenAPI PostgREST) :
-- territoires_assignes jsonb, quartiers_assignes jsonb, territory_code text,
-- area_code text. Cette migration est un no-op en prod ; elle rend la base
-- reproductible depuis `supabase/`.
--
-- Idempotent. Additif.
-- ============================================================================
begin;

alter table public.profiles add column if not exists territoires_assignes jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists quartiers_assignes jsonb not null default '[]'::jsonb;

alter table public.pdv add column if not exists territory_code text;
alter table public.pdv add column if not exists area_code text;

create index if not exists idx_pdv_territory_code on public.pdv (territory_code);
create index if not exists idx_pdv_area_code on public.pdv (area_code);

comment on column public.profiles.territoires_assignes is 'Territoires (pdv.zone) du périmètre, tableau JSON de textes. Vide = repli sur zone_assignee.';
comment on column public.profiles.quartiers_assignes is 'Quartiers (pdv.quartier) du périmètre, tableau JSON de textes. Vide = pas de contrainte quartier.';

commit;
