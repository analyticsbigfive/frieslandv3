-- PDV : repères OSM des quartiers pour les 8 correspondances non ambiguës.
--
-- La source est une recherche Nominatim du quartier + zone + Côte d'Ivoire
-- effectuée le 2026-07-17. Ces valeurs sont des repères de quartier issus
-- d'OpenStreetMap, pas des relevés GPS précis du point de vente. Les lignes
-- ambiguës restent volontairement NULL (voir docs/ajour/pdv-coordonnees-osm.csv).
-- Ne pas utiliser ces repères pour valider une présence géofencée sans relevé
-- GPS effectué sur le terrain.

update public.pdv as p
set geolocation_lat = v.latitude,
    geolocation_lng = v.longitude,
    updated_at = now()
from (values
  ('75298881', 5.3481134::double precision, -4.0667528::double precision),
  ('PS-001',    5.3699343::double precision, -3.9554947::double precision),
  ('PS-002',    5.2957060::double precision, -3.9959665::double precision),
  ('PS-003',    7.6905370::double precision, -5.0356999::double precision),
  ('PS-005',    6.1239507::double precision, -5.9311705::double precision),
  ('PS-006',    6.8302421::double precision, -5.2655923::double precision),
  ('PS-007',    5.3481134::double precision, -4.0667528::double precision),
  ('PS-010',    6.8749151::double precision, -6.4402075::double precision)
) as v(pdv_id, latitude, longitude)
where p.pdv_id = v.pdv_id
  and (p.geolocation_lat is null or p.geolocation_lng is null);
