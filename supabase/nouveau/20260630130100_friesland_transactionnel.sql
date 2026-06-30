-- ============================================================================
-- Migration 6/6 : TRANSACTIONNEL + CALCUL DU PERFECT STORE
-- Stocke ce que les merchandisers saisissent sur le terrain et calcule le score.
-- Dépend des migrations 1 à 5.
-- Trois axes "canal" cohabitent (héritage du fichier source) :
--   - canal                GT/MT        -> sert aux POIDS (poids_reference)
--   - segment_disponibilite (7 valeurs) -> sert aux SEUILS (seuil_disponibilite)
--   - segment_visibilite    (6 valeurs) -> sert au STANDARD (standard_visibilite)
-- ============================================================================
begin;

-- Merchandisers / managers (comptes par territoire, cf. réunion)
create table if not exists merchandiser (
  id           bigint generated always as identity primary key,
  nom          text not null,
  email        text unique,
  territoire_id bigint references territoire(id),
  role         text not null default 'merchandiser' check (role in ('merchandiser','manager')),
  actif        boolean not null default true
);

-- Points de vente (créés depuis l'app)
create table if not exists point_de_vente (
  id                   bigint generated always as identity primary key,
  nom                  text not null,
  type_pdv_id          bigint references type_pdv(id),
  territoire_id        bigint references territoire(id),
  distributeur_id      bigint references distributeur(id),
  canal                text check (canal in ('GT','MT')),
  segment_disponibilite text check (segment_disponibilite in
                          ('Boutique','Minimarket','Kiosque','Aboki','Pushcart','TableTop','Porridge')),
  segment_visibilite   text check (segment_visibilite in
                          ('boutique','superette','table_top','pushcart','porridge','kiosque_aboki')),
  niveau_perfect_store text check (niveau_perfect_store in ('flagship','vip','core','basic')),
  grade                text check (grade in ('A','B','C')),
  latitude             double precision,
  longitude            double precision,
  actif                boolean not null default true,
  cree_le              timestamptz not null default now()
);

-- Une visite = un merchandiser pointe dans un PDV (avec contrôle géofence 50 m)
create table if not exists visite (
  id               bigint generated always as identity primary key,
  point_de_vente_id bigint not null references point_de_vente(id),
  merchandiser_id  bigint not null references merchandiser(id),
  debut            timestamptz not null default now(),
  fin              timestamptz,
  latitude         double precision,
  longitude        double precision,
  distance_m       numeric,                       -- distance au PDV au moment du pointage
  dans_geofence    boolean,                       -- distance_m <= 50
  promo_en_cours   boolean not null default false,-- pilier Promotion évalué seulement si true
  commentaire      text
);

-- Relevé Disponibilité : quantité exacte saisie par référence (cf. réunion)
create table if not exists releve_disponibilite (
  id                   bigint generated always as identity primary key,
  visite_id            bigint not null references visite(id) on delete cascade,
  reference_produit_id bigint not null references reference_produit(id),
  quantite_relevee     integer not null default 0,
  unique (visite_id, reference_produit_id)
);

-- Relevé Visibilité / Promotion : présence de chaque élément du planogramme
create table if not exists releve_visibilite (
  id                   bigint generated always as identity primary key,
  visite_id            bigint not null references visite(id) on delete cascade,
  element_visibilite_id bigint not null references element_visibilite(id),
  present              boolean not null default false,
  unique (visite_id, element_visibilite_id)
);

commit;

-- ============================================================================
-- CALCUL DU SCORE (vues)
-- ============================================================================

-- 1) Disponibilité ligne à ligne : disponible = quantité relevée >= seuil
create or replace view v_disponibilite_ligne as
select
  rd.visite_id,
  rp.categorie_produit_id,
  rd.reference_produit_id,
  pr.poids,
  (rd.quantite_relevee >= sd.quantite_min)::int as disponible
from releve_disponibilite rd
join visite           vi on vi.id = rd.visite_id
join point_de_vente   pv on pv.id = vi.point_de_vente_id
join reference_produit rp on rp.id = rd.reference_produit_id
join seuil_disponibilite sd
     on sd.reference_produit_id = rd.reference_produit_id
    and sd.segment = pv.segment_disponibilite
    and sd.grade   = pv.grade
join poids_reference pr
     on pr.reference_produit_id = rd.reference_produit_id
    and pr.canal = pv.canal;

-- 2) Disponibilité pondérée par catégorie (c'est ce qui donne 92 / 14 / 91)
create or replace view v_score_disponibilite_categorie as
select
  visite_id,
  categorie_produit_id,
  round(100.0 * sum(poids * disponible) / nullif(sum(poids),0)) as osa_pondere
from v_disponibilite_ligne
group by visite_id, categorie_produit_id;

-- 3) Disponibilité globale de la visite (moyenne des catégories présentes)
--    NB : pondération inter-catégories non définie par Friesland -> moyenne simple.
create or replace view v_score_disponibilite as
select visite_id, round(avg(osa_pondere)) as score_disponibilite
from v_score_disponibilite_categorie
group by visite_id;

-- 4) Visibilité : éléments obligatoires présents / obligatoires requis
create or replace view v_score_visibilite as
select
  vi.id as visite_id,
  round(100.0 * count(*) filter (where rv.present) / nullif(count(*),0)) as score_visibilite
from visite vi
join point_de_vente pv on pv.id = vi.point_de_vente_id
join standard_visibilite sv
     on sv.segment = pv.segment_visibilite
    and sv.niveau_perfect_store = pv.niveau_perfect_store
    and sv.requis = true
join element_visibilite ev
     on ev.id = sv.element_visibilite_id
    and ev.pilier = 'visibilite'
    and ev.optionnel = false
left join releve_visibilite rv
     on rv.visite_id = vi.id and rv.element_visibilite_id = ev.id
group by vi.id;

-- 5) Promotion : évaluée uniquement si une promo est en cours
create or replace view v_score_promotion as
select
  vi.id as visite_id,
  round(100.0 * count(*) filter (where rv.present) / nullif(count(*),0)) as score_promotion
from visite vi
join point_de_vente pv on pv.id = vi.point_de_vente_id
join standard_visibilite sv
     on sv.segment = pv.segment_visibilite
    and sv.niveau_perfect_store = pv.niveau_perfect_store
    and sv.requis = true
join element_visibilite ev
     on ev.id = sv.element_visibilite_id
    and ev.pilier = 'promotion'
    and ev.optionnel = false
left join releve_visibilite rv
     on rv.visite_id = vi.id and rv.element_visibilite_id = ev.id
where vi.promo_en_cours = true
group by vi.id;

-- 6) Perfect Store : synthèse des 3 piliers
--    Promo ignorée s'il n'y a pas de promo en cours.
--    NB : pondération entre piliers non définie par Friesland -> moyenne simple
--    des piliers évalués. À ajuster quand la formule officielle est connue.
create or replace view v_score_perfect_store as
select
  vi.id as visite_id,
  d.score_disponibilite,
  v.score_visibilite,
  p.score_promotion,
  round((
    coalesce(d.score_disponibilite,0)
    + coalesce(v.score_visibilite,0)
    + case when vi.promo_en_cours then coalesce(p.score_promotion,0) else 0 end
  ) / (2 + case when vi.promo_en_cours then 1 else 0 end)) as score_perfect_store
from visite vi
left join v_score_disponibilite d on d.visite_id = vi.id
left join v_score_visibilite   v on v.visite_id = vi.id
left join v_score_promotion    p on p.visite_id = vi.id;

-- 7) KPI Couverture : nombre de PDV distincts visités (par merchandiser et par mois)
create or replace view v_couverture as
select
  merchandiser_id,
  date_trunc('month', debut) as mois,
  count(distinct point_de_vente_id) as pdv_visites
from visite
group by merchandiser_id, date_trunc('month', debut);
