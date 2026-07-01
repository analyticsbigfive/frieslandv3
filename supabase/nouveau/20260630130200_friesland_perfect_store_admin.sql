-- ============================================================================
-- Migration 8/N : ADMINISTRATION PERFECT STORE + SÉCURITÉ PAR RÔLE
-- - lecture des référentiels : utilisateurs authentifiés ;
-- - modification des paramètres : admin et superviseur uniquement ;
-- - recalcul global : admin et superviseur uniquement ;
-- - section Perfect Store intégrée à la matrice RBAC du dashboard.
-- Dépend de 120300, 120500, 130000 et 130100.
-- ============================================================================
begin;

create or replace function public.est_gestionnaire_perfect_store()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin','superviseur')
      and is_active = true
  );
$$;

revoke all on function public.est_gestionnaire_perfect_store() from public;
grant execute on function public.est_gestionnaire_perfect_store() to authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'categorie_produit',
    'reference_produit',
    'poids_reference',
    'seuil_disponibilite',
    'standard_assortiment',
    'correspondance_reference',
    'segment_grade_type_pdv',
    'niveau_perfect_store',
    'element_visibilite',
    'standard_visibilite',
    'segment_visibilite_type_pdv'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);

    execute format(
      'drop policy if exists %I on public.%I',
      v_table || '_authenticated_read',
      v_table
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      v_table || '_authenticated_read',
      v_table
    );

    execute format(
      'drop policy if exists %I on public.%I',
      v_table || '_manager_write',
      v_table
    );
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using (public.est_gestionnaire_perfect_store()) '
      || 'with check (public.est_gestionnaire_perfect_store())',
      v_table || '_manager_write',
      v_table
    );
  end loop;
end $$;

create table if not exists public.role_section_access (
  role text not null,
  section text not null,
  can_access boolean not null default false,
  updated_at timestamptz default now(),
  primary key (role, section)
);

alter table public.role_section_access enable row level security;

drop policy if exists rsa_read on public.role_section_access;
create policy rsa_read on public.role_section_access
  for select to authenticated using (true);

drop policy if exists rsa_admin_write on public.role_section_access;
create policy rsa_admin_write on public.role_section_access
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin' and is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin' and is_active = true
    )
  );

insert into public.role_section_access(role,section,can_access) values
  ('admin','principal',true),('admin','perfect-store',true),('admin','pdv',true),
  ('admin','visites',true),('admin','visibilite',true),('admin','concurrence',true),
  ('admin','produits',true),('admin','actions',true),('admin','administration',true),
  ('superviseur','principal',true),('superviseur','perfect-store',true),('superviseur','pdv',true),
  ('superviseur','visites',true),('superviseur','visibilite',true),('superviseur','concurrence',true),
  ('superviseur','produits',true),('superviseur','actions',true),('superviseur','administration',false),
  ('merchandiser','principal',false),('merchandiser','perfect-store',false),('merchandiser','pdv',false),
  ('merchandiser','visites',false),('merchandiser','visibilite',false),('merchandiser','concurrence',false),
  ('merchandiser','produits',false),('merchandiser','actions',false),('merchandiser','administration',false),
  ('commercial','principal',false),('commercial','perfect-store',false),('commercial','pdv',false),
  ('commercial','visites',false),('commercial','visibilite',false),('commercial','concurrence',false),
  ('commercial','produits',false),('commercial','actions',false),('commercial','administration',false)
on conflict (role,section) do nothing;

create or replace function public.recalculer_tous_perfect_store(
  p_base_calcul text default 'taux_vente'
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  if p_base_calcul not in ('taux_vente','taux_revu') then
    raise exception 'Base de calcul invalide : %', p_base_calcul;
  end if;

  if not public.est_gestionnaire_perfect_store() then
    raise exception 'Permission refusée : rôle admin ou superviseur requis'
      using errcode = '42501';
  end if;

  select count(*) into v_count from public.visites;
  perform public.calculer_perfect_store(id,p_base_calcul)
  from public.visites;

  return v_count;
end;
$$;

revoke all on function public.recalculer_tous_perfect_store(text) from public;
grant execute on function public.recalculer_tous_perfect_store(text) to authenticated;

commit;
