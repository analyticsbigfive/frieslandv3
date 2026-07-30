# Plan d'exécution — Réunion FrieslandCampina du 23 juillet

Source : `PROMPT-CLAUDE-CODE-reunion-23-juillet.md` (6 tâches).
Décisions arbitrées avec le client le 30/07 (voir § Décisions).

---

## Constats de départ (vérifiés en base, pas supposés)

| Vérification | Résultat | Conséquence |
|---|---|---|
| Signatures des RPC dashboard | `dashboard_perfect_store_filtre`, `perfect_store_par_type_filtre`, `perfect_store_evolution_filtre`, `perfect_store_liste_filtre` n'ont **aucun paramètre date** | Tâche 6 = migration obligatoire, pas du front |
| `data.produits[cat].quantites` | Présent dans le schéma, écrit par `pages/mobile/visites/new.vue:949` | Tâche 3 faisable sans backfill |
| Contenu réel des visites | **15 lignes, toutes démo, `quantites` = 999 partout** | Présence et disponibilité sortiront **identiques (100 %)** tant qu'il n'y a pas de relevé terrain réel. Ce n'est pas un bug du KPI. |
| `routing_templates` | **0 ligne** | Le schéma des règles peut changer sans migration de données |
| Surcharges PostgREST | `create or replace function` ne peut pas ajouter de paramètre → crée une 2ᵉ surcharge → erreur PGRST203 | Chaque RPC modifiée = `drop function <sig exacte>` puis `create`, dans la même migration |

## Décisions arbitrées

1. **Périmètre multi-territoire (4.4)** — la règle récurrente porte son territoire + distributeur. Le garde de périmètre valide le PDV contre le périmètre **de la règle**, plus contre `profiles.territoires_assignes` figé. Le contrôle geofence GPS (`pdv.rayon_geofence`) est un mécanisme distinct et reste inchangé.
2. **Matérialisation des tournées (4.1)** — génération automatique, sans cron ni corvée admin. **Correction apportée après arbitrage** : l'option validée était « à l'ouverture de l'app mobile », mais l'app est offline-first (`useOfflineData`, `useOfflineSync`, `@capacitor/network`). Un merchandiser qui ouvre l'app à 7 h sans réseau n'aurait **aucune tournée**, là où une ligne `routings` pré-générée aurait été en cache. Donc : **pré-génération glissante J → J+7** (déclenchée quand l'admin ouvre la page routing, et à chaque sync en ligne du mobile) en chemin principal, matérialisation à l'ouverture en repli pour une date non pré-générée. Même RPC idempotente, même absence de cron.
3. **Présence (3)** — présence = quantité relevée ≥ 1 ; disponibilité = quantité ≥ seuil paramétré. SKU mis en avant : `BR 150g`, `BR 15g` (role `phare`) + `BR Délice 15g`, `BR Delice Pouch 350g`.
4. **Migrations** — écrites dans `supabase/nouveau/` **et** appliquées au fil de l'eau sur la base de production. Additif uniquement : nouvelles tables, nouvelles colonnes, `DROP`+`CREATE` de fonctions. Aucune donnée existante modifiée ni supprimée.

## Points tranchés que le client doit connaître

- **Dénominateur du taux Perfect Store.** Le client dit « 66,7 % des 15 PDV visités » ; la RPC actuelle compte des **visites scorées**, pas des PDV. J'ajoute le décompte en PDV distincts. Règle retenue sur une période : **un PDV compte comme Perfect Store si sa dernière visite scorée de la période a un niveau.** Sans ça, un PDV visité 3 fois pèse 3 fois dans le taux.
- **Seuil de disponibilité.** Deux tables coexistent : `sku_thresholds` (legacy « stock bas ») et `seuil_disponibilite` (système B, par segment/grade, celle qu'utilise déjà le calcul Perfect Store). Je prends **`seuil_disponibilite`** pour que le nouveau « taux de disponibilité » soit cohérent avec l'OSA déjà affichée. Présence et disponibilité portent alors exactement sur le même ensemble de SKU — seul le seuil change.
- **Étapes A/B/C fusionnées côté SQL.** Les tâches 1, 2 et 6 modifient toutes les mêmes RPC. Une seule migration les sert toutes les trois plutôt que trois passes successives sur la même fonction.
- **Une seule base de comptage.** Le gros chiffre (PDV distincts) et l'accordéon « par type de magasin » (`perfect_store_par_type_filtre`, qui compte des visites scorées) donneraient deux dénominateurs sur la même page. La base **PDV distincts** est appliquée aux quatre RPC de l'étape A, pas seulement à la carte du haut.
- **La couverture ne peut pas rester en l'état.** `fetchCoverage()` lit `v_couverture_globale` filtrée sur `periode = 'AAAA-MM'` (`usePerfectStore.ts:228`) : une vue bucketée au mois ne sait pas répondre « couverture du jour ». L'étape A fait passer la couverture par la RPC dans tous les cas (elle calcule déjà `pdv_vus` depuis `visites`) et abandonne la lecture de la vue, sinon les filtres jour/semaine afficheraient silencieusement des chiffres mensuels.

---

## Étapes

Ordre imposé par les dépendances SQL → front. Après chaque étape : `npm run lint` + `npx vitest run` (pas `npm run test`, qui reste en watch), puis commit.

### Étape A — Migration « périodes + nouveaux compteurs » (sert tâches 1, 2, 6)

`supabase/nouveau/20260730120000_friesland_dashboard_periodes.sql`

- `DROP` + `CREATE` de `dashboard_perfect_store_filtre`, `perfect_store_par_type_filtre`, `perfect_store_evolution_filtre`, `perfect_store_liste_filtre` avec `p_date_debut date` / `p_date_fin date` ajoutés en fin de signature.
- Nouvelles clés dans le `jsonb_build_object` de `dashboard_perfect_store_filtre` :
  - `pdv_perfect_stores` / `pdv_scores` — décompte en PDV distincts (dernière visite de la période).
  - `par_niveau` — tableau `[{niveau, nb_pdv}]` pour la ventilation Flagship · VIP · Core · Basic.
  - `visites_total` — nombre total de visites sur le périmètre + la période (= « couverture des visites », tâche 2.2).
- Nouvelle RPC `couverture_visites_par_commercial(filtres…, p_date_debut, p_date_fin)` → une ligne par merchandiser : nb visites, nb PDV distincts, liste des PDV visités.

**Verify** : chaque RPC appelée en SQL avec et sans dates renvoie un résultat non nul ; `select` sur `pg_proc` confirme **une seule** surcharge par nom.

### Étape B — Tâche 1 : KPI Perfect Store nombre d'abord

`pages/admin/index.vue`, `components/StatsCard.vue` si besoin.

1. Carte héro : nombre absolu en grand, `X %` des N PDV visités en petit dessous.
2. Ventilation par niveau à côté du nombre (`5 Flagship · 3 VIP · 2 Basic`), depuis `par_niveau`.
3. Liste des PDV Perfect Store sur la page 1 (réutilise `fetchPerfectStoreListe`, même rendu que `perfect-store/liste.vue`).
4. Sélecteur de période jour / semaine / mois câblé sur les nouvelles RPC.
5. Les filtres territoire / quartier / distributeur existants continuent de piloter le tout.

**Verify** : filtre « jour » + territoire donne un nombre ≤ au filtre « mois » sans territoire ; la somme de `par_niveau` = le nombre affiché en grand.

### Étape C — Tâche 2 : couverture effective vs couverture des visites

`pages/admin/index.vue`, `pages/admin/visites/index.vue`, `stores/visites.ts`.

1. Carte existante renommée **« Couverture effective »** (PDV uniques / univers assigné) — logique inchangée.
2. Nouvelle carte **« Couverture des visites »** = `visites_total`, avec le détail par merchandiser (PDV visités) depuis `couverture_visites_par_commercial`.
3. Filtres période (jour / semaine / mois) sur l'onglet Visites.

**Verify** : sur un PDV visité deux fois dans la période, couverture effective l'incrémente de 1, couverture des visites de 2.

### Étape D — Tâche 3 : taux de présence

Migration `20260730130000_friesland_presence_disponibilite.sql` + front.

**Pas de nouvelle RPC d'agrégat.** La résolution segment/grade d'un PDV (`segment_grade_type_pdv` → `type_pdv` → `categorie_pdv`, plus la branche `seuil_disponibilite_mt` pour le modern trade) existe déjà deux fois : dans `calculer_perfect_store` (SQL) et dans `utils/perfectStore.ts:scoreVisiteB` (TS). En écrire une troisième garantit la dérive.

- Étendre `calculer_perfect_store` pour écrire aussi `presence_rayon` dans `resultat_perfect_store`, à côté de `dispo_rayon` : même parcours de SKU, `qte >= 1` au lieu de `qte >= quantite_min`. Le trigger existant se charge du recalcul.
- Le KPI dashboard devient alors **un `avg()` de plus** dans `dashboard_perfect_store_filtre`. Présence et disponibilité utilisent par construction le même ensemble de SKU et la même résolution de segment — c'est précisément la propriété que le client veut pouvoir opposer.
- `recalculer_tous_perfect_store` à relancer pour remplir la colonne sur les visites existantes.
- Le détail par catégorie puis par SKU (point 3.3) est un chemin séparé, à traiter après l'agrégat — ne pas le mélanger à la refonte du KPI.
- Tuile sur le dashboard à côté de Perfect Store / Couverture / Disponibilité.

**Verify** : sur une visite forgée à quantité 1 pour un SKU dont le seuil est 6 → présence 100 %, disponibilité 0 %. C'est le test qui prouve que les deux KPI sont réellement distincts (les données démo actuelles ne le prouvent pas).

### Étape E — Tâche 5 : concurrence enrichie

`types/index.ts`, `pages/mobile/visites/new.vue`, `pages/mobile/visites/[id].vue`, `components/VisitDetailModal.vue`, `pages/admin/concurrence/index.vue`.

- Pas de migration : `visites.data` est du jsonb.
- Par concurrent : `present` (existant) + `en_activite` (oui/non) + `action_concurrence` (texte libre, affiché si en activité).
- Bloc « autre(s) concurrent(s) » : liste de `{nom, en_activite, action, photo_url}`, nom obligatoire, photo optionnelle via `useImageUpload`.
- Agrégation dashboard sur une **clé normalisée** (trim + casefold + accents) pour que « Cowmilk », « cowmilk » et « Cow Milk » ne fassent pas trois entrées. Le nom affiché reste la première graphie rencontrée.
- **Lecteur tolérant à l'ancien format** dès l'écriture : les visites existantes portent `evap.autre === 'Présent'` + `evap.nom_concurrent` (à plat), le nouveau format porte `autres: [{…}]`. L'agrégation doit lire les deux, sinon l'historique disparaît du dashboard.
- Filtre par mois sur l'onglet concurrence.

**Verify** : deux visites saisissant le même concurrent avec des casses différentes produisent une seule ligne dans le dashboard.

### Étape F — Tâche 6 : filtres de période partout

Nouveau `components/PeriodFilter.vue` (jour / semaine / mois / personnalisé) qui écrit `dateFrom`/`dateTo`.

- Intégré à `components/DashboardFilters.vue` (couvre concurrence, produits, visibilité d'un coup) et aux écrans qui utilisent `AdminListToolbar`.

**Verify** : « mois » sur chaque page produit la même fenêtre de dates ; aucun écran ne perd ses filtres existants.

### Étape G — Migration routing récurrent (tâche 4)

`supabase/nouveau/20260730140000_friesland_routing_recurrent.sql`

- `routing_templates` : `days_of_week int[]`, `territoire text`, `distributeur text`, `date_debut date`, `date_fin date` (nullable). `day_of_week` conservée nullable pour compat (0 ligne en base, donc pas de reprise de données).
- Nouvelle `routing_template_exception(template_id, date_debut, date_fin, pdv_id nullable, motif)` — `pdv_id` nul = toute la tournée désactivée sur la période ; `pdv_id` renseigné = ce PDV seul décoché.
- `routings` : `template_id uuid null` + `source text` (`manuel` | `regle`) pour la traçabilité.
- RPC `materialiser_routing_jour(p_user_id, p_date)` — idempotente : crée `routings` + `routing_pdv` depuis les règles actives du jour en sautant les exceptions, ou renvoie la tournée existante.

**Verify** : appelée deux fois pour la même date, elle ne crée pas de doublon ; une exception sur la semaine en cours retire le PDV sans toucher la règle.

### Étape H — Tâche 4 front

`stores/routing.ts`, `composables/useRouting.ts`, `pages/admin/routing/index.vue`, `pages/mobile/routing.vue`.

1. `fetchTodayRouting` appelle `materialiser_routing_jour` avant de lire (décision 2).
2. Onglet règles : cases à cocher multi-jours, territoire + distributeur par règle, et décochage d'un PDV pour une semaine donnée (écrit une exception).
3. Import CSV : mode explicite **Fusionner** (défaut) / **Remplacer**. Aujourd'hui `updateRouting` supprime les PDV absents du fichier (`stores/routing.ts:312-320`) — c'est l'écrasement dont se plaint le client. Le mode Fusionner ne supprime rien.
4. Garde de périmètre revu, **uniquement sur le chemin des règles** : une tournée générée depuis une règle est validée contre le territoire + distributeur de la règle (décision 1). Les tournées ponctuelles de l'onglet 1 gardent le garde profil (`pdvInScope` / `assertScopedPDV`) — c'est leur seul filet, et `assertScopedPDV` est appelé depuis `createRouting`, `updateRouting` et `importRoutingsFromCSV`. Le PDV reste choisi dans une liste fermée côté admin.
5. `generateFromTemplates` : son `catch` nu classe aujourd'hui toute erreur en `'exists'`, ce qui masquera de vraies pannes une fois les règles complexifiées — à distinguer.

**Verify** : une règle « lundi + jeudi » sur deux territoires génère les bonnes tournées sur 3 semaines, mois suivant compris, sans intervention admin.

### Étape I — Vérification finale

| Contrôle | Résultat |
|---|---|
| `npm run lint` | **Impossible** : le script appelle `eslint`, absent de `node_modules` et de `package.json`. Ce n'est pas une régression — la commande ne fonctionne pas non plus sur `main`. À installer (`eslint` + config) pour que le contrôle existe. |
| `npx vitest run` | 51 tests verts sur 4 fichiers (`periode`, `concurrence`, `routingRecurrence`, `perfectStore`). Note : `npm run test` lance vitest en mode watch et ne rend jamais la main. |
| `npx nuxt build` | OK, aucune erreur. |
| KPI filtrables | Vérifié en SQL : division → 7 PDV, territoire Marcory → 1, sans filtre → 14. La cascade est respectée, la période s'ajoute aux filtres géo. |
| `npm run generate:native` | OK, 48 routes pré-rendues. |
| `npx cap sync android` | OK, 6 plugins Capacitor détectés. |

### Étape J — Récapitulatif client

Document non technique (`RECAP-CLIENT-23-JUILLET.md`) : pour chaque point soulevé en réunion, ce qui a changé et ce que ça donne à l'écran, sans nom de fichier ni jargon SQL. Inclut les deux points où l'implémentation s'écarte de la demande littérale (dénominateur en PDV distincts, pré-génération des tournées) et ce qui reste à faire côté client (relevés terrain réels pour que présence et disponibilité divergent).

## Tests à écrire

Logiques où une erreur serait silencieuse :

- `utils/periode.ts` → `tests/periode.spec.ts` — bornes jour / semaine / mois. Une erreur d'un jour décale tous les KPI sans lever d'exception. **Fait (9 tests).**
- Présence vs disponibilité — **pas de util TS** : le calcul vit en SQL (voir étape D), en écrire une version TS ferait une troisième implémentation de la même règle. La vérification est `supabase/nouveau/verif_presence_vs_disponibilite.sql`, qui force le cas limite (quantité 1 / seuil 6) et doit renvoyer présence 100 % / disponibilité 0 %. **Fait.**
- `utils/routingRecurrence.ts` — expansion d'une règle en dates, exceptions déduites (étape G/H). À faire.

## Hors périmètre

- La légende de `pages/admin/map.vue` (losange bleu = visite, orange = hors PDV) est en place et n'est pas touchée.
- `pages/admin/produits/recap.vue` continue de calculer côté client via `useDashboardDirection` — la tâche 3 ne demande le nouveau KPI que sur le dashboard.
- `useDashboardDirection` plafonne à 2000 visites. Non bloquant au volume actuel, mais à surveiller.
