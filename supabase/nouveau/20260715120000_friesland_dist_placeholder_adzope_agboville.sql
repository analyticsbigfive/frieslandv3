-- ============================================================================
-- MAJ 2026-07-15 : distributeurs PLACEHOLDER pour Adzope & Agboville
-- (point 3 de MAJ_2026-07-09_A_ARBITRER — réponse Friesland du 2026-07-15).
--
-- Pas de distributeur sur ces localités : le fichier conserve le nom de la
-- localité dans la colonne `dist`, et Friesland demande de garder ce nom en
-- attendant qu'un vrai distributeur couvre la zone (ils feront la modification
-- à ce moment-là). On crée donc 2 distributeurs placeholder du même nom et on
-- les rattache à leur territoire — plus aucun territoire non assigné.
--
-- ⚠️ Quand Friesland communiquera le vrai distributeur : réaffecter le
-- territoire puis supprimer le placeholder devenu orphelin.
--
-- Idempotent. À exécuter après 20260709130000 (qui vide et réinsère
-- territoire_distributeur). Référentiel d'affectation : aucun recalcul requis.
-- ============================================================================
begin;

insert into distributeur(nom, national) values
  ('ADZOPE', false),
  ('AGBOVILLE', false)
on conflict (nom) do nothing;

insert into territoire_distributeur(territoire_id, distributeur_id)
select t.id, d.id from (values
  ('Adzope','ADZOPE'),
  ('Agboville','AGBOVILLE')
) as v(terr, distr)
join territoire t on t.nom = v.terr
join distributeur d on d.nom = v.distr
on conflict do nothing;

commit;
