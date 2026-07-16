-- ============================================================================
-- ZONE_DISTRIBUTEUR : rattachement distributeur au niveau AREA (zone).
--
-- Aujourd'hui le distributeur est constant par territoire (territoire_distributeur,
-- source canonique = 20260709130000). Mais le métier veut pouvoir, à terme, faire
-- VARIER le distributeur d'une area à l'autre dans un même territoire. Cette table
-- le permet : une ligne = (zone, distributeur) autorisé sur cette area.
--
-- Résolution des distributeurs proposés à la création d'un PDV :
--   nationaux (distributeur.national = true)
--   UNION  zone_distributeur de la zone du PDV
--
-- Seed initial = héritage du territoire : chaque zone reçoit le(s) distributeur(s)
-- de son territoire (donc Port Bouët -> SDTP + SDHPA sur toutes ses areas).
-- On repart de territoire_distributeur (état canonique en base), PAS du JSON
-- territory_areas (périmé sur 4 territoires — arbitrage : 130000 fait foi).
-- Les overrides par area se font ensuite en éditant cette table (admin).
--
-- Idempotent. Dépend de 20260630120000 (zone), 20260630120200 (distributeur),
-- 20260709130000 (mapping canonique), 20260630130200 (est_gestionnaire_perfect_store).
-- ============================================================================
begin;

create table if not exists zone_distributeur (
  zone_id         bigint not null references zone(id)         on delete cascade,
  distributeur_id bigint not null references distributeur(id) on delete cascade,
  primary key (zone_id, distributeur_id)
);

-- Seed : chaque zone hérite du/des distributeur(s) de son territoire.
insert into zone_distributeur(zone_id, distributeur_id)
select z.id, td.distributeur_id
from zone z
join territoire t on t.code = z.territoire_code
join territoire_distributeur td on td.territoire_id = t.id
on conflict do nothing;

-- RLS : lecture authentifié, écriture gestionnaire Perfect Store
-- (même pattern que les autres référentiels, cf. 20260630130200).
alter table zone_distributeur enable row level security;

drop policy if exists zone_distributeur_authenticated_read on zone_distributeur;
create policy zone_distributeur_authenticated_read on zone_distributeur
  for select to authenticated using (true);

drop policy if exists zone_distributeur_manager_write on zone_distributeur;
create policy zone_distributeur_manager_write on zone_distributeur
  for all to authenticated
  using (public.est_gestionnaire_perfect_store())
  with check (public.est_gestionnaire_perfect_store());

commit;
