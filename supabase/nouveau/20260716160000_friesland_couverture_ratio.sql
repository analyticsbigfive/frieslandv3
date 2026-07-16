-- ============================================================================
-- COUVERTURE en RATIO : v_couverture_globale expose désormais le dénominateur
-- (PDV actifs du périmètre) + le pourcentage, en plus du compte absolu pdv_vus.
--
-- Exigence client : la couverture = PDV visités / total PDV, pas un compte brut.
-- `create or replace view` reste valide : on n'AJOUTE que des colonnes en fin.
--
-- Idempotent. Dépend de 20260630130100 (définition initiale de la vue).
-- ============================================================================
begin;

create or replace view v_couverture_globale as
select
  to_char(date_trunc('month', v.date_visite), 'YYYY-MM') as periode,
  count(distinct v.pdv_id) as pdv_vus,
  (select count(*) from pdv p where coalesce(p.is_active, true)) as pdv_total,
  round(
    100.0 * count(distinct v.pdv_id)
    / nullif((select count(*) from pdv p where coalesce(p.is_active, true)), 0)
  , 1) as couverture_pct
from visites v
group by date_trunc('month', v.date_visite);

commit;
