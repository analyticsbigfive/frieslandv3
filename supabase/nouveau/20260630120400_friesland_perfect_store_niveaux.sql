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
  visibilite_min  numeric,                   -- % matériel obligatoire posé minimal -- TODO confirmer client
  promotion_min   numeric                    -- exécution promo minimale (%) -- TODO confirmer client
);

-- Matériel de visibilité attendu par catégorie de PDV et par niveau.
-- Seul le matériel 'obligatoire' compte dans la note de visibilité (l'optionnel est ignoré).
create table if not exists standard_visibilite (
  id               bigint generated always as identity primary key,
  categorie_pdv_id bigint not null references categorie_pdv(id) on delete cascade,
  niveau_code      text   not null references niveau_perfect_store(code) on delete cascade,
  emplacement      text   not null check (emplacement in ('interieur','exterieur')),
  element          text   not null,          -- ex. enseigne lumineuse, habillage complet, accroche-rayon, tête de gondole…
  obligatoire      boolean not null default true,
  unique (categorie_pdv_id, niveau_code, emplacement, element)
);

-- Seuils de disponibilité en rayon par niveau (valeurs réunion).
insert into niveau_perfect_store(code, rang, dispo_rayon_min, visibilite_min, promotion_min) values
  ('FLAGSHIP STORE',       4, 95, null, null),   -- TODO confirmer client : seuils visibilité / promotion
  ('VIP PERFECT STORE',    3, 85, null, null),   -- TODO confirmer client
  ('CORE PERFECT STORE',   2, 75, null, null),   -- TODO confirmer client
  ('BASIC PERFECT STORE',  1, 60, null, null)    -- TODO confirmer client
on conflict (code) do nothing;

-- TODO confirmer client : matériel de visibilité obligatoire par catégorie/niveau.
-- Données absentes du fichier source (cf. note l.188 de 20260630120300_*). Table créée vide.

commit;
