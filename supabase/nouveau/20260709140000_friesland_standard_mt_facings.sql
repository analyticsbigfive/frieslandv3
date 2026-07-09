-- ============================================================================
-- MAJ 2026-07-09 : STANDARD DE DISPONIBILITÉ MODERN TRADE (+ facings)
-- Source : onglet STANDARD DISPO MT (nouveau contenu réel du fichier).
-- Quantité minimale + nombre de facings par SKU × format supermarché.
--
-- ⚠️ TABLE DE RÉFÉRENCE — PAS ENCORE BRANCHÉE AU CALCUL.
--    Le moteur (calculer_perfect_store) utilise aujourd'hui le repli Minimarket
--    pour le MT. Pour l'activer il faut d'abord une règle métier de classement
--    des PDV MT en Hyper / Moyen / Petit supermarché (colonne segment MT sur pdv)
--    -> à arbitrer Friesland (voir MAJ_2026-07-09_A_ARBITRER.md).
--    Cette migration CHARGE les données du fichier pour qu'elles soient prêtes.
--
-- Idempotent. À exécuter après 20260630120300 (reference_produit).
-- ============================================================================
begin;

create table if not exists seuil_disponibilite_mt (
  reference_produit_id bigint  not null references reference_produit(id) on delete cascade,
  segment_mt           text    not null check (segment_mt in ('Hypermarche','MoyenSuper','PetitSuper')),
  quantite_min         integer not null,
  facings              integer not null,
  primary key (reference_produit_id, segment_mt)
);
alter table seuil_disponibilite_mt enable row level security;
drop policy if exists seuil_mt_read on seuil_disponibilite_mt;
create policy seuil_mt_read on seuil_disponibilite_mt for select to authenticated using (true);
drop policy if exists seuil_mt_write on seuil_disponibilite_mt;
create policy seuil_mt_write on seuil_disponibilite_mt for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('admin','superviseur')))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('admin','superviseur')));

-- (nom SKU fichier -> reference_produit.nom) ; qty/facing par segment
insert into seuil_disponibilite_mt(reference_produit_id, segment_mt, quantite_min, facings)
select rp.id, v.segment_mt, v.qte, v.fac from (values
  -- EVAP
  ('BR Gold 160g','Hypermarche',96,13),('BR Gold 160g','MoyenSuper',48,8),('BR Gold 160g','PetitSuper',24,6),
  ('BR 150g','Hypermarche',144,13),('BR 150g','MoyenSuper',96,8),('BR 150g','PetitSuper',48,6),
  ('BRB 150g','Hypermarche',96,13),('BRB 150g','MoyenSuper',48,8),('BRB 150g','PetitSuper',24,6),
  ('BR 380g','Hypermarche',48,11),('BR 380g','MoyenSuper',24,7),('BR 380g','PetitSuper',24,5),
  ('Pearl 380g','Hypermarche',48,11),('Pearl 380g','MoyenSuper',48,7),('Pearl 380g','PetitSuper',24,5),
  -- IMP
  ('BR tin 400g','Hypermarche',24,7),('BR tin 400g','MoyenSuper',12,4),('BR tin 400g','PetitSuper',12,5),
  ('BR tin 900g','Hypermarche',12,5),('BR tin 900g','MoyenSuper',6,3),('BR tin 900g','PetitSuper',6,3),
  ('BR tin 2500g','Hypermarche',6,3),('BR tin 2500g','MoyenSuper',4,2),('BR tin 2500g','PetitSuper',2,2),
  ('BR Pouch 360g','Hypermarche',30,5),('BR Pouch 360g','MoyenSuper',12,2),('BR Pouch 360g','PetitSuper',6,3),
  ('BR Delice Pouch 350g','Hypermarche',30,5),('BR Delice Pouch 350g','MoyenSuper',12,2),('BR Delice Pouch 350g','PetitSuper',6,3),
  ('BR Délice 15g','Hypermarche',24,2),('BR Délice 15g','MoyenSuper',12,2),('BR Délice 15g','PetitSuper',12,2),
  ('BR 15g','Hypermarche',24,2),('BR 15g','MoyenSuper',12,2),('BR 15g','PetitSuper',12,2),
  -- SCM
  ('BR 1kg','Hypermarche',24,6),('BR 1kg','MoyenSuper',24,4),('BR 1kg','PetitSuper',24,5),
  ('Pearl 1kg','Hypermarche',24,6),('Pearl 1kg','MoyenSuper',24,4),('Pearl 1kg','PetitSuper',24,5)
) as v(nom, segment_mt, qte, fac)
join reference_produit rp on rp.nom = v.nom
on conflict (reference_produit_id, segment_mt) do update
  set quantite_min = excluded.quantite_min, facings = excluded.facings;

commit;
