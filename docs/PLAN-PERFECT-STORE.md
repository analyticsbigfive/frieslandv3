# PLAN — Intégration Perfect Store dans frieslandv3

> Guide d'implémentation pour Claude Code. Repo : `jhouedanou/frieslandv3` (Nuxt 3 + Supabase).
> Spécification métier complète : voir `docs/kpi-merchandising-v2.md` (à copier dans le repo).
> Langue : tout le code, les commentaires, les commits et les messages en **français**.

## Contexte

Le client FrieslandCampina (Bonnet Rouge) demande d'intégrer le concept **Perfect Store** dans l'app Big Five :

**Perfect Store = OSA (disponibilité) + Visibilité parfaite + Promotion effective (optionnelle)**, avec 4 niveaux : Flagship, VIP, Core, Basic. Le dashboard Perfect Store doit être le **premier écran** après connexion.

### État des lieux du code (vérifié)

- ✅ Collecte terrain solide : `VisiteVisibilite` (ext./int./concurrence), quantités par SKU (`SkuQuantites`), canal GT/MT sur `pdv`, seuils configurables (`sku_thresholds` + `useSkuThresholds`), RLS admin/superviseur.
- ❌ Aucune notion de Perfect Store, aucun scoring, aucune pondération.
- ❌ **Pas de lien réel territoires ↔ PDV** : `pdv.region/zone/secteur` sont du texte libre sans FK vers `zones_secteurs` ; le scoping (`useUserScope.matchesPDVScope`) compare des chaînes ; côté mobile, `PDVQuickCreateModal` remplit zone/secteur depuis `profile.zone_assignee`/`secteurs_assignes` (texte libre), pas depuis une table.
- ❌ Pas de distributeurs, pas de hiérarchie North/South, pas de niveau "area".
- ❌ Pas de section promotion dans le formulaire de visite (seul un booléen `execution_activites_promotionnelles` dans les actions).
- ⚠️ README obsolète (parle de Laravel/Flutter V2) — à réécrire en fin de projet.

### Conventions à respecter

- Migrations SQL numérotées dans `supabase/` (suivre la séquence existante, prochaine : `013_...`), idempotentes (`IF NOT EXISTS`, `ON CONFLICT`), avec RLS systématique (lecture : authentifié ; écriture : admin + superviseur, comme `012_sku_thresholds.sql`).
- Types dans `types/index.ts`, composables dans `composables/`, un store Pinia par domaine dans `stores/`.
- Ne rien casser : l'app actuelle reste fonctionnelle à chaque phase (déploiement progressif demandé par le client).
- Chaque phase = une PR distincte, testée avant de passer à la suivante.

---

## Phase 0 — Socle territorial (PRIORITAIRE, bloque tout le reste)

Objectif : remplacer le rattachement par texte libre par une vraie hiérarchie référencée.

### 0.1 Migration `013_territoires_distributeurs.sql`

- Table `distributeurs` : `id UUID PK`, `nom TEXT UNIQUE`, `is_national BOOLEAN DEFAULT false` (les « tous territoires » type PROSUMA/CDCI), `is_active`.
- Table `territoires` (une ligne = une **area**, comme l'onglet TERRITORY du fichier client) :
  - `id UUID PK`
  - `division_code TEXT` (SOUTHDIV / NORTHDIV), `division_nom TEXT`, `division_equivalence TEXT` (ABIDJAN / INTERIEUR)
  - `sub_region_code TEXT` (SOUTH1...), `sub_region_nom TEXT`, `sub_region_equivalence TEXT` (ABIDJAN 1...)
  - `territory_code TEXT` (BIN, COC 1, TRE...), `territory_nom TEXT` (Bingerville, Cocody 1...)
  - `area_code TEXT`, `area_nom TEXT`
  - `distributeur_id UUID NULL REFERENCES distributeurs(id)` (NULL = « A POURVOIR »)
  - contrainte `UNIQUE (territory_code, area_code)`
- Seed depuis l'onglet TERRITORY + DISTRIBUTEUR + Mapping du fichier client (générer le SQL avec un script `scripts/generate-territoires-seed.mjs` sur le modèle de `scripts/generate-seed-sql.mjs`).

### 0.2 Migration `014_pdv_area_fk.sql`

- `ALTER TABLE pdv ADD COLUMN area_id UUID NULL REFERENCES territoires(id)`.
- Idem sur `visites` : `area_id`, `distributeur_id` (renseignés à la création de visite).
- Ne PAS supprimer `region/zone/secteur` pour l'instant (transition douce).

### 0.3 Script de correspondance `scripts/migrate-pdv-territoires.mjs`

- Matcher les `zones_secteurs` existantes (831 lignes) et les `pdv` existants vers `territoires` (normalisation : casse, accents, espaces ; table de correspondances manuelles pour les cas connus, ex. « ABIDJAN 2 » → sub-region SOUTH2).
- Sortie : CSV `rapport-non-matches.csv` (PDV/zones sans correspondance) pour arbitrage manuel. **Ne jamais deviner silencieusement.**

### 0.4 Profils et scoping

- Migration `015_profiles_areas.sql` : `profiles.area_ids UUID[]` (garde `zone_assignee`/`secteurs_assignes` en lecture le temps de la transition).
- Mettre à jour `composables/useUserScope.ts` : `matchesPDVScope` filtre par `pdv.area_id ∈ profile.area_ids` quand `area_id` est renseigné, repli sur l'ancien comportement texte sinon.
- Mettre à jour les policies RLS concernées.

### 0.5 Critères d'acceptation Phase 0

- [ ] Un PDV peut être rattaché à une area par FK ; l'ancien texte reste affiché.
- [ ] Le rapport de non-matchés est généré et < 100 % des lignes (sinon le matching est cassé).
- [ ] Un merchandiseur avec `area_ids` ne voit que ses PDV.

---

## Phase 0bis — Mobile : sélection territoire + distributeur (demande explicite du client)

- Nouveau composable `useTerritoires.ts` (chargement + cache de la table, cascade Division → Sub-region → Territory → Area).
- `pages/mobile/index.vue` : sélecteur d'area en début de session (parmi `profile.area_ids`) + affichage du distributeur de la zone (pré-rempli depuis `territoires.distributeur_id`, modifiable).
- `components/PDVQuickCreateModal.vue` : remplacer les champs texte zone/secteur par la cascade `territoires` ; le PDV créé reçoit `area_id`.
- `components/PDVSelector.vue` : afficher `territory_nom - area_nom` au lieu de `zone - secteur` quand `area_id` existe.
- Chaque visite enregistre `area_id` + `distributeur_id`.

Critères d'acceptation :
- [ ] Impossible de créer un PDV mobile sans area valide.
- [ ] La visite porte l'area et le distributeur.
- [ ] Mode hors-ligne : la table `territoires` est incluse dans `useOfflineData`.

---

## Phase 1 — Tables de paramétrage + écrans admin

### 1.1 Migration `016_types_pdv.sql`

- Table `types_pdv` : `level3 TEXT`, `level4 TEXT UNIQUE`, `canal TEXT` (GT/MT/alternatif), `famille_criteres TEXT` (boutique / superette / mt / table_top / pushcart / porridge / kiosque_aboki — pilote quelle matrice de critères s'applique).
- Seed : les ~41 types Level3/Level4 du fichier (voir spec §8).
- Mapping des `sous_categorie_pdv` actuelles → `level4` (table `types_pdv_mapping` + script).

### 1.2 Migration `017_dispo_standards.sql`

- Table `dispo_standards` : `sku TEXT`, `categorie TEXT`, `classification TEXT` (hero / support / emerging / innovation / delist), `type_pdv_level4 TEXT`, `quantite_min INTEGER`, `facings INTEGER NULL` (MT uniquement). `UNIQUE (sku, type_pdv_level4)`.
- Seed : spec §4 (GT : Boutique A/B/C, Mini market A/B/C, Kiosque, Aboki, Pushcart, Table Top, Porridge ; MT : hyper/moyens/petits supermarchés).
- Règles annexes en table `dispo_regles` : nb min de SKU par type (Boutique A : 15 min 10 ; B : 12 min 8 ; C : 11 min 5), `hero_obligatoire BOOLEAN`.
- `useSkuThresholds.ts` évolue vers `useDispoStandards.ts` (seuil résolu par SKU × type de PDV, repli sur `sku_thresholds`).

### 1.3 Migration `018_ponderations.sql`

- Table `ponderations` : `canal TEXT` (GT/MT), `categorie TEXT`, `sku TEXT`, `poids NUMERIC`. Contrainte logique : Σ poids = 1 par (canal, catégorie) — vérifier côté app.
- Seed (spec §5) — GT : EVAP 0,65/0,07/0,05/0,03/0,10/0,10 ; IMP 0,76/0,07/0,05/0,03/0,05/0,02/0,02 ; SCM 0,946/0,054. MT : EVAP 0,55/0,12/0,08/0,05/0,15/0,05 ; IMP 0,25/0,16/0,15/0,10/0,15/0,12/0,07 ; SCM 0,30/0,70.

### 1.4 Migration `019_perfect_store_criteres.sql`

- Table `perfect_store_criteres` : `famille TEXT`, `niveau TEXT` (flagship/vip/core/basic), `critere TEXT` (clé technique alignée sur les champs de `VisiteVisibilite`, ex. `reglettes`, `tete_gondole`, `sign_board`), `pilier TEXT` (dispo/visibilite_ext/visibilite_int/promotion), `obligatoire BOOLEAN` (false = optionnel, ex. plaque BR).
- Seed : les matrices de la spec §3.
- ⚠️ Certains critères MT (niche, top shelf, bacs, plot) et alternatifs (thermos, carafe, chasuble, verre jetable, parasol, nappe, tablier) **n'existent pas** dans `VisiteVisibilite` → les ajouter au type + au formulaire (champs conditionnels selon `famille_criteres` du type de PDV).

### 1.5 Formulaire de visite

- Nouvelle section **Promotion** dans `VisiteData` : `promo_en_cours BOOLEAN` (piloté par un paramètre global admin), `type ('standard'|'hotesse'|'degustation')[]`, photos.
- Champ `planogramme_respecte BOOLEAN` (le champ `merchandising` existant s'en rapproche — trancher avec le client, sinon champ dédié).

### 1.6 Écrans admin

- `pages/admin/parametrage/` : standards de dispo, pondérations (avec contrôle Σ = 1), critères Perfect Store, types de PDV, territoires/distributeurs. Réutiliser les patterns des pages admin existantes.

---

## Phase 2 — Moteur de calcul

- Fonction SQL (ou edge function) `calculer_perfect_store(visite_id)` déclenchée à l'insert/update d'une visite :
  1. **Dispo par SKU** : quantité saisie ≥ `dispo_standards.quantite_min` du type de PDV → 1, sinon 0. (Dispo ≠ présence.)
  2. **Dispo par catégorie** : Σ (dispo_sku × poids) avec les pondérations du canal du PDV.
  3. **Score visibilité** ext./int. selon les critères de la famille du type de PDV ; visibilité parfaite = 100 % planogramme + ext + int.
  4. **Promotion** : évaluée seulement si `promo_en_cours` global = true, sinon exclue du score.
  5. **Niveau atteint** : le plus haut niveau dont tous les critères `obligatoire` sont satisfaits.
- Table résultat `pdv_perfect_store_status` : `pdv_id`, `visite_id`, `niveau TEXT NULL`, `score_dispo NUMERIC`, `score_visibilite NUMERIC`, `promo_ok BOOLEAN NULL`, `criteres_manquants JSONB` (par niveau supérieur), `calcule_le TIMESTAMPTZ`. Une ligne = état courant du PDV (upsert).
- Vue matérialisée ou RPC d'agrégation pour le dashboard (pattern `007_optimize_dashboard.sql`) : couverture, comptages par niveau, taux moyens, groupables par division/sub-region/territory/area/distributeur/canal/type PDV.
- Tests : cas limites — PDV sans type mappé, catégorie sans pondération, quantités absentes (visites anciennes) → statut « non évaluable », jamais 0 silencieux.

---

## Phase 3 — Dashboards

### 3.1 Réorganisation de l'accueil admin (basée sur l'existant)

**Étape A — Déplacer l'accueil actuel, sans le modifier.**
- Renommer `pages/admin/index.vue` en `pages/admin/activite.vue` (garder tel quel : header Imprimer/Exporter, 4 `StatsCard`, taux de présence, `ChartsVisitesLineChart`, `ChartsDistributionChart`, tableau Performance Commerciaux, `#dashboard-print-area`).
- Dans `components/AdminSidebar.vue`, l'entrée `{ label: 'Dashboard', to: '/admin', icon: LayoutDashboard }` devient « Perfect Store » ; ajouter en dessous `{ label: 'Activité', to: '/admin/activite', icon: ClipboardList }`. Attention à `isActive()` : le cas spécial `path === '/admin'` reste valable.
- Regrouper la sidebar par piliers Perfect Store pour refléter la logique client : **Perfect Store** (accueil) · **Activité** (ex-dashboard, Visites, Routing) · **Disponibilité** (les pages `produits/*` existantes : Dispo EVAP/IMP/SCM, Inventaire SKU, Seuils stock) · **Visibilité** (pages `visibilite/*` existantes) · **Concurrence** · **PDV & Territoires** · **Paramétrage**. Les pages existantes ne bougent pas, seule leur organisation dans le menu change — vérifier `011_rbac_role_section_access.sql` pour rattacher les nouvelles entrées aux sections RBAC.

**Étape B — Nouveau `pages/admin/index.vue` (dashboard Perfect Store).**
Structure de haut en bas, en réutilisant les composants existants :
1. **Header** : titre + boutons Imprimer/Exporter (reprendre le pattern `handlePrint`/`exportMenuItems` et `#dashboard-print-area` de l'actuel index — les utilisateurs y sont habitués).
2. **`DashboardFilters` étendu** : le composant a déjà date début/fin, canal (General trade/Modern trade), catégorie, sous-catégorie, commercial, région. Ajouter des props `showTerritoire` avec la cascade **Division → Sub-region → Territoire → Area** (options chargées via `useTerritoires`, chaque niveau filtre le suivant) + un select **Distributeur**. Remplacer à terme le select « Région » texte par cette cascade ; remplacer les options codées en dur de « Sous-catégorie » par la table `types_pdv` (Level 4).
3. **Ligne KPI (4 `StatsCard`, mêmes props title/value/subtitle/icon/color/format)** :
   - Couverture — `format="percent"`, subtitle « X / Y PDV visités » (visites distinctes sur la période ÷ PDV actifs du périmètre filtré)
   - Perfect Stores — `format="percent"`, subtitle « N PDV qualifiés »
   - Meilleur niveau représenté ou nb de Flagship
   - PDV non évaluables (visite trop ancienne / type non mappé) — pour piloter la qualité de données
4. **Répartition par niveau** : réutiliser `ChartsDistributionChart` avec les 4 niveaux (Flagship/VIP/Core/Basic) au lieu des types de PDV.
5. **3 cartes piliers** (même style de carte que les « taux de présence » actuels) :
   - Disponibilité : taux pondéré par catégorie (EVAP/IMP/SCM/UHT...), avec bascule GT/MT — remplace la notion de « présence » affichée aujourd'hui (le client a explicitement dit que présence ≠ disponibilité)
   - Visibilité : extérieure / intérieure / planogramme
   - Promotion : badge « optionnel », grisée si aucune promo en cours
6. **Évolution** : réutiliser `ChartsVisitesLineChart` avec le taux de Perfect Stores par jour/semaine (même format `{ date, count }`).
7. **Tableau PDV** (pattern du tableau Performance Commerciaux : header + export CSV via `useCsvExport` + lien « Voir tout → /admin/pdv ») : colonnes nom, type (Level 4), territoire/area, niveau (badge), **critères manquants pour le niveau supérieur** (depuis `pdv_perfect_store_status.criteres_manquants`).
8. **Données** : un seul RPC Supabase `dashboard_perfect_store(filtres)` agrégeant `pdv_perfect_store_status` (pattern `007_optimize_dashboard.sql`) — pas de calcul côté client. Étendre `DashboardStats` dans `types/index.ts` avec un bloc `perfect_store` plutôt que créer un type parallèle.

**Étape C — Drill-down** : chaque carte pilier renvoie vers les pages existantes (`/admin/produits/evap` pour la dispo, `/admin/visibilite` pour la visibilité) — pas de nouvelles pages à créer pour ça, juste des liens.

### 3.2 Mobile

- `pages/mobile/index.vue` : couverture du jour du merchandiseur, PDV de la tournée avec leur niveau, et « critères manquants » du prochain PDV (gap to next level). Réutiliser le pattern des cards existantes et `MobileBottomNav` inchangé.

---

## Ordre d'exécution et jalons

1. Phase 0 (migrations 013–015 + script de matching + rapport) — **rien d'autre avant**.
2. Phase 0bis (mobile territoires) — livrable visible pour le client.
3. Phase 1 (paramétrage 016–019 + formulaire + admin).
4. Phase 2 (calcul + statuts).
5. Phase 3 (dashboards).
6. Nettoyage : suppression des colonnes texte devenues redondantes, réécriture du README.

## Points à valider avec le client (ne pas décider seul)

- Correspondance exacte anciennes zones/secteurs → nouvelles areas pour les non-matchés du rapport.
- « NB SCM à délister » (toujours vide dans le fichier).
- Qui active/désactive « promo en cours » (proposition : paramètre global en back-office).
- `merchandising` existant = « planogramme respecté » ou champ distinct ?
- Distributeurs des 7 territoires « A POURVOIR ».
