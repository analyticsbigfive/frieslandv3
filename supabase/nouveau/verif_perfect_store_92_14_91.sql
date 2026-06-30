-- ============================================================================
-- VÉRIFICATION DE BOUT EN BOUT — doit reproduire 92 / 14 / 91
-- 1 merchandiser, 1 PDV (EVAP, commerce traditionnel GT, segment Boutique, grade A),
-- 3 visites = les 3 profils de disponibilité du fichier source.
-- À lancer sur une base de TEST, APRÈS les 6 migrations.   psql ... -f ce_fichier.sql
-- Ré-exécutable (nettoie ses propres données avant de réinsérer).
-- ============================================================================
begin;

-- Nettoyage d'un éventuel passage précédent
delete from visite
 where merchandiser_id in (select id from merchandiser where email='test.merch@bigfive.ci')
    or point_de_vente_id in (select id from point_de_vente where nom='PDV Test EVAP GT');
delete from point_de_vente where nom='PDV Test EVAP GT';
delete from merchandiser   where email='test.merch@bigfive.ci';

-- Merchandiser de test (rattaché à un territoire existant)
insert into merchandiser(nom,email,territoire_id,role)
select 'Test Merch', 'test.merch@bigfive.ci', t.id, 'merchandiser'
from territoire t where t.nom='Cocody 1' limit 1;

-- Point de vente de test
insert into point_de_vente(nom,canal,segment_disponibilite,segment_visibilite,niveau_perfect_store,grade,territoire_id)
select 'PDV Test EVAP GT', 'GT', 'Boutique', 'boutique', 'vip', 'A', t.id
from territoire t where t.nom='Cocody 1' limit 1;

-- 3 visites
insert into visite(point_de_vente_id, merchandiser_id, debut, promo_en_cours, commentaire)
select pv.id, m.id, v.debut::timestamptz, false, v.lib
from point_de_vente pv, merchandiser m,
     (values ('V1','2026-06-01 09:00'),('V2','2026-06-08 09:00'),('V3','2026-06-15 09:00')) as v(lib,debut)
where pv.nom='PDV Test EVAP GT' and m.email='test.merch@bigfive.ci';

-- Relevés de disponibilité (quantité exacte par référence)
insert into releve_disponibilite(visite_id, reference_produit_id, quantite_relevee)
select vi.id, rp.id, d.qte
from (values

  ('V1','BR 150g',48),
  ('V1','BRB 150g',0),
  ('V1','BR 380g',24),
  ('V1','BRB 380g',12),
  ('V1','BR Gold 160g',24),
  ('V1','Pearl 380g',24),
  ('V2','BR 150g',0),
  ('V2','BRB 150g',24),
  ('V2','BR 380g',24),
  ('V2','BRB 380g',0),
  ('V2','BR Gold 160g',24),
  ('V2','Pearl 380g',0),
  ('V3','BR 150g',48),
  ('V3','BRB 150g',0),
  ('V3','BR 380g',24),
  ('V3','BRB 380g',0),
  ('V3','BR Gold 160g',24),
  ('V3','Pearl 380g',24)
) as d(visite, ref, qte)
join visite vi on vi.commentaire=d.visite
join point_de_vente pv on pv.id=vi.point_de_vente_id and pv.nom='PDV Test EVAP GT'
join reference_produit rp on rp.nom=d.ref;

commit;

-- ============================================================================
-- RÉSULTAT : disponibilité pondérée par visite (catégorie EVAP)
-- ============================================================================
select
  vi.commentaire                                   as visite,
  cp.code                                          as categorie,
  sc.osa_pondere                                   as score_obtenu,
  case vi.commentaire when 'V1' then 92 when 'V2' then 14 when 'V3' then 91 end as score_attendu,
  (sc.osa_pondere = case vi.commentaire when 'V1' then 92 when 'V2' then 14 when 'V3' then 91 end) as ok
from v_score_disponibilite_categorie sc
join visite vi             on vi.id = sc.visite_id
join categorie_produit cp  on cp.id = sc.categorie_produit_id
join point_de_vente pv     on pv.id = vi.point_de_vente_id
where pv.nom='PDV Test EVAP GT'
order by vi.commentaire;
