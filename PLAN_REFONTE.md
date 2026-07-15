# Plan de refonte Friesland — Données, Règles, Parcours, Visuel

> Document d'implémentation. Établi après audit du schéma Supabase (`supabase/nouveau/` + `supabase/_archive/`), des 45 routes, de la couche offline et du système de types/RBAC.
> Stratégie : **stabiliser les données → unifier les règles métier → simplifier les parcours → améliorer le visuel.**
> Statut global : **faisable**, sans blocage rédhibitoire. 3 hypothèses du plan initial corrigées ci-dessous.

---

## 0. État des lieux (résumé d'audit — source de vérité)

### 0.1 Schéma en 2 couches (à connaître avant toute migration)
- `supabase/_archive/` = **tables transactionnelles cœur** : `profiles`, `pdv`, `visites`, `routings`, `routing_pdv`, `routing_templates`, `routing_data`. **Ce sont les SEULES définitions de ces tables dans le repo.**
- `supabase/nouveau/` = **référentiel + moteur Perfect Store** (22 tables). Référence les tables cœur par FK **sans les créer** (ex. `resultat_perfect_store.visite_id → visites(id)`, `TOUT_COMBINE.sql:1404`).
- `TOUT_COMBINE.sql` + `scripts/run-big-five-migrations.sh` sont en cours de modification (git status) → migration active.

### 0.2 Tables & colonnes clés
| Objet | Emplacement | Points clés |
|---|---|---|
| `visites` | `_archive/001b_create.sql:74` | PK `id UUID DEFAULT gen_random_uuid()` ; clé client `visite_id TEXT UNIQUE` (`:76`) ; `sync_status CHECK('synced','pending','error')` (`:88`) ; GPS `geolocation_lat/lng`, `geofence_validated`, `precision_gps` (`:82-85`) ; `image_urls TEXT[]` ; `data JSONB` (toutes lectures produit/visibilité/concurrence/actions) |
| `pdv` | `_archive/001b_create.sql:43` | `pdv_id TEXT UNIQUE` (client) ; `geolocation_lat/lng`, `rayon_geofence` ; `image_url` ; `is_active` (pas de statut) |
| `routings` / `routing_pdv` | `_archive/007_routing_system.sql:10,26` | `status` CHECK ; `UNIQUE(user_id,date_routing)` ; `objectifs JSONB` |
| `position_tournee` | `nouveau/20260703120000...:15` | `id uuid` (client) ; `tournee_id` **colonne nue, pas de table parente** |
| `role_section_access` | `TOUT_COMBINE.sql:1838` | matrice **4 rôles × 9 sections**, RLS |
| `profiles` | `_archive/001b_create.sql:10` | `role CHECK('admin','superviseur','merchandiser','commercial')` |
| Seuils | `seuil_disponibilite` (`:528`) + `_mt` (`:2067`) | relationnels (GT + MT) |
| Produits | `categorie_produit` seed `TOUT_COMBINE.sql:546` | **EVAP/IMP/SCM seuls** relationnels |

### 0.3 Domaines SANS table (JSONB `visites.data` uniquement)
- **Concurrence**, **Actions commerciales**, **Prix**, **Inventaire/stock**.
- **UHT / YAOURT / CÉRÉALES** : hors référentiel relationnel (UHT exclu volontairement, `nouveau/20260630120300...:6`). Présents dans le catalogue front (`utils/products.ts` — 6 catégories, 26 SKU) et dans le JSONB, **mais non scorés par le moteur Perfect Store**.

### 0.4 Offline (état réel)
- Queue durable **IndexedDB** (`offline:queue`, `composables/useOfflineData.ts:94-103`), UUID client, traitement séquentiel.
- Idempotence **offline** OK : `upsert(onConflict:'visite_id')` (`useOfflineSync.ts:98`), `pdv_id` (`:107`), `position_tournee.id` (`:146`).
- Autosave brouillon en `localStorage` (`visit-draft:{userId}:{...}`, `new.vue:678,698,719`).

---

## 1. Corrections des 3 hypothèses du plan initial

| # | Hypothèse initiale | Réalité | Correction |
|---|---|---|---|
| ① | « Préserver toutes les données » (relationnel) | concurrence/actions/prix/inventaire = **JSONB seul** ; UHT/YAOURT/CÉRÉALES hors moteur PS | Préserver = garder JSONB. Tout KPI relationnel sur ces domaines = **travail neuf** (Lot 6), pas de la réutilisation. |
| ② | « Préserver statuts communs » (brouillon…validé) | seul `sync_status ∈ {synced,pending,error}` existe. **Aucun statut de cycle de vie visite.** | **Créer** `visites.status` (Lot 2). Séparer statut métier (validation) vs statut technique (transport/sync). |
| ③ | « Sync idempotente / zéro doublon » | offline OK, mais chemin **online = `.insert()` avec nouveau `visite_id` par retry** (`new.vue:1016,1075`) → **doublon prod** | Bug prod actif → **Lot 1 en priorité**, avant toute refonte UI. |

---

## 1bis. État vérifié — déjà fait (arbre de travail, non commité)
> Vérifié le 2026-07-15 (2ᵉ passe, après implémentation utilisateur) par lecture directe du code.

**✅ LOT 1 — TERMINÉ (les 6 tâches)**
- **T1.1** — online passe en `upsert(onConflict:'visite_id')` (`new.vue:1309`).
- **T1.2** — `visite_id` généré une fois via ref `activeVisiteId` (`new.vue:705,1249-1250`), réutilisé au retry, remis à `null` après succès (`:1337`).
- **T1.3** — `visite_id` = 24 hex (`crypto.randomUUID().replace(/-/g,'').slice(0,24)`, `:1249`) — fini le 8-char.
- **T1.4** — photo orpheline corrigée : `update(...).select('visite_id')` ; si 0 ligne → item `image` remis `pending` + `continue` sans consommer de retry (`useOfflineSync.ts:152-163`).
- **T1.5** — compteurs séparés `pendingVisitCount`/`pendingImageCount`/`errorVisitCount`/`errorImageCount` (`useOfflineSync.ts:222-238`), affichés « N visite(s) et M photo(s) » dans `OfflineBanner`.
- **T1.6** — `setInterval` 30 s relance `processQueue` si queue non vide (`useOfflineSync.ts:68-73`), en plus de `online`/`visibilitychange`/`pageshow`.

**✅ Autres tâches du plan déjà faites**
- **T4.2** — alerte sync device-local **retirée** du dashboard admin (plus aucune ref `useOfflineSync` dans `admin/index.vue`). Piège résolu.
- **LOT 2 (code)** — migration `20260715130000_friesland_visite_statut.sql` écrite + branchée au runner, types à jour. ⚠️ **non appliquée en base** (T2.7).

**⚠️ Régression détectée — à corriger**
- **T7.3** — `gpsMinAccuracy` appliqué via `throw` dans `validateGeofence`, mais avalé par le `try/catch` de `handleSave` ⇒ **modale « Hors zone » neutralisée** + visites soumises en silence avec `geofence_validated=false`. Défaut 10 m irréaliste. Détail + correctif : voir T7.3 au LOT 7.
- **`layouts/admin.vue`** — **ré-introduit une alerte sync device-local** dans l'en-tête admin (« N erreur(s) sur cet appareil » → `/admin/visites`), alors que T4.2 l'avait retirée de `admin/index.vue` pour cette raison. Atténué par le libellé explicite « sur cet appareil », mais l'info reste ~toujours vide pour un admin sur desktop. **À confirmer : garder ou retirer.**
- **`AdminTableEnhancer.vue`** — tri/filtre **client-side uniquement** (DOM). Sur les tables admin **paginées serveur**, il trie seulement la page visible tout en ayant l'air de trier tout le jeu → **trompeur**. À restreindre (`data-no-column-tools`) sur les tables paginées.
- **T1.7 / T5.4 / LOT 4 base** — déjà faits (passe précédente) : dernière synchro affichée, autosave/reprise brouillon, cockpit « À traiter maintenant » + fraîcheur + KPIs.
- **Socle pré-existant** (commité) : matrice RBAC, catalogue 6 catégories, upsert offline idempotent, géoloc tournée native.

**❌ Reste à faire (near-term)**
- **LOT 2** — statut cycle de vie visite : toujours pas de colonne `visites.status`, pas de `synced_at`, pas de type `VisitStatus` (diff `types/index.ts` = nettoyage SKU SCM uniquement). **Bloqué par décision D1** (dossier SQL autoritaire).
- **LOT 4.1 (reste)** — alertes PDV non visités / erreurs GPS / routings incomplets / commerciaux inactifs.
- **LOT 3, 5, 6, 8** — partiellement entamés hors numérotation. Mapping des modifs non commitées (audit du 2026-07-15) :

| Fichier | Lot | Ce qui change | État |
|---|---|---|---|
| `components/FormWizard.vue` (+62) | **LOT 5** (teinte LOT 3) | `stepStates` dérivé des **vraies données** (remplace le suivi des clics) ; couleurs d'état ; `<select>` de section sur mobile ; indicateur « N / M · Label ». Câblé (`new.vue:30`, computed `:992`) | fait — ⚠️ **n'est pas T5.2** (les étapes restent toutes accessibles) ; proche de T5.5 mais au niveau étape, pas champ |
| `components/AdminTableEnhancer.vue` (NEW, 304 l.) | **LOT 3** | Tri + filtre par colonne injectés en DOM sur **toutes** les tables admin (MutationObserver, tri typé fr, `aria-sort`) | fait — ⚠️ client-side only (voir régression ci-dessus) |
| `layouts/admin.vue` (+44) | **LOT 3 + tension LOT 4** | Wrap du slot dans `AdminTableEnhancer` ; alerte sync « sur cet appareil » ; footer Big Five | fait — ⚠️ voir régression T4.2 |
| `components/AdminSidebar.vue` (+13) | **LOT 3** | Type `AdminNavItem` + `badge?` optionnel ; fix `text-left` | partiel — `badge` **déclaré jamais utilisé** (servirait T4.4) |
| `layouts/mobile.vue` (+11) | **LOT 1 / T1.7** | `syncTooltip` « Dernière synchronisation : HH:MM » sur le badge | fait — logique **inline**, donc pas encore T3.4 (module partagé) |
| `plugins/native-app.client.ts` (+6) | **LOT 7** (objectif LOT 1) | Capacitor `appStateChange` → `processQueue()` au retour au premier plan | fait — pendant natif de T1.6, ne correspond à aucun T7.x numéroté |
| `pages/admin/perfect-store/index.vue` (+181) | **hors plan** | Table type PDV → accordéon avec liste magasins paginée 10/page (`fetchPerfectStoreListe({type})`) | fait |
| `types/index.ts`, `utils/products.ts`, SQL `2026070915*`/`20260715120000` | **hors plan** | Implémentation des **arbitrages client du 2026-07-15** (SCM ramené à 2 SKU ; câblage MT ; placeholders Adzope/Agboville) — cf. `MAJ_2026-07-09_A_ARBITRER.md` | fait |

**Résidu mineur LOT 1** : tant que la visite parente n'est pas en base, l'item photo est ré-uploadé au storage toutes les 30 s (idempotent via `upsert:true`, mais consomme de la bande passante). Acceptable.

---

## 2. Règles de non-régression (invariants tout au long)
- [ ] Aucune des **45 routes** supprimée (34 admin / 9 mobile / 2 racine). Inclut les entrées `redirect` (`/admin/perfect-store/visites`) et statiques (`/mobile/visites/new`).
- [ ] Aucune donnée visite/PDV/routing/Perfect Store retirée (JSONB `data` conservé intégralement).
- [ ] Matrice RBAC (`role_section_access`, 4 rôles × 9 sections) et middleware (`admin.ts`, `useAccessControl.ts`) conservés.
- [ ] Exports CSV/Excel (`/admin/import-export`, imports routing) disponibles.
- [ ] Formulaire mobile : **tous les champs métier** conservés (6 catégories, 26 SKU, visibilité, concurrence, actions, photos).
- [ ] Offline, GPS/géofence, photos, synchronisation, tournée native : testés séparément (Lot 8).
- [ ] Chaque version fonctionne sur desktop, PWA et APK native.

---

## 3. Plan par lots

> Convention : chaque tâche indique **[SQL] / [FRONT] / [COMPOSABLE] / [DÉCISION]**, les fichiers touchés, et un critère d'acceptation.

### LOT 0 — Décisions bloquantes (pré-requis)
- [x] **D1 [DÉCISION]** ✅ **`supabase/nouveau/` est autoritaire pour toute NOUVELLE migration.** Preuve : `scripts/run-big-five-migrations.sh` fixe `SQL_DIR=supabase/nouveau` et rejoue 22 migrations de ce seul dossier ; `_archive/` n'est **jamais** exécuté. `nouveau/` s'accroche déjà à `visites` (trigger `trg_perfect_store`, FK `references visites(id)`) sans la créer → `_archive/` = socle historique **déjà appliqué en prod**, gelé. ⚠️ Le runner n'a **aucune table de suivi de migrations** : il rejoue tout à chaque exécution → **toute migration doit être idempotente**.
- [x] **D2 [DÉCISION]** ✅ Retenu : `status ∈ {soumis, validé, rejeté}` (métier), distinct de `sync_status` (technique). Brouillon reste local (`localStorage`) — une visite n'atteint la base qu'une fois soumise.
- [x] **D3 [DÉCISION]** ✅ Fait — `visite_id` = 24 hex (`new.vue:1249`), rétro-compatible avec les lignes 8-char existantes.

### LOT 1 — Fiabilité offline & correction des doublons ✅ TERMINÉ
Fichiers : `pages/mobile/visites/new.vue`, `composables/useOfflineSync.ts`, `components/OfflineBanner.vue`.
- [x] **T1.1 [FRONT]** ✅ Online → `upsert(visite, { onConflict:'visite_id' })` (`new.vue:1309`).
- [x] **T1.2 [FRONT]** ✅ `visite_id` généré une fois via ref `activeVisiteId` (`new.vue:705,1249-1250`), réutilisé au retry, remis `null` après succès (`:1337`).
- [x] **T1.3 [FRONT]** ✅ `visite_id` = 24 hex (`:1249`).
- [x] **T1.4 [COMPOSABLE]** ✅ `update(...).select('visite_id')` ; 0 ligne → item `image` remis `pending` + `continue` (`useOfflineSync.ts:152-163`).
- [x] **T1.5 [FRONT]** ✅ `pendingVisitCount`/`pendingImageCount`/`errorVisitCount`/`errorImageCount` (`useOfflineSync.ts:222-238`), bannière « N visite(s) et M photo(s) ».
- [x] **T1.6 [COMPOSABLE]** ✅ `setInterval` 30 s relançant `processQueue` si queue non vide (`useOfflineSync.ts:68-73`).
- [ ] **T1.8 [TEST]** Reste : valider en conditions réelles (couper réseau au submit online → rejouer → 1 seule ligne ; visite en erreur → photos non orphelines).
- [x] **T1.7 [FRONT]** ✅ **Fait** — `lastSyncAt` + « Dernière synchronisation : HH:MM » (`layouts/mobile.vue:137`) + messages lisibles. Reste optionnel : âge du cache de référence (30 min).

### LOT 2 — Statut cycle de vie visite (comble hypothèse ②) — code écrit, **migration NON appliquée**
Migration : `supabase/nouveau/20260715130000_friesland_visite_statut.sql` (dossier issu de D1), branchée dans `scripts/run-big-five-migrations.sh`.
- [x] **T2.1 [SQL]** ✅ `add column if not exists status text not null default 'soumis'` + contrainte `visites_status_check` (drop/add → rejouable).
- [x] **T2.2 [SQL]** ✅ `add column if not exists synced_at timestamptz` + trigger `trg_visites_touch_synced_at` (`before insert or update`) → renseigné **côté serveur** (`now()`), pas par l'horloge du device (souvent fausse hors ligne).
- [x] **T2.3 [SQL]** ✅ Backfill `synced_at = coalesce(updated_at, created_at)` ; `status` backfillé par le `default` du `add column`.
- [x] **T2.4 [FRONT]** ✅ `types/index.ts` : `VisitStatus = 'soumis'|'validé'|'rejeté'`, `Visite.status`, `Visite.synced_at`, les 2 axes documentés. Sûr : aucune construction littérale de `Visite` (que des `as Visite`).
- [x] **T2.5 [SQL]** ✅ Garde-fou par trigger `trg_visites_garde_statut` + helper existant `est_gestionnaire_perfect_store()` (admin/superviseur, `is_active`). `auth.uid() is null` (psql/seeds) = non appliqué, sinon le fichier ne serait pas rejouable.
- [ ] **T2.7 [SQL]** ▶️ **Appliquer la migration** : `./scripts/run-big-five-migrations.sh <DATABASE_URL>`. *Rien n'est en base tant que ce n'est pas lancé.*
- [ ] **T2.6 [FRONT]** Écran admin visites (`/admin/visites`) : action valider/rejeter. ⚠️ Prérequis : ajouter `status` aux `select` de listes (`useOfflineData.ts:116`, `pages/mobile/index.vue:311`, `stores/visites.ts`) — ils ne le sélectionnent pas aujourd'hui, `visite.status` serait `undefined`.

### LOT 3 — Socle commun & règles métier (Étape 1+2 initiales)
- [ ] **T3.1 [FRONT]** Module unique de **mapping statut → label → couleur** (métier + sync + routing), partagé admin/mobile. *Acceptation : une seule source, même rendu partout.*
- [ ] **T3.2 [FRONT]** Composants états **loading / vide / erreur** normalisés.
- [ ] **T3.3 [FRONT]** Mini design system : palette `fc-blue`, cartes (`rounded-xl shadow-sm`), badges statut, filtres, boutons — composants partagés PWA/admin.
- [ ] **T3.4 [FRONT]** Notion de **fraîcheur des données** (indicateur d'âge) réutilisable (s'appuie sur T1.7/T2.2).
- [ ] **T3.5 [DOC]** Référentiel officiel des 45 routes + rôles/droits par section (généré, versionné).

### LOT 4 — Dashboard cockpit admin (Étape 3, corrigé)
Fichier : `pages/admin/index.vue`.
- [ ] **T4.1 [FRONT]** Bloc « À traiter maintenant » — alertes **requêtables serveur** :
  - [ ] PDV non visités (jointure `pdv` × `visites` sur période) ✅
  - [ ] Erreurs GPS : `geofence_validated=false` / `precision_gps` élevée ✅
  - [ ] Catégories sous seuil : `seuil_disponibilite`/`_mt` vs `data.quantites` (calcul) ✅
  - [ ] Routings incomplets : `routing_pdv.status ≠ 'completed'` ✅
  - [ ] Commerciaux sans activité récente : `max(visites.created_at)` par `profiles` ✅
- [x] **T4.2 [FRONT]** ✅ **Résolu par retrait** — l'alerte sync device-local a été supprimée du dashboard admin (plus aucune ref `useOfflineSync` dans `admin/index.vue`). Si un suivi sync temps réel côté admin est voulu plus tard : heartbeat device → table `device_sync_state`.
- [ ] **T4.3 [FRONT]** En-tête contexte : période / zone / dernière MAJ. **KPI existants conservés** (aucun retiré).
- [ ] **T4.4 [FRONT]** Chaque alerte renvoie vers l'écran d'action correspondant (lien profond).

### LOT 5 — Simplification PWA (Étape 4)
Fichiers : `pages/mobile/index.vue`, `pages/mobile/visites/new.vue`, `layouts/mobile.vue`.
- [ ] **T5.1 [FRONT]** Accueil : tournée du jour, progression, prochaine visite, statut réseau + GPS + sync en attente, bouton « Commencer une visite ».
- [ ] **T5.2 [FRONT]** Formulaire : étapes affichées **conditionnellement** (selon canal/type PDV), **parité fonctionnelle totale** (tout le JSONB conservé).
- [ ] **T5.3 [FRONT]** Préremplissage des infos connues (PDV, routing du jour).
- [x] **T5.4 [FRONT]** ✅ **Fait** — `saveDraft`/`restoreDraft`/`clearDraft` + watchers + bannière + toast reprise (`new.vue`). À **tester** seulement, pas à recréer.
- [ ] **T5.5 [FRONT]** Distinction visuelle champs obligatoires / facultatifs.

### LOT 6 — KPI concurrence / actions / prix / inventaire (comble hypothèse ①)
> Optionnel / ultérieur. Ces domaines n'ont pas de table.
- [ ] **T6.1 [DÉCISION]** Choisir : **vues SQL sur `visites.data`** (JSONB path) **ou** tables/vues matérialisées dédiées. Recommandé : vues SQL en lecture (pas de duplication d'écriture).
- [ ] **T6.2 [SQL]** Vues de lecture : `v_concurrence`, `v_actions`, `v_prix`, `v_inventaire` extraites du JSONB. *Acceptation : pages concurrence/actions lisent une vue, plus le JSONB brut.*
- [ ] **T6.3 [DÉCISION]** UHT/YAOURT/CÉRÉALES dans le moteur Perfect Store : **oui/non** ? (aujourd'hui hors scoring relationnel). Si oui → seed `categorie_produit` + `correspondance_reference`.

### LOT 7 — Application native (Étape 6)
Fichiers : `composables/useTournee.ts`, `layouts/mobile.vue`, config Capacitor.
- [ ] **T7.1 [FRONT]** Écran d'autorisation GPS clair + diagnostic permissions refusées.
- [ ] **T7.2 [COMPOSABLE]** Reprise tournée après interruption/kill (**socle déjà là** `useTournee.ts:306-352` — fiabiliser).
- [ ] **T7.3 [COMPOSABLE]** ⚠️ **Implémenté mais contre-productif — à revoir.** `validateGeofence` (`useGeofencing.ts:67-69`) **throw** si `accuracy > minAccuracy` (défaut **10 m**, irréaliste : GPS urbain/intérieur = 20-50 m). Dans `handleSave` l'appel est dans un `try/catch { geofenceOk = false }` → le throw ⇒ **pas de modale « Hors zone »**, visite soumise **en silence** avec `geofence_validated=false`. Effets : (a) la plupart des visites marquées non-géolocalisées ; (b) **le garde-fou hors-zone est neutralisé** (un commercial loin du PDV passe aussi en silence) ; (c) le message précis « Précision GPS insuffisante (X m) » est écrasé par le générique `'Erreur de géolocalisation'` (mapping `err.code` `:86-89`, notre Error n'a pas de `code`). **Correctif** : ne pas `throw` pour la précision → exposer `accuracyOk` dans `GeofenceResult` ; remonter `gpsMinAccuracy` à ~50 m ; modale dédiée « précision insuffisante » (Réessayer / Soumettre quand même) ; préserver le message. Note : `grabPosition` (`:161-176`) ne throw pas → `precision_gps` reste correctement enregistré.
- [ ] **T7.4** Notifications push + deep links vers PDV/visite + journal de diagnostic synchronisable.

### LOT 8 — Validation & non-régression (Étape 7)
- [ ] Test des 45 routes admin/mobile.
- [ ] Test des 4 rôles (admin / superviseur / merchandiser / commercial) via matrice RBAC.
- [ ] Création visite + photos **hors ligne** → fermeture forcée → reprise → reconnexion → sync → **zéro doublon**.
- [ ] Test GPS valide / invalide / refusé.
- [ ] Test routing démarré / terminé / ignoré.
- [ ] Vérif exports CSV/Excel.
- [ ] Test responsive + APK native.
- [ ] Contrôle performance + accessibilité (clavier/tactile).

---

## 4. Ordre d'exécution & dépendances
```
LOT 0 (décisions)
  └─> LOT 1 (bug doublon — priorité absolue, indépendant)
  └─> LOT 2 (statut visite) ──> LOT 3 (socle/vocabulaire) ──> LOT 4 (cockpit admin)
                                                          └──> LOT 5 (PWA)
LOT 6 (KPI JSONB) : après LOT 3, optionnel
LOT 7 (natif) : parallèle à LOT 5
LOT 8 (validation) : continu + porte de sortie finale
```
- **LOT 1 peut démarrer immédiatement** (aucune dépendance de décision autre que D3).
- **LOT 2 dépend de D1** (dossier SQL autoritaire).

---

## 5. Risques & points à trancher
| Risque | Impact | Mitigation |
|---|---|---|
| Migration posée dans le mauvais dossier SQL | FK cassées | **D1 avant tout SQL** |
| `visite_id` 8 hex — collision ~50 % vers 77k lignes | doublons silencieux | D3 (allonger) |
| `sync_status='error'` défini mais jamais écrit | pas d'état d'erreur serveur observable | statut dérivé côté client (la ligne n'est en base que si sync réussie) — ne pas compter dessus |
| État « non synchronisé » non requêtable en admin | alerte trompeuse | T4.2 |
| JSONB non typé (concurrence/actions/prix) | KPI fragiles | vues SQL Lot 6 + validation de schéma JSONB |

---

## 6. Critères de réussite
- [ ] Chaque fonctionnalité actuelle a un équivalent vérifié (matrice Lot 8).
- [ ] Aucune donnée perdue hors connexion ; **zéro doublon** après reconnexion (Lot 1).
- [ ] Chaque KPI a une définition claire ; chaque alerte renvoie vers une action (Lot 4).
- [ ] L'utilisateur comprend l'état de synchronisation (Lot 1.5/1.7).
- [ ] Dashboard utilisable sans connaître la structure interne de la base.
- [ ] PWA : terminer une visite en peu de manipulations, parité métier totale.
- [ ] Native : fiabilité GPS/réseau améliorée.
