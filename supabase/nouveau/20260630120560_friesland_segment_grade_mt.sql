-- ============================================================================
-- PATCH 6c/N : segment + grade des types de PDV MODERNES (MT)
-- Comble le TODO de 20260630120500_friesland_pont_releves.sql : seul le GT était
-- couvert dans segment_grade_type_pdv -> tout PDV moderne tombait à un score 0
-- (segment NULL => aucun seuil_disponibilite joint).
--
-- ⚠️ HYPOTHÈSE À VALIDER (Friesland) :
--   seuil_disponibilite ne contient PAS de seuils MT (Hypermarket/Supermarket) :
--   ses segments autorisés sont GT (Boutique|Minimarket|Kiosque|Aboki|Pushcart|
--   TableTop|Porridge). On rattache donc provisoirement les formats MT au segment
--   GT le plus proche AYANT des seuils ('Minimarket', grades A/B uniquement) afin
--   d'obtenir un score MT NON nul. À remplacer par de vrais seuils MT dès fournis.
--
--   Hypermarket   -> Minimarket A     Supermarket A -> Minimarket A
--   Supermarket B -> Minimarket B     Supermarket C -> Minimarket B
--   (Minimarket n'a pas de grade C dans seuil_disponibilite -> C rabattu sur B.)
--
-- Canal : géré séparément via categorie_pdv.canal (='MT' pour ces types), qui
-- sélectionne poids_reference.canal='MT' dans calculer_perfect_store. Rien à faire ici.
-- Idempotent. Dépend de 20260630120100 (type_pdv) et 20260630120500 (table pont).
-- ============================================================================
begin;

insert into segment_grade_type_pdv(type_pdv_id, segment, grade)
select tp.id, v.segment, v.grade from (values
  ('Hypermarket',  'Minimarket', 'A'),
  ('Supermarket A','Minimarket', 'A'),
  ('Supermarket B','Minimarket', 'B'),
  ('Supermarket C','Minimarket', 'B')
) as v(nom, segment, grade)
join type_pdv tp on tp.nom = v.nom
on conflict (type_pdv_id) do nothing;

commit;
