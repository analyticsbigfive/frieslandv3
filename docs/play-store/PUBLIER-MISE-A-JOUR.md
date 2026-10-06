# Publier une mise à jour de l'application (APK direct + Play Store)

Procédure pour livrer une nouvelle version de l'application Android Bonnet
Rouge, par exemple la **1.0.12 (versionCode 15)**. Deux canaux coexistent :

- l'**APK direct**, téléchargé par le lien stable de l'écran de mise à jour,
  publié depuis l'admin ;
- le **Play Store**, alimenté par un **AAB** dans la Play Console.

Le poste de build doit être prêt : JDK 21, Android SDK, keystore d'upload et
`android/keystore.properties`. Voir [BUILD-ANDROID.md](../BUILD-ANDROID.md).

---

## 1. Avant le build

1. **Migrations** : appliquer dans l'éditeur SQL de Supabase celles dont la
   version dépend, dans l'ordre des noms de fichier. Pour la 1.0.12, après
   celles de la 1.0.11 :
   ```
   supabase/nouveau/20261007100000_friesland_ssf_sous_zones.sql
   supabase/nouveau/20261007110000_friesland_admin_autonomie.sql
   supabase/nouveau/20261007120000_friesland_parametres_app.sql
   supabase/nouveau/20261007130000_friesland_catalogue_releve.sql
   supabase/nouveau/20261007140000_friesland_import_lot.sql
   ```
   Le site web doit être déployé avec le même code (fusion dans `main`).
2. **Numéro de version** :
   - `package.json` → `"version": "1.0.12"` ;
   - `android/app/build.gradle` → `versionCode 15` et `versionName "1.0.12"`.

   Le `versionCode` est un entier qui augmente à chaque livraison : le Play
   Store refuse un code déjà importé, même pour un AAB jamais publié. Un code
   peut être sauté : si la 1.0.11 (14) n'est pas en ligne, publier directement
   la 1.0.12 (15) suffit.
3. **`.env`** : `SUPABASE_URL` et `SUPABASE_KEY` de production. Depuis la
   1.0.12, le geofence, les précisions GPS et le suivi de tournée viennent des
   **Paramètres terrain** de l'admin ; les valeurs du `.env` ne servent plus que
   de repli au tout premier lancement sans réseau.

## 2. Construire et vérifier

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
```

```bash
pnpm run android:bundle
```

```bash
pnpm run android:release
```

```bash
pnpm run android:verify
```

- AAB : `android/app/build/outputs/bundle/release/app-release.aab`.
- APK : `android/app/build/outputs/apk/release/app-release.apk`.
- `android:verify` doit afficher l'empreinte SHA-1
  `13:B2:1B:C5:C7:12:90:73:BE:DF:65:EB:AE:FD:0D:F6:45:FE:FD:CF`. Sinon, ne rien
  publier : la clé n'est pas la bonne.

Copier les deux fichiers sous leur nom de livraison :

```bash
cp android/app/build/outputs/apk/release/app-release.apk dist-apk/friesland-bonnet-rouge-1.0.12-release.apk
```

```bash
cp android/app/build/outputs/bundle/release/app-release.aab dist-apk/friesland-bonnet-rouge-1.0.12-release.aab
```

**Test sur un téléphone** avant toute publication :

```bash
adb install -r dist-apk/friesland-bonnet-rouge-1.0.12-release.apk
```

Vérifier au minimum : connexion, une visite complète, une visite hors ligne
puis sa synchronisation, et pour un compte Atom l'écran « Ma semaine » et le
SSF prérempli. Le compte de test Atom et son scénario sont décrits dans
[TEST-COMPTE-ATOM.md](../TEST-COMPTE-ATOM.md).

## 3. Publier l'APK direct depuis l'admin

1. Admin → **Paramètres → Référentiels → Application mobile → Publier une
   version**.
2. Choisir `friesland-bonnet-rouge-1.0.12-release.apk`. L'écran affiche la
   version lue dans le fichier et refuse une version plus ancienne que celle en
   service.
3. Laisser **« Rendre cette version obligatoire » décoché**, puis **Publier**.

Effet : le lien stable télécharge la 1.0.12, et les téléphones en 1.0.12 et
plus affichent un bandeau « nouvelle version », sans blocage. Les téléphones
plus anciens ne sont pas encore prévenus : c'est l'étape 5.

## 4. Publier l'AAB dans la Play Console

1. Play Console → l'application **Bonnet Rouge** → **Tester et publier →
   Production** (ou **Test interne** pour une première vérification par
   quelques comptes).
2. **Créer une release** → importer `friesland-bonnet-rouge-1.0.12-release.aab`.
3. Nom de la release : `1.0.12 (15)`. Notes de version (fr-FR), par exemple :
   ```
   - Merchandisers Atom : SSF du jour dans la visite et écran « Ma semaine ».
   - Liste des produits mise à jour par l'administrateur, sans nouvelle version.
   - Réglages GPS et suivi de tournée gérés depuis l'administration.
   - Message clair quand la précision GPS est insuffisante.
   ```
4. **Suivant → Enregistrer → Envoyer pour examen**. Choisir un **déploiement
   progressif** (par exemple 20 %, puis 100 % après un ou deux jours sans
   incident).
5. Compter de quelques heures à quelques jours d'examen. Les déclarations
   (sécurité des données, localisation en arrière-plan) ne sont à refaire que
   si les autorisations Android changent ; la 1.0.12 n'en ajoute aucune. Voir
   [DECLARATIONS-PLAY-CONSOLE.md](DECLARATIONS-PLAY-CONSOLE.md).

## 5. Rendre la version obligatoire

Une fois la version **disponible à 100 % sur le Play Store** :

1. Admin → **Publier une version** → choisir le même APK, cocher **« Rendre
   cette version obligatoire »**, éventuellement un message, puis **Publier**.
2. Les téléphones en version plus ancienne sont bloqués sur l'écran « Mise à
   jour obligatoire » jusqu'à l'installation.

La version minimale ne doit jamais dépasser la version réellement publiée :
l'écran le refuse, sinon les téléphones tourneraient en boucle sur la mise à
jour.

## 6. Suivre le déploiement

- Admin → **Versions installées** : la version de chaque téléphone, à sa
  dernière ouverture.
- Play Console → **Statistiques** et **Android vitals** : installations,
  plantages, ANR.

## 7. Revenir en arrière

- **Play Store** : Production → la release → **Arrêter le déploiement**. Les
  téléphones déjà mis à jour gardent la version ; les autres ne la reçoivent
  plus.
- **Ne pas** rendre la version obligatoire tant que le problème n'est pas
  réglé.
- Une version publiée ne se retire pas : corriger, incrémenter le
  `versionCode` et publier une **1.0.13** par cette même procédure.
