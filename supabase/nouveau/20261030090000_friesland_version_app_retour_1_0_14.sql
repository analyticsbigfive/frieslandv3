-- ============================================================================
-- 30/10/2026 : retour à la version minimale 17 (1.0.14), comme avant le 29/10
--
-- Le 29/10 au soir, version_code_min est passé à 20 (1.0.17) après l'envoi de
-- l'APK 1.0.17 sur le lien `latest`. Mais les tablettes en 1.0.15 (8 vues le
-- 30/10 au matin) l'avaient installée depuis le Play Store : signées par
-- Google (signature d'application Play), elles ne peuvent pas installer l'APK
-- du lien, signé avec la clé d'envoi (« Impossible d'installer »). Elles
-- restaient bloquées sur l'écran de mise à jour obligatoire.
--
-- Appliquée le 30/10 à 08:54 UTC à la demande de Jean Luc. La 1.0.17 passera
-- par le Play Store ; une fois en ligne, version_code_min repassera à 20 avec
-- url_telechargement = fiche Play Store (pas l'APK).
-- ============================================================================
begin;

update public.version_app
set version_code_min = 17,
    version_nom_min = '1.0.14',
    version_code_dispo = 17,
    version_nom_dispo = '1.0.14',
    message = 'Version 1.0.14 : en créant un PDV, la liste propose les distributeurs de votre secteur (par exemple SIDECOM à Treichville et Marcory). Les PDV de votre tournée s''affichent toujours avec leur nom.',
    updated_at = now()
where plateforme = 'android';

commit;
