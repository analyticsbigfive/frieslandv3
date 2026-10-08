# Guide d'administration — Big Five / Perfect Store (Friesland Bonnet Rouge)

> Version du 8 octobre 2026 (application mobile 1.0.12). Couvre le back-office
> web (`/admin`) et tous les réglages qui pilotent l'application mobile : le
> client gère ses données depuis l'admin, sans passer par l'éditeur SQL.
> Données de référence Perfect Store : fichier client « BIG FIVE KPI UPDATE »
> (copie CSV dans `docs/big-five-kpi-csv/`), vérifié conforme à la base.
>
> Nouveautés depuis juillet : merchandisers Atom (quotas, SSF et sous-zones,
> §7 bis), produits du formulaire (§4 bis), paramètres terrain et publication
> de l'application (§8), imports terrain (§11), maintenance (§12).

---

## 1. Connexion et rôles

- **URL de connexion** : <https://frieslandv3.vercel.app/login>
- **Compte administrateur** : `admin@friesland.ci`. Le mot de passe est remis
  séparément, en main propre ; il ne figure jamais dans ce guide.
- Après connexion, un **admin** ou
  **superviseur** arrive sur le dashboard Perfect Store (`/admin`) ; un
  **merchandiser** arrive sur l'app mobile (`/mobile`).
- **Rôles** :
  | Rôle | Ce qu'il peut faire |
  |---|---|
  | `admin` | Tout : standards, référentiels, utilisateurs, permissions, recalcul |
  | `superviseur` | Standards + référentiels + suivi (pas la gestion des permissions) |
  | `commercial` | App mobile : équipe, actions commerciales, field coaching ; analyse en lecture seule sur le web |
  | `merchandiser` | App mobile : visites, création de PDV ; il ne voit que les PDV de ses territoires et quartiers |
- **Employeur** (fiche utilisateur) : `friesland` (tournées par périmètre) ou
  `atom` (tournées par quotas avec les SSF, §7 bis).
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
| **Produits du formulaire** (libellé, ordre, actif, seuil « stock bas ») | Paramètres → **Produits du formulaire** (`/admin/produits/seuils`) | `sku_thresholds` |
| Rattacher un produit du formulaire à une référence notée | `/admin/referentiels` → **Correspondance SKU** | `correspondance_reference` |

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

## 4 bis. Produits du formulaire de visite

Depuis l'application 1.0.12, la liste des produits relevés dans la visite vient
de la base : **Paramètres → Produits du formulaire** (`/admin/produits/seuils`).

| Action | Comment | Effet |
|---|---|---|
| Renommer un produit | Modifier son libellé | Immédiat sur le web ; téléphones à leur prochaine ouverture |
| Réordonner | Modifier l'ordre | Ordre des lignes dans l'étape de la catégorie |
| Retirer un produit | Décocher « Dans le formulaire » | Il disparaît du formulaire ; l'historique reste (tableaux, export) |
| Ajouter un produit | Libellé + seuil en bas de la catégorie | Clé générée et **figée** (elle range les quantités dans les visites) |
| Seuil « stock bas » | Modifier le seuil | Pastilles du téléphone et inventaire SKU (hors score) |

Règles :
- On ne supprime jamais un produit : on le retire du formulaire.
- Un produit noté au Perfect Store (présent dans **Correspondance SKU**) ne
  peut pas être retiré : la base le refuse, sinon toutes les nouvelles visites
  le noteraient à 0. Retirer d'abord la correspondance.
- Un nouveau produit est saisi et exporté, mais ne compte au Perfect Store
  qu'après une **Correspondance SKU**, suivie d'un **Recalculer** (qui renote
  aussi l'historique).
- Les **catégories** (EVAP, IMP, SCM, UHT, Yaourt, Céréales…) se gèrent dans
  `/admin/referentiels` → **Catégories du relevé** : libellé, ordre, actif,
  **facings en Modern Trade**. Une nouvelle catégorie (code en minuscules, figé)
  apparaît dans le formulaire dès qu'elle a des produits ; elle n'est pas notée
  au Perfect Store.
- Les téléphones en 1.0.10 / 1.0.11 gardent leur liste intégrée : un nouveau
  produit n'y apparaît qu'après la mise à jour en 1.0.12.

---

## 5. Référentiels (`/admin/referentiels`)

Tous en CRUD direct, groupés par thème :

- **Géographie** : Régions (divisions North/South), Sous-régions, Territoires,
  Zones/Areas. Hiérarchie : pays > division > sous-région > territoire > area.
- **Distribution** :
  - **Distributeurs** (nom + couverture « National » = proposé partout). Le
    **renommage** est reporté sur les PDV et les règles de tournée.
  - **Distrib ↔ Territoires** : distributeur(s) par territoire.
  - **Distrib ↔ Areas** : *override* par area — permet à un même territoire
    d'avoir des distributeurs différents selon l'area. À la création d'un PDV,
    l'app propose : distributeurs de l'**area** (s'il y en a), sinon ceux du
    **territoire**, plus les **nationaux**.
  - **SSF (vendeurs)** : nom, variantes, téléphone, distributeur, actif,
    « à confirmer ». **SSF ↔ Quartiers** : la sous-zone de chaque SSF (§7 bis).
  - **Alias d'import** : nom tel qu'écrit dans les fichiers DMS ou Atom → 
    merchandiser, distributeur ou SSF (exact, commence par, contient).
- **Points de vente** : Catégories (level 3, avec canal GT/MT) et Types (level 4),
  avec leur **libellé français**.
  ⚠️ Le level 4 pilote tout le scoring : ne pas renommer un type sans re-vérifier
  son mapping dans standards → Types de PDV.
- **Produits** : catégories produit, références (SKU), **Correspondance SKU**
  (produit du formulaire ↔ référence ; clé = catégorie + produit), rôles
  (héros), marques et SKU concurrents, **Catégories du relevé**.
- **Perfect Store** : niveaux, poids, seuils dispo GT, seuils dispo MT (facings),
  assortiment, éléments et matrice de visibilité.
- **Application mobile** : **Paramètres terrain**, **Quotas Atom**, **Canal
  Atom** (sous-catégorie de PDV → canal), **Types d'action** commerciale,
  **Engins de vente**, **Version minimale**, **Versions installées**, **Publier
  une version**, **Maintenance**.

Lien direct vers un onglet : `/admin/referentiels?onglet=<id>` (ex.
`?onglet=ssf`, `?onglet=parametre_app`).

---

## 6. PDV et visites

- **`/admin/pdv`** : liste, répartition, évolution des créations. La fiche
  porte aussi le **code DMS** (`mdm`) et le **rayon de geofence** propre au PDV
  (vide = rayon des paramètres terrain).
- **`/admin/visites`** : liste des visites avec niveau Perfect Store, score,
  détail complet au clic (relevé, piliers, photos). Suppression possible.
- **`/admin/perfect-store/liste`** : tous les PDV par niveau, filtrable.
- **Import / Export** : `/admin/import-export` (PDV en masse, exports Excel,
  imports terrain §11). L'export des visites contient toutes les visites de la
  plage, avec statut et quantité de chaque produit du catalogue.

---

## 7. Utilisateurs et périmètres

- **`/admin/users`** : création/édition des comptes (rôle, employeur,
  territoires et quartiers assignés, commercial responsable, actif/inactif).
- Un **merchandiser** ne voit que les PDV de ses territoires (et de ses
  quartiers s'ils sont renseignés). Admin/superviseur voient tout.
- **`/admin/permissions`** : sections du menu accessibles par rôle.

---

## 7 bis. Merchandisers Atom : quotas, SSF et sous-zones

Principe : chaque PDV du portefeuille est visité **une fois par mois civil**.
Chaque jour, un **SSF** (vendeur du distributeur) accompagne le merchandiser,
qui reste dans la **sous-zone** de ce SSF (ses quartiers).

| Je veux… | Où | Table |
|---|---|---|
| Créer / corriger un SSF | Référentiels → Distribution → **SSF (vendeurs)** | `ssf` |
| Définir la sous-zone d'un SSF | Référentiels → Distribution → **SSF ↔ Quartiers** | `ssf_quartier` |
| Planning : quel jour avec quel SSF | Routing & Planning → **Règles** : une règle `SSF — <nom>` par SSF, en mode quota, avec ses jours | `routing_templates.ssf_id` |
| Nombre de PDV par canal et par jour | Référentiels → Application mobile → **Quotas Atom** | `routing_quota_canal` |
| Canal d'une sous-catégorie de PDV | Référentiels → Application mobile → **Canal Atom** | `canal_atom_sous_categorie` |
| Suivi du mois | Barre latérale → **Programme Atom** | `programme_atom(mois)` |
| Charger le fichier client « SSF ↔ zones » | Import / Export → **Imports terrain** → Sous-zones SSF et planning Atom | — |

**Tournée du jour** (générée chaque nuit pour 7 jours) : d'abord les PDV de la
règle du jour, puis les PDV actifs de la sous-zone du SSF, selon la grille,
sans PDV déjà planifié ou visité dans le mois. Grille de lancement : 20 PDV du
lundi au jeudi, 15 le vendredi, 10 le samedi (Superette, Boutique, Aboki &
Kiosque, Pushcart, Porridge). Un canal absent de la sous-zone est complété par
des boutiques.

**Règles** : modifier une règle (menu → **Modifier**) change libellé, jours,
dates, mode, SSF, territoire et distributeur. Le sélecteur **SSF (avec qui)**
préremplit libellé, territoire, distributeur et mode quota ; la liste des PDV
est limitée à la sous-zone et un PDV hors sous-zone est refusé. La règle
« Portefeuille DMS » du merchandiser couvre les jours sans SSF.

**Planning d'équipe** : Routing & Planning › Tournées planifiées s'ouvre sur
une grille personne × jour (lundi → samedi) : PDV faits / prévus, « à générer »,
SSF du jour pour Atom ; un clic ouvre la tournée du jour. « Par personne »
revient aux cartes individuelles (liste et calendrier du mois).

**Objectif mensuel** (Programme Atom et écran mobile « Mes objectifs ») : la
grille additionnée sur les jours de tournée du mois (420 sur quatre semaines
pleines, 465 en octobre 2026). Il se change en modifiant la grille.

**Après un changement** de règle, de grille ou de sous-zone : Maintenance →
**Recalculer les tournées à venir** (Atom). Les tournées non commencées sont
refaites ; celle du jour n'est jamais modifiée.

**Côté téléphone (1.0.12)** : Plus → **Ma semaine (SSF)** (SSF, téléphone,
quartiers de chaque jour, hors ligne) ; champ **SSF (avec qui)** dans la visite,
prérempli avec le SSF du jour, « autre » pour un nom libre ; bandeau orange si
le PDV est hors de la sous-zone (non bloquant). Le SSF est enregistré dans la
visite (`visites.ssf_id` / `ssf_brut`) et affiché dans son détail.

**Données de départ** : SSF et sous-zones déduits des visites de septembre
(`a_confirmer = true`). Le fichier client les remplace dès qu'il est importé.

---

## 8. Application mobile (ce que vos réglages pilotent)

- **Sélection du PDV** : chaque option affiche `Nom (Territoire) · GT/MT` ;
  après sélection, un badge indique **General Trade** ou **Modern Trade** + le type.
- **Disponibilité** : une étape par **catégorie active** du catalogue (§4 bis),
  saisie des **quantités** par produit. Si le PDV est **MT** et que la catégorie
  a les facings, un champ **« F » (facings)** apparaît à côté de chaque
  quantité — il est requis par la règle MT (quantité ET facings). Le champ
  s'encadre en orange si le facing saisi est sous le minimum.
- **Visibilité / Promotion** : les éléments affichés viennent de la **matrice du
  segment** du PDV (ex. un supermarché affiche Niche/Top shelf/Bacs…, une
  boutique affiche Réglette/Maison BR/…). Modifier la matrice dans l'admin
  change le formulaire mobile.
- **Création de PDV** (merchandiser) : cascade Catégorie → Type (le canal se
  déduit), Territoire → Area, **distributeur** proposé selon l'area/le
  territoire + nationaux.
- **Hors-ligne** : les visites et les statuts d'étape de tournée se mettent en
  file et se synchronisent au retour du réseau ; le score est calculé à la
  synchronisation. Le catalogue, les paramètres et le planning SSF sont gardés
  sur le téléphone.

### Paramètres terrain (Référentiels → Application mobile → Paramètres terrain)

Lus par l'app 1.0.12 à chaque ouverture (cache hors ligne). Portée : tous, ou
propre à `friesland` / `atom` (prime pour ses utilisateurs). Bornes contrôlées.

| Paramètre | Départ | Effet |
|---|---|---|
| `geofence_rayon_m` | 300 m | Distance max. agent ↔ PDV ; rayon des PDV sans rayon propre |
| `gps_precision_min_m` | 10 m | Au-delà : visite enregistrée « GPS non validé » (motif précision), l'agent est prévenu |
| `gps_precision_pdv_max_m` | 30 m | Pour géolocaliser un PDV depuis le terrain |
| `gps_precision_tournee_max_m` | 50 m | Points de trajet moins précis ignorés |
| `tracking_intervalle_s` / `tracking_distance_m` | 120 s / 15 m | Fréquence des points de tournée |
| `tracking_envoi_s` / `tracking_lot_max` | 300 s / 200 | Envoi groupé des points |
| `objectif_visites_jour` | 10 ; vide pour Atom | Objectif de l'accueil ; vide = taille de la tournée du jour |

### Publier une version (Référentiels → Application mobile → Publier une version)

1. Choisir l'APK signé (`friesland-bonnet-rouge-<version>-release.apk`) : la
   page lit son `versionCode` et refuse une version plus ancienne.
2. Publier **sans** « obligatoire » : le lien de téléchargement est mis à jour,
   les téléphones 1.0.12+ affichent un bandeau « nouvelle version ».
3. Quand la version est **en ligne sur le Play Store**, republier en cochant
   **Rendre cette version obligatoire** : les versions plus anciennes sont
   bloquées sur l'écran de mise à jour.
4. Suivre **Versions installées**.

Procédure complète, AAB et Play Console : `docs/play-store/PUBLIER-MISE-A-JOUR.md`.

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
| « Table non disponible (migration à exécuter) » dans referentiels | Migration `supabase/nouveau/` non appliquée | Exécuter les migrations dans l'ordre des timestamps (§13) |
| Une tournée Atom sort de la sous-zone | Quartiers du SSF incomplets, ou règle sans SSF | SSF ↔ Quartiers, SSF de la règle, puis Recalculer les tournées à venir |
| Un jour sans tournée Atom | Aucune règle active ce jour (ou suspendue) | Routing → Règles : cocher le jour sur la bonne règle |
| « Ce produit est noté au Perfect Store… » en retirant un produit | Correspondance SKU existante | Retirer la correspondance, puis le produit |
| Un nom du fichier DMS/Atom n'est pas reconnu | Variante d'écriture | Alias d'import, puis relancer la simulation |
| Les tableaux de bord ne reflètent pas un import | Statistiques recalculées chaque heure | Maintenance → Rafraîchir les statistiques maintenant |

---

## 11. Imports terrain (`/admin/import-export` → Imports terrain)

Réservé à l'admin. Quatre traitements, qui remplacent les scripts de l'équipe
technique :

| Import | Fichier | Ce qu'il fait |
|---|---|---|
| Clients DMS → points de vente | Export clients du DMS | Rapproche par code DMS, nom et GPS ; crée les PDV manquants, complète les existants |
| Affectation des merchandisers (DMS) | Liste « merchandiser ↔ e-mail » + export DMS | Règles « Portefeuille DMS », périmètres, employeur |
| Visites Atom (export Bonnet Rouge) | Export des visites Atom | Importe les visites (préfixe `ATOM-`), crée les PDV inconnus, rattache distributeur et SSF |
| Sous-zones SSF et planning Atom | Fichier client « SSF ↔ zones » (ou rien : dérivation des visites) | Sous-zones, règles `SSF — <nom>` et leurs jours, périmètres |

Déroulé : **Simuler** (aucune écriture ; résumé, rapport et CSV téléchargeables)
→ relire → **Appliquer** (par lots, barre de progression, relançable sans
doublon) → **Historique** (chaque lot, avec **Annuler le lot** pour défaire ses
écritures). Un nom mal reconnu se corrige dans **Alias d'import**.

---

## 12. Maintenance (Référentiels → Application mobile → Maintenance)

- **Recalculer les tournées à venir** (Atom / Friesland / tous) : après un
  changement de règle, de grille ou de sous-zone.
- **Générer les tournées manquantes (7 jours)**.
- **Rafraîchir les statistiques maintenant** (sinon chaque heure).
- **Tâches planifiées** : état, dernier passage, horaire modifiable (format
  cron, heure d'Abidjan = UTC) des tâches de nuit.

---

## 13. Ce qui reste du ressort de l'équipe technique

Restent dans le code, car ils changent la structure de l'application :
- liste des rôles et des sections du menu (la matrice Permissions se règle
  dans l'admin) ;
- objectifs d'une étape de tournée (Stock, Encaissement, Photos,
  Merchandising, Prospection), questions du field coaching, textes des
  notifications ;
- construction de l'application Android (APK, AAB) et publication sur le Play
  Store (`docs/play-store/PUBLIER-MISE-A-JOUR.md`) ;
- migrations de la base (`supabase/nouveau/`), appliquées dans l'éditeur SQL.
  Ordre pour la version 1.0.12, après celles de la 1.0.11 (`20261006120000`,
  `20261006130000`) :
  1. `20261007100000_friesland_ssf_sous_zones.sql`
  2. `20261007110000_friesland_admin_autonomie.sql`
  3. `20261007120000_friesland_parametres_app.sql`
  4. `20261007130000_friesland_catalogue_releve.sql`
  5. `20261007140000_friesland_import_lot.sql`
- la table historique `zones_secteurs` n'est plus utilisée (à retirer).

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
