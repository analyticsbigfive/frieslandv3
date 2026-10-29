-- ============================================================================
-- APP MOBILE 1.0.17 (versionCode 20) : version minimale
--
-- 1.0.17 : GPS obligatoire pour faire une visite (aide de la tablette, « Êtes-
-- vous bien devant ? »), création de PDV avec photo de la devanture et contrôle
-- des doublons, compteur du jour selon l'objectif (visite libre, pushcarts).
-- La 1.0.16 n'est jamais sortie.
--
-- Appliquée le 29/10/2026 à la demande de Jean Luc, APRÈS
--   node scripts/upload-apk.mjs dist-apk/friesland-bonnet-rouge-1.0.17-release.apk --latest
-- et vérification du lien `latest` (versionCode 20, même empreinte que l'APK
-- construit). url_telechargement inchangée.
--
-- Effet : les tablettes en 1.0.15 et avant voient l'écran « mise à jour
-- obligatoire » jusqu'à installation de la 1.0.17. Idempotent.
-- ============================================================================
begin;

update public.version_app
set version_code_min = 20,
    version_nom_min = '1.0.17',
    version_code_dispo = greatest(coalesce(version_code_dispo, 0), 20),
    version_nom_dispo = case when coalesce(version_code_dispo, 0) <= 20 then '1.0.17' else version_nom_dispo end,
    message = 'Version 1.0.17 : la position de la tablette est obligatoire pour faire une visite. Si elle ne vient pas, l''application explique quoi régler. Loin du point de vente, elle demande « Êtes-vous bien devant ? » au lieu de bloquer. Le compteur du jour suit l''objectif (3/20 en visite libre).',
    updated_at = now()
where plateforme = 'android'
  and version_code_min < 20;

commit;
