-- ============================================================================
-- QUARTIER « France Afrique » (Treichville)
--
-- Réponse d'Atom du 15/10/2026 : les 13 PDV du mercredi du secteur « France
-- Afrique » (avenues 7 à 9, liste de Gui Stéphane) forment un secteur à part,
-- distinct de France Amerique. Ils portent déjà pdv.quartier = 'France
-- Afrique' depuis l'import du 14/10 ; il manquait le quartier au référentiel,
-- dans l'area « AUTRES TREICHVILLE » (TRE / AUTTRE), à côté de France Amerique.
--
-- Idempotent. Additif.
-- APPLIQUÉE en production le 15/10/2026 (apply_migration), quartier id 1043.
-- ============================================================================
begin;

insert into public.quartier (zone_id, nom, ordre)
select z.id, 'France Afrique', coalesce((select max(q.ordre) from public.quartier q where q.zone_id = z.id), 0) + 1
from public.zone z
where z.territoire_code = 'TRE' and z.code = 'AUTTRE'
on conflict (zone_id, nom) do nothing;

commit;
