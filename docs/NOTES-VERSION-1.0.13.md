# Notes de version — 10 octobre 2026

Application mobile **1.0.13** (versionCode 16) et back-office web.

## Texte court pour la publication de l'application

À coller dans Paramètres › Versions de l'app › Publier une version (champ « Message ») :

> Version 1.0.13 : « Ma semaine » affiche votre lieu et votre SSF de chaque jour, d'après le routing du mois de votre agence. Le coaching propose le vendeur du distributeur dans une liste et ne montre que ses points de vente. Corrections diverses.

## Application mobile (téléphones)

**Merchandisers d'agence (Atom, agence North)**
- « Ma semaine (SSF) » suit le routing du mois préparé par l'agence : pour chaque jour, le lieu de visite et le vendeur du distributeur (SSF) qui accompagne.
- Sans routing chargé, l'écran l'explique : « Le routing du mois (lieux et SSF) est préparé par votre agence ».

**Commerciaux : coaching terrain**
- Le vendeur coaché se choisit dans la liste des vendeurs (SSF) du distributeur. « Autre vendeur » permet toujours de saisir un nom.
- Une fois le vendeur choisi, la liste des points de vente se limite à ses clients.
- Nouveau champ « Objectif du coaching », quand des objectifs sont définis dans les référentiels.
- Commercial Modern Trade : un message annonce le coaching dédié aux supermarchés, proposé dès que sa grille sera chargée.

**Pour tous**
- À la connexion, le profil charge l'agence et la direction du compte. Les écrans et les tournées s'affichent avec le bon périmètre dès l'ouverture.

## Back-office web

**Navigation plus simple**
- Deux niveaux partout : le menu à gauche, puis les onglets de la page. Plus de sous-onglets.
- Chaque rôle ne voit que les écrans qu'il peut ouvrir. Un écran refusé ramène à sa page d'accueil avec un message.
- Référentiels : une liste à gauche avec une recherche, la liste choisie à droite.

**Perfect Store : les chiffres sont enfin calculés**
- La disponibilité, la présence et l'assortiment restaient à 0 % : le calcul ne lisait que des quantités, presque jamais saisies. Il lit désormais les cases cochées pendant la visite.
- Règle : une référence est disponible quand « Disponible » est coché sans « En rupture ». Elle est présente quand « Présent » ou « Disponible » est coché.
- Toutes les visites ont été recalculées. Sur les visites avec relevé, la disponibilité moyenne est de 53,6 %.
- Aucun point de vente n'atteint encore un niveau : le standard exige 100 % des éléments de visibilité.

**Fiche d'une visite et produits**
- La fiche montre la disponibilité et le prix relevés pour chaque référence, au lieu de quantités à 0. « Présent » seul s'affiche « Présent, pas disponible ».
- Produits › Disponibilité : la part des visites où chaque référence était disponible est juste (elle sortait presque toujours « En rupture »).
- Délice (15 g et 350 g) : les relevés importés à tort comme « En rupture » ont été corrigés.

**Planning**
- Nouvel onglet « Routing du mois » (administrateur et agence) : les trois étapes du fichier mensuel, avec un exemple à télécharger.
- Le commercial consulte les tournées et les règles des merchandisers de son équipe, sans pouvoir les modifier.
- Le compte agence ne voit et ne charge que les merchandisers de son agence.

**Fiabilité**
- Un chargement qui échoue affiche sa cause et un bouton « Réessayer », au lieu de zéros.
- Une session expirée est annoncée, et la reconnexion ramène à la page en cours.
- Les messages de confirmation et d'erreur (notifications) s'affichent de nouveau.
- Les suppressions et les actions lourdes demandent une confirmation qui nomme l'élément.
- Carte des points de vente : de nouveau cadrée sur la Côte d'Ivoire, avec tous les points. Les fiches aux coordonnées fausses sont signalées.

**Lisibilité**
- Charte Bonnet Rouge (rouge réservé aux actions), une seule palette pour les graphiques.
- Mode sombre lisible : contrastes, focus clavier et graphiques.
- Pages utilisables sur téléphone et tablette (rien ne dépasse à 375 px).

**Guides**
- Guides PDF réécrits pour la nouvelle navigation, avec captures d'écran (noms remplacés par des noms fictifs) : docs/guides/.

## À savoir

- Aucune visite n'a été saisie dans l'application depuis le 30 septembre.
- Les 10 080 visites Atom importées n'ont pas de relevé produit. Elles comptent encore pour 0 % dans les moyennes Perfect Store (correction proposée, à décider).
