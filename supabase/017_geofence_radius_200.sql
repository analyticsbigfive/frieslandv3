-- ============================================================
-- 017_geofence_radius_200.sql
-- Aligne le rayon de géofence sur 200 m (décision meeting : alerte < 200 m).
-- La config app (nuxt.config runtimeConfig.public.geofenceRadius) est aussi à 200.
-- À exécuter dans le SQL Editor de Supabase. Idempotent.
-- ============================================================

-- Nouveau défaut pour les PDV créés ensuite
ALTER TABLE public.pdv ALTER COLUMN rayon_geofence SET DEFAULT 200;

-- Réaligne les PDV restés sur l'ancien défaut (300) vers 200.
-- (300 était le défaut universel précédent ; aucun rayon custom connu.)
UPDATE public.pdv SET rayon_geofence = 200 WHERE rayon_geofence = 300;
