-- ============================================================================
-- ÉVOLUTION Perfect Store : taux de PDV conformes par jour, pour la courbe
-- d'accueil (dashboard Perfect Store).
--
-- perfect_store_pct = PDV ayant atteint un niveau (niveau non null)
--                     / visites scorées du jour.
-- `date` en ISO (YYYY-MM-DD) : consommé tel quel par ChartsVisitesLineChart
-- (qui ne re-parse que les dates ISO — cf. utils/dates.ts).
--
-- Idempotent. Dépend de 20260630130100 (resultat_perfect_store).
-- ============================================================================
begin;

create or replace view v_perfect_store_evolution as
select
  to_char(date_trunc('day', v.date_visite), 'YYYY-MM-DD') as date,
  count(*) filter (where r.niveau is not null) as perfect_stores,
  count(*) as visites_scorees,
  round(
    100.0 * count(*) filter (where r.niveau is not null)
    / nullif(count(*), 0)
  , 1) as perfect_store_pct
from visites v
join resultat_perfect_store r on r.visite_id = v.id
group by date_trunc('day', v.date_visite);

commit;
