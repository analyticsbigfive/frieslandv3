-- ============================================================================
-- RÔLE « AGENCE » : CHAQUE AGENCE NE VOIT QUE SES MERCHANDISERS (10/10/2026)
-- À COLLER DANS L'ÉDITEUR SQL : testée en production dans une transaction annulée
-- (compte d'Elias : 15 merchandisers Atom + 7 commerciaux, 8 479 PDV sur la carte,
-- 0 hors d'Abidjan ; admin inchangé), application par le connecteur refusée.
--
-- Constat (compte d'Elias, Atom) : la lecture de `profiles` est ouverte à tout
-- compte connecté (profiles_select_authenticated, USING true). Un compte
-- agence voyait donc les 14 commerciaux, le superviseur, les admins et les
-- merchandisers Friesland : Suivi des équipes, Versions de l'app, filtres de
-- Visites, et Programme merchandiser (programme_merchandiser est SECURITY
-- INVOKER et filtre par direction : une deuxième agence South y serait
-- apparue). Une nouvelle agence South va être créée : le cloisonnement se
-- fait par agence (profiles.employeur), jamais par direction.
--
--   1. profils_visibles_agence() : le compte lui-même, les merchandisers de
--      son agence (merch_ids_agence) et leurs commerciaux de rattachement
--      (profiles.commercial_id, routing_mensuel.commercial_id : le nom du
--      sales rep reste lisible dans le Planning).
--   2. Politique RESTRICTIVE sur profiles : un compte agence ne lit que ces
--      profils. Sans effet pour tout autre rôle (agence_courante() est nulle).
--   3. carte_pdv_agence() : les PDV visités OU recensés par les merchandisers
--      de l'agence (pdv.ajoute_par = leur e-mail : 1 420 PDV Atom, dont 200
--      seulement visités ; pdv.created_by pour ceux créés dans l'application),
--      pour la carte et le Suivi des équipes. Lire `pdv` par la RLS coûtait
--      environ 6 s par requête (pdv_ids_agence, 19 317 PDV dont Bouaké et
--      Dabou venus des territoires du premier fichier DMS) ; ici, environ
--      8 500 PDV, tous à Abidjan, en une fraction de seconde.
--
-- Politiques et fonctions AJOUTÉES : aucune politique existante n'est élargie.
-- Idempotent.
-- ============================================================================
begin;

-- 1. Profils lisibles par le compte agence connecté (vide pour tout autre compte).
create or replace function public.profils_visibles_agence()
returns setof uuid
language sql stable security definer rows 100
set search_path to 'public'
as $$
  select auth.uid() where public.agence_courante() is not null
  union
  select m from public.merch_ids_agence() m
  union
  select p.commercial_id from public.profiles p
  where p.commercial_id is not null and p.id in (select public.merch_ids_agence())
  union
  select rm.commercial_id from public.routing_mensuel rm
  where rm.commercial_id is not null and rm.merchandiser_id in (select public.merch_ids_agence())
$$;

revoke all on function public.profils_visibles_agence() from public, anon;
grant execute on function public.profils_visibles_agence() to authenticated;

-- 2. Lecture des profils : un compte agence ne voit que les siens.
drop policy if exists profiles_select_agence on public.profiles;
create policy profiles_select_agence on public.profiles
  as restrictive for select to authenticated
  using ((select public.agence_courante()) is null
         or id in (select public.profils_visibles_agence()));

-- 3. Carte et Suivi des équipes : PDV visités ou recensés par les merchandisers de l'agence.
create or replace function public.carte_pdv_agence()
returns table(
  pdv_id text, nom_pdv text, zone text, quartier text, canal text, sous_categorie_pdv text,
  geolocation_lat double precision, geolocation_lng double precision, image_url text
)
language sql stable security definer rows 8000
set search_path to 'public'
as $$
  select p.pdv_id, p.nom_pdv, p.zone, p.quartier, p.canal, p.sous_categorie_pdv,
         p.geolocation_lat, p.geolocation_lng, p.image_url
  from public.pdv p
  where p.is_active
    and (p.pdv_id in (select v.pdv_id from public.visites v where v.user_id in (select public.merch_ids_agence()))
         or p.created_by in (select public.merch_ids_agence())
         or lower(p.ajoute_par) in (select lower(m.email) from public.profiles m
                                    where m.email is not null and m.id in (select public.merch_ids_agence())))
$$;

revoke all on function public.carte_pdv_agence() from public, anon;
grant execute on function public.carte_pdv_agence() to authenticated;

commit;
