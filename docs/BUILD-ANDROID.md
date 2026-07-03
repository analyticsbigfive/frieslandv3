# Build Android (APK) — Friesland Bonnet Rouge

Application mobile terrain empaquetée avec Capacitor 7. L'APK n'embarque que
l'app `/mobile` (l'admin reste sur le web) et ajoute le suivi GPS de tournée
en arrière-plan.

## Prérequis (poste de build)

| Outil | Version | Installation |
|---|---|---|
| Node | ≥ 20 | déjà requis par le projet |
| pnpm | 10.x | `npm i -g pnpm` |
| JDK | **21** | `brew install openjdk@21` |
| Android SDK | Platform 35 + Build-Tools 35 | `brew install --cask android-commandlinetools` puis `sdkmanager --sdk_root="$HOME/Library/Android/sdk" "platform-tools" "platforms;android-35" "build-tools;35.0.0"` |

Fichier `android/local.properties` (non versionné) :

```
sdk.dir=/Users/<vous>/Library/Android/sdk
```

Exportez pour Gradle :

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
```

## Variables d'environnement gelées au build

`SUPABASE_URL` et `SUPABASE_KEY` sont lues depuis `.env` **au moment du
`generate:native`** et inscrites dans le bundle JS de l'APK. Changer
d'instance Supabase = régénérer et rebuilder l'APK.

## Commandes

```bash
# Build web natif (SPA statique, PWA désactivée) + copie dans android/
pnpm run android:sync

# APK debug (installable direct, non signé release)
pnpm run android:apk
# → android/app/build/outputs/apk/debug/app-debug.apk

# APK release signé (livrable client)
pnpm run android:release
# → android/app/build/outputs/apk/release/app-release.apk
```

Installation sur appareil : `adb install -r <chemin.apk>`.

## Signature release

1. Générer le keystore **une seule fois** :
   ```bash
   keytool -genkeypair -v -keystore friesland-release.jks -alias friesland \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Le stocker **hors git** (coffre-fort + copie chez le client). Sa perte
   interdit toute mise à jour de l'app installée.
3. Créer `android/keystore.properties` (gitignoré) :
   ```
   storeFile=/chemin/vers/friesland-release.jks
   storePassword=…
   keyAlias=friesland
   keyPassword=…
   ```
   `android/app/build.gradle` le lit automatiquement : si le fichier est
   absent, le build release est signé en debug (tests internes uniquement).

## Versioning

Dans `android/app/build.gradle` : incrémenter `versionCode` (entier monotone)
à **chaque** livraison ; aligner `versionName` sur la version de
`package.json`.

## Icônes / splash

Source : `resources/icon.png` (1024×1024). Régénérer après changement :

```bash
npx @capacitor/assets generate --android \
  --iconBackgroundColor '#ffffff' --splashBackgroundColor '#C8102E'
```

## Base de données

Appliquer la migration `supabase/nouveau/20260703120000_friesland_position_tournee.sql`
(table `position_tournee` + RLS) avant la première utilisation du suivi de
tournée.

## Checklist de tests terrain avant livraison

- [ ] Login puis kill/relance de l'app → session conservée
- [ ] Visite complète hors ligne → resynchronisation au retour réseau
- [ ] Début de tournée → notification persistante « Tournée en cours »
- [ ] 2 h de tracking écran éteint (inclure un Tecno/Infinix) → pas de trous
- [ ] Mode avion 5 min pendant la tournée → aucun point perdu ni dupliqué
      (vérifier `position_tournee` dans Supabase)
- [ ] Consommation batterie sur une tournée type < 10 %
- [ ] Bouton retour Android : navigation puis mise en veille sur l'accueil
