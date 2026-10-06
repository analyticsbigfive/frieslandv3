-- ============================================================================
-- APP MOBILE 1.0.11 (versionCode 14) : version minimale
--
-- 1.0.11 : badge du canal Atom dans la tournée, écrans « Mes tournées » et
-- « Mes objectifs », objectif du jour = taille de la tournée, « Se souvenir de
-- moi » à la connexion, statut d'étape de tournée mis en file hors ligne (une
-- visite enregistrée sans réseau n'affiche plus « Erreur » et clôt son étape à
-- la reconnexion).
--
-- À appliquer APRÈS :
--   node scripts/upload-apk.mjs dist-apk/friesland-bonnet-rouge-1.0.11-release.apk --latest
-- qui remplace l'APK du lien stable `latest` (url_telechargement inchangée).
--
-- Effet : les téléphones en 1.0.10 (versionCode 13) voient l'écran « mise à
-- jour obligatoire » jusqu'à installation de la 1.0.11. Idempotent.
-- ============================================================================
begin;

update public.version_app
set version_code_min = 14,
    version_nom_min = '1.0.11',
    updated_at = now()
where plateforme = 'android'
  and version_code_min < 14;

commit;
