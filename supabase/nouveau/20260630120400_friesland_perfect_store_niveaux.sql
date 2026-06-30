-- ============================================================================
-- Migration 5/N : NIVEAUX PERFECT STORE + STANDARDS DE VISIBILITÉ
-- Dépend de la migration 2 (categorie_pdv).
-- Les 4 niveaux vont du plus exigeant (FLAGSHIP STORE) au moins exigeant
-- (BASIC PERFECT STORE). Attribution = gating conjonctif (ET) : un niveau n'est
-- atteint que si TOUS ses seuils minimaux sont satisfaits en même temps.
-- ============================================================================
begin;

-- Seuils minimaux par niveau. Un seuil NULL = pilier non exigé à ce niveau.
create table if not exists niveau_perfect_store (
  code            text primary key,          -- 'FLAGSHIP STORE' | 'VIP PERFECT STORE' | 'CORE PERFECT STORE' | 'BASIC PERFECT STORE'
  rang            int  not null,             -- plus grand = plus exigeant
  dispo_rayon_min numeric,                   -- disponibilité en rayon minimale (%)
  visibilite_min  numeric,                   -- visibilité parfaite = 100 %
  promotion_min   numeric                    -- exécution promo = 100 % si applicable
);

-- Seuils de disponibilité en rayon par niveau (valeurs réunion).
insert into niveau_perfect_store(code, rang, dispo_rayon_min, visibilite_min, promotion_min) values
  ('FLAGSHIP STORE',       4, 95, 100, 100),
  ('VIP PERFECT STORE',    3, 85, 100, 100),
  ('CORE PERFECT STORE',   2, 75, 100, 100),
  ('BASIC PERFECT STORE',  1, 60, 100, 100)
on conflict (code) do update set
  rang = excluded.rang,
  dispo_rayon_min = excluded.dispo_rayon_min,
  visibilite_min = excluded.visibilite_min,
  promotion_min = excluded.promotion_min;

-- La promotion est optionnelle par visite : promotion_min ne s'applique que
-- lorsque visites.data.visibilite.promotion_applicable = true.

commit;
