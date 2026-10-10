-- ============================================================================
-- COMMERCIAL : LECTURE DES TOURNÉES DE SON ÉQUIPE (10/10/2026)
-- APPLIQUÉE EN PRODUCTION le 10/10/2026 (MCP, apply_migration). Contrôle :
-- le commercial le plus suivi (4 merchandisers) lit 34 tournées, 26 règles et
-- 21 905 étapes, exactement celles de son équipe.
--
-- Décision du 10/10 : le commercial consulte Planning › Tournées et Règles
-- récurrentes, sans rien modifier. Jusqu'ici il ne lisait que ses propres
-- tournées (user_id = auth.uid()), donc une page vide.
--
-- Son équipe = les merchandisers dont profiles.commercial_id est le sien
-- (17 merchandisers rattachés à 10 commerciaux au 10/10). Mêmes politiques
-- que pour l'agence (20261010100000), en SELECT seulement : l'écriture reste
-- à l'admin et au superviseur. Rien ne change pour les autres rôles.
-- Idempotent.
-- ============================================================================
begin;

create or replace function public.merch_ids_commercial()
 returns setof uuid
 language sql
 stable security definer rows 20
 set search_path to 'public'
as $function$
  select m.id from public.profiles m
  where m.role = 'merchandiser' and m.commercial_id = auth.uid()
$function$;

revoke all on function public.merch_ids_commercial() from public, anon;
grant execute on function public.merch_ids_commercial() to authenticated;

drop policy if exists routings_select_commercial on public.routings;
create policy routings_select_commercial on public.routings
  for select to authenticated
  using (user_id in (select public.merch_ids_commercial()));

drop policy if exists routing_pdv_select_commercial on public.routing_pdv;
create policy routing_pdv_select_commercial on public.routing_pdv
  for select to authenticated
  using (routing_id in (
    select r.id from public.routings r
    where r.user_id in (select public.merch_ids_commercial())
  ));

drop policy if exists routing_templates_select_commercial on public.routing_templates;
create policy routing_templates_select_commercial on public.routing_templates
  for select to authenticated
  using (user_id in (select public.merch_ids_commercial()));

drop policy if exists routing_template_pdv_select_commercial on public.routing_template_pdv;
create policy routing_template_pdv_select_commercial on public.routing_template_pdv
  for select to authenticated
  using (template_id in (
    select t.id from public.routing_templates t
    where t.user_id in (select public.merch_ids_commercial())
  ));

commit;
