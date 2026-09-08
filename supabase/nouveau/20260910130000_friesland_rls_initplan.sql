-- ============================================================================
-- RLS : PRÉDICATS DE RÔLE ÉVALUÉS UNE FOIS PAR REQUÊTE (InitPlan)
--
-- Constat. Une policy RLS est un filtre appliqué ligne à ligne. Les prédicats
-- ci-dessous appellent role_actif_courant() / peut_ecrire_terrain(), qui lisent
-- public.profiles. Postgres les traite comme dépendants de la ligne courante et
-- les exécute une fois par ligne scannée. Sur visites (26 261 lignes) et pdv
-- (25 399 lignes), c'est ~26 000 lectures de profiles pour un résultat qui ne
-- change pas pendant la requête : le rôle de l'utilisateur connecté.
--
-- Correctif. Envelopper l'appel dans un sous-select scalaire `(select f())`.
-- Le sous-select ne référence aucune colonne de la table filtrée : Postgres le
-- classe en InitPlan, l'évalue une fois au démarrage de la requête et réutilise
-- le résultat pour toutes les lignes. 26 000 appels → 1.
-- (Recommandation Supabase, advisor `auth_rls_initplan`.)
--
-- Aucun changement de sémantique : mêmes rôles, mêmes lignes visibles, mêmes
-- droits d'écriture. Seul le nombre d'évaluations change.
--
-- Périmètre volontairement limité aux deux tables volumineuses. Sont laissées
-- telles quelles :
--   - les policies en `using (true)` (visite_perfect_store, resultat_perfect_store,
--     quartier en lecture) : rien à évaluer ;
--   - les référentiels sous est_gestionnaire_perfect_store() (< 1 000 lignes) :
--     gain non mesurable, churn inutile ;
--   - les policies en `exists (select 1 from profiles where id = auth.uid() …)`
--     (pdv_update_admin, pdv_delete_admin, visites_delete_admin) : le sous-select
--     ne référence pas la ligne externe, Postgres le remonte déjà en InitPlan.
--     Les réécrire avec role_actif_courant() ajouterait le filtre `is_active`
--     qu'elles n'ont pas aujourd'hui — ce serait un changement de droits, pas
--     une optimisation.
--
-- Idempotent. Additif.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1) visites — lecture
-- ---------------------------------------------------------------------------
-- Inchangé : ses propres visites, ou tout pour admin/superviseur.
-- Source : 20260907140100_friesland_lot2_roles_rls_commercial.sql:101
drop policy if exists "visites_select" on public.visites;
create policy "visites_select" on public.visites for select
  using (
    (select auth.uid()) = user_id
    or (select public.role_actif_courant()) in ('admin','superviseur')
  );

-- Inchangé : le commercial lit les visites des PDV de son périmètre.
-- pdv_id in (select pdv_ids_perimetre()) est déjà set-based, on n'y touche pas.
-- Source : 20260907150100_friesland_lot2_perf_perimetre.sql:51
drop policy if exists "visites_select_commercial" on public.visites;
create policy "visites_select_commercial" on public.visites for select
  using (
    (select public.role_actif_courant()) = 'commercial'
    and pdv_id in (select public.pdv_ids_perimetre())
  );

-- ---------------------------------------------------------------------------
-- 2) visites — mise à jour
-- ---------------------------------------------------------------------------
-- Le USING d'un UPDATE filtre lui aussi les lignes scannées : même gain.
-- Inchangé : rôle terrain, et auteur de la visite ou admin.
drop policy if exists "visites_update" on public.visites;
create policy "visites_update" on public.visites for update
  using (
    (select public.peut_ecrire_terrain())
    and ((select auth.uid()) = user_id or (select public.role_actif_courant()) = 'admin')
  )
  with check (
    (select public.peut_ecrire_terrain())
    and ((select auth.uid()) = user_id or (select public.role_actif_courant()) = 'admin')
  );

-- ---------------------------------------------------------------------------
-- 3) pdv — lecture
-- ---------------------------------------------------------------------------
-- Inchangé : tout pour admin/superviseur, sinon le périmètre du profil.
drop policy if exists "pdv_select_perimetre" on public.pdv;
create policy "pdv_select_perimetre" on public.pdv for select to authenticated
  using (
    (select public.role_actif_courant()) in ('admin','superviseur')
    or pdv_id in (select public.pdv_ids_perimetre())
  );

-- Inchangé : seuls les rôles terrain modifient un PDV. Le USING scanne pdv.
drop policy if exists "pdv_update_terrain" on public.pdv;
create policy "pdv_update_terrain" on public.pdv for update
  using ((select public.peut_ecrire_terrain()))
  with check ((select public.peut_ecrire_terrain()));

commit;
