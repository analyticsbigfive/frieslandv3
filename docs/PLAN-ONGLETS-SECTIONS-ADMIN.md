# Plan — onglets des sections admin

## Objectif

Ajouter une navigation par onglets entre les sous-pages des sections Visites,
Perfect Store, Visibilité, Concurrence et Produits, en conservant les routes
existantes et le style admin déjà utilisé dans Routing et Référentiels.

## Choix d’implémentation

- créer `components/AdminSectionTabs.vue` avec des liens `NuxtLink` ;
- déduire la section depuis `route.path` dans `layouts/admin.vue` pour éviter de
  dupliquer les onglets dans chaque page ;
- afficher la navigation dans `layouts/admin.vue`, juste au-dessus du contenu,
  avec une barre horizontale scrollable sur petits écrans ;
- conserver les onglets internes propres à une page, notamment ceux des familles
  produit (`dispo`, `prix`, `recap`) ;
- conserver le point d’entrée Actions et le lien vers le suivi des visites terrain,
  qui sont les deux routes existantes les plus proches du suivi des actions ;

## Vérification

- lancer le lint TypeScript/Vue ;
- vérifier les liens et l’état actif sur desktop et mobile ;
- vérifier que les query params des pages produit restent préservés.
