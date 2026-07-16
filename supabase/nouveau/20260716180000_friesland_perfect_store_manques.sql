-- ============================================================================
-- CRITÈRES MANQUANTS pour le niveau supérieur (« gap to next level »).
--
-- Pour chaque visite scorée, calcule ce qui bloque le passage au niveau
-- immédiatement au-dessus (rang + 1) — ou au niveau BASIC si non conforme.
-- FLAGSHIP (rang max) est exclu (aucun niveau cible).
--
-- ⚠️ La visibilité NE PEUT PAS se déduire du score `visibilite` stocké :
-- ce dernier est calculé pour le niveau ATTEINT (calculer_taux_standard filtre
-- sur le niveau). On recalcule donc les éléments requis au niveau CIBLE et on
-- liste ceux non observés (via element_visibilite_observe, fonction du moteur).
-- On sépare pilier visibilité / promotion ; la promotion n'est retenue que si
-- elle est applicable sur la visite — comme le gating de calculer_perfect_store.
-- La résolution du segment de visibilité reprend EXACTEMENT le lateral join du
-- moteur (normalisation d'espaces sur type_pdv.nom).
--
-- Idempotent. Dépend de 20260630130100 (moteur, element_visibilite_observe).
-- ============================================================================
begin;

-- drop + create (et non replace) : l'ordre des colonnes change entre versions.
drop view if exists v_perfect_store_manques;
create view v_perfect_store_manques as
with base as (
  select r.visite_id, v.pdv_id, v.data, r.niveau as niveau_actuel,
         r.dispo_rayon, r.assortiment, coalesce(n.rang, 0) as rang_actuel,
         p.nom_pdv, p.sous_categorie_pdv as type_pdv, p.zone, p.secteur, p.distributor_name,
         -- Division (North/South) résolue via le territoire : nom_affichage = équivalence
         -- (SOUTH DIVISION -> ABIDJAN, NORTH DIVISION -> UP COUNTRY).
         rg.nom_affichage as division
  from resultat_perfect_store r
  join visites v on v.id = r.visite_id
  join pdv p on p.pdv_id = v.pdv_id
  left join niveau_perfect_store n on n.code = r.niveau
  left join territoire t on t.nom = p.zone
  left join sous_region sr on sr.code = t.sous_region_code
  left join region rg on rg.code = sr.region_code
),
resolu as (
  select b.*, sv.segment as vis_segment
  from base b
  left join lateral (
    select c.* from type_pdv c
    where regexp_replace(trim(c.nom), '\s+', ' ', 'g') = regexp_replace(trim(b.type_pdv), '\s+', ' ', 'g')
    order by (c.nom = b.type_pdv) desc
    limit 1
  ) tp on true
  left join segment_visibilite_type_pdv sv on sv.type_pdv_id = tp.id
),
cible as (
  select r.*, nt.code as niveau_cible, nt.dispo_rayon_min,
    case
      when nt.code ilike 'FLAGSHIP%' then 'flagship'
      when nt.code ilike 'VIP%' then 'vip'
      when nt.code ilike 'CORE%' then 'core'
      else 'basic'
    end as key_cible
  from resolu r
  join niveau_perfect_store nt on nt.rang = r.rang_actuel + 1
)
select
  c.visite_id, c.pdv_id, c.nom_pdv, c.type_pdv, c.division, c.zone, c.secteur, c.distributor_name,
  c.niveau_actuel, c.niveau_cible,
  (c.dispo_rayon < c.dispo_rayon_min) as dispo_manque,
  c.dispo_rayon, c.dispo_rayon_min,
  (c.assortiment is not null and c.assortiment < 100) as assortiment_manque,
  (select coalesce(array_agg(e.nom order by e.nom), '{}') from standard_visibilite s
     join element_visibilite e on e.id = s.element_visibilite_id
     where s.segment = c.vis_segment and s.niveau_perfect_store = c.key_cible
       and s.requis and not e.optionnel and e.pilier = 'visibilite'
       and not element_visibilite_observe(c.data, e.code)) as visibilite_manques,
  (select coalesce(array_agg(e.nom order by e.nom), '{}') from standard_visibilite s
     join element_visibilite e on e.id = s.element_visibilite_id
     where s.segment = c.vis_segment and s.niveau_perfect_store = c.key_cible
       and s.requis and not e.optionnel and e.pilier = 'promotion'
       and coalesce((c.data->'visibilite'->>'promotion_applicable')::boolean, false)
       and not element_visibilite_observe(c.data, e.code)) as promotion_manques
from cible c;

commit;
