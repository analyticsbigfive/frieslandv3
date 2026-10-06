# Test du compte QA Atom — 6 octobre 2026

Scénario de `docs/TEST-COMPTE-ATOM.md`, étapes 3 à 11, déroulé sur un Pixel 9
(Android 17) avec l'APK **1.0.10** (versionCode 13) installé, piloté par adb
depuis le poste de build. Aucune visite n'a été faite avec un vrai compte.

## Préparation

- `node scripts/compte-test-atom.mjs --pregenerer=3 --apply` : règle « Test Atom »
  (851 PDV recopiés de attecoubeone@) et 3 tournées (mardi 6 → jeudi 8 octobre).
- Le compte `qa.atom@friesland-test.ci` existait déjà et `SEED_DEFAULT_PASSWORD`
  était vide dans `.env` : son mot de passe a été réinitialisé avec une valeur
  générée, rangée dans `.env` uniquement (jamais dans le dépôt ni dans un message).
- Le téléphone était à Abidjan mais à 6–16 km des PDV du jour : une position GPS
  de test a été injectée par adb (voir « Piloter le téléphone par adb »), puis retirée.

## Résultats

| # | Résultat | Constat |
|---|---|---|
| 3 | OK | Connexion directe sur l'accueil terrain, pas de changement de mot de passe imposé |
| 4 | OK | Mardi : 20 PDV — 2 superettes, 14 boutiques, 2 kiosques, 2 pushcarts, 0 porridge. Le portefeuille ne compte aucun porridge (et seulement 4 kiosques, 2 pushcarts) : la place manquante est complétée par une boutique, comme prévu. Mercredi 20, jeudi 20 |
| 5 | OK | Après fermeture forcée et relance : mêmes 20 PDV, même ordre |
| 6 | OK | 60 PDV distincts sur les 3 jours, aucun doublon |
| 7 | OK | MME COUL passe « Fait », badge « GPS validé » ; visite en base au nom de QA Atom avec 2 photos |
| 8 | Partiel | Voir constats 1 à 3 |
| 9 | Non vérifiable | L'écran « Programme Atom » n'existe pas dans le code de la 1.0.10 (seule la vue `v_programme_atom` existe). En base, les 2 visites du mois étaient bien au nom de QA Atom |
| 10 | OK | Tournée du jour d'attecoubeone@ identique avant et après (20 PDV, mêmes statuts), alors que MME COUL est aussi son PDV n° 1 |
| 11 | OK | Onglet Visites : uniquement les 2 visites de QA Atom |

## Constats

1. **Hors ligne, « Démarrer » échoue** avec « TypeError: Failed to fetch » affiché
   sous « Hors zone » : le changement de statut de l'étape n'est pas mis en file.
2. **Enregistrement hors ligne : erreur affichée alors que la visite est en file.**
   Chaque tentative (« Confirmer », « Réessayer ») affiche « Une erreur est
   survenue » et remet la visite en file : 3 visites et 6 photos en attente pour
   une seule visite. À la reconnexion, une seule visite arrive en base (même
   `visite_id`), avec ses 2 photos : pas de doublon.
3. **Après synchronisation, l'étape reste « En cours »** (`routing_pdv` sans
   `visite_id`) : la clôture de mission n'est pas rejouée, la progression reste à 1/20.
4. **« Précision GPS insuffisante » n'atteint jamais l'agent** :
   `composables/useGeofencing.ts` remplace ce message par « Erreur de géolocalisation ».
   En intérieur (précision 19 à 77 m, seuil 10 m), l'agent ne comprend pas pourquoi
   il est « hors zone ».
5. **À l'enregistrement, une précision supérieure à 10 m contourne le geofence**
   sans alerte : la visite 1 a été enregistrée avec la position réelle du téléphone
   (16 km du PDV, précision 40 m) et `geofence_validated = false`.
6. **L'objectif de l'accueil est figé à « 10 visites »** (`pages/mobile/index.vue`),
   sans lien avec le quota Atom de 20 PDV par jour.
7. **Le rayon de geofence des téléphones est de 300 m**, pas 200 m : la valeur
   `NUXT_PUBLIC_GEOFENCE_RADIUS=300` du `.env` est figée dans l'APK au build.

Les sauts de la position de test ont gonflé le kilométrage de la tournée (176 km) :
sans objet en conditions réelles.

## Nettoyage

`node scripts/compte-test-atom.mjs --nettoyer --apply` : 2 visites, 3 tournées,
16 positions GPS et la règle supprimées, compte désactivé (contrôle relancé : 0
partout). Téléphone : compte déconnecté, fournisseurs de position de test retirés,
mode avion et Wi‑Fi rétablis, images de test supprimées de la galerie.

## Piloter le téléphone par adb

- `adb` n'est pas dans le PATH : `~/Library/Android/sdk/platform-tools/adb`.
- Écran : `adb exec-out screencap -p > ecran.png` ; arbre d'interface :
  `adb exec-out uiautomator dump /dev/tty` ; saisie : `adb shell input tap X Y`,
  `adb shell input text '…'`.
- **Position de test** : l'app passe par Google Play Services, les fournisseurs
  `gps` et `network` seuls ne suffisent pas.

  ```bash
  adb shell appops set --uid 2000 android:mock_location allow
  adb shell cmd location providers add-test-provider fused
  adb shell cmd location providers set-test-provider-enabled fused true
  adb shell cmd location providers set-test-provider-location fused --location 5.4084552,-4.0886804 --accuracy 1
  ```

  La position doit être renvoyée toutes les 2 s environ, et la précision rester
  sous le seuil de l'app (10 m). À la fin :
  `adb shell cmd location providers remove-test-provider fused` (idem `gps`, `network`).
- **Mode avion** : `adb shell cmd connectivity airplane-mode enable` laisse le Wi‑Fi
  connecté ; ajouter `adb shell svc wifi disable`. Rétablir avec `disable` / `enable`.
- **Photos** : le sélecteur ouvre la galerie personnelle ; pousser des images de
  test (`adb push … /sdcard/Pictures/` puis diffusion `MEDIA_SCANNER_SCAN_FILE`)
  et les supprimer après.
- Les taps vers le bas de l'écran sont parfois pris pour le geste système, et une
  bulle d'appel peut recouvrir le bouton « Suivant » : taper sur sa partie gauche.
