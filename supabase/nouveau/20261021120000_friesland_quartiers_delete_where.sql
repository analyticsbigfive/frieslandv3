-- ============================================================================
-- QUARTIERS ATOM : UN DELETE AVEC WHERE, POUR PASSER PAR L'API (21/10/2026)
-- « Appliquer les corrections » (admin/routing/validation) échouait avec
-- « DELETE requires a WHERE clause ». Modifier routing_mensuel déclenche
-- quartiers_atom_apres_routing, qui appelle recalculer_quartiers_atom(null) :
-- la fonction vidait pdv_quartier_tournee par un DELETE sans WHERE. Le rôle
-- authenticator charge safeupdate, qui refuse ce DELETE pour tout appel passé
-- par l'API (PostgREST). Depuis l'éditeur SQL, l'appel passait.
-- Seul changement : « where true », même résultat.
-- Aucune autre fonction publique n'a de DELETE ou d'UPDATE sans WHERE (vérifié
-- en production le 21/10).
-- Idempotente.
-- ============================================================================
begin;

create or replace function public.recalculer_quartiers_atom(p_pdv_ids text[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if p_pdv_ids is null then
    delete from pdv_quartier_tournee where true;
  else
    delete from pdv_quartier_tournee where pdv_id = any (p_pdv_ids);
  end if;

  with points as materialized (
    select r.merchandiser_id, r.latitude, r.longitude, r.distributeur
    from routing_mensuel r
    join profiles m on m.id = r.merchandiser_id and m.employeur = 'atom' and coalesce(m.is_active, true)
      and coalesce(m.email, '') not like '%@friesland-test.ci'
    where r.actif and r.latitude is not null and r.longitude is not null
  )
  insert into pdv_quartier_tournee (pdv_id, merchandiser_id, point_lat, point_lng, distance_m, calcule_le)
  select p.pdv_id, x.merchandiser_id, x.latitude, x.longitude,
         round(distance_m(p.geolocation_lat, p.geolocation_lng, x.latitude, x.longitude))::int, now()
  from pdv_atom a
  join pdv p on p.pdv_id = a.pdv_id
  cross join lateral (
    select pt.merchandiser_id, pt.latitude, pt.longitude
    from points pt
    order by round(sqrt(power((pt.latitude - p.geolocation_lat) * 110574, 2)
                      + power((pt.longitude - p.geolocation_lng) * 111320 * 0.9958, 2))),
             (pt.distributeur is distinct from p.distributor_name),
             pt.merchandiser_id
    limit 1
  ) x
  where coalesce(p.is_active, true)
    and p.geolocation_lat is not null and p.geolocation_lng is not null
    and not (p.geolocation_lat = 0 and p.geolocation_lng = 0)
    and (p_pdv_ids is null or p.pdv_id = any (p_pdv_ids));
  get diagnostics n = row_count;
  return n;
end;
$$;

commit;
