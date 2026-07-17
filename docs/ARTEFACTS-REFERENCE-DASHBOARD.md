# Artefacts de référence — dashboard admin

Ce document sert de référence commune pendant l’implémentation. Les intitulés
et destinations ci-dessous viennent des routes présentes dans le dépôt.

## 1. Matrice de navigation

| Domaine | Niveau onglets cible | Routes existantes à conserver |
|---|---|---|
| Perfect Store | Tableau de bord · Liste par niveau · Visites | `/admin` · `/admin/perfect-store/liste` · `/admin/perfect-store/visites` |
| Visites | Toutes les visites · Évolution · Par catégorie · Commerciaux | `/admin/visites` · `/admin/visites/evolution` · `/admin/visites/categories` · `/admin/visites/commerciaux` |
| PDV | Liste · Répartition · Évolution · Distributeurs | `/admin/pdv` · `/admin/pdv/repartition` · `/admin/pdv/evolution` · `/admin/distributeurs` |
| Visibilité | Extérieure · Intérieure · Promotion · Évolution | `/admin/visibilite` · `/admin/visibilite/interieure` · `/admin/visibilite/promotion-recap` · `/admin/visibilite/interieure-evolution` |
| Concurrence | Évolution · Récapitulatif · Visibilité | `/admin/concurrence` · `/admin/concurrence/visibilite-recap` · `/admin/concurrence/visibilite-evolution` |
| Produits | Récapitulatif · Disponibilité · Inventaire SKU · Seuils de stock | `/admin/produits/recap` · `/admin/produits/[category]` · `/admin/produits/inventaire` · `/admin/produits/seuils` |
| Actions | Synthèse · Visites terrain | `/admin/actions` · `/admin/visites` |
| Paramètres | Standards · Seuils · Référentiels · Utilisateurs · Permissions · Import / Export | `/admin/perfect-store/standards` · `/admin/produits/seuils` · routes correspondantes sous `/admin` |

### Second niveau à traiter dans le contenu

- Produits : EVAP, IMP, SCM, UHT, Yaourt, Céréales.
- Visibilité intérieure : GT et MT.
- Produits avec `?tab=prix` ou `?tab=recap` : conserver les query params tant
  que les routes historiques les utilisent.

Le second niveau ne doit pas concurrencer la barre d’onglets principale.

## 2. Gabarit de barre de filtres

```text
[ Période ] [ Périmètre ] [ Canal ] [ Catégorie ] [ Commercial ] [ Rechercher ]
                                                            [Filtrer] [Réinitialiser]

Filtres actifs : [ ... ]                              128 résultats
```

Règles de comportement :

- les champs sont absents lorsqu’ils ne sont pas pertinents ;
- « Tous », « Toutes » et « Rechercher… » gardent le vocabulaire actuel ;
- une seule action de remise à zéro vide tous les champs de la vue ;
- le nombre de résultats provient de la liste existante, pas d’un nouveau calcul ;
- les filtres par colonne restent masqués jusqu’à la demande de l’utilisateur.

## 3. Gabarit de liste

```text
Nom de la liste                                      [Exporter] [Créer]
Description courte                                  128 résultats

[Rechercher…] [Filtres] [Réinitialiser]

| Nom / libellé ↕ | Périmètre ↕ | Statut ↕ | Dernière mise à jour ↕ | Actions |
|-----------------|--------------|----------|-------------------------|---------|
| valeur          | valeur       | badge    | valeur                  |   …     |

Page 1 / 7 · 20 par page                         [Précédent] [Suivant]
```

États à prévoir pour chaque liste :

- chargement : lignes skeleton de même hauteur que les lignes réelles ;
- aucun résultat : message lié aux filtres actifs + action Réinitialiser ;
- aucune donnée : message distinct lorsqu’il n’y a pas encore de données ;
- erreur : message inline sans perdre les filtres ;
- tri actif : icône et `aria-sort` sur une seule colonne à la fois.

## 4. Gabarit KPI compact

```text
┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│ Libellé            │  │ Libellé            │  │ Libellé            │  │ Libellé            │
│ 84 %               │  │ 1 248              │  │ 72 %               │  │ 63 %               │
│ contexte court     │  │ contexte court     │  │ contexte court     │  │ contexte court     │
└────────────────────┘  └────────────────────┘  └────────────────────┘  └────────────────────┘
```

Contraintes :

- quatre KPI maximum dans le premier groupe ;
- libellé en casse phrase, sur une ligne si possible ;
- valeur tabulaire, lisible, sans titre en capitales forcées ;
- sous-texte facultatif, une seule ligne ;
- aucune icône nécessaire pour comprendre la valeur ; elle reste décorative ;
- les cartes secondaires sont dans la vue détaillée existante.

Pour Perfect Store, le bloc actuel « Performance réseau » devient un KPI
compact conservant exactement la valeur existante et son contexte
`perfect_stores / visites_scorees`. Le calcul ne change pas.

## 5. Checklist de revue écran

- [ ] La sidebar indique le domaine, pas chaque sous-page.
- [ ] Une seule barre d’onglets est visible et son onglet actif est évident.
- [ ] Les filtres sont dans le même ordre que les écrans voisins.
- [ ] Le bouton Réinitialiser remet toute la vue à zéro.
- [ ] La liste affiche son total, son état de tri et sa pagination.
- [ ] Le premier groupe contient au plus quatre KPI.
- [ ] Les valeurs restent identiques avant / après.
- [ ] Les états loading, vide, erreur et filtré existent.
- [ ] L’écran reste utilisable au clavier et en largeur mobile.
