# Plan — Onglets des sous-pages admin

> Proposition du 16 juillet 2026

## Objectif

Réduire la densité de la navigation admin en regroupant les écrans d’un même domaine dans une barre d’onglets persistante.

La sidebar doit présenter les grands domaines. Les onglets doivent présenter les vues de ce domaine. Une page ne doit pas avoir à répéter une liste de liens différente dans son contenu.

## Proposition d’architecture

| Domaine | Onglets proposés | Routes existantes à conserver |
|---|---|---|
| Visites | Toutes, Évolution, Catégories, Commerciaux | `/admin/visites`, `/admin/visites/evolution`, `/admin/visites/categories`, `/admin/visites/commerciaux` |
| Perfect Store | Vue d’ensemble, PDV par niveau, Visites, Standards | `/admin/perfect-store`, `/admin/perfect-store/liste`, `/admin/perfect-store/visites`, `/admin/perfect-store/standards` |
| Visibilité | Synthèse, Extérieure, Intérieure GT, Intérieure MT, Promotion, Évolution | `/admin/visibilite`, `/admin/visibilite/exterieure-recap`, `/admin/visibilite/interieure-gt-recap`, `/admin/visibilite/interieure-mt-recap`, `/admin/visibilite/promotion-recap`, `/admin/visibilite/interieure-evolution` |
| Concurrence | Récapitulatif, Évolution, Visibilité concurrence | `/admin/concurrence`, `/admin/concurrence/visibilite-evolution`, `/admin/concurrence/visibilite-recap` |
| Produits | Récapitulatif, Disponibilité, EVAP, IMP, SCM, Inventaire, Seuils | `/admin/produits/recap`, `/admin/produits/[category]`, `/admin/produits/inventaire`, `/admin/produits/seuils` |
| Actions | Récapitulatif, Évolution, Détail par action | `/admin/actions` avec vues internes ou query `?tab=` |

Les routes actuelles restent valides. Les onglets deviennent une couche de navigation commune, sans casser les liens existants ni les favoris.

## Règles d’interface

### Position

Les onglets se placent immédiatement sous le titre de la page et avant les filtres. Ils restent dans le même conteneur que l’en-tête afin de faire comprendre qu’ils changent de vue, pas de périmètre métier.

### Style

- ligne horizontale fine ;
- onglet actif signalé par une bordure inférieure rouge et une couleur de texte rouge ;
- aucun bouton plein pour les onglets ;
- défilement horizontal sur mobile ;
- compteur uniquement lorsque le nombre aide à décider : visites, PDV, actions à relancer ;
- libellés courts, en casse phrase.

### Comportement

- un clic navigue vers une vraie route avec `NuxtLink` ;
- les filtres utiles sont conservés dans la query string ;
- l’onglet actif est calculé depuis `route.path` et `route.query.tab` ;
- le changement d’onglet ne réinitialise pas la période, le canal ou le territoire ;
- les pages directes et les retours navigateur sélectionnent automatiquement le bon onglet ;
- les onglets utilisent `aria-current="page"` ou `aria-selected="true"` selon le composant retenu.

## Plan technique

### Étape 1 — Créer un composant partagé

Créer `components/admin/AdminSectionTabs.vue` avec :

- `items: { label, to, count?, key? }[]` ;
- détection de l’onglet actif via `useRoute()` ;
- conservation contrôlée des paramètres de filtre ;
- scroll horizontal accessible ;
- style compatible avec les pages admin existantes.

Créer un registre de configuration, par exemple `utils/adminSectionTabs.ts`, afin de ne pas recopier les tableaux d’onglets dans chaque page.

### Étape 2 — Brancher les domaines sans changer leur métier

Ajouter le composant dans l’en-tête des pages Visites, Perfect Store, Visibilité, Concurrence, Produits et Actions.

Ne pas déplacer les tableaux, graphiques ou appels Supabase dans cette étape. Le changement doit être purement structurel et navigationnel.

### Étape 3 — Uniformiser les pages internes

- remplacer les liens isolés « retour au tableau de bord » par l’onglet actif et un fil d’Ariane court ;
- conserver les boutons d’export dans l’en-tête ;
- conserver les filtres au même niveau sous les onglets ;
- ajouter un état vide ou un message de données indisponibles dans chaque vue qui n’a pas encore de backend complet ;
- maintenir les pages de standards et de paramétrage séparées des pages de performance.

### Étape 4 — Cas particulier Produits

Les pages produits combinent une navigation par famille et une navigation par fonction. Il faut éviter deux barres concurrentes.

Proposition :

- première barre : Récapitulatif, Disponibilité, Inventaire, Seuils ;
- dans Disponibilité : sélecteur de famille EVAP / IMP / SCM / UHT, plutôt qu’une seconde barre de navigation globale ;
- les routes historiques `/admin/produits/evap`, etc. redirigent vers la vue Disponibilité avec `?category=evap`.

### Étape 5 — Cas particulier Actions

La page Actions est actuellement concentrée dans une seule page. Ajouter les onglets visuels dès maintenant, puis faire évoluer le contenu progressivement :

- Récapitulatif : taux par action ;
- Évolution : tendance journalière / hebdomadaire ;
- Détail par action : tableau filtrable des actions et PDV concernés.

La première version peut utiliser `?tab=` sans créer trois pages physiques.

### Étape 6 — Sidebar

La sidebar garde uniquement les domaines :

- Perfect Store ;
- Visites ;
- Visibilité ;
- Concurrence ;
- Produits ;
- Actions ;
- Réseau et Paramétrage.

Les sous-pages ne doivent plus être listées comme autant d’entrées concurrentes dans la navigation principale.

## États à prévoir

- onglet actif ;
- onglets avec compteur ;
- onglets désactivés si le droit d’accès manque ;
- chargement : conserver la barre d’onglets et afficher un skeleton sous celle-ci ;
- erreur : conserver l’onglet actif et afficher l’erreur dans le contenu ;
- mobile : défilement horizontal sans retour à la ligne ;
- route inconnue : retour à l’onglet de synthèse du domaine.

## Critères d’acceptation

- Chaque domaine possède une barre d’onglets cohérente.
- L’onglet actif est correct lorsqu’une URL est ouverte directement.
- Les filtres ne sont pas perdus au changement d’onglet.
- Les routes existantes continuent de fonctionner.
- Aucun nouvel écran ne dépend d’un lien `#`.
- La navigation clavier atteint chaque onglet et expose clairement l’état actif.
- Sur mobile, les onglets restent utilisables sans réduire le texte à une icône.
- Les pages Perfect Store et Disponibilité conservent la logique actuelle : niveau, manques, OSA GT, quantité + facings MT.

## Ordre recommandé

1. Composant partagé + registre de routes.
2. Visites et Perfect Store, car ce sont les parcours de décision prioritaires.
3. Visibilité et Concurrence.
4. Produits avec traitement spécifique de la famille produit.
5. Actions avec `?tab=`.
6. Nettoyage de la sidebar et vérification des droits RBAC.
