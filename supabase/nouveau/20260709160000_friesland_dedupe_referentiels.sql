-- ============================================================================
-- MAJ 2026-07-09 : DÉDUPLICATION des référentiels + contraintes uniques
--
-- Problème : `categorie_pdv`, `type_pdv` et `zone` ont accumulé des doublons
-- lorsqu'un import (TOUT_COMBINE) a été rejoué : leur `on conflict do nothing`
-- n'avait pas de contrainte unique effective sur la clé naturelle, donc chaque
-- réexécution ré-insérait toutes les lignes.
--
-- Cette migration : (1) supprime les doublons en gardant la plus ancienne ligne,
-- (2) ajoute les contraintes uniques manquantes -> les futures réexécutions
-- deviennent idempotentes (le `on conflict do nothing` fonctionne enfin),
-- (3) recalcule les scores (la résolution type_pdv redevient univoque).
--
-- Idempotent. À exécuter en DERNIER (après toutes les autres migrations).
-- ============================================================================
begin;

-- 1) categorie_pdv : repointer les enfants vers le keeper, puis supprimer les doublons
update type_pdv tp
set categorie_pdv_id = k.kid
from categorie_pdv c
join (select nom, min(id) kid from categorie_pdv group by nom) k on k.nom = c.nom
where tp.categorie_pdv_id = c.id and c.id <> k.kid;

delete from categorie_pdv c
using (select nom, min(id) kid from categorie_pdv group by nom) k
where c.nom = k.nom and c.id <> k.kid;

-- 2) type_pdv : supprimer les enfants rattachés aux doublons (le keeper garde les siens),
--    puis supprimer les doublons de type_pdv
delete from segment_grade_type_pdv sg
using type_pdv t
join (select nom, min(id) kid from type_pdv group by nom) k on k.nom = t.nom
where sg.type_pdv_id = t.id and t.id <> k.kid;

delete from segment_visibilite_type_pdv sv
using type_pdv t
join (select nom, min(id) kid from type_pdv group by nom) k on k.nom = t.nom
where sv.type_pdv_id = t.id and t.id <> k.kid;

delete from type_pdv t
using (select nom, min(id) kid from type_pdv group by nom) k
where t.nom = k.nom and t.id <> k.kid;

-- 3) zone : supprimer les doublons exacts (territoire_code, code, nom)
delete from zone z
using zone z2
where z.id > z2.id
  and z.territoire_code = z2.territoire_code
  and coalesce(z.code,'') = coalesce(z2.code,'')
  and z.nom = z2.nom;

-- 4) Contraintes uniques (rendent les futures réexécutions idempotentes)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'categorie_pdv_nom_uk') then
    alter table categorie_pdv add constraint categorie_pdv_nom_uk unique (nom);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'type_pdv_nom_uk') then
    alter table type_pdv add constraint type_pdv_nom_uk unique (nom);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'zone_nat_uk') then
    alter table zone add constraint zone_nat_uk unique (territoire_code, code, nom);
  end if;
end $$;

-- 5) Recalcul (type_pdv redevient univoque -> segment/grade correctement résolus)
select calculer_perfect_store(id, 'taux_vente') from visites;

commit;
