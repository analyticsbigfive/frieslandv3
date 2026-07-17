# Recommandations UX — app mobile

## Périmètre audité

Audit des écrans et composants mobiles existants :

- accueil / visites (`pages/mobile/index.vue`) ;
- création d’une visite (`pages/mobile/visites/new.vue` + `components/FormWizard.vue`) ;
- routing (`pages/mobile/routing.vue`) ;
- liste et détail des PDV ;
- carte, calendrier et contacts ;
- shell mobile et navigation (`layouts/mobile.vue` + `components/MobileBottomNav.vue`).

Les recommandations ci-dessous portent sur la hiérarchie, la densité, la navigation et les états d’interface. Elles ne proposent ni nouveau calcul, ni score, ni automatisation métier.

## Diagnostic synthétique

| Constat observé | Effet utilisateur | Priorité |
| --- | --- | --- |
| L’en-tête affiche en même temps retour, logo, titre, mode sombre, GPS, tournée, connexion, synchronisation et compte. | Les indicateurs concurrencent le titre et l’action de l’écran. | P0 |
| La barre basse contient 5 entrées, alors que Calendrier est accessible comme écran mais n’est pas dans cette navigation. | L’utilisateur doit deviner où retrouver certains écrans. | P0 |
| L’accueil empile progression, tournée GPS, mini-carte, recherche, filtres et liste. | La liste des visites — contenu principal — arrive tard. | P0 |
| Le formulaire de visite comporte 11 étapes : Général, EVAP, IMP, SCM, UHT, Yaourt, Céréales, Concurrence, Visibilité, Actions, Photos. | Le nombre d’étapes donne une impression de longueur et oblige à changer souvent de contexte. | P0 |
| `FormWizard` possède sa propre barre d’action fixe, en plus de la navigation mobile globale. | Risque de concurrence visuelle et de recouvrement au bas de l’écran. | P0 |
| La liste PDV combine recherche, tri, GPS, zones et création dans la même zone haute. | Trop de contrôles avant la première ligne de résultat. | P1 |
| La liste PDV limite le résultat à 50 éléments (`slice(0, 50)`) sans exposer de pagination ou de compteur. | Une partie de l’information peut sembler absente. | P1 |
| La carte superpose rayon, légende et statistiques sur la carte. | Les contrôles couvrent la zone utile, surtout sur petit écran. | P1 |
| Les détails PDV et visite utilisent plusieurs cartes successives avec le même poids visuel. | La lecture demande de parcourir des blocs équivalents avant de trouver l’action. | P1 |

## Plan recommandé

### Lot 1 — Clarifier le shell mobile

Objectif : rendre immédiatement visibles le titre, l’état de connexion et l’action principale.

- Conserver le header rouge et le retour contextuel.
- Remplacer les nombreux indicateurs par un seul état compact « État de l’app » ouvrant un panneau avec : connexion, synchronisations en attente, GPS et tournée en cours.
- Garder l’accès compte et mode sombre, mais les sortir de la ligne principale si la largeur est insuffisante.
- Garder quatre destinations principales dans la barre basse : Visites, Routing, PDV, Plus.
- Dans « Plus », rendre explicites Calendrier, Contacts et Carte. Aucun écran n’est supprimé ; les écrans secondaires sont simplement regroupés.

### Lot 2 — Recentrer l’accueil sur la prochaine action

Objectif : permettre de commencer ou reprendre une visite sans parcourir le tableau de bord.

- Afficher en premier le contexte « Aujourd’hui » et la prochaine action disponible.
- Conserver le compteur de visites et l’objectif de 10 visites, mais sous forme compacte sur une seule ligne.
- Garder la tournée GPS et la mini-carte, mais les présenter comme une section repliable ou secondaire.
- Placer la recherche et le filtre juste au-dessus de la liste.
- Conserver la création de visite avec le bouton principal en zone de pouce.

### Lot 3 — Simplifier la création de visite sans changer le contenu

Objectif : réduire la sensation de longueur sans perdre les étapes métier.

- Conserver les 11 étapes et tous leurs champs.
- Les regrouper visuellement en phases : Général ; Produits ; Concurrence & visibilité ; Actions & photos.
- Afficher « Étape X sur 11 » et l’état de chaque étape : vide, en cours, terminé, à vérifier.
- En mode création, masquer temporairement la barre de navigation principale : l’utilisateur reste dans le formulaire et récupère la navigation après annulation ou enregistrement.
- Garder une seule barre d’action basse : Annuler, Précédent et Suivant/Enregistrer.
- Conserver le brouillon automatique, les avertissements, le GPS, le hors-ligne, les photos et les règles de validation.
- Ne pas préremplir ou modifier des valeurs sans action explicite de l’utilisateur.

### Lot 4 — Uniformiser les listes et les filtres

Objectif : faire fonctionner les écrans mobiles avec le même modèle mental.

- Ligne 1 : recherche.
- Ligne 2 : bouton « Filtres » avec le nombre de filtres actifs ; les critères s’ouvrent dans un panneau bas.
- Ligne 3 : compteur de résultats et tri explicite.
- Ligne de résultat : information principale, contexte secondaire, statut, puis une action primaire.
- Pour les PDV, rendre visible le nombre de résultats affichés et prévoir « Charger la suite » ou une pagination avant toute mise en production de la limite à 50.
- Pour les visites, conserver date, GPS, synchronisation et indicateurs produits, mais déplacer les indicateurs secondaires derrière le détail si l’espace manque.

### Lot 5 — Donner une hiérarchie aux actions

Objectif : éviter que plusieurs boutons paraissent équivalents.

- Routing : mettre « Démarrer » ou « Remplir la visite » en action principale ; garder « Passer » et « Terminer » en action secondaire.
- PDV : mettre « Visiter » en action principale dans le détail ; laisser Modifier et Ouvrir dans Google Maps en actions secondaires.
- Visite : afficher le statut GPS et la synchronisation près du résumé, puis les détails produits, concurrence, actions et photos en sections lisibles.
- Carte : faire de l’ouverture d’un PDV l’action principale du panneau de détail ; conserver rayon, légende et compteurs dans un panneau contrôlable.

## Règles de non-régression

- Ne supprimer aucun champ de visite, catégorie produit, indicateur GPS, statut de synchronisation, objectif de routing, information PDV ou photo.
- Ne pas modifier les règles de géofence, le fonctionnement hors ligne, la synchronisation, les droits ou les calculs existants.
- Ne pas introduire de classement automatique, de recommandation métier ou de score supplémentaire.
- Ne pas cacher définitivement une information : les détails restent accessibles par une action explicite.
- Préserver les liens existants vers `/mobile`, `/mobile/pdv`, `/mobile/routing`, `/mobile/calendar`, `/mobile/map`, `/mobile/contacts` et `/mobile/visites/new`.

## Prototype livré

Le prototype associé illustre trois situations prioritaires avec les données et libellés déjà présents dans l’application :

1. accueil « Aujourd’hui » recentré sur la prochaine action ;
2. routing avec une action primaire par PDV ;
3. création de visite avec phases visuelles, tout en indiquant les 11 étapes existantes.

Fichier : `docs/prototypes/mobile-simplification.html`.

