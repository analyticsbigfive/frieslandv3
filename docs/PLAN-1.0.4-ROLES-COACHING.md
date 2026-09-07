# Plan d'implémentation — 1.0.4 : conformité Play + rôles commerciaux, field coaching, dashboards

> Document d'exécution. Destiné à être repris tel quel par une session Claude Code.
> Rédigé le 7 septembre 2026. Branche de départ : `main`, dernier commit `acab4d1`.

---

## 0. Contexte et état actuel

Deux chantiers convergent sur une seule livraison, à la demande du client.

**Google Play a rejeté la version 1.0.3** pour deux motifs :
1. Divulgation bien visible manquante — l'app déclare `ACCESS_BACKGROUND_LOCATION` sans écran d'explication interne avant le prompt système.
2. Politique de confidentialité non conforme — n'identifiait ni l'application ni la personne morale, et niait à tort la collecte en arrière-plan.

**Le client ouvre l'app à un second niveau d'utilisateurs** : les commerciaux consultent en lecture seule le travail des merchandiseurs, décident d'actions terrain, et remplissent un field coaching aujourd'hui hébergé sur KoboToolbox.

### Déjà fait — commit `acab4d1`, ne pas refaire

| Fichier | Contenu |
|---|---|
| `composables/useLocationDisclosure.ts` | Porte unique de divulgation. Natif seulement, acceptation persistée dans `@capacitor/preferences`, refus redemandé au prochain besoin. |
| `components/LocationDisclosureModal.vue` | Modale au format exigé par Play (« y compris lorsque l'application est fermée ou n'est pas utilisée »), lien vers la politique. |
| `app.vue` | Montage de la modale dans `<ClientOnly>`. |
| `composables/useGeoProvider.ts` | `getCurrentPosition`, `watchPosition` et `requestPermission` attendent la divulgation avant tout prompt système. |
| `composables/useTournee.ts` | `startTournee` exige la divulgation même si la permission premier plan est déjà accordée (`addWatcher` demande l'arrière-plan). |
| `pages/privacy-policy.vue` | Section d'identification : BD & CO, 60 rue François Ier 75008 Paris, package `com.bdco.bonnetrouge`, contact `team@bigfive-edition.com`, site `bigfivesolutions.com`. Collecte décrite en deux volets, premier plan et tournée en arrière-plan. |
| `pages/supprimer-compte.vue` | Même identité éditeur rappelée. |
| `android/app/build.gradle` | `versionCode 6`, `versionName "1.0.4"` (le 5 a été consommé par un upload Play refusé le 7 sept.). |
| `package.json` | Version `1.0.4`, script `android:bundle`. |
| `docs/play-store/FICHE-PLAY-STORE.md` | Table des valeurs d'identité à répliquer entre Play Console et les pages publiques. |

Vérifié : 62 tests vitest passent, `npx nuxt build` réussit.

### Décisions actées par le client

| Sujet | Décision | Conséquence |
|---|---|---|
| Découpage des livraisons | Tout dans une seule version 1.0.4 | **L'app reste rejetée sur le Store pendant tout le développement.** Choix assumé après signalement. |
| Field coaching | Branché sur les référentiels existants | Réponses croisables avec les visites. Les 13 questions Oui/Non/NA restent identiques au Kobo. |
| Garde-fou de signature | Échec immédiat si `keystore.properties` absent | Plus jamais d'AAB signé debug produit en silence. |
| Machine de build | L'autre poste, détenteur du keystore | Le dépôt doit rendre ce build reproductible et auto-vérifiant. |
| Concurrence (fichier « Competitors list » du 7 sept.) | Relevé **par SKU** (marque + grammage), marques existantes conservées | Nouveau référentiel `marque_concurrente_sku`, lot 6.2 |
| Disponibilité V2 (fichier du 7 sept.) | Seuils GT obsolètes retirés, seuils `SupermarcheMT` conservés | Retrait depuis l'admin (CRUD Seuils dispo existant), jamais par migration, lot 6.1 |
| Yaourt et céréales | Retirés du relevé, données historiques conservées | Paramètre admin activable/désactivable par catégorie, lot 6.4 |
| Suppressions en base | **Aucune suppression directe en base** — tout retrait passe par un CRUD dans l'admin | Les migrations restent additives (schéma, seed, RLS). Vaut pour tout le lot 6. |

### Correspondance des rôles

**Aucun nouveau rôle à créer.** `admin`, `superviseur`, `merchandiser` et `commercial` existent déjà dans les cinq sites de déclaration.

| Demande client | Rôle existant | État |
|---|---|---|
| Managers — accès administrateur total | `admin` | Fonctionnel |
| Commerciaux — consultation et analyse, lecture seule | `commercial` | **Inerte** : toutes ses lignes `role_section_access` sont à `false`, et la RLS ne lui donne accès à aucune visite |
| Merchandiseurs | `merchandiser` | Fonctionnel |

Sites de déclaration des rôles, à connaître avant toute modification :
`types/index.ts:6` · `supabase/_archive/001b_create.sql:15` (contrainte CHECK, pas un enum) · `supabase/nouveau/20260727120000_friesland_handle_new_user_role.sql:22` · `server/utils/adminUsers.ts:6` · `composables/useAccessControl.ts:25`

---

## Lot 1 — Terminer la conformité Play

### 1.1 Garde-fou de signature — `android/app/build.gradle`

**Le problème.** Le fichier retombe aujourd'hui en silence sur la clé debug quand `android/keystore.properties` est absent. Un `bundleRelease` lancé le 7 septembre a produit un AAB signé `CN=Android Debug` après quatre minutes de build, inutilisable pour Play.

**Règle de conception, à inscrire en commentaire dans le fichier.** La phase de configuration ne lève **jamais** d'erreur : un `throw` posé dans `buildTypes.release` s'évalue à chaque invocation de Gradle et casserait `assembleDebug`, `./gradlew tasks` et la synchro Android Studio. Les diagnostics sont collectés à la configuration, puis levés par un `gradle.taskGraph.whenReady` qui ne se déclenche que si une tâche d'artefact release est réellement planifiée. Ce callback s'exécute après la configuration et avant la première tâche : échec en une dizaine de secondes.

**Remplacer les lignes 3-10 :**

```groovy
// --- Signature release ---------------------------------------------------
// Lue depuis android/keystore.properties (non versionné, voir docs/BUILD-ANDROID.md).
// RÈGLE : la phase de configuration ne lève JAMAIS d'erreur — sinon assembleDebug,
// `./gradlew tasks` et la synchro Android Studio casseraient aussi. Les diagnostics
// sont collectés ici et levés par le guard `gradle.taskGraph.whenReady` (bas de
// fichier), qui ne se déclenche que si une tâche produisant un artefact release
// est planifiée.
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('keystore.properties')
def signingProblem = null

if (!keystorePropertiesFile.exists()) {
    signingProblem = "fichier introuvable : ${keystorePropertiesFile.absolutePath}"
} else {
    keystorePropertiesFile.withInputStream { keystoreProperties.load(it) }
    def missing = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'].findAll {
        !keystoreProperties[it]?.trim()
    }
    if (missing) {
        signingProblem = "clés manquantes ou vides dans keystore.properties : ${missing.join(', ')}"
    } else if (!file(keystoreProperties['storeFile']).exists()) {
        // file() résout les chemins relatifs depuis android/app/ : utiliser un chemin ABSOLU.
        signingProblem = "storeFile introuvable : ${keystoreProperties['storeFile']}"
    }
}
def signingReady = (signingProblem == null)
```

**Remplacer le bloc `signingConfigs` (lignes 28-37) :**

```groovy
    signingConfigs {
        if (signingReady) {
            release {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
```

**Remplacer le bloc `buildTypes` (lignes 38-46) :**

```groovy
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
            if (signingReady) {
                signingConfig signingConfigs.release
            }
            // Sinon : AUCUN signingConfig. Jamais de repli sur la clé debug — c'est ce
            // repli qui a produit l'AAB debug-signé (CN=Android Debug) du 7 sept. 2026.
        }
    }
```

**Insérer après la fermeture du bloc `android {}`, avant `repositories {` :**

```groovy
// Garde-fou : interdit de produire un artefact release sans le keystore d'upload.
// `whenReady` s'exécute après la configuration et AVANT la première tâche → échec en
// quelques secondes, pas après 4 minutes de packaging. Les builds debug, `./gradlew
// tasks` et la synchro Android Studio ne matchent aucune tâche de la liste : intacts.
// NB : concaténation de String volontaire — en Groovy, Set<GString>.contains(String)
// renvoie toujours false.
def releaseArtifactTasks = [
    project.path + ':assembleRelease',
    project.path + ':bundleRelease',
    project.path + ':installRelease'
] as Set

gradle.taskGraph.whenReady { graph ->
    if (signingReady) return
    def requested = graph.allTasks.findAll { releaseArtifactTasks.contains(it.path) }
    if (requested.isEmpty()) return
    throw new GradleException(
        "\n\n*** BUILD RELEASE REFUSÉ : keystore d'upload absent ou invalide ***\n" +
        "  Cause   : " + signingProblem + "\n" +
        "  Tâches  : " + requested.collect { it.path }.join(', ') + "\n" +
        "  Sans keystore ce build produirait un artefact non signé (auparavant : signé\n" +
        "  avec la clé debug), refusé par Google Play.\n" +
        "  Corriger: créer android/keystore.properties (chemins ABSOLUS), voir\n" +
        "            docs/BUILD-ANDROID.md § « Signature release ».\n" +
        "  SHA-1 attendu de la clé d'upload :\n" +
        "  13:B2:1B:C5:C7:12:90:73:BE:DF:65:EB:AE:FD:0D:F6:45:FE:FD:CF\n"
    )
}
```

**Points de vigilance.** Le filtrage sur le chemin complet compte : `assembleRelease` planifie aussi `:capacitor-android:assembleRelease`, seul `:app:` doit déclencher. `signingConfigs.release` n'est référencé que dans la branche qui le crée, donc pas d'`UnknownDomainObjectException`. Ne pas contrôler l'alias en dur : l'empreinte fait foi. Si le cache de configuration est activé un jour, y compris via Android Studio dont les réglages priment sur `gradle.properties`, revérifier que le callback se déclenche sur un cache hit.

### 1.2 Vérification d'empreinte — `scripts/verify-aab-signature.sh` (nouveau)

Script tracké et exécutable, plus un script npm. Le build se fait sur une machine non observable : une commande documentée se saute ou se tape de travers, un script suit le checkout et porte l'empreinte attendue dans git. L'empreinte est publique, c'est ce qu'affiche Play Console.

`apksigner` refuse les `.aab`. `jarsigner -verify` sort une alerte de chaîne PKIX sur clé auto-signée et son affichage dépend de la locale. La méthode fiable extrait le bloc PKCS#7 et calcule le digest.

```bash
#!/usr/bin/env bash
# Vérifie que l'artefact (.aab ou .apk) est signé avec la clé d'upload Play de
# Friesland Bonnet Rouge. Sort non-zéro sinon.
#   ./scripts/verify-aab-signature.sh [chemin]
# Empreinte publique = Play Console › Intégrité de l'app › certificat de la clé d'importation.
set -euo pipefail

EXPECTED_SHA1="13b21bc5c7129073bedf65ebaefd0df645fefdcf"
ARTIFACT="${1:-android/app/build/outputs/bundle/release/app-release.aab}"

[ -f "$ARTIFACT" ] || { echo "ERREUR : artefact introuvable : $ARTIFACT" >&2; exit 1; }

# Signature v1 (jar) : un bloc PKCS#7 nommé d'après l'alias.
# alias `upload` -> META-INF/UPLOAD.RSA ; clé debug -> META-INF/ANDROIDD.RSA
COUNT="$(unzip -Z1 "$ARTIFACT" | grep -Eic '^META-INF/.*\.(RSA|DSA|EC)$' || true)"
[ "$COUNT" -ne 0 ] || { echo "ERREUR : aucun bloc de signature — artefact NON SIGNÉ." >&2; exit 1; }
[ "$COUNT" -eq 1 ] || { echo "ERREUR : $COUNT blocs de signature, 1 attendu." >&2; exit 1; }

BLOCK="$(unzip -Z1 "$ARTIFACT" | grep -Ei '^META-INF/.*\.(RSA|DSA|EC)$' | head -1)"

# openssl x509 ne lit que le PREMIER certificat PEM = le signataire. La clé est
# auto-signée (un seul cert), garanti par le contrôle "exactement 1 bloc" ci-dessus.
ACTUAL_SHA1="$(unzip -p "$ARTIFACT" "$BLOCK" \
  | openssl pkcs7 -inform DER -print_certs \
  | openssl x509 -outform DER \
  | shasum -a 1 | cut -d' ' -f1)" \
  || { echo "ERREUR : extraction du certificat impossible — NON VÉRIFIABLE." >&2; exit 1; }

[ "${#ACTUAL_SHA1}" -eq 40 ] \
  || { echo "ERREUR : empreinte illisible — NON VÉRIFIABLE." >&2; exit 1; }

echo "Artefact : $ARTIFACT"
echo "Bloc     : $BLOCK"
echo "SHA-1    : $ACTUAL_SHA1"

if [ "$ACTUAL_SHA1" != "$EXPECTED_SHA1" ]; then
  {
    echo ""
    echo "ÉCHEC : artefact signé avec la MAUVAISE clé."
    echo "  attendu : $EXPECTED_SHA1"
    echo "  obtenu  : $ACTUAL_SHA1"
    echo "  (0d75d17f24eeea465e5bad4ccdb20a38bfed0481 = clé debug Android)"
  } >&2
  exit 1
fi

echo "OK : clé d'upload Friesland Bonnet Rouge."

# Affichage lisible du DN. Locale forcée : keytool traduit ses libellés
# (« Empreintes du certificat » / « SHA 1: » en français) — d'où le contrôle
# principal fait par digest openssl, insensible à la locale.
if command -v keytool >/dev/null 2>&1; then
  unzip -p "$ARTIFACT" "$BLOCK" \
    | keytool -printcert -J-Duser.language=en -J-Duser.country=US 2>/dev/null \
    | sed -n '1,7p' || true
fi
```

`chmod +x scripts/verify-aab-signature.sh`, puis dans `package.json` après `"android:bundle"` :

```json
"android:verify": "bash scripts/verify-aab-signature.sh",
```

Ne pas chaîner dans `android:bundle` : en cas d'échec on veut l'artefact sur disque pour l'inspecter.

### 1.3 Documentation — `docs/BUILD-ANDROID.md`

| Ligne | Correction |
|---|---|
| 1 | Titre `# Build Android (APK) —` → `# Build Android (APK + AAB) —` |
| 13 | Ligne JDK : préciser que Homebrew installe `openjdk@21` en keg-only, invisible à l'auto-détection Gradle (`/usr/libexec/java_home -V` ne liste que 17/16/11/8), d'où l'export obligatoire |
| 14 | `"platforms;android-35"` → `"platforms;android-36"` — `android/variables.gradle:3` fixe `compileSdkVersion = 36`, la doc actuelle échoue sur une machine neuve |
| 22 | `Exportez pour Gradle :` → **obligatoire** avant tout `gradlew`, sinon `Cannot find a Java installation … languageVersion=21` |
| 41-46 | Ajouter le bloc AAB (voir ci-dessous) |
| 55 | `-alias friesland` → `-alias upload` |
| 62 | Préciser que `storeFile` doit être un chemin **absolu** — `file()` résout depuis `android/app/` |
| 64 | `keyAlias=friesland` → `keyAlias=upload` |
| 67-68 | **Supprimer** « si le fichier est absent, le build release est signé en debug (tests internes uniquement) » — factuellement faux depuis le lot 1.1, et c'est cette phrase qui a produit le mauvais artefact |

Bloc à ajouter aux commandes :

````markdown
```bash
# AAB release signé — LE livrable Google Play
pnpm run android:bundle
# → android/app/build/outputs/bundle/release/app-release.aab

# Vérifier la clé de signature de l'artefact (obligatoire avant upload)
pnpm run android:verify
```
````

Remplacement pour les lignes 67-68 :

> `android/app/build.gradle` le lit automatiquement. **Si le fichier est absent, incomplet, ou si `storeFile` n'existe pas, tout build release (`android:release`, `android:bundle`) échoue immédiatement** — plus aucun repli sur la clé debug.

Nouvelle section à ajouter :

````markdown
## Empreinte attendue de la clé d'upload

```
Alias   : upload
DN      : CN=Friesland Bonnet Rouge, O=Big Five Abidjan, L=Abidjan, C=CI
SHA-1   : 13:B2:1B:C5:C7:12:90:73:BE:DF:65:EB:AE:FD:0D:F6:45:FE:FD:CF
SHA-256 : BD:2E:F3:68:DF:DE:1E:AF:F9:0F:EF:3E:08:0C:25:AB:1A:8B:DC:81:28:5F:F1:3A:FF:9F:81:09:93:EC:9E:51
```

Doit correspondre à Play Console › Intégrité de l'app › certificat de la clé d'importation.
`pnpm run android:verify` le contrôle automatiquement.
````

### 1.4 Ménage

```bash
rm -f android/app/build/outputs/bundle/release/app-release.aab
```

Pas de `./gradlew clean`, inutile de jeter l'état incrémental. Aucun risque git : le chemin est ignoré via `android/.gitignore`. Une fois le garde-fou en place, cette machine ne peut plus régénérer cet artefact, c'est le but.

---

## Lot 2 — Rôles et cloisonnement

Socle du reste. À faire en premier après le lot 1.

> **État au 7 septembre 2026 (après-midi).** Code livré : `utils/roles.ts` (+ tests), `isCommercial` / `isMerchandiser` dans `stores/auth.ts`, `MobileBottomNav` selon le rôle, `middleware/terrain-write.ts` sur la saisie de visite, CTA d'écriture masqués pour le commercial. Migrations écrites, **à appliquer dans l'éditeur SQL Supabase dans cet ordre** : `20260907140000_friesland_lot2_schema_rattrapage.sql` puis `20260907140100_friesland_lot2_roles_rls_commercial.sql`. Preuve par PostgREST direct : `COMMERCIAL_EMAIL=… pnpm run rls:test`.
>
> Constat en production qui corrige le texte ci-dessous : la lecture des visites du commercial est **déjà scopée** zone + quartier (1 775 visites visibles pour un compte réel = exactement son périmètre), et `role_section_access` du commercial est déjà ouvert sauf `parametres`. Les deux ont été posés hors dépôt ; la migration 140100 les codifie. Ce qui manquait réellement est le 2.4 : l'écriture restait ouverte à tout authentifié.

### 2.1 Redirection après connexion

`pages/login.vue:126`, `pages/login.vue:148` et `pages/index.vue:20` codent en dur :

```ts
const redirect = authStore.isAdmin || authStore.isSuperviseur ? '/admin' : '/mobile'
```

Le commercial atterrit donc sur `/mobile`, ce qui reste le bon choix : c'est son outil quotidien, et `middleware/native-scope.global.ts:10-11` renvoie de toute façon `/admin/*` vers `/mobile` dans l'APK. Le dashboard d'analyse lui reste accessible sur le web.

Ajouter `isCommercial` et `isMerchandiser` dans `stores/auth.ts` — il n'existe aujourd'hui que `isAdmin` et `isSuperviseur` (`stores/auth.ts:16-18`), ce dernier incluant `admin`.

### 2.2 Matrice de permissions

`role_section_access` contient déjà neuf lignes `commercial`, toutes à `false` (`supabase/nouveau/20260630130200_friesland_perfect_store_admin.sql:125-127`). Migration de seed pour passer à `true` les sections de lecture (`principal`, `pdv`, `visites`, `visibilite`, `concurrence`, `produits`, `actions`) et laisser `parametres` à `false`.

`components/AdminSidebar.vue:205-207` honore déjà la matrice : aucun code de navigation à écrire.

**Piège à ne pas manquer.** `canAccessPath` renvoie `true` pour tout chemin non mappé (`composables/useAccessControl.ts:96-98`). Toute nouvelle page d'administration doit être déclarée dans `sectionKeyForPath` (`useAccessControl.ts:30-49`), sinon elle est ouverte à **tous** les rôles.

Ajouter une section demande de tenir cinq registres cohérents entre eux :
`DASHBOARD_SECTIONS` (`useAccessControl.ts:13-23`) · `sectionKeyForPath` (`:30-48`) · une ligne `role_section_access` en base · `AdminSidebar.navSections` (`components/AdminSidebar.vue:125-198`) · `adminSectionTabs` / `detectAdminSection` (`utils/adminSectionTabs.ts:20-93`).

### 2.3 RLS sur les visites — le blocage dur

État actuel (`supabase/_archive/001c_indexes_triggers_rls.sql:119-123`) :

```sql
CREATE POLICY "visites_select" ON public.visites FOR SELECT
  USING (auth.uid() = user_id
         OR EXISTS (SELECT 1 FROM public.profiles
                    WHERE id = auth.uid() AND role IN ('admin','superviseur')));
```

Un commercial voit **zéro visite**. Et comme `v_perfect_store_liste_full` et ses sœurs sont déclarées `with (security_invoker = true)`, les vues et RPC remontent vides elles aussi.

Écrire une nouvelle politique de lecture scopée au territoire, appuyée sur une fonction `SECURITY DEFINER` **dédiée à la lecture**. Ne pas élargir `est_gestionnaire_perfect_store()` (`supabase/nouveau/20260630130200:11-25`) : elle gouverne aussi l'**écriture** sur environ 25 tables.

Une fois la politique posée, `get_visites_filtered` (déclarée `language sql stable`, donc `SECURITY INVOKER`, `supabase/nouveau/20260717150000:21`) et toute la couche vues/RPC héritent du périmètre sans modification de code.

### 2.4 Lecture seule réellement appliquée

Aujourd'hui n'importe quel utilisateur authentifié peut écrire :

| Politique | Effet |
|---|---|
| `pdv_update_field` (`_archive/019:81-83`) | Modifier **n'importe quel** PDV. Les politiques UPDATE se combinent en OR, ce qui rend `pdv_update_admin` inopérant. |
| `pdv_insert_auth` (`_archive/001c:110`) | Créer un PDV |
| `visites_insert` (`_archive/019:91-92`) | Insérer une visite sous son propre `user_id` |
| `images_insert_auth` (`_archive/001c:148-164`) | Uploader dans le bucket `visite-images`, qui est **public** |

« Lecture seule » n'est donc pas une propriété du système, seulement de l'interface. Ajouter une condition de rôle aux politiques d'écriture de `pdv`, `visites` et du bucket. **Sans cela, la restriction commerciale se contourne par un appel PostgREST direct.**

### 2.5 Nettoyages induits

`isPrivilegedProfile` est réécrit à l'identique trois fois — `composables/useUserScope.ts:3-5`, `stores/pdv.ts:61-63`, `stores/routing.ts:28` (plus `scripts/fix-zones-residuelles.mjs:74`). Extraire un helper unique.

`components/MobileBottomNav.vue:41-44` impose quatre onglets fixes sans conscience du rôle. Un commercial y verrait un onglet Routing vide de sens et atterrirait sur une liste de visites personnelles vide. Le rendre dépendant du rôle.

### 2.6 Dette de schéma à réparer

`profiles.territoires_assignes` est lu partout (`stores/auth.ts:41`, `stores/pdv.ts`, `stores/routing.ts:22`, `types/index.ts:26`) mais **aucune migration ne le crée** dans le dépôt. Idem pour `pdv.territory_code` et `pdv.area_code`, pourtant remplies par un trigger (`supabase/nouveau/20260716230000_friesland_pdv_quartiers.sql:53-75`).

Ces colonnes ont été ajoutées hors du dossier suivi. **Reproduire la base depuis `supabase/` échoue aujourd'hui.** Ajouter les migrations idempotentes correspondantes.

---

## Lot 3 — Consultation commerciale dans l'app

> **État au 7 septembre 2026 (fin d'après-midi).** Livré : `/mobile/equipe` (3.1), fraîcheur de visite dans la liste PDV via `pdv_fraicheur_filtre` (3.2, commercial et privilégiés), lecture d'une visite du périmètre par le commercial (3.3), `data.commentaires` dans le wizard, le détail et la modale (3.4), `action_commerciale` + `type_action_commerciale` avec création depuis la fiche PDV et le détail de visite, restitution `/mobile/actions` et fiche PDV, statut avançable par l'assigné (3.5). Migration à appliquer : `20260907150000_friesland_lot3_actions_commerciales.sql`. Comptes de test : `pnpm exec node scripts/create-test-accounts.mjs`. Non fait : rappel des actions ouvertes dans le routing du jour.

### 3.1 Suivi des visites de l'équipe

Nouvelle page sous `/mobile` listant les visites des merchandiseurs du périmètre : date, heure, PDV, merchandiseur, statut.

Le statut existe déjà : `visites.status` (`soumis` / `validé` / `rejeté`, `supabase/nouveau/20260715130000:17-26`), distinct de `sync_status` qui décrit le transport appareil → serveur.

Réutiliser le patron de requête de `pages/mobile/index.vue:328-332` en remplaçant le filtre `user_id` par le périmètre territorial.

### 3.2 Liste des PDV avec statut de dernière visite

Enrichir `pages/mobile/pdv/index.vue`, qui possède déjà le tri par proximité, les puces de zone, les badges de distance et la pagination incrémentale. Il ne montre **aucune** information de visite.

Ce qui existe déjà et se réutilise :
- Index `idx_visites_pdv_date ON visites(pdv_id, date_visite DESC)` (`supabase/nouveau/20260831200000:24`)
- La requête « dernière visite d'un PDV » est écrite à `pages/mobile/visites/new.vue:1026-1045`
- `v_perfect_store_liste_full` (`supabase/nouveau/20260709170000:26`) et la RPC `perfect_store_liste_filtre` retournent déjà une ligne par PDV avec `date_visite`, `niveau`, `score_global`, `commercial` et le `visite_id` nécessaire pour ouvrir le détail

Ce qui manque entièrement : la **fraîcheur**. Aucune notion de « visite à jour », de retard, ni de PDV jamais visité.

À créer : un référentiel `frequence_visite` avec valeur par défaut hebdomadaire, surchargeable par zone et par type de PDV, plus une RPC retournant par PDV la date de dernière visite et son état — à jour, en retard, jamais visité. Ce dernier état alimente les alertes rouges du lot 5.

### 3.3 Consultation d'une visite passée

`components/VisitDetailModal.vue` est purement présentationnel, sans aucune requête, avec `canDelete` à `false` par défaut. **Réutilisable tel quel**, il affiche déjà : informations générales, niveau Perfect Store et ses cinq métriques, quantités par SKU comparées aux seuils, visibilité et promotion par élément, concurrence, actions, photos.

Deux correctifs nécessaires :
- `pages/mobile/visites/[id].vue:209-211` force `.eq('user_id', user.id)` pour tout non-privilégié
- `matchesVisiteScope` (`composables/useUserScope.ts:52-71`) renvoie `false` pour quiconque n'est ni privilégié ni auteur

**Piège de lecture des données.** `pages/mobile/visites/new.vue:1244-1270` écrit à la soumission des miroirs dérivés : `visibilite.exterieure.*` et `interieure.*` dérivés de `standards`, et `produits.<cat>.<sku>` dérivés de `quantites`. Ces miroirs n'existent que pour d'anciens dashboards et les lignes antérieures à juillet 2026 peuvent diverger. **Lire `data.visibilite.standards` et `data.produits.<cat>.quantites`**, jamais les miroirs.

### 3.4 Commentaire du merchandiseur — champ manquant

Une recherche exhaustive ne trouve **aucun** champ de texte libre sur une visite. L'exemple cité par le client, « propriétaire absent », n'a aucun support aujourd'hui.

Le seul analogue est `routing_pdv.result_notes`, renseigné uniquement quand le merchandiseur **saute** un PDV (`pages/mobile/routing.vue:178`, `composables/useRouting.ts:84-88`) — cas où aucune visite n'est créée.

À ajouter : `data.commentaires` dans le payload, une zone de texte dans l'étape actions ou photos de `pages/mobile/visites/new.vue`, et son rendu dans `VisitDetailModal.vue` et `pages/mobile/visites/[id].vue`.

### 3.5 Actions décidées par le commercial

Nouvelle table `action_commerciale` : PDV, visite d'origine, auteur, type, merchandiseur assigné, échéance, statut, commentaire.

Le type provient d'un référentiel configurable `type_action_commerciale`, pré-rempli avec activation SSR, activation SSM et référencement produit. Cela évite de figer dans le code une liste que le client n'a pas encore arrêtée.

Restitution demandée à deux endroits : dans l'app du merchandiseur (fiche PDV et routing du jour) et dans les visites. Écriture réservée au commercial et aux rôles privilégiés — cohérent avec la lecture seule, puisque le commercial ne modifie pas la saisie du merchandiseur mais crée un objet distinct.

---

## Lot 4 — Field coaching

> **État au 7 septembre 2026 (soir).** Livré : référentiel `engin_vente`, tables `field_coaching` + `field_coaching_transfert`, RPC `transferer_field_coaching` (migration `20260907160000`, à appliquer) ; wizard mobile `/mobile/coaching/new` (5 étapes : superviseur & vendeur, PDV & propriétaire, distribution, Perfect Visibility, Effective Promotion — 13 questions Oui/Non/N/A), liste `/mobile/coaching`, détail avec transfert et historique, brouillon local, file hors ligne ; rapport admin `/admin/visites/coaching` (période, superviseur, zone, KPI, table, export CSV, impression). Ouvert aux rôles superviseur, commercial, admin. **À vérifier avec le client : le libellé exact des 13 questions** (`utils/fieldCoaching.ts`), rédigé d'après les intitulés courts du plan faute d'accès au formulaire Kobo. Non fait : photos sur le coaching.

Chantier neuf : aucune trace de `kobo`, `enketo` ou `coaching` dans le dépôt.

### 4.1 Le formulaire source

`https://ee.kobotoolbox.org/x/iApzz0oy` — « QUESTIONNAIRE DE SUIVI DES ACTIVITES DE PROSPECTION (Rooting) ». Quatre blocs d'identification puis un bloc d'évaluation « Maximise Distribution ».

### 4.2 Transposition, branchée sur les référentiels

| Bloc Kobo | Champs | Transposition |
|---|---|---|
| I_1 Superviseur | NOM (15 prénoms en dur) | Compte connecté, plus sélection parmi les profils `superviseur` |
| I_2 Vendeur | Distributeur (14 valeurs en dur) | Table `distributeur` |
| I_2 Vendeur | Engin (Van, Mini Van, Tricycle, Moto, Truck) | Nouveau référentiel `engin_vente` |
| I_3 PDV | Nom du PDV | Sélection dans le parc réel via `PDVSelector` |
| I_3 PDV | Route du jour (Lundi à Samedi) | Convention `days_of_week` déjà en place côté routing |
| I_3 PDV | Type de PDV (Boutique, Aboki, Pushcard, Kiosk, Superette, Autres) | `type_pdv` / `categorie_pdv` |
| I_3 PDV | Commune, quartier, boulevard/rue, proche de | Pré-remplis depuis `pdv` (`quartier`, `adressage`), éditables |
| I_4 Propriétaire | Nom, prénom, téléphone | Champs du coaching |
| II_1.1 | Nombre de SKU en PDV, nombre disponibles | Entiers |
| II_1.1 | SKU disponibles (19 valeurs) | `reference_produit` |
| II_1.2 Perfect Visibility | 8 questions | **Identiques** : hot spot, Maison Bonnet Rouge habillée, rangement, présentoir, emplacement secondaire, visibilité extérieure, QR code, concept 3 hotspots |
| II_1.3 Effective Promotion | 5 questions | **Identiques** : PDV informé, participation, réception gratuit ou gadget, respect du mécanisme, respect des prix |

Les treize questions à trois états (Oui / Non / Non applicable) sont reprises **mot pour mot** pour préserver la comparabilité avec l'historique Kobo.

### 4.3 Construction

Réutiliser `components/FormWizard.vue` (étapes avec `key`/`label`/`phase`/`validate()`, badges d'état, navigation par swipe, pied fixe) et l'enveloppe complète de la saisie de visite, directement transposable :
- Brouillon `localStorage` — `saveDraft` / `restoreDraft` / `clearDraft`, `pages/mobile/visites/new.vue:719-762`
- File d'attente hors ligne — `useOfflineSync.addToQueue`, `new.vue:1296-1308`
- `SaveOverlay` de progression — `new.vue:1111-1123`
- Photos — `composables/useImageUpload.ts`, bucket `visite-images`

Primitives de champ existantes : `ToggleStatus` (trois états), `ToggleYesNo`, `PDVSelector`, `PdvNameAutocomplete`, `SkuQuantityInput`.

**Précédent de formulaire piloté par configuration**, unique dans le dépôt : `pages/admin/referentiels/index.vue:268-274` définit une interface `Field { key, label, type, opts?, required?, … }` et génère table **et** formulaire depuis un registre. Elle est taillée pour du CRUD à plat, une seule table, un seul modal. Un formulaire multi-étapes demande de grouper les champs par étape, soit un hybride entre ce registre et `FormWizard`.

### 4.4 Transfert

Champ d'assignation sur le coaching, plus une table d'historique des transferts conservant l'auteur d'origine. Le transfert ne réécrit pas la paternité, il déplace la charge.

### 4.5 Rapport des field coaching effectués

Explicitement demandé par le client. Page d'administration composée d'éléments existants :
- `components/DashboardFilters.vue` — barre de filtres pilotée par props `show*`, cascade géographique complète, puces retirables, débounce 400 ms
- Table en `class="admin-table"` — le `AdminTableEnhancer` monté dans `layouts/admin.vue:120-122` injecte automatiquement tri et filtres de colonne
- `components/AdminPagination.vue`
- `composables/useCsvExport.ts` — `exportToCsv` ou ExcelJS
- Impression via le patron `window.print()` de `pages/admin/activite.vue:542`

---

## Lot 5 — Dashboards

### 5.1 Historique et évolution par PDV

Rien de comparable n'existe. `components/charts/VisitesLineChart.vue:44-55` est mono-série, couleur `#C8102E` figée, `legend: {display:false}`. Un composant multi-séries est nécessaire pour comparer deux périodes ou plusieurs PDV.

`plugins/chart.client.ts:17-28` enregistre une liste fermée sans `TimeScale` : ajouter l'enregistrement si un axe temporel est requis, sinon rester sur des libellés de catégorie.

**Consolidation à faire.** L'agrégation par période est réimplémentée **trois fois** : `composables/useDashboardDirection.ts:189-213`, `pages/admin/visites/evolution.vue:96-129`, `pages/admin/pdv/evolution.vue:102-117`. La regrouper dans `utils/` avec des tests unitaires, conformément à la convention du dépôt : la logique testable vit dans `utils/`, les composants et pages ne sont pas testés.

Réutilisable : la RPC `perfect_store_evolution_filtre` via `usePerfectStore.fetchPerfectStoreEvolution` (`:420-440`), `components/PeriodFilter.vue` et `utils/periode.ts`.

### 5.2 Tableau de bord commerciaux

Vue de synthèse par zone : PDV visités et non visités, disponibilité, alertes rouges alimentées par l'état de fraîcheur du lot 3.2.

**Contrainte structurante.** `/admin` agrège **exclusivement par RPC Supabase**. `usePerfectStore.hasDashFilters` vaut littéralement `(f) => !!f` (`composables/usePerfectStore.ts:293`), les vues non filtrées sont donc des chemins morts par conception. La raison est documentée à `usePerfectStore.ts:281-292` : les vues comptent des **visites**, les RPC comptent des **PDV distincts**, et mélanger les deux avait mis deux dénominateurs contradictoires sur un même écran.

Tout nouvel indicateur agrégé doit donc être une **nouvelle RPC**, jamais un calcul côté client.

### 5.3 Convention SQL

Fichier `supabase/nouveau/AAAAMMJJHHMMSS_friesland_<slug>.sql`, idempotent, encadré `begin;` / `commit;`, `create or replace function`, `language sql stable`, `set search_path = public`, paramètres préfixés `p_`, retour `jsonb` ou `setof`, vues déclarées `with (security_invoker = true)`. Modèle : `supabase/nouveau/20260716200000_friesland_dashboard_filtrable.sql`.

**À ne pas oublier :** le dossier `nouveau/` ne contient **aucun précédent de politique RLS**, toutes vivent dans `_archive/`. Les politiques des nouvelles tables sont à écrire d'après le style de l'archive.

---

## Lot 6 — Référentiels produits et concurrence (fichiers client du 7 septembre)

Deux fichiers Excel reçus le 7 septembre : `DISPONIBILITE - V2.xlsx` et `Competitors list IMP  EVAP - Présence.xlsx`. Diff calculé contre le seed du dépôt **et** la base live. S'ajoutent deux demandes formulées le même jour : retirer yaourt et céréales du relevé, et piloter l'étape « Visibilité concurrence » du wizard par les marques enregistrées en base.

**Règle valable pour tout le lot : aucune suppression directe en base.** Les migrations n'écrivent que du schéma, du seed et des politiques. Tout retrait de ligne se fait depuis l'admin, par un CRUD, pour que le client reste autonome et que rien ne disparaisse sans trace.

### 6.1 Disponibilité V2

**Ce qui ne change pas.** Vérifié ligne à ligne contre `supabase/nouveau/20260630120300_friesland_produits_disponibilite.sql` et la base live :
- Les 15 références et leurs rôles sont identiques. La classification client se traduit sans écart : Support SKU → `soutien`, Herro SKU → `phare`, Emerging heros → `croissance`, Innovation SKU → `nouveaute`, Candidate to delist → `a_retirer`.
- `standard_assortiment` (15 SKU / 10 min, 12 / 8, 11 / 5, héros obligatoires) est identique.
- Aucune valeur de seuil ne diffère, aucune ligne n'est à ajouter.

**Ce qui change : 17 seuils à retirer.** V2 vide les colonnes de trois références qui ont encore des seuils en base live :

| Référence | Segments × grades à retirer | Lignes |
|---|---|---|
| BRB 380g (à délister) | Boutique A/B/C, Minimarket A/B | 5 |
| BR 1kg | Boutique A, Minimarket A/B | 3 |
| Pearl 1kg | Boutique A/B/C, Minimarket A/B, Kiosque A/B, Aboki A/B | 9 |

La base live contient aussi `SupermarcheMT` A/B/C pour BR 1kg et Pearl 1kg (câblage MT, `20260709150000`). Le fichier V2 ne couvre pas le MT : **ces lignes restent**.

**Effet sur le calcul, à connaître avant de retirer.** `calculer_dispo_categorie(..., 'scm', ...)` joint `seuil_disponibilite` ; sans seuil SCM en GT, elle renvoie `null` et `dispo_rayon` devient la moyenne EVAP + IMP — le `where x is not null` de `20260630130100_friesland_perfect_store_calcul.sql:187-190` le gère déjà. `presence_rayon_scm` (`20260730130000`) suit le même chemin. L'assortiment (`:200-218`) compte sur `correspondance_reference` sans jointure seuil : SCM et BRB 380g continuent de compter dans les « 15 SKU », ce qui est cohérent avec le total V2. Les visites GT déjà calculées gardent leur ancien `dispo_rayon_scm` tant qu'on ne les recalcule pas.

**Constat — rien à coder.** Le CRUD existe déjà : Paramètres → Référentiels → section Perfect Store → « Seuils dispo » (`pages/admin/referentiels/index.vue`, entrée `seuil_disponibilite`, avec suppression ligne à ligne, RLS `seuil_disponibilite_manager_write` réservée à `est_gestionnaire_perfect_store()`). Le recalcul existe aussi : bouton « Recalculer toutes les visites » de `pages/admin/perfect-store/standards.vue`, RPC `recalculer_tous_perfect_store`.

> **État au 7 septembre 2026.** Script `scripts/retirer-seuils-v2.mjs` : le dry-run identifie exactement les 17 lignes (BRB 380g ×5, BR 1kg ×3, Pearl 1kg ×9, MT intact). **Reste à lancer** `node scripts/retirer-seuils-v2.mjs --apply` (supprime puis recalcule via `recalculer_tous_perfect_store`), ou la suppression à la main dans l'admin.

**Procédure admin (pas de SQL) :**
1. Référentiels → Perfect Store → Seuils dispo : supprimer les 17 lignes du tableau ci-dessus, en recoupant référence, segment et grade. Ne pas toucher aux lignes `SupermarcheMT`.
2. Standards Perfect Store → « Recalculer toutes les visites ».
3. Optionnel, à coder si demandé : afficher la classification client (Hero / Support / Emerging / Innovation / Delist) comme libellé du `role` dans Standards, sans toucher l'enum.

### 6.2 Concurrence par SKU

**Existant.** `marque_concurrente` (`20260730150000`) est au niveau **marque** ; `code` est la clé JSONB de `visites.data.concurrence.<famille>.<code>` (statut `ProductStatus`). Base live : evap {cowmilk, nido_150g}, imp {nido, laity, top_lait}, scm {top_saho}, uht {candia}. CRUD admin en place (`pages/admin/referentiels/index.vue:612-637`, `code = normaliserNomConcurrent(nom)` à la création).

**Fichier.** Les onglets EVAP et IMP « Présence » listent des SKU (marque + grammage), tous à Présence = 1, colonne Picture vide :
- EVAP : Laity 150 g (en double dans le fichier), Cowmilk 160 g, Soleil 400 g
- IMP : Nido 800 / 2500 / 400 / 15 / 350 g ; Top lait 400 / 12 g ; Laity 900 / 400 / 18 / 360 g ; Biblos FC 16 g, Biblos Full Cream 360 g, Biblos Fat Filled 900 g ; Captain 12 / 22 g

Les onglets « IVC IMP » et « IVC Evap » sont des fiches marché (format, colisage, matière grasse) et citent en plus Dano, LP et Tylait, absents de la liste Présence.

**Marques manquantes** au niveau marque : Laity et Soleil en EVAP, Biblos et Captain en IMP. `nido_150g` EVAP n'est pas dans la liste Présence mais figure dans IVC Evap : à conserver.

**À construire :**
- Table `marque_concurrente_sku` : `id`, `marque_id → marque_concurrente`, `grammage_g int`, `format text`, `colisage int`, `code text`, `actif`, `ordre`, `image_url text null`, `unique (marque_id, code)`. `code` figé à la création, clé JSONB sous `data.concurrence.<famille>.skus.<code>` (ex. `nido_400g`). RLS calquée sur `marque_concurrente_read` / `marque_concurrente_write`.
- Seed : les 4 marques manquantes puis les 19 SKU du fichier (Laity 150 g dédoublonné), format et colisage repris des onglets IVC quand ils existent.
- `composables/useMarquesConcurrentes.ts` : charger les SKU avec les marques, exposer `skusParMarque`. Repli offline `MARQUES_CONCURRENTES_DEFAUT` enrichi des SKU.
- Formulaire `pages/mobile/visites/new.vue:310-344` : sous chaque marque `present`, un `ToggleStatus` par SKU. La marque reste écrite sous sa clé actuelle (les dashboards historiques la lisent) et passe à `Présent` dès qu'un SKU l'est.
- `types/index.ts` (`ConcurrenceCategorie`) et `utils/concurrence.ts` : sous-objet `skus`.
- Restitution : `components/VisitDetailModal.vue:96-132`, `pages/mobile/visites/[id].vue`, et un bloc « présence par SKU » dans `pages/admin/concurrence/index.vue` à côté du comptage par marque (`:141-186`).
- Admin : entrée de registre `marque_concurrente_sku` (select marque, grammage, format, colisage, photo via `useImageUpload` vers `visite-images`, actif, ordre). Désactiver plutôt que supprimer une fois des relevés collectés.

### 6.2 bis Visibilité concurrence — étape 9/11 du wizard

**Constat.** `pages/mobile/visites/new.vue:919-926` fige six items NIDO / LAITY / CANDIA × extérieur / intérieur, et `VisiteVisibilite.concurrence` (`types/index.ts:362-373`) les porte en clés plates (`nido_exterieur`…). Une marque ajoutée dans les Référentiels n'y apparaît jamais.

**Incohérence préexistante à corriger en même temps.** `pages/admin/concurrence/visibilite-recap.vue:121-155` et `visibilite-evolution.vue:83-129` lisent `data.visibilite.concurrence.exterieure.<marque>` / `interieure.<marque>` — une forme imbriquée que le wizard n'écrit jamais, avec une liste de marques locale (`visibilite-recap.vue:121`). Ces deux pages sont donc vides pour toute visite saisie par l'app.

**À construire :** items générés depuis `marque_concurrente` (toutes familles, `actif`), écrits sous `data.visibilite.concurrence.exterieure.<code>` et `interieure.<code>` — la forme qu'attendent déjà les dashboards ; les deux pages et `VisitDetailModal` branchés sur `useMarquesConcurrentes` à la place de leurs listes locales ; repli de lecture sur les clés plates pour l'historique.

### 6.3 Incidence sur le field coaching

La ligne « SKU disponibles (19 valeurs) → `reference_produit` » du lot 4.2 reste valable : V2 ne modifie ni la liste des références ni leurs rôles.

### 6.4 Catégories de relevé désactivables — retrait de yaourt et céréales

**Constat.** Yaourt et céréales n'existent **qu'en front**. `categorie_produit` en base ne contient que EVAP / IMP / SCM (référentiel Perfect Store, à ne pas toucher). Aucune table de paramètres applicatifs n'existe (`perfect_store_score_config` et `perfect_store_tier_config` seulement). Points d'apparition :
`utils/products.ts:64-78` (`PRODUCT_CATALOG`, type `ProductCategoryKey`) · étapes du wizard `pages/mobile/visites/new.vue:668-680` et `productCategoryKeys :959` · `pages/mobile/visites/[id].vue:167` · onglets `utils/adminSectionTabs.ts:56-60` · `pages/admin/produits/recap.vue:105-110` · `pages/admin/produits/[category].vue:249-257` · `pages/admin/produits/inventaire.vue:95` · `pages/admin/activite.vue:426,493` (`taux_yaourt`, vue héritée de `_archive/001c:181`) · `composables/useCsvExport.ts:35,77`.

Des visites historiques portent `data.produits.yaourt` et `.cereales` : on masque, on ne supprime rien.

**À construire :**
- Table `categorie_releve (code text primary key check (code in ('evap','imp','scm','uht','yaourt','cereales')), libelle text, actif boolean, ordre int)`. Seed : evap / imp / scm / uht actifs, **yaourt et cereales inactifs**. Lecture `authenticated`, écriture réservée à `est_gestionnaire_perfect_store()`. Pas de suppression : un code est structurel dans le JSONB des visites.
- Composable `useCategoriesReleve()` sur le modèle de `useMarquesConcurrentes` : `useState`, `categoriesActives` calculé, repli offline = `PRODUCT_CATALOG` avec yaourt et céréales inactifs, pour que le retrait soit visible dans l'app même sans réseau.
- Consommateurs filtrés par `actif` : `wizardSteps` et `productCategoryKeys` (`new.vue`), `[id].vue:167`, `VisitDetailModal` s'il itère les catégories, `adminSectionTabs.produits` (onglets calculés depuis le composable, ou filtrés dans le composant d'onglets), `recap.vue`, `inventaire.vue`, `[category].vue` (404 si code inactif), `activite.vue` (tuile `taux_yaourt` masquée). `useCsvExport` garde ses colonnes pour l'historique.
- Admin : entrée de registre dans `pages/admin/referentiels/index.vue`, section `produit`, colonnes code / libellé / actif / ordre, champs éditables `actif` et `ordre` seulement (`lockEdit` sur le code), pas de `del`. Une case à cocher retire ou réactive une catégorie sans redéploiement.
- `defaultData.produits` (`types/index.ts:561+`) conserve les clés yaourt et cereales pour la compatibilité du type ; elles ne sont plus affichées ni validées.

---

## Lot 7 — Livraison Play

`versionCode 5` et `versionName 1.0.4` sont déjà posés et non publiés : les conserver.

### Sur cette machine

1. Appliquer les lots 1 à 6.
2. `pnpm exec vitest run` puis `npx nuxt build`.
3. Prouver le garde-fou :
   ```bash
   cd android
   export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
   ./gradlew tasks --all >/dev/null && echo "sync OK"   # doit réussir
   ./gradlew assembleDebug                               # doit réussir
   ./gradlew bundleRelease                               # doit ÉCHOUER en ~10 s
   ```
4. Prouver le vérificateur sur un artefact connu bon :
   ```bash
   pnpm run android:verify dist-apk/friesland-bonnet-rouge-1.0.3-release.aab
   ```
5. Committer et **noter le SHA** — c'est lui qui épingle `versionCode 5`.

### Sur la machine au keystore

6. `git pull`, puis vérifier que `git rev-parse HEAD` correspond au SHA noté.
7. `export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`
8. Confirmer `android/keystore.properties` avec `keyAlias=upload` et un `storeFile` **absolu**.
9. Confirmer le `.env` de production : `SUPABASE_URL` et `SUPABASE_KEY` sont **gelées dans le bundle JS** au moment du `generate:native`.
10. `pnpm install --frozen-lockfile`
11. `pnpm run android:bundle` (environ 4 minutes) puis `pnpm run android:release` pour l'APK sideloadable.
12. `pnpm run android:verify` → doit afficher `OK : clé d'upload…`. **S'arrêter à la moindre erreur.**
13. Copier vers `dist-apk/friesland-bonnet-rouge-1.0.4-release.{aab,apk}` selon la convention des quatre versions précédentes, re-vérifier la copie, committer.

### Dans Play Console — vous seul

14. Uploader l'AAB. Un upload avec la mauvaise clé est rejeté par un message de signature explicite. Recouper l'empreinte de la clé d'importation affichée par Play avec `13:B2:1B:C5:…:CF`.
15. **Formulaire de déclaration de localisation en arrière-plan** : il réclame une **vidéo** montrant la modale de divulgation apparaissant avant tout prompt système. L'enregistrer et l'héberger **avant** d'ouvrir le formulaire — c'est l'étape qu'on découvre en cours de route.
16. **Sécurité des données** : localisation précise, collectée, non partagée, cohérente avec la politique publiée.
17. **Nom du développeur** : doit afficher exactement `BD & CO`, identique aux deux pages publiques.
18. Notes de version 1.0.4 couvrant la divulgation et l'identification de l'éditeur.

### Bloquant hors code

Résolu le 7 sept. : les deux pages sont servies par `https://frieslandv3.vercel.app` (vérifié, package et BD & CO présents). Ancien constat : l'URL était `https://<domaine>/privacy-policy` dans la fiche (`docs/play-store/FICHE-PLAY-STORE.md`). Google exige une URL **publiquement accessible** ; l'existence des pages dans le dépôt ne suffit pas, d'autant que `generate:native` ne publie que `/mobile`. Résoudre le domaine de production, puis :

```bash
curl -s https://frieslandv3.vercel.app/privacy-policy | grep -c 'com.bdco.bonnetrouge'
curl -s https://frieslandv3.vercel.app/supprimer-compte | grep -c 'BD &amp; CO'
```

---

## Vérification

| Quoi | Comment |
|---|---|
| Non-régression logique | `pnpm exec vitest run` (62 tests aujourd'hui) ; nouveaux tests dans `tests/` pour la fraîcheur de visite et l'agrégation par période consolidée |
| Build web | `npx nuxt build` |
| Garde-fou signature | `assembleDebug` passe, `bundleRelease` échoue vite, `tasks --all` passe |
| Empreinte de l'artefact | `pnpm run android:verify` sur le 1.0.3 puis sur le 1.0.4 produit |
| Cloisonnement RLS | Depuis un compte `commercial` réel : lecture des visites de sa zone effective, **écriture refusée sur `pdv` et `visites` par appel PostgREST direct**, pas seulement par l'interface |
| Parcours commercial | Connexion, liste PDV avec statut de dernière visite, ouverture d'une visite passée en lecture seule, création d'une action, remontée chez le merchandiseur |
| Field coaching | Saisie complète hors ligne, resynchronisation, transfert vers un autre commercial, présence dans le rapport |
| Dashboards | Comparaison d'un PDV sur deux périodes, synthèse par zone avec alertes rouges |
| Seuils V2 | `select count(*) from seuil_disponibilite` avant et après retrait depuis l'admin : 17 de moins, lignes `SupermarcheMT` intactes ; `supabase/nouveau/verif_presence_vs_disponibilite.sql` toujours vert ; recalcul lancé depuis Standards |
| Concurrence par SKU | Visite test avec un SKU concurrent Présent : JSONB `data.concurrence.<famille>.skus.<code>` écrit, marque dérivée à Présent, bloc SKU du dashboard concurrence alimenté ; étape 9/11 du wizard liste les marques du référentiel et `visibilite-recap` / `visibilite-evolution` ne sont plus vides |
| Catégories de relevé | Yaourt et céréales absents du wizard mobile (en ligne et hors ligne), des onglets admin et du récap ; réactivation depuis Référentiels visible sans redéploiement ; anciennes visites toujours lisibles |

Note : `vitest.config.ts` utilise `environment: 'node'` et `include: ['tests/**/*.spec.ts']`, sans contexte Nuxt ni Supabase mocké. Les modules testés importent leurs dépendances explicitement plutôt que de compter sur l'auto-import.

Nettoyage mineur repéré : `utils/perfectStore.spec.ts` est un doublon obsolète de `tests/perfectStore.spec.ts`, non capté par le glob.

---

## Hypothèses et risques

- **Fréquence de visite** non arrêtée par le client : hebdomadaire par défaut, surchargeable par zone et type de PDV. À confirmer avant de figer les alertes.
- **Actions commerciales** non listées précisément : référentiel configurable pré-rempli SSR, SSM, référencement. Aucune liste figée dans le code.
- **Colonnes non déclarées** — `profiles.territoires_assignes`, `pdv.territory_code`, `pdv.area_code` : la base n'est pas reproductible depuis le dépôt aujourd'hui. Migrations de rattrapage au lot 2.6.
- **Écriture ouverte à tout authentifié** sur `pdv` et le bucket d'images : la lecture seule commerciale n'est pas réelle tant que le lot 2.4 n'est pas fait.
- **Le Store reste en rejet** pendant tout le développement, conséquence directe du choix de livraison unique.
- Le périmètre commercial dans l'APK est limité à `/mobile` par `native-scope.global.ts` ; l'analyse filtrée reste une surface web.
- **Photos des SKU concurrents** : la colonne Picture du fichier est vide. `image_url` reste nul jusqu'à ce que le client fournisse les visuels ou les ajoute depuis l'admin.
- **Dano, LP, Tylait** figurent dans les onglets IVC mais pas dans la liste Présence : non seedés, à confirmer avec le client.
- **Disponibilité V2** ne couvre pas le commerce moderne : les seuils `SupermarcheMT` restent ceux du câblage de juillet.
- **Retrait des 17 seuils** : fait à la main dans l'admin, donc à recouper avec le tableau du lot 6.1 avant de lancer le recalcul.
- Les politiques RLS de `profiles`, `pdv` et `visites` n'existent que dans `supabase/_archive/`, alors que ce dossier se déclare remplacé par `nouveau/`. **Confirmer l'état réel en base avant de modifier** :
  ```sql
  select tablename, policyname, cmd, qual from pg_policies
  where tablename in ('profiles','pdv','visites','position_tournee','routing_templates');
  ```
