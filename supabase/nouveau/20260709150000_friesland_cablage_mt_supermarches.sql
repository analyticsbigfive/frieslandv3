-- ============================================================================
-- MAJ 2026-07-09 : CÂBLAGE du standard Modern Trade sur le calcul Perfect Store
-- (point 2 de MAJ_2026-07-09_A_ARBITRER — A=Grand / B=Moyen / C=Petit).
--
-- Le classement des supermarchés vient de l'onglet TYPE DE POINT DE VENTE :
--   Hypermarket / Supermarket A -> Grands · Supermarket B -> Moyens · Supermarket C -> Petits
--
-- On modélise ça comme un segment 'SupermarcheMT' + grade A/B/C, réutilisé TEL QUEL par
-- calculer_perfect_store (AUCUNE modification de la fonction). Remplace le repli provisoire
-- Minimarket de 20260630120560.
--
-- Déjà en place (rien à faire) : les formulaires PDV proposent ces types (source =
-- référentiel type_pdv), la visibilité MT est mappée (segment 'superette'), et
-- categorie_pdv.canal='MT' pour Hypermarkets/Premium/Value Supermarkets.
--
-- ✅ Correspondance A/B/C -> Grand/Moyen/Petit CONFIRMÉE par Friesland le 2026-07-15
-- (Hypermarket + Supermarket A -> Grands · B -> Moyens · C -> Petits).
-- Idempotent. À exécuter après 20260709140000. Recalcule l'historique.
-- ============================================================================
begin;

-- 1. Autoriser le segment 'SupermarcheMT' dans seuil_disponibilite (CHECK étendu).
do $$
declare c text;
begin
  select conname into c from pg_constraint
  where conrelid = 'seuil_disponibilite'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%segment%';
  if c is not null then execute format('alter table seuil_disponibilite drop constraint %I', c); end if;
end $$;
alter table seuil_disponibilite add constraint seuil_disponibilite_segment_check
  check (segment in ('Boutique','Minimarket','Kiosque','Aboki','Pushcart','TableTop','Porridge','SupermarcheMT'));

-- 2. Quantités minimales MT -> seuil_disponibilite (grade A=Grand/Hyper, B=Moyen, C=Petit),
--    dérivées de seuil_disponibilite_mt (chargé en 20260709140000).
insert into seuil_disponibilite(reference_produit_id, segment, grade, quantite_min)
select reference_produit_id, 'SupermarcheMT',
  case segment_mt
    when 'Hypermarche' then 'A'
    when 'MoyenSuper'  then 'B'
    when 'PetitSuper'  then 'C'
  end,
  quantite_min
from seuil_disponibilite_mt
on conflict (reference_produit_id, segment, grade) do update
  set quantite_min = excluded.quantite_min;

-- 3. Rattacher les types supermarché à (SupermarcheMT, grade) — écrase le repli Minimarket (120560).
insert into segment_grade_type_pdv(type_pdv_id, segment, grade)
select tp.id, 'SupermarcheMT',
  case tp.nom
    when 'Hypermarket'   then 'A'
    when 'Supermarket A' then 'A'
    when 'Supermarket B' then 'B'
    when 'Supermarket C' then 'C'
  end
from type_pdv tp
where tp.nom in ('Hypermarket','Supermarket A','Supermarket B','Supermarket C')
on conflict (type_pdv_id) do update
  set segment = excluded.segment, grade = excluded.grade;

-- 4. Recalcul de l'historique : les PDV supermarchés sont désormais scorés
--    sur le vrai standard MT (au lieu du repli Minimarket).
select calculer_perfect_store(id, 'taux_vente') from visites;

commit;
