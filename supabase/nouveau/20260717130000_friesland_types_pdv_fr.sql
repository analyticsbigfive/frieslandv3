-- ============================================================================
-- Libellés FRANÇAIS des types de PDV + correctif pilier TG en Modern Trade.
-- Sources : docs/ajour/types-de-pdv.csv (feuille « Types de PDV ») et
--           docs/ajour/criteres-donnees.csv (feuille « Critères (données) »,
--           17/07/2026).
--
-- Les colonnes `nom` (EN, ex. 'Superettes A', 'Pushcard A') restent la clé :
-- elles sont utilisées par le matching front (visibilitySegmentForPdv) et par
-- les seeds existants. La traduction vit dans `nom_fr`, à brancher côté
-- affichage. Le canal « Alternatif / HORECA » du CSV n'est PAS répercuté sur
-- categorie_pdv.canal (contrainte GT/MT + impact pondérations) : à arbitrer.
--
-- Migration idempotente, rejouable.
-- ============================================================================
begin;

-- 1. Traductions FR des catégories (niveau 3).
alter table categorie_pdv add column if not exists nom_fr text;
update categorie_pdv c
set nom_fr = v.nom_fr
from (values
  ('Hypermarkets','Hypermarchés'),
  ('Premium Supermarkets','Supermarchés premium'),
  ('Value Supermarkets','Supermarchés économiques'),
  ('Minimarkets','Supérettes'),
  ('Small/Medium Grocery GT','Épiceries de proximité (GT)'),
  ('Fuel forecourts','Boutiques de station-service'),
  ('Pharmacy Chain/Independent','Pharmacies (chaînes & indépendantes)'),
  ('Bakery (Chain/Independent)','Boulangeries (chaînes & indépendantes)'),
  ('Wet/Public Market','Marchés publics'),
  ('Traditional Wholesale','Commerce de gros traditionnel'),
  ('Wholesale Club/Cash & Carry','Libre-service de gros'),
  ('Bricks and Clicks','Commerce en ligne'),
  ('Shop in Shop','Corner (shop-in-shop)'),
  ('Hotel chains','Hôtellerie'),
  ('Full Service Restaurant','Restauration'),
  ('Independent Street Vendor Tea & Coffee','Vente ambulante thé & café'),
  ('Institutes/Office/Factory/Industry','Institutions & entreprises')
) as v(nom, nom_fr)
where c.nom = v.nom;

-- 2. Traductions FR des types (niveau 4).
alter table type_pdv add column if not exists nom_fr text;
update type_pdv t
set nom_fr = v.nom_fr
from (values
  ('Hypermarket','Hypermarché'),
  ('Supermarket A','Supermarché A'),
  ('Supermarket B','Supermarché B'),
  ('Supermarket C','Supermarché C'),
  ('Superettes A','Supérette A'),
  ('Superettes B','Supérette B'),
  ('Superettes C','Supérette C'),
  ('Boutique A','Boutique A'),
  ('Boutique B','Boutique B'),
  ('Boutique C','Boutique C'),
  ('Petrol Station','Station-service'),
  ('Pharmacy A','Pharmacie A'),
  ('Pharmacy B','Pharmacie B'),
  ('Pharmacy C','Pharmacie C'),
  ('Bakery A','Boulangerie A'),
  ('Bakery B','Boulangerie B'),
  ('Bakery C','Boulangerie C'),
  ('General Grocery stall','Étal d''épicerie générale'),
  ('Open Market Table Top','Table top de marché ouvert'),
  ('Tmamies (Oil spice & condiments)','Tmamies (huile, épices & condiments)'),
  ('Wholesalers','Grossistes'),
  ('Semi-Wholesalers','Demi-grossistes'),
  ('Cash & Carry A','Cash & Carry A'),
  ('Cash & Carry B','Cash & Carry B'),
  ('E-retailers','E-commerçants'),
  ('Home delivery','Livraison à domicile'),
  ('Chain Hotel','Hôtel de chaîne'),
  ('Independent Hotel','Hôtel indépendant'),
  ('International Restaurant','Restaurant international'),
  ('Local Restaurant','Restaurant local'),
  ('Aboki A','Aboki A'),
  ('Aboki B','Aboki B'),
  ('Kiosk A','Kiosque A'),
  ('Kiosk B','Kiosque B'),
  ('Pushcard A','Pushcart A (chariot ambulant)'),
  ('Pushcard B','Pushcart B (chariot ambulant)'),
  ('Horeca coffee','Café HORECA'),
  ('Porridge','Bouillie (porridge)'),
  ('Table Top','Table top'),
  ('Vending machine','Distributeur automatique'),
  ('Institutes/company sales','Ventes institutions / entreprises')
) as v(nom, nom_fr)
where t.nom = v.nom;

-- 3. Modern Trade : la feuille « Critères (données) » classe « TG (activités
--    promotionnelles) » sous le pilier Promotion (le seed 20260716210000
--    l'avait mis en visibilité intérieure). Aligné ici, puis recalcul.
update element_visibilite
set pilier = 'promotion', emplacement = 'promotion'
where segment = 'mt' and code = 'tg';

select calculer_perfect_store(id, 'taux_vente') from visites;

commit;
