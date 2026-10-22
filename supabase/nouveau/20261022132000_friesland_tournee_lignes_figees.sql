-- ============================================================================
-- TOURNÉES : LE MERCHANDISER NE CHANGE QUE L'ÉTAT DE SES ÉTAPES (22/10/2026)
--
-- Revue de sécurité de « vos PDV » (20261022130000) : les politiques
-- routing_pdv_user_update et routings_user_update laissent un merchandiser
-- modifier toutes les colonnes de ses tournées. En changeant le PDV d'une
-- étape (ou la date d'une ancienne tournée), il faisait entrer n'importe quel
-- PDV dans « ses PDV » (pdv_ids_merch_atom) et dans pdv_ids_tournee : lisible,
-- et sa position fixée par une visite. Il pouvait aussi réécrire l'objectif
-- d'une visite libre.
--
-- L'app ne change que l'état d'une étape (statut, arrivée, fin, GPS, visite,
-- note : stores/routing.ts updateRoutingPDVStatus, file hors ligne) et le
-- statut de la tournée (syncRoutingStatus). Tout le reste est figé pour un
-- appel direct d'un utilisateur qui n'est ni admin ni superviseur. Les
-- fonctions du serveur (security definer : visite libre, réordonnancement,
-- génération) passent, car elles ne s'exécutent pas en « authenticated ».
-- Idempotente.
-- ============================================================================
begin;

create or replace function public.routing_pdv_colonnes_figees()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.est_admin_ou_superviseur()
     and (new.routing_id is distinct from old.routing_id
          or new.pdv_id is distinct from old.pdv_id
          or new.position_order is distinct from old.position_order
          or new.objectifs is distinct from old.objectifs) then
    raise exception 'Le PDV, l''ordre et les objectifs d''une étape se modifient depuis l''administration'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_routing_pdv_colonnes_figees on public.routing_pdv;
create trigger trg_routing_pdv_colonnes_figees
  before update on public.routing_pdv
  for each row execute function public.routing_pdv_colonnes_figees();

create or replace function public.routings_colonnes_figees()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.est_admin_ou_superviseur()
     and (new.user_id is distinct from old.user_id
          or new.date_routing is distinct from old.date_routing
          or new.source is distinct from old.source
          or new.template_id is distinct from old.template_id
          or new.created_by is distinct from old.created_by
          or new.objectifs is distinct from old.objectifs) then
    raise exception 'Le jour, le merchandiser et l''objectif d''une tournée se modifient depuis l''administration'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_routings_colonnes_figees on public.routings;
create trigger trg_routings_colonnes_figees
  before update on public.routings
  for each row execute function public.routings_colonnes_figees();

revoke all on function public.routing_pdv_colonnes_figees() from public, anon, authenticated;
revoke all on function public.routings_colonnes_figees() from public, anon, authenticated;

commit;
