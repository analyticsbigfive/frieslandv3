# Plan — dernière passe de l’admin

Date : 17 juillet 2026  
Périmètre : shell admin, navigation, filtres, listes, KPI et états d’usage.

## Intention

Réduire le temps de recherche d’une information sans changer le métier : mêmes
routes, mêmes données, mêmes calculs Perfect Store, mêmes droits et mêmes
exports. Aucun nouveau KPI ni comportement « intelligent » n’est proposé.

## P0 — rendre chaque écran immédiatement lisible

### 1. Shell et navigation

- garder une seule navigation principale visible à la fois : domaines dans la
  sidebar, vues dans les onglets ;
- conserver l’onglet actif, le titre et le périmètre lors d’un changement de
  route ;
- réduire le header global aux informations de contexte et d’état utiles ;
- afficher un fil de contexte simple : `Domaine / Vue`.

### 2. Contrat de filtre

Sur chaque écran qui filtre une liste ou un KPI :

1. recherche ou période ;
2. périmètre géographique ;
3. canal / catégorie si pertinent ;
4. bouton `Plus de filtres` ;
5. filtres actifs sous forme de chips ;
6. `Réinitialiser` au même endroit.

Les champs restent ceux déjà présents dans le produit. Seul leur ordre et leur
rendu sont harmonisés.

### 3. Contrat de liste

- titre + description courte + nombre de résultats ;
- recherche et filtres à gauche, export / création à droite ;
- tri explicite sur les colonnes qui le permettent ;
- actions directement visibles quand elles sont au nombre de trois ou moins ;
- pagination identique ;
- états distincts : chargement, aucun résultat filtré, aucune donnée, erreur.

## P1 — améliorer les parcours prioritaires

### Dashboard / Perfect Store

- premier écran : filtres, quatre KPI prioritaires, puis une seule liste de
  lecture ;
- conserver les piliers secondaires sous forme de ligne compacte ;
- repousser l’explication du calcul sous le contenu principal ;
- garder l’accordéon par type, mais ouvrir un seul niveau à la fois.

### PDV

- garder la table comme vue principale ;
- actions directes `Modifier`, `Voir sur la carte`, `Supprimer` ;
- ouvrir le détail dans un panneau latéral sans perdre la liste ni les filtres ;
- afficher les coordonnées manquantes comme un état, pas comme une colonne
  supplémentaire.

### Visites, visibilité, concurrence et produits

- même barre de liste et même pagination ;
- sous-vues GT / MT, catégories et familles de produits dans le contenu de la
  vue, pas dans la navigation principale ;
- colonnes secondaires masquées par défaut sur les écrans les plus larges ;
- détail accessible par ligne ou action explicite.

## P1 — états et accessibilité

- skeletons à la forme des contenus attendus ;
- message d’erreur directement dans la zone concernée, avec conservation des
  filtres ;
- `aria-current`, `aria-sort`, labels des champs et focus visibles ;
- actions avec libellé ou tooltip, jamais une icône seule sans nom accessible ;
- vérification mobile : filtres défilants, tables scrollables et actions
  atteignables au clavier.

## P2 — validation finale

1. parcourir les routes admin existantes ;
2. vérifier les rôles et les éléments masqués par RBAC ;
3. tester recherche, tri, filtre, reset, pagination et états vides ;
4. comparer les valeurs avant / après sur Perfect Store, Visites et Produits ;
5. valider desktop, largeur intermédiaire, mobile et clavier.

## Critères de sortie

- l’utilisateur sait toujours où il se trouve ;
- un filtre actif est visible et retirable individuellement ;
- une liste indique son total, son état de tri et sa page ;
- les quatre KPI prioritaires tiennent dans le premier écran ;
- aucun calcul, libellé métier, droit ou export n’a changé.

## Hors périmètre

Refonte de la base, ajout d’indicateurs, recommandations automatiques, nouveau
parcours mobile, remplacement de Nuxt UI ou changement des formules Perfect
Store.

Prototype associé : [admin-final-pass.html](./prototypes/admin-final-pass.html).
