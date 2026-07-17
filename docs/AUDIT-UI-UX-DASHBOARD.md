# Audit UI/UX du dashboard admin

Date : 17 juillet 2026  
Périmètre : `pages/admin`, `layouts/admin.vue`, composants admin et styles partagés.

## Position de départ

Cet audit décrit ce qui est réellement présent dans le dépôt. Il ne propose pas de
nouveaux indicateurs, de nouvelles données ou de nouveaux parcours métier.

### Inventaire observé

| Élément | Constat dans le dépôt |
|---|---|
| Écrans admin | 36 fichiers de pages sous `pages/admin` |
| Sections de sidebar | 9 sections dans `components/AdminSidebar.vue` |
| Navigation par onglets | 6 domaines dans `components/AdminSectionTabs.vue` |
| Filtres partagés | 17 pages utilisent `DashboardFilters.vue` |
| Écrans avec tableau HTML | 21 pages |
| Tri / filtres locaux | au moins 4 familles d’écrans ont leur propre implémentation |
| KPI partagés | `StatsCard.vue` est utilisé par plusieurs domaines |

## Constats par sujet

### 1. Navigation

- La sidebar liste encore de nombreuses sous-pages alors qu’une barre d’onglets
  est déjà injectée globalement par `layouts/admin.vue`.
- Les onglets ne couvrent pas tous les domaines de la sidebar : PDV, Principal et
  Paramètres n’ont pas de système équivalent.
- Le domaine Produits expose les familles EVAP, IMP, SCM, UHT, Yaourt et Céréales
  dans la même barre que les fonctions Récapitulatif, Inventaire et Seuils.
  Cela crée une barre longue et mélange deux niveaux de navigation.
- Le domaine Visibilité expose sept onglets dans une seule ligne, dont des vues
  GT/MT et des vues de récapitulatif qui pourraient relever d’un second niveau.
- `pages/admin/perfect-store/liste.vue` ajoute encore un lien « Tableau de bord »
  dans le contenu alors que le domaine dispose déjà d’onglets.
- L’état actif est déduit uniquement de `route.path`. Les variantes par query
  (`/admin/produits/evap?tab=prix`, par exemple) ne possèdent pas de contrat
  partagé pour l’onglet actif.

Références :

- [layout admin](../layouts/admin.vue)
- [sidebar](../components/AdminSidebar.vue)
- [onglets actuels](../components/AdminSectionTabs.vue)
- [plan d’onglets existant](./PLAN-ONGLETS-SOUS-PAGES-ADMIN.md)

### 2. Filtres

`DashboardFilters.vue` fournit une base commune, mais son rendu reste très
variable : chaque page choisit un sous-ensemble de champs et plusieurs écrans
ont recréé une barre spécifique.

Variantes observées :

- filtre partagé avec dates, canal, catégorie, sous-catégorie, commercial,
  région, zone, quartier et nom de PDV ;
- cascade Division / Territoire / Area / Distributeur sur le dashboard
  Perfect Store ;
- recherche + niveau sur la liste Perfect Store ;
- recherche + zone + sous-région sur la liste des PDV ;
- filtres par colonne directement dans plusieurs tableaux de visibilité et de
  concurrence.

Le problème principal n’est donc pas l’absence de filtres, mais le manque de
contrat commun pour : l’ordre, le libellé, le bouton de recherche, la remise à
zéro, l’affichage des filtres actifs et la conservation du périmètre lors d’un
changement d’onglet.

Référence : [DashboardFilters.vue](../components/DashboardFilters.vue).

### 3. Listes, tri et filtrage

- `AdminTableEnhancer.vue` ajoute dynamiquement un tri et des filtres de colonne
  à de nombreux tableaux.
- D’autres écrans ont leur propre état de tri ou leurs propres filtres de
  colonne : notamment les récapitulatifs de visibilité et de concurrence.
- Les espacements, les libellés d’en-têtes, les contrôles de pagination et les
  états vides ne sont pas uniformes.
- Le tri générique agit sur le DOM de la table, alors que plusieurs listes sont
  paginées ou calculées localement. Le comportement attendu doit être explicite
  avant de généraliser le composant.

Références :

- [enhancer de tableaux](../components/AdminTableEnhancer.vue)
- [liste Perfect Store](../pages/admin/perfect-store/liste.vue)
- [liste des PDV](../pages/admin/pdv/index.vue)
- [récapitulatif concurrence](../pages/admin/concurrence/visibilite-recap.vue)

### 4. KPI et densité

- Le dashboard Perfect Store affiche un bloc principal avec une valeur en
  `text-5xl`, une icône de 64 px, puis six cartes KPI.
- `StatsCard.vue` reste relativement haut : padding de 20 px, valeur en 30 px,
  icône dédiée et parfois une sous-ligne.
- Le layout ajoute en plus trois KPI dans l’en-tête sur les écrans larges.
- Certains écrans affichent simultanément des cartes KPI, des cartes de
  graphiques, puis un tableau récapitulatif. Le contenu est correct mais la
  hiérarchie visuelle ne distingue pas assez l’essentiel du détail.
- Le récapitulatif Produits répète une grille de KPI, une grille de graphiques
  puis un tableau ; c’est un candidat prioritaire à la réduction de hauteur.

Références :

- [dashboard Perfect Store](../pages/admin/index.vue)
- [carte KPI partagée](../components/StatsCard.vue)
- [récapitulatif Produits](../pages/admin/produits/recap.vue)
- [styles admin](../assets/css/main.css)

## Ce qui ne doit pas bouger dans ce chantier

- les routes existantes et les liens favoris ;
- les règles RBAC et les contrôles d’accès ;
- les requêtes Supabase et les formules Perfect Store ;
- les noms métier existants, sauf correction validée par le métier ;
- les données affichées et les exports ;
- les parcours offline, GPS, photos et synchronisation.

## Diagnostic synthétique

Le dashboard n’a pas besoin de davantage de blocs. Il a besoin d’un shell unique
et de règles de lecture répétables :

1. un seul niveau de navigation principal visible à un endroit donné ;
2. un ordre de filtres stable et une remise à zéro prévisible ;
3. une liste qui se lit toujours selon la même structure ;
4. des KPI courts, comparables et regroupés par priorité ;
5. les détails accessibles dans un second niveau, sans les afficher partout.
