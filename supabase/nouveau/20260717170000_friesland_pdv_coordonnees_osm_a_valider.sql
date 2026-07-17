-- PDV : repères OSM « à valider » (complément de 20260717160000).
--
-- Ces 3 PDV ont une correspondance OSM utilisable mais de moindre confiance
-- (source docs/ajour/pdv-coordonnees-osm.csv, statut = a_valider) :
--   PS-004 (Marcory Hibiscus)  → OSM « Cité Hibiscus », probable non exact.
--   PS-011 (Bingerville Nouveau Goudron) → OSM arrêt de bus (repère de voirie).
--   PS-012 (Man Marché) → OSM marché de Man (POI, pas centroïde de quartier).
-- Ce sont des REPÈRES approximatifs pour l'affichage carte, PAS des relevés GPS
-- terrain : ne pas les utiliser pour valider une présence géofencée.
-- Ne remplace jamais une coordonnée déjà saisie (garde is null). Idempotent.

update public.pdv as p
set geolocation_lat = v.latitude,
    geolocation_lng = v.longitude,
    updated_at = now()
from (values
  ('PS-004', 5.2990032::double precision, -3.9818359::double precision),
  ('PS-011', 5.3485994::double precision, -3.8603267::double precision),
  ('PS-012', 7.4096970::double precision, -7.5481780::double precision)
) as v(pdv_id, latitude, longitude)
where p.pdv_id = v.pdv_id
  and (p.geolocation_lat is null or p.geolocation_lng is null);
