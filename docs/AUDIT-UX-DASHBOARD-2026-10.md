# Audit du back-office : prise en main par des utilisateurs non techniques

*9 octobre 2026 · application 1.0.12 · branche `jl/dashboard-ux`*

Ce document fait le point sur le back-office (`/admin`) avant sa refonte : ce qui gêne un utilisateur qui n'est pas informaticien, par ordre de gravité, et ce que la refonte corrige. Il s'appuie sur trois examens indépendants menés le même jour :

- une **revue de conception** écran par écran, avec quatre parcours types (responsable trade marketing, commercial, responsable d'agence, administrateur occasionnel), sur le site réel à 1440 px et 375 px ;
- un **détecteur automatique** de défauts visuels (impeccable) passé sur les 46 pages et les composants partagés ;
- un **audit technique** : accessibilité, performance, cohérence des couleurs, affichage mobile, solidité de l'ensemble.

## En bref

| Examen | Note | Lecture |
|---|---|---|
| Ergonomie (10 critères de Nielsen) | **17 / 40** | En dessous de la moyenne des outils métier (20 à 32). |
| Charge mentale (8 critères) | **4 échecs, 3 partiels** | Élevée : trop de choix à chaque écran, trop de choses à retenir. |
| Audit technique (5 critères) | **8 / 20** | Faible : la base fonctionne, mais l'ensemble manque de cohérence. |
| Détecteur automatique | **87 signalements** | Surtout des textes trop petits (10 et 11 px) et des couleurs hors charte. |

Le back-office fait beaucoup de choses justes sur le fond : il distingue la présence de la disponibilité, montre le nombre avant le pourcentage, simule les imports avant de les appliquer et permet de les annuler. Mais il parle la langue de ses développeurs, empile jusqu'à quatre niveaux de menus, et laisse des actions lourdes (recalcul de toutes les visites, suppression d'une visite, désactivation d'un compte) sans garde-fou.

## Les 10 problèmes, du plus grave au moins grave

### 1. Le compte agence ne peut pas faire le travail pour lequel il a été créé
Le rôle « agence » (Atom) sert à charger et corriger le routing mensuel de ses merchandisers. Aujourd'hui, l'écran d'import n'est visible que par un administrateur, le Planning lui est caché, les liens « Corriger dans les référentiels » le renvoient sans explication, et la page Activité lui affichera des zéros avec un message technique (« Exécutez les migrations Supabase »). La page Permissions n'a même pas de colonne pour ce rôle.
**Correction :** le menu et les onglets se construisent selon le rôle ; l'agence voit Vue d'ensemble, Activité, Planning (en lecture), Visites, et trois écrans de Paramètres (Référentiels réduits au routing mensuel et aux alias de quartier, Import / Export réduit au routing mensuel, Versions de l'app). La page Permissions gagne la colonne Agence.

### 2. Jusqu'à quatre niveaux de menus, et des écrans en double
Pour publier une version de l'application, il faut passer par Paramètres, puis l'onglet Référentiels, puis la pastille « Application mobile », puis le dixième sous-onglet : trois rangées de navigation visibles en même temps. Les produits ajoutent des onglets dans les onglets (EVAP › Disponibilités / Prix / Récapitulatif), les standards cinq onglets locaux, le Planning des onglets à emojis puis des bascules par personne. Le groupe « Principal » du menu compte huit liens, dont deux « Programme merchandiser… » coupés de la même façon. Les standards Perfect Store se modifient à deux endroits, les versions de l'application aussi.
**Correction :** deux niveaux, jamais plus : un domaine dans le menu, une vue dans la barre d'onglets. Le menu est regroupé en quatre familles (Piloter, Terrain, Marché, Réglages). Les familles de produits deviennent un filtre, les listes de référence une colonne de liste avec recherche, les standards une seule page en sections, le Planning deux onglets et une bascule d'affichage.

### 3. Des mots de développeur partout
SSF, DMS, OSA pondérée, Hero SKU, GT/MT, Area, géofence, versionCode, « (Système B) », « KPIs », « gaps », « template », des identifiants internes (`97528ce3`) dans les tableaux, et une dizaine de messages qui demandent de « lancer les migrations ». 49 messages d'erreur affichent le texte brut de la base de données. Le tutoiement et le vouvoiement se mélangent.
**Correction :** une passe de rédaction en français simple, au vouvoiement ; un glossaire (dans le guide et sous forme d'aides au survol) ; tous les messages d'erreur passent par une traduction qui dit ce qui s'est passé et quoi faire, sans jamais montrer de SQL.

### 4. Des actions lourdes sans garde-fou
« Recalculer toutes les visites » (environ 26 000 visites réécrites) part d'un clic, sans confirmation. Supprimer une visite efface définitivement l'historique et le bouton est proposé à tous les rôles, commerciaux en lecture seule compris. Supprimer un PDV demande « Supprimer ce PDV ? » sans dire lequel. Désactiver un utilisateur se fait en un clic, sans confirmation ni message. L'import CSV des PDV écrit directement, sans aperçu.
**Correction :** une confirmation qui nomme l'élément et la conséquence ; « Supprimer une visite » réservé aux rôles autorisés ; message après chaque désactivation ; aperçu avant import.

### 5. La page d'accueil ne répond pas à la question qu'on se pose
La première chose affichée est un grand « 0 » Perfect Store et une liste vide ; les 1 962 points de vente non conformes ne sont qu'un nombre gris. Le « pourquoi » (critères manquants) arrive au dixième bloc sur onze, à près de 5 000 pixels de défilement. Les chiffres se contredisent d'un écran à l'autre (la disponibilité EVAP vaut 0 %, 15,8 % ou 64,3 % selon la page et la période par défaut).
**Correction :** la page commence par ce qui est à traiter, quatre indicateurs au plus, un seul bloc ouvert à la fois ; même période par défaut partout.

### 6. Trois couleurs principales au lieu d'une
Faute de réglage, la bibliothèque d'interface applique son vert par défaut : 115 boutons sur 151 sont verts (« Filtrer », « Enregistrer », pagination, cases à cocher, anneaux de focus) à côté des boutons rouges de la marque. On compte sept styles de bouton principal, cinq styles de carte, deux familles de gris et sept palettes de graphiques. Un « prix respecté » est affiché en rouge ; une icône euro sert pour des prix en FCFA.
**Correction :** rouge Bonnet Rouge pour l'action et la position courante, une seule famille de gris, une seule palette de graphiques (vérifiée pour les daltoniens), des statuts toujours accompagnés d'un mot.

### 7. Deux titres par page, et des pages qui annoncent autre chose
L'en-tête affiche « Dashboard » sur l'accueil comme sur Activité, puis la page ajoute son propre titre. 21 pages écrivent leur titre à la main, en capitales (« PRODUITS — EVAP »).
**Correction :** l'en-tête affiche un fil d'Ariane « Domaine › Vue », chaque page a un seul titre, en casse normale.

### 8. Un accès refusé ne dit rien
Les onglets ne tiennent pas compte du rôle : un superviseur voit « Utilisateurs » ou « Permissions », clique, et se retrouve sur l'accueil sans explication.
**Correction :** chaque rôle ne voit que ce qu'il peut ouvrir ; un lien direct vers un écran fermé affiche « Vous n'avez pas accès à… ».

### 9. Textes trop petits, contrastes trop faibles
58 textes en 10 ou 11 px, 229 textes gris clair à environ 2,6:1 de contraste (le minimum lisible est 4,5:1), statut d'un utilisateur indiqué par une seule pastille de couleur, 50 boutons « … » sans nom pour les lecteurs d'écran, des étiquettes blanches sur vert ou orange à 2 à 3:1.
**Correction :** 12 px minimum, gris lisibles (4,8:1 au moins), statuts écrits en toutes lettres, boutons nommés.

### 10. Sur téléphone et petit portable
À 375 px, l'accueil déborde de 69 px et le Planning de 388 px (défilement horizontal) : le choix de période et la rangée « Modèle Excel / Importer / Exporter / Nouveau routing » ne passent pas à la ligne, et la barre d'onglets déborde sans indice qu'il y a d'autres onglets. Le tableau des visites (14 colonnes) défile même sur un écran de 1440 px.
**Correction :** filtres qui passent à la ligne, fondu au bord des onglets qui défilent, tableaux qui défilent dans leur carte.

## Parcours par rôle

| Qui | Ce qu'il veut faire | Ce qui bloque aujourd'hui |
|---|---|---|
| **Aminata**, responsable trade marketing, première utilisation | Savoir quels magasins de sa zone sont sous le standard ce mois-ci, et pourquoi | L'accueil liste les magasins qui sont au niveau, pas les autres ; le « pourquoi » est en bas de page ; « Quartier », « Territoire », « Division » : laquelle est sa zone ? ; « Analyse des gaps » en anglais. |
| **Koffi**, commercial, consultation | Vérifier les visites de la semaine de ses merchandisers | 14 colonnes ; la colonne « Commercial » liste des merchandisers ; un bouton vert « Filtrer » inutile ; « Supprimer » lui est proposé ; pas de vue « mon équipe ». |
| **Elias**, responsable d'agence (Atom) | Charger et corriger le routing du mois | Aucun accès à l'import ; écarts visibles mais sans moyen de les corriger ; onglets Perfect Store qu'il ne peut pas ouvrir ; zéros et message technique sur Activité. |
| **Administrateur occasionnel** | Ajouter un utilisateur, corriger une liste, publier une version | Paramètres s'ouvre sur « Régions » ; Utilisateurs est le 4ᵉ onglet sur 8 ; boutons qui passent sous la recherche ; publier une version est au 4ᵉ niveau. |

## Jargon relevé (à expliquer ou remplacer)

| Terme affiché | Sens | Traitement |
|---|---|---|
| SSF | Vendeur du distributeur (Sales Force du distributeur) | Expliqué au survol et dans le glossaire ; « vendeur » dans les phrases. |
| DMS | Logiciel de gestion du distributeur, d'où viennent les portefeuilles clients | Glossaire ; « fichier du distributeur » dans les phrases. |
| GT / MT | Commerce traditionnel (boutiques) / grande distribution (supermarchés) | « boutiques » / « supermarchés », sigle entre parenthèses. |
| SKU, Hero SKU | Référence produit, référence prioritaire | « référence », « référence prioritaire ». |
| OSA pondérée | Taux de disponibilité en rayon | « disponibilité en rayon ». |
| Gaps | Écarts au standard | « écarts au standard ». |
| Géofence | Rayon autour du point de vente dans lequel la visite est valide | « rayon de visite ». |
| Area, Code area | Quartier commercial | « quartier ». |
| Division (North/South) | Direction commerciale | « direction ». |
| Field coaching | Accompagnement terrain | « coaching terrain ». |
| versionCode, Système B, BIG FIVE KPI, migrations | Termes internes | Retirés de l'interface. |

## Ce que la refonte corrige, et ce qui reste technique

**Corrigé par la refonte :** les doublons (versions de l’app gérées à un seul endroit, listes couvertes par les Standards retirées des Référentiels), la navigation à deux niveaux construite selon le rôle (agence comprise), les couleurs et composants unifiés, le titre unique, le fil d'Ariane, les messages d'erreur, le jargon visible, les confirmations des actions lourdes, les états vides des graphiques, les textes trop petits, l'affichage à 375 px, l'aide accessible depuis l'en-tête et le guide réécrit.

**À décider ensuite, hors de cette refonte :** une page d'accueil propre à chaque rôle (« à traiter » pour le trade marketing, « mon équipe cette semaine » pour le commercial, « mon routing du mois » pour l'agence), la fusion d'Activité et du Perfect Store dans un dictionnaire unique des indicateurs, le regroupement des onglets Visibilité intérieure boutiques / supermarchés.

**Reste technique (équipe de développement) :** l'application des migrations de base de données, la maintenance des tâches planifiées, la publication du fichier APK, les imports en masse hors des écrans prévus.

## Annexes

### Notes de la revue de conception (critères de Nielsen)

| # | Critère | Note | Constat principal |
|---|---|---|---|
| 1 | L'état du système est visible | 2 | Chargements et progression du recalcul bien montrés, mais « 0 visite » affiché pendant le chargement, refus d'accès silencieux, chiffres de l'en-tête incohérents. |
| 2 | Le langage est celui de l'utilisateur | 1 | SSF, DMS, OSA, GT/MT, géofence, identifiants et codes bruts. |
| 3 | L'utilisateur garde la main | 2 | Annulation des imports terrain ; suppressions définitives ailleurs ; permissions enregistrées dès le clic. |
| 4 | Cohérence | 1 | Trois chiffres EVAP différents, deux titres par page, cinq styles d'onglets, boutons verts et rouges. |
| 5 | Prévention des erreurs | 2 | Vérifications de l'APK et simulation d'import excellentes ; recalcul global sans confirmation. |
| 6 | Reconnaître plutôt que se souvenir | 2 | Chemins à retenir écrits en texte (« Référentiels › Application mobile › … »). |
| 7 | Souplesse et efficacité | 2 | Filtres conservés dans l'URL, exports partout ; pas de sélection multiple ni de vue d'équipe. |
| 8 | Sobriété | 2 | Accueil de 8 757 px et 11 blocs, 12 camemberts sur la synthèse produits. |
| 9 | Aide à corriger les erreurs | 1 | 49 messages bruts, une dizaine mentionnant les migrations. |
| 10 | Aide et documentation | 2 | Bonnes aides dans les formulaires ; pas de glossaire, guides non reliés à l'interface. |
| | **Total** | **17 / 40** | |

### Audit technique

| # | Critère | Note | Constat principal |
|---|---|---|---|
| 1 | Accessibilité | 2 | Anneau de focus présent mais vert sur les composants ; 50 boutons sans nom ; statut par la couleur seule ; contrastes et tailles insuffisants ; onglets sans rôle ARIA. |
| 2 | Performance | 2 | Pages très longues qui chargent tout ; toutes les visites de la période calculées dans le navigateur ; barre d'outils de tableau ajoutée à chaque tableau. |
| 3 | Couleurs et thèmes | 1 | Vert par défaut de la bibliothèque, deux familles de gris (1 436 emplois de `gray`), sept palettes de graphiques, alias « bleu » qui est rouge, graphiques sans mode sombre. |
| 4 | Affichage sur petits écrans | 2 | Débordement de 69 px à 375 px, barres d'actions qui ne passent pas à la ligne, onglets qui débordent sans indice. |
| 5 | Cohérence de l'ensemble | 1 | Menu décrit dans quatre listes qui ne concordent plus, sept boutons principaux, cinq cartes, 21 titres faits main, écrans en double. |
| | **Total** | **8 / 20** | |

### Détecteur automatique (avant)
87 signalements sur 30 fichiers : 59 tailles de texte hors échelle (10 et 11 px), 23 couleurs hors charte (légendes de carte, axes de graphiques), 2 rayons d'angle, 1 palette générique, 2 faux positifs (classes conditionnelles fusionnées). Rapport brut conservé hors du dépôt.

Sur le site, le même détecteur injecté dans la page relève 36 défauts sur l'accueil, 61 sur la liste des PDV (dont 59 contrastes trop faibles, surtout les identifiants internes en gris clair sous chaque nom), 46 sur le Planning et 11 sur les Référentiels. Mesures : deux titres h1 sur chaque page ; couleur principale de la bibliothèque = vert ; contour de focus vert sur les boutons pleins, la pagination et le lien d'évitement ; boutons « Export », « Import CSV », « Réinitialiser » en vert à 2,3:1.

### Avant / après

Mesures du 9 octobre (avant) et du 10 octobre 2026 (après la refonte et la seconde critique), mêmes méthodes : deux examens indépendants, détecteur, navigateur sur le site réel.

| Mesure | Avant | Après |
|---|---|---|
| Ergonomie (10 critères de Nielsen) | 17 / 40 | **22 / 40** |
| Audit technique (5 critères) | 8 / 20 | **13 / 20** |
| Détecteur, pages du back-office | 87 signalements sur 30 fichiers | **0** (1 avis sur une ombre en mode sombre) |
| Niveaux de navigation | jusqu'à 4 (Référentiels : pastilles puis 44 onglets ; Planning : onglets, bascule, bascule par personne) | **2 partout** (menu, puis onglets) |
| Listes qui décrivent le menu | 4, qui ne concordaient plus | **1 registre** (`utils/adminNavigation.ts`), testé pour les 5 rôles |
| Titres h1 par page | 2 | **1** sur les 51 adresses vérifiées |
| Couleur principale de la bibliothèque | vert | **rouge Bonnet Rouge** (#C8102E) |
| Familles de gris dans les pages | `gray` (1 436 emplois) et `slate` | **slate seul** |
| Palettes de graphiques | 7 | **1** (`utils/chartPalette.ts`) |
| Textes de 10 et 11 px | 59 | **0** |
| Messages d'erreur bruts (SQL, migrations) | 49 | **0** dans le back-office |
| Accès refusé | renvoi silencieux | renvoi vers la page d'accueil du rôle, avec « Vous n'avez pas accès à… » |
| Actions lourdes sans confirmation | recalcul global, désactivation d'un compte, import CSV, suppression d'une visite | **confirmations qui nomment l'élément et la conséquence** |
| Débordement à 375 px | 69 px | **0** sur les 46 écrans (et 0 à 768 et 1 024 px) |
| Focus clavier | vert sur les composants | **rouge, visible sur 100 % des éléments testés** |
| Accueil Perfect Store | 8 757 px, 6 indicateurs, 11 blocs | environ 5 400 px, 4 indicateurs, « à traiter » en premier |
| Synthèse produits | 12 camemberts | 1 tableau à barres |
| Compte agence | inutilisable (administrateur ou rien) | menu réduit, routing chargeable et corrigeable, Planning en consultation |
| Fiche d'une visite | quantités à 0 pour presque toutes les visites | disponibilité et prix relevés ; « aucun relevé » dit clairement |
| Guides | sans capture, droits du superviseur faux, mot de passe en clair | réécrits pour la nouvelle navigation, sans identifiant |

**Traités après la seconde critique (10 octobre)** : un échec de chargement s'affiche avec sa cause et « Réessayer » ; « Non évalué » est distinct de « Non conforme » ; mode sombre (bouton principal 5,9:1, focus, axes des graphiques) ; « Tous » et les textes indicatifs à 4,8:1 ; les confirmations natives remplacées ; session expirée annoncée ; notifications (toasts) enfin affichées ; onglet Planning › Routing du mois pour l'agence ; le commercial consulte les tournées de son équipe. Perfect Store : la disponibilité, la présence et l'assortiment lisent désormais les statuts des relevés (0 % avant, 53,6 % de disponibilité sur les visites avec relevé).

**Restent à décider** : les 10 080 visites Atom sans relevé produit comptent 0 % au lieu de « non évaluées » ; le bloc « Passer au niveau supérieur » dépasse le délai au-delà d'un mois ; aucun point de vente n'atteint un niveau Perfect Store tant que la visibilité exige 100 % des éléments du standard.