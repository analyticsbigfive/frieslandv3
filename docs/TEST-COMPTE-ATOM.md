# Tester la tournée Atom avec un compte de test

Ce guide vérifie la logique Atom (quotas par canal, chaque PDV une fois par
mois) sur téléphone, avec un compte de test : **qa.atom@friesland-test.ci**.
Les vrais agents ne sont pas touchés : les quotas sont calculés compte par
compte.

Comptez 30 minutes. Logique décrite dans `docs/TOURNEES-ATOM-QUOTAS.md`.

## 1. Préparer le compte

Sur le poste qui a le `.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) :

```bash
node scripts/compte-test-atom.mjs                                       # simulation : ce qui sera fait
node scripts/compte-test-atom.mjs --pregenerer=3 --password=… --apply   # compte + règle + 3 jours de tournées
```

Le script crée le compte (mot de passe = `--password`, ou à défaut
`SEED_DEFAULT_PASSWORD` du `.env` ; un compte existant garde le sien), le marque
**Atom**, recopie le périmètre et le portefeuille d'un vrai agent
(`--source=…`, par défaut attecoubeone@gmail.com) dans une règle **« Test
Atom »** en mode Quotas, puis crée les tournées. Il ne lui donne pas de
commercial : le compte n'apparaît dans l'équipe de personne.

Relancer le script repart de zéro : la règle et les tournées à partir
d'aujourd'hui sont recréées.

## 2. Scénario

| # | Action | Résultat attendu |
|---|---|---|
| 1 | Admin › Utilisateurs : chercher « QA Atom » | Badge **Atom**, rôle merchandiser, pas de commercial |
| 2 | Admin › Routing › Règles | Règle « Test Atom » avec le badge violet **Quotas**, lundi → samedi |
| 3 | Téléphone : se connecter avec qa.atom@friesland-test.ci | Arrivée sur l'accueil terrain, sans changement de mot de passe imposé |
| 4 | Ouvrir la tournée du jour | Le nombre de PDV par canal suit la grille (Référentiels › Application mobile › Quotas Atom). Du lundi au jeudi : 2 superettes, 13 boutiques, 2 kiosques, 2 pushcarts, 1 porridge = **20 PDV**. Vendredi : 15. Samedi : 10. Dimanche : pas de tournée |
| 5 | Fermer l'app (balayage) puis la rouvrir | **Même** tournée, mêmes PDV, même ordre (elle n'est jamais recalculée) |
| 6 | Admin › Routing : comparer les tournées des 3 jours | **Aucun PDV en double** d'un jour à l'autre (chaque PDV une fois par mois) |
| 7 | Faire une visite complète sur un PDV de la tournée (photos, relevé) | Le PDV passe en « Terminé » dans la tournée ; la visite apparaît dans Admin › Visites au nom de QA Atom |
| 8 | Mode avion, faire une 2ᵉ visite, puis rétablir le réseau | La visite part à la reconnexion, sans doublon |
| 9 | Référentiels › Application mobile › Programme Atom | QA Atom apparaît avec ses visites du mois |
| 10 | Admin › Routing : tournée du jour de l'agent source (attecoubeone@) | **Inchangée** par le test |
| 11 | Téléphone : onglet Visites | QA Atom ne voit **que ses** visites, pas celles des autres agents |

Un écart sur les lignes 4 à 6 : noter la date, le jour et les PDV concernés.
Le canal d'un PDV vient de sa sous-catégorie (`canal_atom`). Quand un canal
manque de PDV, les places restantes sont complétées par des boutiques.

## 3. Nettoyer après le test

Les visites du compte de test comptent dans les tableaux de bord et dans le
Programme Atom. Après le test :

```bash
node scripts/compte-test-atom.mjs --nettoyer            # simulation : ce qui sera supprimé
node scripts/compte-test-atom.mjs --nettoyer --apply
```

Visites, tournées, positions GPS et règle du compte de test sont supprimées,
puis le compte est désactivé. Les vrais agents ne sont pas touchés.

## 4. APK de test (téléphone branché à l'ordinateur)

L'app 1.0.10 n'a pas changé pour Atom : **l'APK 1.0.10 déjà publiée suffit**
pour ce test.

```bash
adb devices                                                        # le téléphone doit être listé « device »
adb install -r dist-apk/friesland-bonnet-rouge-1.0.10-release.apk
```

Pour tester du code modifié, construire un APK **debug** (prérequis : JDK 21,
Android SDK et `android/local.properties`, voir `docs/BUILD-ANDROID.md`) :

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
pnpm install
pnpm run android:apk          # → android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

- **Téléphone non listé par `adb devices`** : Réglages › À propos › taper 7 fois
  sur « Numéro de build », puis Options pour les développeurs › **Débogage
  USB**. Accepter l'autorisation qui s'affiche sur le téléphone.
- **`INSTALL_FAILED_UPDATE_INCOMPATIBLE`** : l'app déjà installée est signée
  avec une autre clé (Play Store ou release). Il faut d'abord
  `adb uninstall com.bdco.bonnetrouge`. ⚠️ Cela efface les données locales,
  dont les **visites pas encore synchronisées** : synchroniser avant.
- `SUPABASE_URL` et `SUPABASE_KEY` sont lues dans `.env` **au moment du
  build** : un APK construit avec une autre base pointe vers cette base.
- Debug de l'app : Chrome sur l'ordinateur → `chrome://inspect` → la WebView
  de l'app (APK debug seulement).
