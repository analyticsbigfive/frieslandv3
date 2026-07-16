-- ============================================================================
-- MT FACINGS branchés au calcul : en Modern Trade, un produit n'est « disponible »
-- que si quantité ≥ seuil ET facings ≥ seuil (règle ET, implémentation logique du
-- fichier STANDARD DISPO MT — valeurs de facings déjà en base `seuil_disponibilite_mt`).
-- En General Trade : aucun facing → contrainte inactive (comportement inchangé).
--
-- Facings observés : data.produits.<cat>.facings.<sku_key> (saisis en MT sur mobile).
-- Mapping grade PDV MT → format facings : A=Hypermarche, B=MoyenSuper, C=PetitSuper
-- (cohérent avec 20260709150000 : A=Grand/B=Moyen/C=Petit, confirmé Friesland 15/07).
--
-- Idempotent. Recalcule tout l'historique en fin de migration.
-- Dépend de 20260630130100 (fonction), 20260709140000 (seuil_disponibilite_mt).
-- ============================================================================
begin;

create or replace function calculer_dispo_categorie(
  p_data jsonb,
  p_cat text,
  p_canal text,
  p_segment text,
  p_grade text,
  p_base_calcul text default 'taux_vente'
) returns numeric
language sql stable
set search_path = public
as $$
  select case
    when sum(pr.poids) > 0 then
      round(
        sum(pr.poids * (case
          -- Seuil quantité : en MT, priorité au standard MT vivant (seuil_disponibilite_mt),
          -- sinon seuil_disponibilite (GT ou repli). => l'éditeur admin MT est effectif.
          when coalesce((p_data->'produits'->cr.categorie_jsonb->'quantites'->>cr.sku_key)::numeric, 0) >= coalesce(mt.quantite_min, sd.quantite_min)
            -- Contrainte facings : uniquement MT (mt non null), sinon ignorée.
            and (mt.facings is null
                 or coalesce((p_data->'produits'->cr.categorie_jsonb->'facings'->>cr.sku_key)::numeric, 0) >= mt.facings)
          then 1 else 0 end))
        / sum(pr.poids) * 100
      )
    else null
  end
  from correspondance_reference cr
  join reference_produit rp on rp.id = cr.reference_produit_id
  join poids_reference pr on pr.reference_produit_id = rp.id
    and pr.canal = p_canal
    and pr.base_calcul = p_base_calcul
  join seuil_disponibilite sd on sd.reference_produit_id = rp.id
    and sd.segment = p_segment
    and sd.grade = p_grade
  left join seuil_disponibilite_mt mt on p_canal = 'MT'
    and mt.reference_produit_id = rp.id
    and mt.segment_mt = case p_grade
      when 'A' then 'Hypermarche'
      when 'B' then 'MoyenSuper'
      when 'C' then 'PetitSuper'
    end
  where cr.categorie_jsonb = p_cat;
$$;

-- Recalcul complet (le nouveau critère facings peut changer les niveaux MT).
select calculer_perfect_store(id, 'taux_vente') from visites;

commit;
