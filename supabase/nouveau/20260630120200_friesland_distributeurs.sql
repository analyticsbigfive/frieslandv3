-- ============================================================================
-- Migration 3/4 : DISTRIBUTEURS + MAPPING  (onglets DISTRIBUTEUR, Mapping)
-- Dépend de la migration 1 (territoire). 'national'=true -> couvre tous les territoires.
-- NB : 'ABDI MOHAMED' (Bouna) est probablement le même que 'ABDI'.
-- ============================================================================
begin;
create table if not exists distributeur (
  id       bigint generated always as identity primary key,
  nom      text not null unique,
  national boolean not null default false
);
create table if not exists territoire_distributeur (
  territoire_id   bigint not null references territoire(id)  on delete cascade,
  distributeur_id bigint not null references distributeur(id) on delete cascade,
  primary key (territoire_id, distributeur_id)
);

insert into distributeur(nom,national) values
  ('ABDI',false),
  ('ABDI MOHAMED',false),
  ('ADIALEA RCI',true),
  ('ALI BABA CI',false),
  ('BALDE IBRAHIMA',false),
  ('BON MARCHE',false),
  ('BOUSSOURA SARL',false),
  ('CIVADIS',true),
  ('COMPAGNIE DE DISTRIBUTION (C.D.C.I)',true),
  ('COTE D''IVOIRE SUPERMARCHES',true),
  ('DYNAMIS',false),
  ('ESF KORHOGO',false),
  ('ETABLISSEMENT EL VALAH SARL',false),
  ('ETABLISSEMENT LEMRABOTT & FRÈRES',false),
  ('ETABLISSEMENT NIARE & FRERES',false),
  ('IDMCI',false),
  ('IVOIRE DISTRIBUTION MARCHANDISES C.I',false),
  ('KADERIM SA',true),
  ('KAZA DISTRIBUTION',false),
  ('NICE SERVICE',false),
  ('NOUVEAUX DISTRIBUTEURS ASSOCIES',false),
  ('OMNI RETAIL',false),
  ('PLAISIR BACHUSS',false),
  ('PRODISMA',false),
  ('PROSUMA CASH PORT',true),
  ('PROSUMA DIVISION CENTRALE',true),
  ('RIDACOM',false),
  ('RIZKALLAH MICHEL',false),
  ('SDHPA',false),
  ('SDTP',false),
  ('SIDECOM',false),
  ('SOCOCE COTE D''IVOIRE SA',true),
  ('SOCOCE INTERIEUR',false),
  ('SOCOPRIX',true),
  ('SODIAMA',false),
  ('SODICOM-CI',false),
  ('SODISMAF',false),
  ('SOMALI-CI',false),
  ('Societe des 2 Plateaux - S.2.P',true),
  ('TAHIROU',false),
  ('UP GROUND SALES & MARKETING',false)
on conflict (nom) do nothing;

insert into territoire_distributeur(territoire_id,distributeur_id)
select t.id, d.id from (values
  ('Abengourou','RIZKALLAH MICHEL'),
  ('Abobo 1','ETABLISSEMENT NIARE & FRERES'),
  ('Aboisso','NICE SERVICE'),
  ('Adjame','BOUSSOURA SARL'),
  ('Bassam','OMNI RETAIL'),
  ('Bingerville','DYNAMIS'),
  ('Bondoukou','TAHIROU'),
  ('Bouake 1','SODIAMA'),
  ('Bouake 2','IVOIRE DISTRIBUTION MARCHANDISES C.I'),
  ('Bouna','ABDI MOHAMED'),
  ('Cocody 1','PLAISIR BACHUSS'),
  ('Cocody 2','PRODISMA'),
  ('Daloa','BON MARCHE'),
  ('Divo','RIDACOM'),
  ('Divo','RIDACOM'),
  ('Ferke','ESF KORHOGO'),
  ('Gagnoa 1','SOMALI-CI'),
  ('Gagnoa 2','SOCOCE INTERIEUR'),
  ('Guiglo 1','ETABLISSEMENT EL VALAH SARL'),
  ('Guiglo 2','SODISMAF'),
  ('Katiola','IDMCI'),
  ('Korhogo','ESF KORHOGO'),
  ('Man','ALI BABA CI'),
  ('Mankono','KAZA DISTRIBUTION'),
  ('Marcory','SIDECOM'),
  ('Odienne','BALDE IBRAHIMA'),
  ('Plateau','BOUSSOURA SARL'),
  ('Port bouet','SDTP'),
  ('Port bouet','SDHPA'),
  ('San Pedro','ETABLISSEMENT LEMRABOTT & FRÈRES'),
  ('Soubre','SOCOCE INTERIEUR'),
  ('Treichville','SIDECOM'),
  ('Yamoussoukro','UP GROUND SALES & MARKETING'),
  ('Yopougon 1','SODICOM-CI'),
  ('Yopougon 2','SODICOM-CI'),
  ('Yopougon 3','NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('Yopougon 4','NOUVEAUX DISTRIBUTEURS ASSOCIES')
) as v(terr,distr)
join territoire t on t.nom=v.terr
join distributeur d on d.nom=v.distr
on conflict do nothing;

-- Règle appli : distributeurs d'un territoire = mapping spécifique UNION (national=true).
-- Territoires sans distributeur dans le fichier ('A POURVOIR'/'NOT AVAILABLE') :
--   Abobo 2, Adzope, Agboville, Anyama, Dabou, Dimbokro, koumassi.
commit;