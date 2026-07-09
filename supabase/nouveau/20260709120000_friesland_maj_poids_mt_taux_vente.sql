-- ============================================================================
-- MAJ 2026-07-09 : poids MT taux_vente révisés (mise à jour du fichier BIG FIVE)
-- Source : onglets DISPONIBILITE EVAP/IMP MT (nouveau bloc "Contribution '25").
--
-- Seuls les poids MT base 'taux_vente' d'EVAP (6) et IMP (7) changent.
-- Inchangés : tous les poids GT, tous les 'taux_revu', et SCM (voir note).
-- Chaque catégorie somme à 1.0 après mise à jour.
--
-- ⚠️ SCM MT NON traité ici : le fichier passe SCM MT de 2 à 4 SKU (ajoute
--    '397 R' + 'BRB 1Kg', base DIVISION). Cela nécessite 2 nouvelles
--    reference_produit + correspondance + arbitrage rôles/seuils -> migration
--    séparée après validation Friesland (cf. correspondance_imp_scm_fix ligne 19).
--
-- Idempotent (UPDATE des mêmes valeurs). À exécuter après 20260630120300.
-- ============================================================================
begin;

update poids_reference p
set poids = d.poids
from (
  select rp.id as rid, v.poids
  from (values
    -- EVAP / MT / taux_vente
    ('BR 150g',              0.488953),
    ('BRB 150g',             0.135132),
    ('BR 380g',              0.138184),
    ('BRB 380g',             0.062622),
    ('BR Gold 160g',         0.138855),
    ('Pearl 380g',           0.036255),
    -- IMP / MT / taux_vente
    ('BR 15g',               0.575363),
    ('BR Pouch 360g',        0.240079),
    ('BR Délice 15g',        0.078602),
    ('BR Delice Pouch 350g', 0.063667),
    ('BR tin 400g',          0.023089),
    ('BR tin 900g',          0.013755),
    ('BR tin 2500g',         0.005445)
  ) as v(nom, poids)
  join reference_produit rp on rp.nom = v.nom
) d
where p.reference_produit_id = d.rid
  and p.canal = 'MT'
  and p.base_calcul = 'taux_vente';

-- Recalcul de l'historique pour refléter les nouveaux poids MT dans
-- resultat_perfect_store (sinon le dashboard garde les anciens scores).
-- Sur une base volumineuse : fenêtre de maintenance (peut se restreindre aux
-- PDV MT, seuls impactés, si besoin de performance).
select calculer_perfect_store(id, 'taux_vente') from visites;

commit;
