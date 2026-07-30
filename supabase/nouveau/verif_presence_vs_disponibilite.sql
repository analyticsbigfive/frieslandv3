-- ============================================================================
-- VÉRIFICATION : présence et disponibilité sont bien deux mesures distinctes.
--
-- Le risque, avec deux KPI calculés sur la même assiette de SKU, est qu'ils
-- renvoient toujours le même chiffre — auquel cas l'écran affiche deux fois la
-- même information sans que personne ne s'en aperçoive.
--
-- Ce test force le cas limite : toutes les quantités EVAP à 1, alors que les
-- seuils de disponibilité du segment sont supérieurs à 1.
-- Attendu : presence_pct = 100, disponibilite_pct = 0.
--
-- Aucune écriture : les deux fonctions sont pures, on leur passe un jsonb forgé.
-- ============================================================================
with seg as (
  select sg.segment, sg.grade, coalesce(cp.canal, 'GT') as canal
  from segment_grade_type_pdv sg
  join type_pdv tp on tp.id = sg.type_pdv_id
  left join categorie_pdv cp on cp.id = tp.categorie_pdv_id
  limit 1
),
payload as (
  select jsonb_build_object('produits', jsonb_build_object('evap',
    jsonb_build_object('quantites', (
      select jsonb_object_agg(cr.sku_key, 1)
      from correspondance_reference cr where cr.categorie_jsonb = 'evap'
    )))) as data
)
select
  s.segment,
  s.grade,
  s.canal,
  (select min(sd.quantite_min) from seuil_disponibilite sd
    where sd.segment = s.segment and sd.grade = s.grade) as seuil_min,
  calculer_presence_categorie(p.data, 'evap', s.canal, s.segment, s.grade) as presence_pct,
  calculer_dispo_categorie(p.data, 'evap', s.canal, s.segment, s.grade) as disponibilite_pct
from seg s, payload p;

-- Résultat obtenu le 30/07/2026 :
--   segment=SupermarcheMT grade=A canal=MT seuil_min=6
--   presence_pct=100  disponibilite_pct=0
