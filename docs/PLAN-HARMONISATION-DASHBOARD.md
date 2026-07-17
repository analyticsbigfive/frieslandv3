# Plan d’harmonisation UI/UX du dashboard

## Objectif

Rendre les écrans admin plus faciles à parcourir sans modifier le métier :
l’utilisateur doit reconnaître la navigation, les filtres, les KPI et les listes
quel que soit le domaine ouvert.

Le plan est volontairement progressif. Il s’appuie sur les routes et composants
existants et ne demande pas de nouvelle donnée.

## Architecture cible

```text
Sidebar = domaines de travail
        ↓
Onglets = vues d’un domaine
        ↓
Titre + contexte de la vue
        ↓
Barre de filtres commune
        ↓
KPI prioritaires (4 maximum à la fois)
        ↓
Graphique ou liste principale
        ↓
Détail secondaire / export / aide au calcul
```

Une information ne doit pas être répétée dans la sidebar, les onglets et le
contenu de la page.

## Lots proposés

### Lot 0 — Référentiel de navigation et baseline

Objectif : disposer d’une seule source de vérité pour les domaines, routes et
onglets.

- extraire la configuration actuellement codée dans
  `AdminSectionTabs.vue` dans un registre partagé ;
- documenter les routes de chaque domaine, y compris les routes existantes non
  encore représentées par des onglets ;
- décider, pour chaque domaine, ce qui reste dans la sidebar et ce qui passe
  dans les onglets ;
- vérifier les liens directs, les query params et les droits avant de retirer
  une entrée de la sidebar.

Critère de sortie : chaque route admin a un propriétaire de navigation unique.

### Lot 1 — Navigation par onglets

Priorité : P0.

- conserver une seule barre d’onglets dans le layout admin ;
- utiliser un style texte + ligne active, sans bouton plein ;
- garder le défilement horizontal sur petits écrans ;
- utiliser la même casse, la même hauteur et le même état actif partout ;
- retirer progressivement les liens de sous-pages de la sidebar uniquement après
  avoir branché l’onglet correspondant ;
- regrouper les familles de Produits dans un sélecteur de famille au sein de la
  vue Disponibilité, au lieu de les mélanger aux fonctions globales ;
- regrouper les vues GT/MT de Visibilité dans la vue intérieure, en conservant
  leurs routes actuelles comme destinations.

Critère de sortie : l’utilisateur peut passer d’une vue à l’autre sans chercher
dans une liste de sous-pages ni perdre son contexte de navigation.

### Lot 2 — Barre de filtres commune

Priorité : P0.

Conserver les champs existants, mais imposer un contrat de rendu :

1. période ;
2. périmètre géographique ;
3. canal ;
4. catégorie / sous-catégorie ;
5. commercial ;
6. recherche textuelle si la vue est une liste.

Règles :

- ne montrer que les champs utiles à la vue ;
- garder le même ordre et les mêmes libellés ;
- placer « Filtrer » et « Réinitialiser » au même endroit ;
- afficher les filtres actifs sous forme de résumé compact ;
- conserver les valeurs utiles dans la query string lorsque la route les
  accepte ;
- éviter les filtres par colonne visibles en permanence ; les afficher via un
  contrôle « Filtrer les colonnes » ou une vue dédiée.

Critère de sortie : la remise à zéro et la lecture du périmètre se comportent de
la même manière dans tous les écrans concernés.

### Lot 3 — Listes et tableaux

Priorité : P0.

Définir une structure commune, sans modifier les données :

- en-tête de liste avec titre, résultat total et actions ;
- recherche ou filtre principal à gauche ; export / création à droite ;
- en-têtes de colonnes avec tri explicite et état accessible ;
- filtre de colonne replié par défaut ;
- cellules avec les mêmes espacements et la même hiérarchie ;
- pagination avec la même formulation ;
- états loading, vide, erreur et résultat filtré sans résultat.

Le tri doit être défini au niveau des données lorsque la liste est paginée ou
serveur-dépendante. L’enhancer DOM actuel peut rester une solution transitoire
pour les tableaux simples, mais ne doit pas devenir la seule API de liste.

Critère de sortie : une liste se manipule de la même façon dans PDV, Visites,
Perfect Store, Visibilité, Concurrence et Produits.

### Lot 4 — KPI et densité

Priorité : P1.

- transformer `StatsCard` en carte compacte et constante ;
- limiter la première vue à quatre KPI prioritaires ;
- déplacer les indicateurs secondaires dans une section « Détail » ou dans la
  vue spécialisée existante ;
- réduire le bloc Perfect Store principal à un KPI compact avec son contexte ;
- éviter de répéter dans la page les KPI déjà présents dans l’en-tête global ;
- conserver le formatage tabulaire des nombres et des pourcentages ;
- garder les définitions existantes accessibles, mais hors du premier écran.

Critère de sortie : le premier écran expose le contexte, les filtres, les KPI
essentiels et le premier contenu utile sans grand bloc disproportionné.

### Lot 5 — Validation et non-régression

Priorité : P0 avant déploiement.

- tester les 36 routes admin listées dans l’audit ;
- vérifier les 4 rôles et les sections masquées par RBAC ;
- ouvrir chaque route directement puis revenir par les onglets ;
- vérifier le maintien des query params Produits ;
- tester tri, filtre, reset, pagination et états vides sur chaque famille de
  liste ;
- vérifier desktop, largeur intermédiaire et mobile ;
- vérifier clavier, `aria-current`, focus visible et défilement horizontal ;
- comparer les résultats de données avant / après sur les écrans Perfect Store,
  Visites et Produits.

## Ordre de réalisation recommandé

1. Perfect Store + Visites : parcours prioritaires et déjà dotés d’onglets.
2. Produits : réduction la plus visible de la barre d’onglets.
3. Visibilité + Concurrence : alignement des listes et filtres de colonne.
4. PDV : liste, recherche, pagination et filtres de périmètre.
5. Actions + Paramètres : même shell, avec leurs spécificités conservées.
6. Nettoyage final de la sidebar et validation des droits.

## Hors périmètre

- refonte de la base de données ;
- changement des calculs Perfect Store ;
- ajout d’alertes « intelligentes » ou de recommandations ;
- ajout de nouveaux KPI ;
- réécriture du framework ou remplacement de Nuxt UI ;
- modification du parcours mobile terrain.
