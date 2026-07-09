-- ============================================================================
-- MAJ 2026-07-09 : la colonne `dist` de l'onglet TERRITORY devient CANONIQUE
-- (décision Friesland). Elle était cassée (#REF!) et non reprise en migration 1 ;
-- elle est désormais renseignée et remplace l'onglet Mapping comme source du
-- rattachement territoire -> distributeur.
--
-- Changements vs mapping précédent :
--   + LKA SERVICES (nouveau distributeur) : Bassam, Aboisso, Abobo 2, Anyama
--   ~ DYNAMYS -> DYNAMIS (Bingerville) · Cocody 1 -> PRODISMA · koumassi -> SIDECOM
--     Port bouet -> SDHPA · Bouna -> ABDI · Dabou -> NOUVEAUX DISTRIBUTEURS ASSOCIES
--     Dimbokro -> UP GROUND SALES & MARKETING
--   = 5 des 7 territoires jadis non assignés sont désormais couverts.
--
-- ⚠️ Adzope et Agboville : la cellule `dist` répète le nom du territoire
--    (placeholder) -> restent NON assignés. À arbitrer Friesland.
--
-- Idempotent (DELETE + réinsertion déterministe). À exécuter après 20260630120200.
-- N'impacte pas le scoring (référentiel d'affectation, pas de recalcul requis).
-- ============================================================================
begin;

insert into distributeur(nom, national) values ('LKA SERVICES', false)
on conflict (nom) do nothing;

-- Remplacement complet du mapping par la colonne `dist` (valeur unique par territoire,
-- cohérente sur toutes les areas). Adzope/Agboville exclus (placeholder).
delete from territoire_distributeur;

insert into territoire_distributeur(territoire_id, distributeur_id)
select t.id, d.id from (values
  ('Bingerville','DYNAMIS'),
  ('Cocody 1','PRODISMA'),
  ('Cocody 2','PRODISMA'),
  ('Treichville','SIDECOM'),
  ('Marcory','SIDECOM'),
  ('koumassi','SIDECOM'),
  ('Port bouet','SDHPA'),
  ('Bassam','LKA SERVICES'),
  ('Aboisso','LKA SERVICES'),
  ('Plateau','BOUSSOURA SARL'),
  ('Yopougon 1','SODICOM-CI'),
  ('Yopougon 2','SODICOM-CI'),
  ('Yopougon 3','NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('Yopougon 4','NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('Dabou','NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('Abobo 1','ETABLISSEMENT NIARE & FRERES'),
  ('Abobo 2','LKA SERVICES'),
  ('Anyama','LKA SERVICES'),
  ('Adjame','BOUSSOURA SARL'),
  ('Abengourou','RIZKALLAH MICHEL'),
  ('Yamoussoukro','UP GROUND SALES & MARKETING'),
  ('Dimbokro','UP GROUND SALES & MARKETING'),
  ('Bouake 1','SODIAMA'),
  ('Bouake 2','IVOIRE DISTRIBUTION MARCHANDISES C.I'),
  ('Katiola','IDMCI'),
  ('Korhogo','ESF KORHOGO'),
  ('Ferke','ESF KORHOGO'),
  ('Bondoukou','TAHIROU'),
  ('Bouna','ABDI'),
  ('Daloa','BON MARCHE'),
  ('Divo','RIDACOM'),
  ('Gagnoa 1','SOMALI-CI'),
  ('Gagnoa 2','SOCOCE INTERIEUR'),
  ('Guiglo 1','ETABLISSEMENT EL VALAH SARL'),
  ('Guiglo 2','SODISMAF'),
  ('Man','ALI BABA CI'),
  ('Mankono','KAZA DISTRIBUTION'),
  ('Odienne','BALDE IBRAHIMA'),
  ('San Pedro','ETABLISSEMENT LEMRABOTT & FRÈRES'),
  ('Soubre','SOCOCE INTERIEUR')
) as v(terr, distr)
join territoire t on t.nom = v.terr
join distributeur d on d.nom = v.distr
on conflict do nothing;

commit;
