-- ============================================================================
-- Migration 7/N : CALCUL PERFECT STORE — résultat + fonction + trigger + vues
-- Dépend des migrations 2 (pdv/type), 4 (référentiel), 5 (niveaux), 6 (pont).
-- La fonction est le MIROIR de utils/perfectStore.ts (calculerDisponibiliteRayon) :
--   disponibilité catégorie = round( Σ(poids×dispo) / Σ(poids évalués) × 100 ).
-- Pour le référentiel EVAP·GT (Σ poids = 1), ceci redonne exactement 92/14/91.
-- ============================================================================
begin;

-- Résultat calculé, une ligne par visite.
create table if not exists resultat_perfect_store (
  visite_id        uuid primary key references visites(id) on delete cascade,
  dispo_rayon_evap numeric,
  dispo_rayon_imp  numeric,
  dispo_rayon_scm  numeric,
  dispo_rayon      numeric,            -- agrégat des catégories -- TODO confirmer client (règle de combinaison)
  visibilite       numeric,            -- % matériel obligatoire posé (null tant que standard_visibilite vide)
  promotion        numeric,            -- exécution promo (null si pas de promo)
  niveau           text references niveau_perfect_store(code),
  calcule_le       timestamptz not null default now()
);

-- --- Disponibilité en rayon pondérée d'UNE catégorie (en %, ou NULL si rien d'évaluable) ---
-- Renormalisée par la somme des poids effectivement évalués (références ayant poids + seuil applicables).
create or replace function calculer_dispo_categorie(
  p_data jsonb, p_cat text, p_canal text, p_segment text, p_grade text
) returns numeric
language sql stable as $$
  select case
    when sum(pr.poids) > 0 then
      round(
        sum(pr.poids * (case
          when coalesce((p_data->'produits'->cr.categorie_jsonb->'quantites'->>cr.sku_key)::numeric, 0) >= sd.quantite_min
          then 1 else 0 end))
        / sum(pr.poids) * 100
      )
    else null
  end
  from correspondance_reference cr
  join reference_produit rp on rp.id = cr.reference_produit_id
  join poids_reference pr   on pr.reference_produit_id = rp.id and pr.canal = p_canal
  join seuil_disponibilite sd on sd.reference_produit_id = rp.id and sd.segment = p_segment and sd.grade = p_grade
  where cr.categorie_jsonb = p_cat;
$$;

-- --- Calcul complet pour une visite (upsert dans resultat_perfect_store) ---
-- SECURITY DEFINER : la fonction écrit le résultat même si l'appelant (merchandiser)
-- n'a pas le droit d'écrire directement dans resultat_perfect_store (RLS lecture seule).
create or replace function calculer_perfect_store(p_visite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data   jsonb;
  v_pdv    text;
  v_canal  text;
  v_segment text;
  v_grade  text;
  v_evap numeric; v_imp numeric; v_scm numeric;
  v_dispo numeric;
  v_visi numeric := null;   -- TODO : calculer quand standard_visibilite est seedé
  v_promo numeric := null;  -- pas de promo dans les données terrain actuelles
  v_niveau text;
begin
  select data, pdv_id into v_data, v_pdv from visites where id = p_visite_id;
  if v_data is null then
    return;
  end if;

  -- Résolution PDV -> canal (GT/MT), segment, grade. Lien faible (cf. TODO migration 120500) :
  -- on passe par type_pdv (= pdv.sous_categorie_pdv) car pdv.canal vaut 'General trade', pas 'GT'/'MT'.
  select coalesce(cp.canal, 'GT'), sg.segment, sg.grade
    into v_canal, v_segment, v_grade
  from pdv p
  left join type_pdv tp on tp.nom = p.sous_categorie_pdv
  left join categorie_pdv cp on cp.id = tp.categorie_pdv_id
  left join segment_grade_type_pdv sg on sg.type_pdv_id = tp.id
  where p.pdv_id = v_pdv;

  if v_canal is null then v_canal := 'GT'; end if;

  v_evap := calculer_dispo_categorie(v_data, 'evap', v_canal, v_segment, v_grade);
  v_imp  := calculer_dispo_categorie(v_data, 'imp',  v_canal, v_segment, v_grade);
  v_scm  := calculer_dispo_categorie(v_data, 'scm',  v_canal, v_segment, v_grade);

  -- Agrégat = moyenne des catégories évaluées (non nulles). -- TODO confirmer client.
  select round(avg(x)) into v_dispo
  from (values (v_evap), (v_imp), (v_scm)) as t(x)
  where x is not null;

  -- Niveau : gating conjonctif (ET). Un seuil NULL n'est pas exigé. Plus haut rang satisfait.
  select n.code into v_niveau
  from niveau_perfect_store n
  where v_dispo is not null and v_dispo >= n.dispo_rayon_min
    and (n.visibilite_min is null or (v_visi  is not null and v_visi  >= n.visibilite_min))
    and (n.promotion_min  is null or (v_promo is not null and v_promo >= n.promotion_min))
  order by n.rang desc
  limit 1;

  insert into resultat_perfect_store(
    visite_id, dispo_rayon_evap, dispo_rayon_imp, dispo_rayon_scm,
    dispo_rayon, visibilite, promotion, niveau, calcule_le)
  values (p_visite_id, v_evap, v_imp, v_scm, v_dispo, v_visi, v_promo, v_niveau, now())
  on conflict (visite_id) do update set
    dispo_rayon_evap = excluded.dispo_rayon_evap,
    dispo_rayon_imp  = excluded.dispo_rayon_imp,
    dispo_rayon_scm  = excluded.dispo_rayon_scm,
    dispo_rayon      = excluded.dispo_rayon,
    visibilite       = excluded.visibilite,
    promotion        = excluded.promotion,
    niveau           = excluded.niveau,
    calcule_le       = now();
end;
$$;

-- --- Trigger : recalcul automatique à chaque insert/update de visite ---
create or replace function trg_calculer_perfect_store()
returns trigger
language plpgsql as $$
begin
  perform calculer_perfect_store(NEW.id);
  return NEW;
end;
$$;

drop trigger if exists trg_perfect_store on visites;
create trigger trg_perfect_store
  after insert or update on visites
  for each row execute function trg_calculer_perfect_store();

-- --- Sécurité : résultat lisible par tout authentifié ; écriture réservée à la fonction ---
alter table resultat_perfect_store enable row level security;
drop policy if exists resultat_perfect_store_read on resultat_perfect_store;
create policy resultat_perfect_store_read on resultat_perfect_store
  for select to authenticated using (true);

-- --- Vues de restitution ---
create or replace view v_perfect_store_global as
  select coalesce(niveau, 'Aucun niveau') as niveau,
         count(*)                          as nb_visites,
         round(avg(dispo_rayon), 1)        as dispo_rayon_moyen
  from resultat_perfect_store
  group by coalesce(niveau, 'Aucun niveau');

create or replace view v_perfect_store_par_categorie_pdv as
  select p.categorie_pdv,
         coalesce(r.niveau, 'Aucun niveau') as niveau,
         count(*)                            as nb_visites,
         round(avg(r.dispo_rayon), 1)        as dispo_rayon_moyen
  from resultat_perfect_store r
  join visites v on v.id = r.visite_id
  join pdv p     on p.pdv_id = v.pdv_id
  group by p.categorie_pdv, coalesce(r.niveau, 'Aucun niveau');

-- Couverture : PDV distincts visités par merchandiser et par mois.
create or replace view v_couverture as
  select v.commercial                                          as merchandiser,
         to_char(date_trunc('month', v.date_visite), 'YYYY-MM') as periode,
         count(distinct v.pdv_id)                              as pdv_vus,
         null::int     as cible,    -- TODO confirmer client (objectif de couverture)
         null::numeric as taux      -- = pdv_vus / cible × 100 quand la cible est connue
  from visites v
  group by v.commercial, date_trunc('month', v.date_visite);

-- Backfill (optionnel, à lancer une fois après migration ; peut être long sur l'historique) :
--   select calculer_perfect_store(id) from visites;

commit;
