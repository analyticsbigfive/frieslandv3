# Plan consolidé — Perfect Store

> Version du 16 juillet 2026 · FrieslandCampina / Big Five
>
> Ce document remplace la logique de planification dispersée des anciennes phases. Il distingue les éléments déjà présents dans le dépôt, les décisions métier encore ouvertes et l’ordre recommandé pour stabiliser le produit.

## 1. Décision produit

Le premier écran admin doit répondre à une seule question :

> **Quels PDV dois-je traiter maintenant, et quel critère bloque leur niveau ?**

Le dashboard ne doit donc pas être une addition de tableaux de suivi. Il doit être un cockpit court, filtrable et orienté action, avec quatre niveaux de lecture :

1. **Résultat** — taux de Perfect Stores, couverture, répartition des niveaux.
2. **Cause** — disponibilité, visibilité, promotion conditionnelle.
3. **Action** — PDV sous Basic et manques vers le niveau supérieur.
4. **Preuve** — visite, seuil, critère, territoire et source de paramétrage.

Les sous-titres explicatifs permanents sont supprimés du cockpit. Les explications apparaissent uniquement dans les cartes de détail, les états vides et les panneaux de paramétrage.

## 2. Sources de vérité

### Référentiel client

Le dossier [`docs/big-five-kpi-csv`](./big-five-kpi-csv) est la source métier de référence pour :

- les 41 types de PDV Level 3 / Level 4 ;
- les standards GT et MT de disponibilité ;
- les niveaux Flagship, VIP, Core et Basic ;
- les matrices de visibilité par famille de PDV et par niveau ;
- les pondérations par catégorie et canal ;
- les territoires, areas et distributeurs ;
- la définition de la couverture et du KPI merchandising.

Les volumes constatés dans les fichiers sont :

| Référentiel | Volume source |
|---|---:|
| Types de PDV | 41 lignes |
| Territoires / areas | 179 lignes |
| Mapping territoire-distributeur | 54 lignes |
| Matrice Perfect Store MT | 5 lignes de données |
| Standard disponibilité MT | 7 lignes de données |
| Matrices GT / canaux alternatifs | selon le canal : Boutique, Superette, Kiosque/Aboki, Pushcart, Table Top, Porridge |

Le cockpit doit conserver la provenance de chaque règle : fichier source, version, date d’import et ligne d’origine lorsque cela est possible.

### Logique actuellement implémentée

Les migrations récentes ajoutent ou consolident :

- le seed de démonstration de 14 PDV et 14 visites ;
- le rattachement zone / territoire / distributeur ;
- la couverture sous forme de ratio **PDV visités / PDV actifs** ;
- l’évolution journalière du taux de Perfect Stores ;
- la vue des manques vers le niveau supérieur ;
- le calcul MT avec la règle **quantité suffisante ET facings suffisants** ;
- la RPC filtrable `dashboard_perfect_store_filtre`.

Le moteur actuel calcule :

- une disponibilité par SKU, puis par catégorie, avec pondération ;
- un score de disponibilité global ;
- une visibilité selon le type de PDV et le niveau candidat ;
- une promotion uniquement si `promotion_applicable = true` ;
- le plus haut niveau dont tous les seuils passent.

Les seuils actuels sont :

| Niveau | Rang | Disponibilité minimale | Visibilité | Promotion |
|---|---:|---:|---:|---:|
| Flagship | 4 | 95 % | 100 % | 100 % si applicable |
| VIP | 3 | 85 % | 100 % | 100 % si applicable |
| Core | 2 | 75 % | 100 % | 100 % si applicable |
| Basic | 1 | 60 % | 100 % | 100 % si applicable |

Une visite sans niveau est présentée comme **Sous Basic / Non conforme** dans le cockpit si elle a été évaluée mais n’atteint aucun niveau. **Non évaluable** doit rester un état distinct, réservé aux données ou référentiels insuffisants.

## 3. Proposition visuelle

Artefact de visualisation : [`docs/prototypes/perfect-store-dashboard.html`](./prototypes/perfect-store-dashboard.html)

### Navigation proposée

La navigation est structurée par décision, pas par table technique :

| Groupe | Pages | Rôle |
|---|---|---|
| Pilotage | Perfect Store, Activité | Décider et mesurer la couverture de l’exécution |
| Terrain | Visites, Routing & carte | Voir les visites et organiser le traitement |
| Réseau | Points de vente, Territoires | Comprendre le parc et son rattachement |
| Performance | Disponibilité, Visibilité | Diagnostiquer les deux piliers principaux |
| Administration | Paramétrage | Contrôler les sources et les règles |

### Page Perfect Store

Ordre recommandé :

1. filtres compacts : période, canal, division, territoire, area, distributeur, type de PDV ;
2. quatre KPI : Perfect Stores, couverture, meilleur niveau, PDV sous Basic ;
3. file **À traiter maintenant** ;
4. répartition Flagship / VIP / Core / Basic / Sous Basic ;
5. santé des piliers : OSA, visibilité, promotion conditionnelle ;
6. évolution du taux de Perfect Stores ;
7. table des PDV prioritaires avec le gap vers le niveau supérieur.

La ligne principale ne doit pas afficher un score isolé sans cause. La colonne la plus importante est donc **Écart principal / critères manquants**.

### Page Disponibilité

Elle doit séparer visuellement les deux règles :

- **GT** : quantité observée ≥ quantité minimale ;
- **MT** : quantité observée ≥ quantité minimale **et** facings observés ≥ facings minimaux.

Le drill-down doit afficher, pour chaque SKU : seuil, valeur observée, statut quantité, statut facing, classification et poids. La présence seule ne doit jamais être présentée comme disponibilité.

### Page Visibilité

Elle doit afficher la matrice réellement applicable au type de PDV :

- niveau actuel et niveau cible ;
- critères obligatoires ;
- critères observés ;
- critères manquants ;
- promotion séparée et masquée du calcul si elle n’est pas applicable.

Pour le MT, la matrice de référence inclut notamment niche, wobbler, top shelf, bacs, réglettes, TG, plot et hôtesses. Les matrices GT et canaux alternatifs restent propres à leur famille.

### Page Paramétrage

Cette page n’est pas une page de statistiques. Elle doit montrer :

- la source de chaque référentiel ;
- sa date de dernière mise à jour ;
- le nombre de lignes importées ;
- les doublons et libellés ambigus ;
- les distributeurs `A POURVOIR` ou `NOT AVAILABLE` comme états métier ;
- les erreurs de source à corriger avant publication.

## 4. Plan de réalisation

### Étape 0 — Figer le dictionnaire métier

**Objectif :** éviter que le dashboard et le moteur parlent de deux Perfect Stores différents.

- créer un dictionnaire des noms techniques et libellés affichés ;
- trancher `Pushcard` / `Pushcart`, `Herro` / `Hero`, `Superette` / `Superette A/B/C` ;
- confirmer que Basic est bien un Perfect Store qualifié ;
- confirmer la matrice de visibilité définitive du Supermarket A ;
- documenter la correspondance grade MT A/B/C → Hypermarche / MoyenSuper / PetitSuper.

**Livrable :** une table de correspondance versionnée et un rapport d’anomalies.

### Étape 1 — Nettoyer et versionner les sources

**Objectif :** rendre les CSV importables sans perdre l’information originale.

- isoler les cellules `#ERROR!`, `#DIV/0!` et `#REF!` ;
- ne pas convertir silencieusement les valeurs manquantes en zéro ;
- dédupliquer les mappings, notamment les lignes ambigües de Divo ;
- conserver `A POURVOIR` et `NOT AVAILABLE` avec un statut explicite ;
- produire un rapport d’import : lignes acceptées, rejetées, corrigées et à arbitrer.

**Livrable :** import contrôlé + rapport de qualité consultable dans Paramétrage.

### Étape 2 — Stabiliser le read model dashboard

**Objectif :** faire reposer le cockpit sur une réponse agrégée cohérente.

La RPC ou vue de lecture doit retourner, dans un même périmètre filtré :

- `pdv_total`, `pdv_vus`, `couverture_pct` ;
- `visites_scorees`, `perfect_stores`, `perfect_store_pct` ;
- moyenne OSA, visibilité, promotion et assortiment ;
- distribution par niveau, y compris `non_conforme` et `non_evaluable` ;
- file des PDV prioritaires ;
- manques vers le niveau supérieur ;
- dimensions division, sub-region, territoire, area, distributeur, canal et type de PDV.

Les filtres doivent être appliqués côté SQL, pas reconstruits à partir de chiffres globaux côté client.

### Étape 3 — Construire le cockpit

**Objectif :** implémenter la proposition visuelle sans multiplier les cartes.

- brancher les quatre KPI sur le read model ;
- afficher les niveaux sous forme de distribution ;
- remplacer les sous-titres permanents par des libellés courts et des détails au clic ;
- relier chaque action à la liste PDV filtrée ;
- conserver l’export et l’impression ;
- ajouter un état de fraîcheur des données et la période réellement calculée.

### Étape 4 — Brancher les drill-downs

**Objectif :** permettre de passer du signal à la preuve sans changer de logique.

- fiche PDV : dernière visite, niveau, scores par pilier, critères manquants ;
- disponibilité : SKU, seuil, quantité, facings MT, classification et poids ;
- visibilité : matrice applicable par famille / niveau ;
- territoires : hiérarchie et distributeur ;
- visites : statut de synchronisation et résultat Perfect Store.

### Étape 5 — Sécuriser le paramétrage

**Objectif :** permettre à un administrateur de modifier les règles sans casser le calcul.

- contrôler que les pondérations totalisent 100 % par catégorie et canal ;
- refuser la publication d’un type de PDV sans famille de critères ;
- valider les standards MT avec quantité et facings ;
- journaliser les changements de seuils et matrices ;
- afficher la version de paramétrage utilisée par chaque résultat.

### Étape 6 — Tester puis déployer progressivement

**Objectif :** rendre les résultats vérifiables par le métier avant ouverture réseau.

- tests SQL sur le seed de 14 PDV ;
- tests d’interface sur chaque filtre et chaque lien d’action ;
- test d’export et d’impression ;
- test des données manquantes, des types non mappés et des distributeurs à pourvoir ;
- déploiement d’abord sur le périmètre de démonstration, puis sur un territoire pilote.

## 5. Jeu de tests de référence

Le seed [`20260716140000_friesland_seed_14_pdv.sql`](../supabase/nouveau/20260716140000_friesland_seed_14_pdv.sql) doit produire :

| PDV | Résultat attendu |
|---|---|
| PS-001 à PS-003 | Flagship |
| PS-004 à PS-006 | VIP |
| PS-007 à PS-010 | Core |
| PS-011 à PS-012 | Basic |
| PS-013 à PS-014 | Sous Basic / Non conforme |

Contrôles attendus :

- 14 visites et 14 PDV visités ;
- 12 PDV qualifiés au niveau Basic ou supérieur ;
- 2 PDV sous Basic ;
- PS-003 doit dépendre des quantités **et** des facings MT ;
- une promotion non applicable ne doit pas réduire le niveau ;
- une donnée absente ne doit pas être convertie silencieusement en performance nulle ;
- un type non mappé doit produire un état explicite et actionnable.

## 6. Arbitrages à obtenir avant mise en production

1. **Définition de “Perfect Store”** : Basic inclus ou indicateur réservé aux trois niveaux supérieurs ? Le moteur et le seed actuels impliquent Basic inclus.
2. **Matrice MT** : la visibilité du Supermarket A est encore décrite comme rabattue sur la matrice Superette dans le seed ; il faut valider la cible métier.
3. **Promotion** : paramètre global, paramètre par campagne ou propriété de chaque visite ?
4. **Assortiment** : obligatoire à tous les niveaux ou uniquement pour certains segments ?
5. **Données non évaluables** : quelles conditions exactes doivent distinguer absence de visite, type non mappé et visite incomplète ?
6. **Distributeurs non affectés** : simple statut de référentiel ou blocage de création / visite ?

## 7. Critère de fin

Le chantier est terminé lorsque :

- le cockpit répond à “où agir et pourquoi” en moins d’une vue ;
- les mêmes filtres donnent les mêmes chiffres sur le cockpit et les drill-downs ;
- chaque niveau affiché est explicable par des seuils et critères visibles ;
- le jeu de 14 PDV produit les résultats attendus ;
- les erreurs et ambiguïtés du référentiel sont visibles, tracées et non masquées ;
- le paramétrage MT quantité + facings est testable sans modifier le code métier.
