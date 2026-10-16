-- ============================================================================
-- PDV DE SA TOURNÉE TOUJOURS LISIBLES (16/10/2026)
-- APPLIQUÉE EN PRODUCTION le 16/10/2026 (MCP, apply_migration). Contrôle en
-- se connectant comme chaque merch Atom, sur les 7 prochains jours : étapes
-- affichées en code 460 → 0 (GUI STEPHANE 187 → 0 sur 234). GUI STEPHANE lit
-- 1 734 PDV sur 45 887 (secteur 393 + tournée 1 685), pas tout le parc.
--
-- Constat du 16/10 : après la réaffectation des merchandisers Atom (profils
-- modifiés entre 16:14 et 16:35), l'app affichait des PDV par leur code au lieu
-- de leur nom (ex. KOUAME HELLARION, GUI STEPHANE : 187 étapes sur 234).
-- Les étapes de tournée (routing_pdv) viennent des règles et restent lisibles ;
-- le PDV, lui, passe par pdv_select_perimetre → pdv_ids_perimetre(), limité aux
-- territoires et quartiers du profil. Une étape hors de ce secteur revenait
-- donc avec pdv = null, et l'écran retombait sur pdv_id.
--
-- AJOUT SEULEMENT : pdv_ids_perimetre() et les politiques existantes ne
-- changent pas. Une politique de lecture de plus (permissive, donc en OU) ouvre
-- les PDV que l'utilisateur doit voir pour travailler :
--   - les étapes de ses tournées (60 derniers jours et à venir) ;
--   - les PDV de ses règles actives ;
--   - ses visites des 60 derniers jours (historique, calendrier) ;
--   - pour un commercial, les mêmes PDV pour son équipe (merch_ids_commercial(),
--     20261010150000), dont il lit déjà les tournées.
-- Même principe que pdv_ids_agence() (20261010100000). Lecture seule.
-- Index utilisés : routings (user_id, date_routing), routing_pdv (routing_id),
-- routing_templates (user_id), routing_template_pdv (template_id),
-- visites (user_id). Idempotent.
-- ============================================================================
begin;

create or replace function public.pdv_ids_tournee()
 returns setof text
 language sql
 stable security definer rows 500
 set search_path to 'public'
as $function$
  with equipe as materialized (
    -- Soi-même (compte actif) + son équipe si commercial.
    select pr.id from public.profiles pr
    where pr.id = auth.uid() and pr.is_active = true
    union
    select m from public.merch_ids_commercial() m
  )
  select rp.pdv_id
  from equipe e
  join public.routings r on r.user_id = e.id and r.date_routing >= current_date - 60
  join public.routing_pdv rp on rp.routing_id = r.id
  union
  select tp.pdv_id
  from equipe e
  join public.routing_templates t on t.user_id = e.id and t.is_active
  join public.routing_template_pdv tp on tp.template_id = t.id
  union
  select v.pdv_id
  from equipe e
  join public.visites v on v.user_id = e.id and v.date_visite >= current_date - 60
  where v.pdv_id is not null
$function$;

revoke all on function public.pdv_ids_tournee() from public, anon;
grant execute on function public.pdv_ids_tournee() to authenticated;

drop policy if exists pdv_select_tournee on public.pdv;
create policy pdv_select_tournee on public.pdv
  for select to authenticated
  using (pdv_id in (select public.pdv_ids_tournee()));

commit;
