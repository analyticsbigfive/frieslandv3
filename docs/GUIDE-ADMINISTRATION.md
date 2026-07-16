# Guide d'administration — Big Five / Perfect Store (Friesland Bonnet Rouge)

> Version du 16 juillet 2026. Couvre le back-office web (`/admin`) et les réglages
> qui pilotent l'application mobile des merchandisers.
> Données de référence : fichier client « BIG FIVE KPI UPDATE »
> (copie CSV dans `docs/big-five-kpi-csv/`), vérifié conforme à la base.

---

## 1. Connexion et rôles

- **URL** : l'application web, page `/login`. Après connexion, un **admin** ou
  **superviseur** arrive sur le dashboard Perfect Store (`/admin`) ; un
  **merchandiser** arrive sur l'app mobile (`/mobile`).
- **Rôles** :
  | Rôle | Ce qu'il peut faire |
  |---|---|
  | `admin` | Tout : standards, référentiels, utilisateurs, permissions, recalcul |
  | `superviseur` | Standards + référentiels + suivi (pas la gestion des permissions) |
  | `merchandiser` | App mobile : visites, création de PDV ; il ne voit que les PDV de sa zone/ses secteurs |
- La visibilité des sections du menu par rôle se règle dans **`/admin/permissions`**
  (matrice rôle × section, table `role_section_access`).

---

## 2. Le dashboard Perfect Store (page d'accueil `/admin`)

C'est le premier écran après connexion. De haut en bas :

1. **Filtres** — cascade **Division (North/South) → Territoire → Area** +
   **Distributeur**. Ils pilotent **toute la page** : les KPI du haut sont
   recalculés côté serveur sur le périmètre choisi, et les tableaux sont filtrés.
   « Réinitialiser » revient à la vue réseau.
   - Division `ABIDJAN` = South Division ; `UP COUNTRY` = North Division.
2. **Performance réseau** — % de visites conformes (ayant atteint au moins BASIC).
3. **KPI Big Five** — Couverture du mois (**X/Y et %** : PDV visités / parc actif),
   Score global moyen, OSA pondérée (disponibilité), Assortiment, Visibilité,
   Promotion effective.
4. **Évolution du taux de Perfect Stores** — courbe quotidienne.
5. **Perfect Store par type de magasin** — accordéons par type (level 4),
   avec la liste paginée des magasins de chaque type.
6. **Points de vente par niveau** — répartition Flagship / VIP / Core / Basic.
7. **« Passer au niveau supérieur »** — pour chaque PDV, le niveau actuel, le
   niveau cible et **les critères exacts qui manquent** (dispo insuffisante,
   assortiment, éléments de visibilité/promotion non installés). C'est l'outil
   d'action terrain : il dit quoi corriger dans chaque magasin.
8. **Comprendre le résultat** — rappel des piliers et tableau des seuils par niveau.

L'ancien tableau de bord d'activité (visites, commerciaux, présence par
catégorie) est sur **`/admin/activite`**.

---

## 3. Comment le niveau Perfect Store est calculé

**Perfect Store = Disponibilité (OSA) + Assortiment + Visibilité + Promotion (optionnelle).**

À chaque visite enregistrée, le moteur calcule automatiquement :

1. **Canal & segment** : le type du PDV (level 4, ex. « Boutique A »,
   « Supermarket B ») détermine :
   - le **canal** GT / MT (via la catégorie level 3),
   - le **segment + grade de disponibilité** (ex. Boutique/A, SupermarcheMT/B),
   - le **segment de visibilité** (boutique, superette, **mt**, kiosque_aboki…).
2. **Disponibilité par catégorie (EVAP / IMP / SCM)** : moyenne **pondérée** des
   SKU (poids par canal), où un SKU compte « disponible » si :
   - **GT** : quantité relevée ≥ quantité minimale du segment/grade ;
   - **MT** : quantité ≥ minimum **ET facings ≥ minimum** (règle ET, standards MT).
   La disponibilité rayon = moyenne des 3 catégories.
   ⚠️ Disponibilité ≠ présence : présence = au moins 1 unité ; disponibilité = quantité minimale atteinte.
3. **Assortiment** : nombre de SKU présents ≥ minimum du segment/grade, héros
   (Hero SKU) obligatoires si configuré.
4. **Visibilité** : % des éléments **requis** du niveau installés (matrice par
   segment). Les éléments marqués *optionnels* ne pénalisent jamais.
5. **Promotion** : évaluée seulement si « promotion applicable » a été coché sur
   la visite ; sinon exclue du score.

**Niveau atteint** = le plus haut niveau dont TOUS les critères passent :

| Niveau | Dispo rayon min | Visibilité | Promotion (si applicable) |
|---|---|---|---|
| FLAGSHIP | ≥ 95 % | 100 % du requis | 100 % |
| VIP | ≥ 85 % | 100 % | 100 % |
| CORE | ≥ 75 % | 100 % | 100 % |
| BASIC | ≥ 60 % | 100 % | 100 % |

En dessous de BASIC : « non conforme ». Ces seuils s'éditent dans
`/admin/referentiels` → **Niveaux Perfect Store**.

---

## 4. Paramétrer les standards — où éditer quoi

| Je veux régler… | Écran | Table |
|---|---|---|
| Quantités minimales **GT** (par SKU × segment × grade) | `/admin/referentiels` → **Seuils dispo** | `seuil_disponibilite` |
| Quantités + **facings MT** (par SKU × Hyper/Moyen/Petit) | `/admin/referentiels` → **Seuils dispo MT (facings)** | `seuil_disponibilite_mt` |
| Assortiment (SKU cibles, minimum, héros obligatoires) | `/admin/referentiels` → **Assortiment** (ou standards → onglet Assortiment) | `standard_assortiment` |
| **Pondérations** des SKU (GT et MT, somme = 100 %) | `/admin/perfect-store/standards` → onglet **Disponibilité** | `poids_reference` |
| **Matrice de visibilité** (éléments requis par niveau et segment) | `/admin/perfect-store/standards` → onglet **Visibilité** | `standard_visibilite` |
| Rattacher un **type de PDV** à ses standards (segment dispo + grade, segment visibilité) | `/admin/perfect-store/standards` → onglet **Types de PDV** | `segment_grade_type_pdv`, `segment_visibilite_type_pdv` |
| **Seuils des niveaux** (95/85/75/60) | `/admin/referentiels` → **Niveaux Perfect Store** | `niveau_perfect_store` |
| Seuils « stock bas » (pastilles mobile, hors scoring) | `/admin/produits/seuils` | `sku_thresholds` |

### ⚠️ Après TOUTE modification de standard : recalculer

Le moteur recalcule automatiquement **à la saisie d'une visite**, pas quand un
standard change. Après édition, cliquer **« Recalculer »** dans
`/admin/perfect-store/standards` (recalcule toutes les visites). Sans ça, les
scores affichés reflètent les anciens standards.

### Segments de visibilité disponibles

`boutique`, `superette`, **`mt`** (supermarchés : Niche, Wobbler, Top shelf,
Bacs, Réglettes, TG, Plot, Hôtesses), `table_top`, `pushcart`, `porridge`,
`kiosque_aboki`. Les éléments eux-mêmes (ajout/suppression, caractère
optionnel) s'éditent dans `/admin/referentiels` → **Éléments visibilité**.

### Scorer un type de PDV aujourd'hui non couvert (ex. Pharmacy, Bakery)

Les 41 types du fichier client existent tous, mais seuls les formats retail
cœur ont des standards. Pour couvrir un nouveau type — **sans migration** :
1. `/admin/referentiels` → **Seuils dispo** : créer les quantités minimales du
   type (choisir un segment existant, ou réutiliser le plus proche).
2. `/admin/perfect-store/standards` → **Types de PDV** : rattacher le type au
   segment/grade de dispo et au segment de visibilité choisis.
3. (Facultatif) **Assortiment** pour ce segment/grade.
4. **Recalculer**.

---

## 5. Référentiels (`/admin/referentiels`)

Tous en CRUD direct, groupés par thème :

- **Géographie** : Régions (divisions North/South), Sous-régions, Territoires,
  Zones/Areas. Hiérarchie : pays > division > sous-région > territoire > area.
- **Distribution** :
  - **Distributeurs** (nom + couverture « National » = proposé partout).
  - **Distrib ↔ Territoires** : distributeur(s) par territoire.
  - **Distrib ↔ Areas** : *override* par area — permet à un même territoire
    d'avoir des distributeurs différents selon l'area. À la création d'un PDV,
    l'app propose : distributeurs de l'**area** (s'il y en a), sinon ceux du
    **territoire**, plus les **nationaux**.
- **Points de vente** : Catégories (level 3, avec canal GT/MT) et Types (level 4).
  ⚠️ Le level 4 pilote tout le scoring : ne pas renommer un type sans re-vérifier
  son mapping dans standards → Types de PDV.
- **Produits** : catégories produit, références (SKU), correspondance
  formulaire ↔ référence, rôles (héros).
- **Perfect Store** : niveaux, poids, seuils dispo GT, seuils dispo MT (facings),
  assortiment, éléments et matrice de visibilité.

---

## 6. PDV et visites

- **`/admin/pdv`** : liste, répartition, évolution des créations.
- **`/admin/visites`** : liste des visites avec niveau Perfect Store, score,
  détail complet au clic (relevé, piliers, photos). Suppression possible.
- **`/admin/perfect-store/liste`** : tous les PDV par niveau, filtrable.
- **Import / Export** : `/admin/import-export` (PDV en masse, exports CSV).

---

## 7. Utilisateurs et périmètres

- **`/admin/users`** : création/édition des comptes (rôle, zone assignée =
  territoire, secteurs assignés = areas, actif/inactif).
- Un **merchandiser** ne voit que les PDV dont `zone` = sa zone assignée et
  `secteur` ∈ ses secteurs assignés. Admin/superviseur voient tout.
- **`/admin/permissions`** : sections du menu accessibles par rôle.

---

## 8. Application mobile (ce que vos réglages pilotent)

- **Sélection du PDV** : chaque option affiche `Nom (Territoire) · GT/MT` ;
  après sélection, un badge indique **General Trade** ou **Modern Trade** + le type.
- **Disponibilité** : saisie des **quantités** par SKU. Si le PDV est **MT**,
  un champ **« F » (facings)** apparaît à côté de chaque quantité — il est
  requis par la règle MT (quantité ET facings). Le champ s'encadre en orange
  si le facing saisi est sous le minimum.
- **Visibilité / Promotion** : les éléments affichés viennent de la **matrice du
  segment** du PDV (ex. un supermarché affiche Niche/Top shelf/Bacs…, une
  boutique affiche Réglette/Maison BR/…). Modifier la matrice dans l'admin
  change le formulaire mobile.
- **Création de PDV** (merchandiser) : cascade Catégorie → Type (le canal se
  déduit), Territoire → Area, **distributeur** proposé selon l'area/le
  territoire + nationaux.
- **Hors-ligne** : les visites se mettent en file et se synchronisent au retour
  du réseau ; le score est calculé à la synchronisation.

---

## 9. Procédures courantes (pas-à-pas)

**Changer un seuil de disponibilité GT** (ex. BR Gold en Boutique A : 24 → 30)
1. `/admin/referentiels` → Seuils dispo → chercher « BR Gold » → ligne Boutique/A → Modifier.
2. `/admin/perfect-store/standards` → **Recalculer**.

**Changer un standard MT (quantité ou facings)**
1. `/admin/referentiels` → **Seuils dispo MT (facings)** → ligne Référence × Format → Modifier.
2. **Recalculer**. (L'édition est immédiatement effective : le moteur lit cette table en direct.)

**Rendre un élément de visibilité requis pour un niveau**
1. `/admin/perfect-store/standards` → Visibilité → choisir le segment → cocher
   la case élément × niveau → Enregistrer.
2. **Recalculer**.

**Affecter un distributeur différent à une area précise**
1. `/admin/referentiels` → **Distrib ↔ Areas** → Ajouter → choisir l'area et le
   distributeur. (Supprimer les lignes héritées du territoire si elles ne
   s'appliquent plus à cette area.)
2. Aucune autre action : la création de PDV mobile propose immédiatement le bon distributeur.

**Ajouter un distributeur**
1. `/admin/referentiels` → Distributeurs → Ajouter (cocher « national » s'il
   couvre tous les territoires).
2. Le rattacher : Distrib ↔ Territoires (et/ou Distrib ↔ Areas).

**Activer une promotion dans le score**
- La promotion est comptée par visite : le merchandiser coche « promotion
  applicable » puis les types en place (standard / hôtesses / dégustation —
  plot/hôtesses en MT). Si non applicable, elle est exclue du score (pas de pénalité).

**Vérifier « pourquoi ce PDV n'est pas Flagship »**
- Accueil → tableau **« Passer au niveau supérieur »** : la ligne du PDV liste
  les critères exacts qui manquent. Sinon `/admin/visites` → clic sur la
  visite → détail des piliers.

---

## 10. Dépannage

| Symptôme | Cause probable | Correction |
|---|---|---|
| Les scores n'ont pas bougé après édition d'un standard | Recalcul non lancé | `/admin/perfect-store/standards` → **Recalculer** |
| Un PDV « Non évaluable » / dispo vide | Type du PDV non mappé à un segment/grade | standards → Types de PDV : rattacher le type |
| Un supermarché est noté 0 en visibilité | Visite saisie avant la matrice MT (anciens codes) | Refaire une visite (le formulaire propose désormais les bons éléments) ou recalculer après correction |
| Un PDV MT chute en dispo alors que le stock est bon | Facings non saisis (règle MT = quantité ET facings) | Saisir les facings dans la visite |
| Le distributeur proposé n'est pas le bon | Mapping area/territoire | `/admin/referentiels` → Distrib ↔ Areas / Territoires |
| Un merchandiser ne voit pas ses PDV | Zone/secteurs assignés ≠ zone/secteur du PDV (texte exact) | `/admin/users` : aligner la zone assignée sur le nom du territoire |
| « Table non disponible (migration à exécuter) » dans referentiels | Migration `supabase/nouveau/` non appliquée | Exécuter les migrations dans l'ordre des timestamps |

---

## Annexe — conformité au fichier client (vérifiée le 16/07/2026)

Comparaison automatique base ↔ `docs/big-five-kpi-csv/` :
- **Seuils de disponibilité GT + MT (quantités et facings)** : 167 valeurs, 0 écart.
- **Pondérations** (taux de vente + taux revus, GT et MT) : 0 écart
  (SCM MT maintenu à 2 SKU — arbitrage Friesland du 15/07).
- **Matrices de visibilité** : conformes pour boutique, superette, kiosque/aboki,
  porridge, pushcart, table top ; matrice **MT dédiée** créée depuis
  `crictere-perfect-store-mt.csv` (les supermarchés ne sont plus notés sur la
  matrice superette).
- **Types de PDV** : 41/41 présents (level 3 → level 4).
- **Distributeurs** : les 37 du fichier + ajouts arbitrés (LKA SERVICES,
  placeholders Adzopé/Agboville).
- **Territoires/areas** : hiérarchie complète seedée, équivalences
  North/South = `ABIDJAN` / `UP COUNTRY`.
