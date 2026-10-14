-- ============================================================================
-- PROFILS : FIN DE LA « RÉCURSION INFINIE » À LA MISE À JOUR (14/10/2026)
--
-- Symptôme : Utilisateurs › réactiver un compte → « Compte non réactivé ».
-- Postgres : 42P17 « infinite recursion detected in policy for relation
-- profiles », dès l'analyse de la requête, pour TOUTE mise à jour de
-- profiles faite depuis le navigateur (admin ou utilisateur sur son profil).
--
-- Cause : profiles_update_own (et profiles_insert_admin) relisent profiles
-- dans leur WITH CHECK. Tant que la lecture de profiles n'avait que des
-- politiques sans sous-requête (USING true), Postgres l'acceptait. La
-- politique restrictive profiles_select_agence (20261010180000) a ajouté des
-- sous-requêtes ((select agence_courante()), id in (select …)) : relire
-- profiles depuis une politique de profiles devient une récursion.
--
-- Correctif : même règle, sans sous-requête dans la politique — un appel de
-- fonction SECURITY DEFINER (profil_visible_agence). Vérifié en production
-- dans une transaction annulée : l'admin réactive un compte, un
-- merchandiser modifie son profil mais pas son rôle (42501), Elias voit les
-- mêmes 23 profils qu'avant.
--
-- Idempotent. APPLIQUÉE en production le 14/10/2026 (connecteur Supabase, apply_migration).
-- ============================================================================
begin;

create or replace function public.profil_visible_agence(p_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select public.agence_courante() is null or p_id in (select public.profils_visibles_agence())
$$;

revoke all on function public.profil_visible_agence(uuid) from public, anon;
grant execute on function public.profil_visible_agence(uuid) to authenticated;

drop policy if exists profiles_select_agence on public.profiles;
create policy profiles_select_agence on public.profiles
  as restrictive for select to authenticated
  using (public.profil_visible_agence(id));

commit;
