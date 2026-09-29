-- ============================================================================
-- DISTRIBUTEURS DE L'EXPORT CLIENTS DMS (fichier du 29/09/2026)
--
-- Le DMS nomme 22 distributeurs. Un seul est absent du référentiel
-- `distributeur` : ETS HIDJABE (Adjamé / Plateau, 851 clients). Deux liens
-- territoire manquent aussi au regard du DMS : PLAISIR BACHUSS sur Cocody 1
-- (521 clients) et SDTP sur Port-Bouët (395 clients).
--
-- Les liens sont ajoutés À CÔTÉ de l'existant (BOUSSOURA reste sur ADJ/PLA,
-- PRODISMA sur COC 1, SDHPA sur PRB) : un PDV porte son distributeur en texte
-- (`pdv.distributor_name`), retirer un lien ne changerait rien aux PDV mais
-- priverait l'admin de la suggestion à la création.
--
-- `zone_distributeur` est renseignée pour chaque area des territoires : une
-- area qui a des lignes ne propose QUE ses distributeurs (voir
-- PDVQuickCreateModal), le lien territoire seul ne suffirait pas.
--
-- Index sur `pdv.mdm` : le code client DMS y est désormais stocké
-- (scripts/importer-dms-pdv.mjs) et sert de clé de rapprochement.
--
-- Idempotent. Additif.
-- ============================================================================
begin;

insert into public.distributeur (nom, national)
values ('ETS HIDJABE', false)
on conflict (nom) do nothing;

with liens(code, nom) as (
  values
    ('ADJ', 'ETS HIDJABE'),
    ('PLA', 'ETS HIDJABE'),
    ('COC 1', 'PLAISIR BACHUSS'),
    ('PRB', 'SDTP')
)
insert into public.territoire_distributeur (territoire_id, distributeur_id)
select t.id, d.id
from liens l
join public.territoire t on t.code = l.code
join public.distributeur d on d.nom = l.nom
on conflict do nothing;

with liens(code, nom) as (
  values
    ('ADJ', 'ETS HIDJABE'),
    ('PLA', 'ETS HIDJABE'),
    ('COC 1', 'PLAISIR BACHUSS'),
    ('PRB', 'SDTP')
)
insert into public.zone_distributeur (zone_id, distributeur_id)
select z.id, d.id
from liens l
join public.zone z on z.territoire_code = l.code
join public.distributeur d on d.nom = l.nom
on conflict do nothing;

create index if not exists idx_pdv_mdm on public.pdv (mdm);

commit;
