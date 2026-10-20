-- ============================================================================
-- BOUTIQUES ATOM HORS TOURNÉE (20/10/2026) — liste à traiter dans
-- Admin › Planning › Validation des tournées.
-- Raisons : sans_gps, sans_distributeur, autre_distributeur (le distributeur
-- de la boutique n'est celui d'aucun jour du merchandiser de son quartier).
-- Idempotente.
-- ============================================================================
begin;

create or replace function public.atom_pdv_hors_tournee()
returns table (pdv_id text, nom_pdv text, distributeur text, raison text,
               merchandiser text, point_visite text, distance_point_m integer,
               latitude double precision, longitude double precision)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not exists (
       select 1 from profiles me where me.id = auth.uid()
         and (me.role in ('admin', 'superviseur') or (me.role = 'agence' and me.employeur = 'atom'))) then
    raise exception 'atom_pdv_hors_tournee : accès refusé' using errcode = '42501';
  end if;
  return query
  select p.pdv_id, p.nom_pdv, p.distributor_name,
         case
           when p.geolocation_lat is null or p.geolocation_lng is null then 'sans_gps'
           when p.distributor_name is null then 'sans_distributeur'
           else 'autre_distributeur'
         end,
         m.nom,
         (select r.point_visite from routing_mensuel r
          where r.merchandiser_id = q.merchandiser_id and r.actif
            and r.latitude = q.point_lat and r.longitude = q.point_lng
          order by r.semaine_du_mois limit 1),
         q.distance_m, p.geolocation_lat, p.geolocation_lng
  from pdv_atom a
  join pdv p on p.pdv_id = a.pdv_id and coalesce(p.is_active, true)
  left join pdv_quartier_tournee q on q.pdv_id = p.pdv_id
  left join profiles m on m.id = q.merchandiser_id
  where q.pdv_id is null
     or p.distributor_name is null
     or not exists (
       select 1 from routing_mensuel r
       where r.merchandiser_id = q.merchandiser_id and r.actif
         and r.distributeur is not distinct from p.distributor_name);
end;
$$;
revoke all on function public.atom_pdv_hors_tournee() from public, anon;
grant execute on function public.atom_pdv_hors_tournee() to authenticated, service_role;

commit;
