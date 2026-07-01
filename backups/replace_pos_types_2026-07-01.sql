BEGIN;
DELETE FROM segment_grade_type_pdv;
DELETE FROM segment_visibilite_type_pdv;
DELETE FROM standard_visibilite_legacy;
DELETE FROM type_pdv;
DELETE FROM categorie_pdv;

INSERT INTO categorie_pdv (nom, canal) VALUES
 ('Hypermarchés', 'MT'),
 ('Supermarchés haut de gamme', 'MT'),
 ('Supermarchés économiques', 'MT'),
 ('Supérettes', 'GT'),
 ('Petites et moyennes épiceries (commerce général)', 'GT'),
 ('Stations-service', 'GT'),
 ('Pharmacies (chaîne / indépendantes)', 'GT'),
 ('Boulangeries (chaîne / indépendantes)', 'GT'),
 ('Marchés publics', 'GT'),
 ('Grossistes traditionnels', 'GT'),
 ('Cash & Carry / clubs de gros', 'GT'),
 ('Commerce physique et en ligne', 'GT'),
 ('Corner en magasin (shop-in-shop)', 'GT'),
 ('Chaînes hôtelières', 'GT'),
 ('Restaurants avec service à table', 'GT'),
 ('Vendeurs de rue indépendants (thé et café)', 'GT'),
 ('Institutions / bureaux / usines / industries', 'GT');

INSERT INTO type_pdv (nom, categorie_pdv_id)
SELECT v.nom, c.id FROM (VALUES
 ('Hypermarché', 'Hypermarchés'),
 ('Supermarché A', 'Supermarchés haut de gamme'),
 ('Supermarché B', 'Supermarchés économiques'),
 ('Supermarché C', 'Supermarchés économiques'),
 ('Supérette A', 'Supérettes'),
 ('Supérette B', 'Supérettes'),
 ('Supérette C', 'Supérettes'),
 ('Boutique A', 'Petites et moyennes épiceries (commerce général)'),
 ('Boutique B', 'Petites et moyennes épiceries (commerce général)'),
 ('Boutique C', 'Petites et moyennes épiceries (commerce général)'),
 ('Station-service', 'Stations-service'),
 ('Pharmacie A', 'Pharmacies (chaîne / indépendantes)'),
 ('Pharmacie B', 'Pharmacies (chaîne / indépendantes)'),
 ('Pharmacie C', 'Pharmacies (chaîne / indépendantes)'),
 ('Boulangerie A', 'Boulangeries (chaîne / indépendantes)'),
 ('Boulangerie B', 'Boulangeries (chaîne / indépendantes)'),
 ('Boulangerie C', 'Boulangeries (chaîne / indépendantes)'),
 ('Étal d’épicerie générale', 'Marchés publics'),
 ('Étal de marché (table top)', 'Marchés publics'),
 ('Tanties (huile, épices et condiments)', 'Marchés publics'),
 ('Grossistes', 'Grossistes traditionnels'),
 ('Semi-grossistes', 'Grossistes traditionnels'),
 ('Cash & Carry A', 'Cash & Carry / clubs de gros'),
 ('Cash & Carry B', 'Cash & Carry / clubs de gros'),
 ('E-commerçants (détaillants en ligne)', 'Commerce physique et en ligne'),
 ('Livraison à domicile', 'Corner en magasin (shop-in-shop)'),
 ('Hôtel de chaîne', 'Chaînes hôtelières'),
 ('Hôtel indépendant', 'Chaînes hôtelières'),
 ('Restaurant international', 'Restaurants avec service à table'),
 ('Restaurant local', 'Restaurants avec service à table'),
 ('Aboki A', 'Vendeurs de rue indépendants (thé et café)'),
 ('Aboki B', 'Vendeurs de rue indépendants (thé et café)'),
 ('Kiosque A', 'Vendeurs de rue indépendants (thé et café)'),
 ('Kiosque B', 'Vendeurs de rue indépendants (thé et café)'),
 ('Charrette A', 'Vendeurs de rue indépendants (thé et café)'),
 ('Charrette B', 'Vendeurs de rue indépendants (thé et café)'),
 ('Café HORECA', 'Vendeurs de rue indépendants (thé et café)'),
 ('Bouillie', 'Vendeurs de rue indépendants (thé et café)'),
 ('Étal (table top)', 'Vendeurs de rue indépendants (thé et café)'),
 ('Distributeur automatique', 'Institutions / bureaux / usines / industries'),
 ('Ventes institutions / entreprises', 'Institutions / bureaux / usines / industries')
) AS v(nom, cat) JOIN categorie_pdv c ON c.nom = v.cat;

INSERT INTO segment_grade_type_pdv (type_pdv_id, segment, grade)
SELECT t.id, v.segment, v.grade FROM (VALUES
 ('Hypermarché', 'Minimarket', 'A'),
 ('Supermarché A', 'Minimarket', 'A'),
 ('Supermarché B', 'Minimarket', 'B'),
 ('Supermarché C', 'Minimarket', 'B'),
 ('Supérette A', 'Minimarket', 'A'),
 ('Supérette B', 'Minimarket', 'B'),
 ('Supérette C', 'Minimarket', 'C'),
 ('Boutique A', 'Boutique', 'A'),
 ('Boutique B', 'Boutique', 'B'),
 ('Boutique C', 'Boutique', 'C'),
 ('Aboki A', 'Aboki', 'A'),
 ('Aboki B', 'Aboki', 'B'),
 ('Kiosque A', 'Kiosque', 'A'),
 ('Kiosque B', 'Kiosque', 'B'),
 ('Charrette A', 'Pushcart', 'A'),
 ('Charrette B', 'Pushcart', 'B'),
 ('Bouillie', 'Porridge', 'A'),
 ('Étal (table top)', 'TableTop', 'A')
) AS v(nom, segment, grade) JOIN type_pdv t ON t.nom = v.nom;

INSERT INTO segment_visibilite_type_pdv (type_pdv_id, segment)
SELECT t.id, v.segment FROM (VALUES
 ('Boutique A', 'boutique'),
 ('Boutique B', 'boutique'),
 ('Boutique C', 'boutique'),
 ('Supérette A', 'superette'),
 ('Supérette B', 'superette'),
 ('Supérette C', 'superette'),
 ('Hypermarché', 'superette'),
 ('Supermarché A', 'superette'),
 ('Supermarché B', 'superette'),
 ('Supermarché C', 'superette'),
 ('Étal (table top)', 'table_top'),
 ('Étal de marché (table top)', 'table_top'),
 ('Charrette A', 'pushcart'),
 ('Charrette B', 'pushcart'),
 ('Bouillie', 'porridge'),
 ('Kiosque A', 'kiosque_aboki'),
 ('Kiosque B', 'kiosque_aboki'),
 ('Aboki A', 'kiosque_aboki'),
 ('Aboki B', 'kiosque_aboki'),
 ('Café HORECA', 'kiosque_aboki')
) AS v(nom, segment) JOIN type_pdv t ON t.nom = v.nom;

UPDATE pdv SET sous_categorie_pdv='Kiosque A', updated_at=now() WHERE sous_categorie_pdv='Kiosk A';
UPDATE pdv SET sous_categorie_pdv='Supérette A', updated_at=now() WHERE sous_categorie_pdv='Superettes A';
COMMIT;
