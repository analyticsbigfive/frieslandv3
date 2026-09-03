-- 20260903120000_friesland_suppression_compte_visites_set_null.sql
--
-- Suppression de compte (page publique /supprimer-compte, exigence Google Play).
-- visites.user_id référence profiles(id) SANS règle ON DELETE : supprimer un
-- utilisateur ayant des visites échoue sur la contrainte. Les relevés de visite
-- sont des données de l'organisation cliente : on les conserve anonymisés
-- (user_id → NULL) au lieu de bloquer la suppression, conformément à ce
-- qu'annonce la page de demande. Le nom du commercial saisi en clair dans
-- visites.commercial / visites.email est effacé par la même occasion.
--
-- position_tournee et routing_templates cascadent déjà (voir 20260703120000
-- et 20260717160000).

begin;

alter table public.visites
  drop constraint if exists visites_user_id_fkey;

alter table public.visites
  add constraint visites_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

-- Anonymisation des champs texte copiés depuis le profil au moment de la visite.
create or replace function public.anonymiser_visites_du_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.visites
     set commercial = null,
         email = null
   where user_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_anonymiser_visites_du_profil on public.profiles;
create trigger trg_anonymiser_visites_du_profil
  before delete on public.profiles
  for each row execute function public.anonymiser_visites_du_profil();

commit;
