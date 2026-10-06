-- ============================================================================
-- APP MOBILE 1.0.10 (versionCode 13) : version minimale et lien de téléchargement
--
-- Le binaire 1.0.10 (minSdk 24, vc13) est construit et signé (dist-apk/) mais
-- n'avait jamais été diffusé : le bucket `apk` s'arrêtait à 1.0.6 et
-- version_app.url_telechargement était NULL — l'écran « mise à jour
-- obligatoire » n'affichait alors AUCUN bouton (components/MiseAJourObligatoire.vue).
--
-- À appliquer APRÈS :
--   node scripts/upload-apk.mjs dist-apk/friesland-bonnet-rouge-1.0.10-release.apk --latest
-- qui publie l'APK à l'URL ci-dessous (lien stable `latest`, écrasé à chaque version).
--
-- Attention : 1.0.9 = versionCode 11, 1.0.10 = versionCode 13 (12 n'a jamais
-- été livré). Idempotent.
-- ============================================================================
begin;

update public.version_app
set version_code_min = 13,
    version_nom_min = '1.0.10',
    url_telechargement = coalesce(url_telechargement,
      'https://iirgolfjwdnnesamzcbd.supabase.co/storage/v1/object/public/apk/friesland-bonnet-rouge-latest.apk'),
    message = coalesce(nullif(message, ''), 'Une nouvelle version de l''application est disponible. Installez-la pour continuer.'),
    updated_at = now()
where plateforme = 'android';

insert into public.version_app (plateforme, version_code_min, version_nom_min, url_telechargement, message)
select 'android', 13, '1.0.10',
  'https://iirgolfjwdnnesamzcbd.supabase.co/storage/v1/object/public/apk/friesland-bonnet-rouge-latest.apk',
  'Une nouvelle version de l''application est disponible. Installez-la pour continuer.'
where not exists (select 1 from public.version_app where plateforme = 'android');

commit;
