-- ============================================================
-- 010_optimize_pdv_indexes.sql - Performance indexes for PDV listing
-- À exécuter dans le SQL Editor de Supabase.
-- Sûr à ré-exécuter (IF NOT EXISTS).
--
-- Problème: les listes PDV (admin + mobile/marchandiseur) filtrent
-- toujours `is_active = true` puis trient par `nom_pdv`, souvent
-- scopé par zone / secteur / region. Sans index composite, Postgres
-- fait un seq scan + tri de toute la table à chaque chargement.
-- ============================================================

-- Active la recherche trigram (ilike '%terme%' sans seq scan)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Liste globale: WHERE is_active = true ORDER BY nom_pdv
CREATE INDEX IF NOT EXISTS idx_pdv_active_nom
  ON public.pdv (nom_pdv)
  WHERE is_active = true;

-- Scope admin par zone + tri (filtre zone)
CREATE INDEX IF NOT EXISTS idx_pdv_active_zone_nom
  ON public.pdv (zone, nom_pdv)
  WHERE is_active = true;

-- Scope marchandiseur par secteur + tri (buildScopedQuery)
CREATE INDEX IF NOT EXISTS idx_pdv_active_secteur_nom
  ON public.pdv (secteur, nom_pdv)
  WHERE is_active = true;

-- Filtre region + tri
CREATE INDEX IF NOT EXISTS idx_pdv_active_region_nom
  ON public.pdv (region, nom_pdv)
  WHERE is_active = true;

-- Recherche texte rapide (nom, id, adressage) via .or(ilike)
CREATE INDEX IF NOT EXISTS idx_pdv_nom_trgm
  ON public.pdv USING gin (nom_pdv gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pdv_pdvid_trgm
  ON public.pdv USING gin (pdv_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pdv_adressage_trgm
  ON public.pdv USING gin (adressage gin_trgm_ops);

-- Met à jour les stats du planificateur
ANALYZE public.pdv;
