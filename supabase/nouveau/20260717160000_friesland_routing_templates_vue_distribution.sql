-- ============================================================================
-- Restaure deux objets backend absents du schéma courant (system B) mais dont
-- le FRONT dépend déjà — provoquaient des 404 au chargement :
--   1. Vue v_distribution_pdv (répartition PDV par type) — lue par
--      stores/visites.ts fetchStats (avait un fallback, mais 404 bruité).
--   2. Tables routing_templates / routing_template_pdv (tournées récurrentes
--      hebdomadaires) — l'onglet « Templates » de /admin/routing et
--      stores/routing.ts (fetchTemplates/createTemplate/…) les attendent.
--      Repris de supabase/_archive/009_routing_templates.sql (jamais migré en B).
-- Compatible schéma B : profiles, pdv, update_routing_updated_at() existent.
-- Idempotent.
-- ============================================================================
begin;

-- 1. Vue répartition PDV par type (source: pdv actifs).
create or replace view public.v_distribution_pdv as
select
  coalesce(sous_categorie_pdv, 'Autre') as type,
  count(*) as count
from public.pdv
where is_active = true
group by coalesce(sous_categorie_pdv, 'Autre')
order by count desc;

-- 2. Templates de tournée récurrents (planning hebdomadaire permanent).
create table if not exists public.routing_templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  label text,
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, day_of_week)
);

create table if not exists public.routing_template_pdv (
  id uuid default gen_random_uuid() primary key,
  template_id uuid not null references public.routing_templates(id) on delete cascade,
  pdv_id text not null references public.pdv(pdv_id) on delete cascade,
  position_order integer not null,
  objectifs jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (template_id, pdv_id)
);

create index if not exists idx_routing_templates_user on public.routing_templates(user_id);
create index if not exists idx_routing_templates_day on public.routing_templates(day_of_week);
create index if not exists idx_routing_templates_active on public.routing_templates(is_active);
create index if not exists idx_routing_template_pdv_template on public.routing_template_pdv(template_id);
create index if not exists idx_routing_template_pdv_pdv on public.routing_template_pdv(pdv_id);

drop trigger if exists trg_routing_templates_updated_at on public.routing_templates;
create trigger trg_routing_templates_updated_at
  before update on public.routing_templates
  for each row execute function update_routing_updated_at();

drop trigger if exists trg_routing_template_pdv_updated_at on public.routing_template_pdv;
create trigger trg_routing_template_pdv_updated_at
  before update on public.routing_template_pdv
  for each row execute function update_routing_updated_at();

alter table public.routing_templates enable row level security;
alter table public.routing_template_pdv enable row level security;

drop policy if exists routing_templates_admin_policy on public.routing_templates;
create policy routing_templates_admin_policy on public.routing_templates
  for all using (
    exists (select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('admin', 'superviseur')));

drop policy if exists routing_templates_user_read on public.routing_templates;
create policy routing_templates_user_read on public.routing_templates
  for select using (user_id = auth.uid());

drop policy if exists routing_template_pdv_admin_policy on public.routing_template_pdv;
create policy routing_template_pdv_admin_policy on public.routing_template_pdv
  for all using (
    exists (select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('admin', 'superviseur')));

drop policy if exists routing_template_pdv_user_read on public.routing_template_pdv;
create policy routing_template_pdv_user_read on public.routing_template_pdv
  for select using (
    exists (select 1 from public.routing_templates
      where routing_templates.id = routing_template_pdv.template_id
        and routing_templates.user_id = auth.uid()));

commit;
