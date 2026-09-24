-- ============================================================================
-- FERMETURE DES ACCÈS ANONYMES (audit du 24/09/2026)
--
-- La clé publique (anon) est embarquée dans l'APK et le bundle web : tout ce
-- que le rôle `anon` peut lire ou exécuter est accessible sans connexion.
-- Constaté en production avant cette migration :
--   - `profiles` lisible sans connexion (policy `profiles_select_all`, rôle
--     public, `using (true)`) : e-mail, téléphone et rôle de tout le personnel ;
--   - tables héritées `app_users`, `commerciaux`, `pdvs`, `geofence_zones`
--     lisibles, et les trois premières modifiables (policies « Allow service
--     insert/update » ouvertes à public) ;
--   - RPC d'action SECURITY DEFINER exécutables par anon (recalcul Perfect
--     Store, matérialisation des routings, téléphone de contact).
--
-- Rien dans l'app ne lit ces données avant connexion (login, suppression de
-- compte et changement de mot de passe ne touchent pas `profiles`).
--
-- Au passage : les policies admin de `profiles`, `visites` et du bucket
-- d'images ignoraient `is_active` — un admin désactivé dont le jeton est encore
-- valide pouvait continuer à modifier/supprimer. Elles passent par
-- role_actif_courant(), qui filtre sur is_active (et évite l'auto-référence
-- de `profiles` dans ses propres policies).
-- ============================================================================
begin;

-- 1. profiles : lecture réservée aux utilisateurs connectés.
drop policy if exists profiles_select_all on public.profiles;
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);
revoke select on public.profiles from anon;

-- 2. Tables héritées, non référencées par l'app : plus aucun accès client.
--    Conservées (pas de drop) comme historique.
drop policy if exists "Allow public read app_users" on public.app_users;
drop policy if exists "Allow service insert app_users" on public.app_users;
drop policy if exists "Allow public read commerciaux" on public.commerciaux;
drop policy if exists "Allow service insert commerciaux" on public.commerciaux;
drop policy if exists "Allow public read pdvs" on public.pdvs;
drop policy if exists "Allow service insert pdvs" on public.pdvs;
drop policy if exists "Allow service update pdvs" on public.pdvs;
drop policy if exists "Allow public read geofence_zones" on public.geofence_zones;
revoke all on public.app_users, public.commerciaux, public.pdvs, public.geofence_zones
  from anon, authenticated;

-- zones_secteurs est lue après connexion (stores/pdv.ts, useOfflineData) :
-- on ne retire que l'accès anonyme.
revoke all on public.zones_secteurs from anon;

-- 3. Policies admin : exiger un admin ACTIF.
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update
  using ((select public.role_actif_courant()) = 'admin')
  with check ((select public.role_actif_courant()) = 'admin');

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete
  using ((select public.role_actif_courant()) = 'admin');

drop policy if exists visites_delete_admin on public.visites;
create policy visites_delete_admin on public.visites
  for delete
  using ((select public.role_actif_courant()) = 'admin');

drop policy if exists images_delete_admin on storage.objects;
create policy images_delete_admin on storage.objects
  for delete
  using (bucket_id = 'visite-images' and (select public.role_actif_courant()) = 'admin');

-- 4. RPC d'action et fonctions de déclencheur : plus exécutables sans session.
--    `authenticated` garde son droit explicite (recalculer_perfect_store_lot
--    est appelée depuis l'admin). Les déclencheurs ne dépendent pas du droit
--    EXECUTE de l'appelant. Les helpers RLS (role_actif_courant,
--    pdv_ids_perimetre…) ne sont pas touchés : les policies les évaluent aussi
--    pour anon.
revoke execute on function
  public.calculer_perfect_store(uuid, text),
  public.compute_perfect_store(text, text),
  public.recalculer_perfect_store_lot(integer, integer, text),
  public.recalculer_tous_perfect_store(text),
  public.materialiser_routing_jour(uuid, date),
  public.materialiser_routings_periode(uuid, date, date),
  public.maj_telephone_contact(uuid, text),
  public.handle_new_user(),
  public.prevent_profile_privilege_escalation(),
  public.visites_garde_statut(),
  public.rls_auto_enable()
from public, anon;

commit;
