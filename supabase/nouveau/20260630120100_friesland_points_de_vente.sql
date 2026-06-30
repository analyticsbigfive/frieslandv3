-- ============================================================================
-- Migration 2/4 : POINTS DE VENTE  (onglet TYPE DE POINT DE VENTE)
-- Nomenclature 2 niveaux : categorie_pdv (niveau 3) > type_pdv (niveau 4)
-- Noms de catégories conservés à l'identique. 'canal' GT/MT = proposition à valider.
-- ============================================================================
begin;
create table if not exists categorie_pdv (
  id    bigint generated always as identity primary key,
  nom   text not null unique,
  canal text check (canal in ('GT','MT'))
);
create table if not exists type_pdv (
  id              bigint generated always as identity primary key,
  categorie_pdv_id bigint not null references categorie_pdv(id) on delete cascade,
  nom             text not null unique
);

insert into categorie_pdv(nom) values
  ('Bakery (Chain/Independent)'),
  ('Bricks and Clicks'),
  ('Fuel forecourts'),
  ('Full Service Restaurant'),
  ('Hotel chains'),
  ('Hypermarkets'),
  ('Independent Street Vendor Tea & Coffee'),
  ('Institutes/Office/Factory/Industry'),
  ('Minimarkets'),
  ('Pharmacy Chain/Independent'),
  ('Premium Supermarkets'),
  ('Shop in Shop'),
  ('Small/Medium Grocery GT'),
  ('Traditional Wholesale'),
  ('Value Supermarkets'),
  ('Wet/Public Market'),
  ('Wholesale Club/Cash & Carry')
on conflict (nom) do nothing;

insert into type_pdv(categorie_pdv_id,nom)
select cp.id, v.t from (values
  ('Hypermarkets','Hypermarket'),
  ('Premium Supermarkets','Supermarket A'),
  ('Value Supermarkets','Supermarket B'),
  ('Value Supermarkets','Supermarket C'),
  ('Minimarkets','Superettes A'),
  ('Minimarkets','Superettes B'),
  ('Minimarkets','Superettes C'),
  ('Small/Medium Grocery GT','Boutique A'),
  ('Small/Medium Grocery GT','Boutique B'),
  ('Small/Medium Grocery GT','Boutique C'),
  ('Fuel forecourts','Petrol Station'),
  ('Pharmacy Chain/Independent','Pharmacy A'),
  ('Pharmacy Chain/Independent','Pharmacy B'),
  ('Pharmacy Chain/Independent','Pharmacy C'),
  ('Bakery (Chain/Independent)','Bakery A'),
  ('Bakery (Chain/Independent)','Bakery B'),
  ('Bakery (Chain/Independent)','Bakery C'),
  ('Wet/Public Market','General Grocery stall'),
  ('Wet/Public Market','Open Market Table Top'),
  ('Wet/Public Market','Tmamies (Oil spice & condiments)'),
  ('Traditional Wholesale','Wholesalers'),
  ('Traditional Wholesale','Semi-Wholesalers'),
  ('Wholesale Club/Cash & Carry','Cash & Carry A'),
  ('Wholesale Club/Cash & Carry','Cash & Carry B'),
  ('Bricks and Clicks','E-retailers'),
  ('Shop in Shop','Home delivery'),
  ('Hotel chains','Chain Hotel'),
  ('Hotel chains','Independent Hotel'),
  ('Full Service Restaurant','International Restaurant'),
  ('Full Service Restaurant','Local Restaurant'),
  ('Independent Street Vendor Tea & Coffee','Aboki A'),
  ('Independent Street Vendor Tea & Coffee','Aboki B'),
  ('Independent Street Vendor Tea & Coffee','Kiosk A'),
  ('Independent Street Vendor Tea & Coffee','Kiosk B'),
  ('Independent Street Vendor Tea & Coffee','Pushcard A'),
  ('Independent Street Vendor Tea & Coffee','Pushcard B'),
  ('Independent Street Vendor Tea & Coffee','Horeca coffee'),
  ('Independent Street Vendor Tea & Coffee','Porridge'),
  ('Independent Street Vendor Tea & Coffee','Table Top'),
  ('Institutes/Office/Factory/Industry','Vending machine'),
  ('Institutes/Office/Factory/Industry','Institutes/company sales')
) as v(cat,t)
join categorie_pdv cp on cp.nom=v.cat
on conflict (nom) do nothing;

-- PROPOSITION canal (à valider) : MT = hyper/supermarchés, GT = le reste
update categorie_pdv set canal='MT' where nom in ('Hypermarkets', 'Premium Supermarkets', 'Value Supermarkets');
update categorie_pdv set canal='GT' where canal is null;
commit;
