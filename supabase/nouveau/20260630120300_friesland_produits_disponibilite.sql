-- ============================================================================
-- Migration 4/4 : PRODUITS, POIDS & SEUILS DE DISPONIBILITÉ
-- Sources : onglet DISPONIBILITE GT (seuils) + onglets DISPONIBILITE *_GT/_MT (poids)
-- role : phare | soutien | croissance | nouveaute | a_retirer
-- canal : GT (commerce traditionnel) | MT (commerce moderne)
-- UHT volontairement exclu (référence à retirer).
-- ============================================================================
begin;
create table if not exists categorie_produit (
  id   bigint generated always as identity primary key,
  code text not null unique,           -- EVAP, IMP, SCM
  nom  text not null
);
create table if not exists reference_produit (
  id                   bigint generated always as identity primary key,
  nom                  text not null unique,
  categorie_produit_id bigint not null references categorie_produit(id),
  role                 text not null check (role in ('phare','soutien','croissance','nouveaute','a_retirer'))
);
-- Poids de chaque référence dans la disponibilité pondérée (somme = 1 par catégorie+canal)
create table if not exists poids_reference (
  reference_produit_id bigint not null references reference_produit(id) on delete cascade,
  canal                text not null check (canal in ('GT','MT')),
  base_calcul          text not null default 'taux_vente'
                       check (base_calcul in ('taux_vente','taux_revu')),
  poids                numeric not null,
  primary key (reference_produit_id, canal, base_calcul)
);
alter table poids_reference
  add column if not exists base_calcul text not null default 'taux_vente';
alter table poids_reference drop constraint if exists poids_reference_base_calcul_check;
alter table poids_reference add constraint poids_reference_base_calcul_check
  check (base_calcul in ('taux_vente','taux_revu'));
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid='poids_reference'::regclass
      and contype='p'
      and pg_get_constraintdef(oid) not ilike '%base_calcul%'
  ) then
    alter table poids_reference drop constraint poids_reference_pkey;
    alter table poids_reference
      add primary key(reference_produit_id,canal,base_calcul);
  end if;
end $$;
-- Quantité minimale pour être 'disponible', par segment de PDV et grade
create table if not exists seuil_disponibilite (
  reference_produit_id bigint not null references reference_produit(id) on delete cascade,
  segment              text not null check (segment in ('Boutique','Minimarket','Kiosque','Aboki','Pushcart','TableTop','Porridge')),
  grade                text not null check (grade in ('A','B','C')),
  quantite_min         integer not null,
  primary key (reference_produit_id, segment, grade)
);
-- Règle d'assortiment indiquée sous le tableau de disponibilité :
-- nombre de SKU cibles, minimum présents et présence obligatoire des Hero SKU.
create table if not exists standard_assortiment (
  segment              text not null check (segment in ('Boutique','Minimarket')),
  grade                text not null check (grade in ('A','B','C')),
  sku_cibles           integer not null check (sku_cibles > 0),
  min_sku_presents     integer not null check (min_sku_presents > 0),
  heros_obligatoires  boolean not null default true,
  primary key (segment, grade)
);

insert into categorie_produit(code,nom) values
  ('EVAP','Lait évaporé'),
  ('IMP','Lait en poudre'),
  ('SCM','Lait concentré sucré')
on conflict (code) do nothing;

insert into reference_produit(nom,categorie_produit_id,role)
select v.nom, cp.id, v.role from (values
  ('BR Gold 160g','EVAP','soutien'),
  ('BR 150g','EVAP','phare'),
  ('BRB 150g','EVAP','croissance'),
  ('BR 380g','EVAP','soutien'),
  ('BRB 380g','EVAP','a_retirer'),
  ('Pearl 380g','EVAP','soutien'),
  ('BR 15g','IMP','phare'),
  ('BR Délice 15g','IMP','nouveaute'),
  ('BR Pouch 360g','IMP','croissance'),
  ('BR Delice Pouch 350g','IMP','nouveaute'),
  ('BR tin 400g','IMP','croissance'),
  ('BR tin 900g','IMP','soutien'),
  ('BR tin 2500g','IMP','soutien'),
  ('BR 1kg','SCM','soutien'),
  ('Pearl 1kg','SCM','croissance')
) as v(nom,cat,role)
join categorie_produit cp on cp.code=v.cat
on conflict (nom) do nothing;

insert into poids_reference(reference_produit_id,canal,poids)
select rp.id, v.canal, v.poids from (values
  ('BR 150g','GT',0.749443117),
  ('BRB 150g','GT',0.08421527549),
  ('BR 380g','GT',0.04827634345),
  ('BRB 380g','GT',0.005407986339),
  ('BR Gold 160g','GT',0.009468528271),
  ('Pearl 380g','GT',0.1031887494),
  ('BR 15g','GT',0.8549315705),
  ('BR Pouch 360g','GT',0.05424448477),
  ('BR Délice 15g','GT',0.07805304413),
  ('BR Delice Pouch 350g','GT',0.008819685235),
  ('BR tin 400g','GT',0.002414206552),
  ('BR tin 900g','GT',0.0009114034803),
  ('BR tin 2500g','GT',0.0006256053519412669),
  ('Pearl 1kg','GT',0.9461997208476083),
  ('BR 1kg','GT',0.05380027915239183),
  ('BR 150g','MT',0.6883495803612449),
  ('BRB 150g','MT',0.09333611065985105),
  ('BR 380g','MT',0.08438338534176236),
  ('BRB 380g','MT',0.037705363529118255),
  ('BR Gold 160g','MT',0.042834613860254625),
  ('Pearl 380g','MT',0.05339094624776877),
  ('BR 15g','MT',0.5578973264423553),
  ('BR Pouch 360g','MT',0.17125631171890085),
  ('BR Délice 15g','MT',0.10108308433953332),
  ('BR Delice Pouch 350g','MT',0.04246753155101114),
  ('BR tin 400g','MT',0.06373779055450027),
  ('BR tin 900g','MT',0.03676065927260427),
  ('BR tin 2500g','MT',0.02679729612109489),
  ('Pearl 1kg','MT',0.4677043522764932),
  ('BR 1kg','MT',0.44385217874148497)
) as v(nom,canal,poids)
join reference_produit rp on rp.nom=v.nom
on conflict do nothing;

-- Pondérations revues/validées dans les feuilles DISPONIBILITE *_GT/_MT.
insert into poids_reference(reference_produit_id,canal,base_calcul,poids)
select rp.id, v.canal, 'taux_revu', v.poids from (values
  ('BR 150g','GT',0.65),('BRB 150g','GT',0.07),('BR 380g','GT',0.05),
  ('BRB 380g','GT',0.03),('BR Gold 160g','GT',0.10),('Pearl 380g','GT',0.10),
  ('BR 15g','GT',0.76),('BR Pouch 360g','GT',0.07),('BR Délice 15g','GT',0.05),
  ('BR Delice Pouch 350g','GT',0.03),('BR tin 400g','GT',0.05),
  ('BR tin 900g','GT',0.02),('BR tin 2500g','GT',0.02),
  ('Pearl 1kg','GT',0.9461997208476083),('BR 1kg','GT',0.05380027915239183),
  ('BR 150g','MT',0.55),('BRB 150g','MT',0.12),('BR 380g','MT',0.08),
  ('BRB 380g','MT',0.05),('BR Gold 160g','MT',0.15),('Pearl 380g','MT',0.05),
  ('BR 15g','MT',0.25),('BR Pouch 360g','MT',0.16),('BR Délice 15g','MT',0.15),
  ('BR Delice Pouch 350g','MT',0.10),('BR tin 400g','MT',0.15),
  ('BR tin 900g','MT',0.12),('BR tin 2500g','MT',0.07),
  ('Pearl 1kg','MT',0.30),('BR 1kg','MT',0.70)
) as v(nom,canal,poids)
join reference_produit rp on rp.nom=v.nom
on conflict (reference_produit_id,canal,base_calcul)
do update set poids=excluded.poids;

insert into seuil_disponibilite(reference_produit_id,segment,grade,quantite_min)
select rp.id, v.segment, v.grade, v.qte from (values
  ('BR Gold 160g','Boutique','A',24),
  ('BR Gold 160g','Boutique','B',24),
  ('BR Gold 160g','Boutique','C',12),
  ('BR Gold 160g','Minimarket','A',24),
  ('BR Gold 160g','Minimarket','B',12),
  ('BR 150g','Boutique','A',48),
  ('BR 150g','Boutique','B',36),
  ('BR 150g','Boutique','C',18),
  ('BR 150g','Minimarket','A',48),
  ('BR 150g','Minimarket','B',24),
  ('BRB 150g','Boutique','A',24),
  ('BRB 150g','Boutique','B',18),
  ('BRB 150g','Boutique','C',12),
  ('BRB 150g','Minimarket','A',24),
  ('BRB 150g','Minimarket','B',18),
  ('BR 380g','Boutique','A',24),
  ('BR 380g','Boutique','B',18),
  ('BR 380g','Boutique','C',10),
  ('BR 380g','Minimarket','A',24),
  ('BR 380g','Minimarket','B',18),
  ('BR 380g','Porridge','A',2),
  ('BRB 380g','Boutique','A',12),
  ('BRB 380g','Boutique','B',12),
  ('BRB 380g','Boutique','C',6),
  ('BRB 380g','Minimarket','A',12),
  ('BRB 380g','Minimarket','B',12),
  ('Pearl 380g','Boutique','A',24),
  ('Pearl 380g','Boutique','B',18),
  ('Pearl 380g','Boutique','C',10),
  ('Pearl 380g','Minimarket','A',24),
  ('Pearl 380g','Minimarket','B',18),
  ('Pearl 380g','Kiosque','A',3),
  ('Pearl 380g','Kiosque','B',3),
  ('Pearl 380g','Aboki','A',2),
  ('Pearl 380g','Aboki','B',1),
  ('BR 15g','Boutique','A',12),
  ('BR 15g','Boutique','B',12),
  ('BR 15g','Boutique','C',3),
  ('BR 15g','Minimarket','A',12),
  ('BR 15g','Minimarket','B',12),
  ('BR Délice 15g','Boutique','A',12),
  ('BR Délice 15g','Boutique','B',12),
  ('BR Délice 15g','Boutique','C',3),
  ('BR Délice 15g','Minimarket','A',12),
  ('BR Délice 15g','Minimarket','B',12),
  ('BR Délice 15g','Pushcart','A',2),
  ('BR Délice 15g','Pushcart','B',2),
  ('BR Délice 15g','TableTop','A',1),
  ('BR Délice 15g','Porridge','A',1),
  ('BR Pouch 360g','Boutique','A',6),
  ('BR Pouch 360g','Boutique','B',3),
  ('BR Pouch 360g','Boutique','C',3),
  ('BR Pouch 360g','Minimarket','A',6),
  ('BR Pouch 360g','Minimarket','B',3),
  ('BR Delice Pouch 350g','Boutique','A',6),
  ('BR Delice Pouch 350g','Boutique','B',3),
  ('BR Delice Pouch 350g','Boutique','C',3),
  ('BR Delice Pouch 350g','Minimarket','A',6),
  ('BR Delice Pouch 350g','Minimarket','B',3),
  ('BR tin 400g','Boutique','A',12),
  ('BR tin 400g','Boutique','B',6),
  ('BR tin 400g','Boutique','C',3),
  ('BR tin 400g','Minimarket','A',12),
  ('BR tin 400g','Minimarket','B',6),
  ('BR tin 900g','Boutique','A',6),
  ('BR tin 900g','Boutique','B',3),
  ('BR tin 900g','Minimarket','A',6),
  ('BR tin 900g','Minimarket','B',3),
  ('BR tin 2500g','Boutique','A',3),
  ('BR tin 2500g','Minimarket','A',3),
  ('BR tin 2500g','Minimarket','B',3),
  ('BR 1kg','Boutique','A',3),
  ('BR 1kg','Minimarket','A',6),
  ('BR 1kg','Minimarket','B',3),
  ('Pearl 1kg','Boutique','A',12),
  ('Pearl 1kg','Boutique','B',6),
  ('Pearl 1kg','Boutique','C',3),
  ('Pearl 1kg','Minimarket','A',12),
  ('Pearl 1kg','Minimarket','B',6),
  ('Pearl 1kg','Kiosque','A',3),
  ('Pearl 1kg','Kiosque','B',2),
  ('Pearl 1kg','Aboki','A',3),
  ('Pearl 1kg','Aboki','B',2)
) as v(nom,segment,grade,qte)
join reference_produit rp on rp.nom=v.nom
on conflict do nothing;

insert into standard_assortiment(
  segment,grade,sku_cibles,min_sku_presents,heros_obligatoires
) values
  ('Boutique','A',15,10,true),
  ('Boutique','B',12,8,true),
  ('Boutique','C',11,5,true),
  ('Minimarket','A',15,10,true),
  ('Minimarket','B',12,8,true),
  ('Minimarket','C',11,5,true)
on conflict (segment,grade) do update set
  sku_cibles = excluded.sku_cibles,
  min_sku_presents = excluded.min_sku_presents,
  heros_obligatoires = excluded.heros_obligatoires;

-- Les deux bases du fichier sont conservées : taux_vente et taux_revu.
-- Seuils de visibilité MT (hyper/supermarchés) : absents du fichier -> à fournir.
-- Test d'acceptation EVAP/GT : poids 150g rouge=0.7494 ... -> doit donner 92/14/91.
commit;
