---
name: Bonnet Rouge — back-office
description: Le back-office de FrieslandCampina Côte d'Ivoire pour piloter l'exécution terrain (Perfect Store, visites, planning, visibilité).
colors:
  bonnet-rouge: "#C8102E"
  bonnet-rouge-profond: "#9B0D23"
  bonnet-rouge-sombre: "#6E0919"
  bonnet-rouge-voile: "#FDE8EC"
  encre: "#0F172A"
  texte: "#334155"
  texte-secondaire: "#475569"
  texte-discret: "#64748B"
  trait: "#E2E8F0"
  trait-fort: "#CBD5E1"
  papier: "#FFFFFF"
  fond: "#F8FAFC"
  fond-appuye: "#F1F5F9"
  succes: "#047857"
  succes-voile: "#ECFDF5"
  alerte: "#B45309"
  alerte-voile: "#FFFBEB"
  erreur: "#B91C1C"
  erreur-voile: "#FEF2F2"
  niveau-flagship: "#104281"
  niveau-vip: "#256ABF"
  niveau-core: "#5598E7"
  niveau-basic: "#9EC5F4"
typography:
  titre-page:
    fontFamily: "Nunito Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
  titre-section:
    fontFamily: "Nunito Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  titre-carte:
    fontFamily: "Nunito Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  texte:
    fontFamily: "Nunito Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  etiquette:
    fontFamily: "Nunito Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  chiffre:
    fontFamily: "Nunito Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
rounded:
  segment: "4px"
  controle: "6px"
  carte: "8px"
  pastille: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  bouton-principal:
    backgroundColor: "{colors.bonnet-rouge}"
    textColor: "{colors.papier}"
    rounded: "{rounded.controle}"
    padding: "6px 10px"
    height: "32px"
  bouton-principal-survol:
    backgroundColor: "{colors.bonnet-rouge-profond}"
    textColor: "{colors.papier}"
  bouton-secondaire:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.texte}"
    rounded: "{rounded.controle}"
    padding: "6px 10px"
    height: "32px"
  bouton-secondaire-survol:
    backgroundColor: "{colors.fond}"
    textColor: "{colors.texte}"
  bouton-discret:
    backgroundColor: "transparent"
    textColor: "{colors.texte}"
    rounded: "{rounded.controle}"
    padding: "6px 10px"
  bouton-discret-survol:
    backgroundColor: "{colors.fond-appuye}"
    textColor: "{colors.encre}"
  champ:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.encre}"
    rounded: "{rounded.controle}"
    padding: "6px 10px"
    height: "32px"
  carte:
    backgroundColor: "{colors.papier}"
    rounded: "{rounded.carte}"
    padding: "16px"
  indicateur:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.encre}"
    typography: "{typography.chiffre}"
    rounded: "{rounded.carte}"
    padding: "16px"
  barre-filtres:
    backgroundColor: "{colors.papier}"
    rounded: "{rounded.carte}"
    padding: "16px"
  bouton-filtres:
    backgroundColor: "transparent"
    textColor: "{colors.texte}"
    typography: "{typography.etiquette}"
    rounded: "{rounded.controle}"
    padding: "0 12px"
    height: "36px"
  segment:
    backgroundColor: "transparent"
    textColor: "{colors.texte}"
    rounded: "{rounded.segment}"
    padding: "4px 10px"
  segment-actif:
    backgroundColor: "{colors.encre}"
    textColor: "{colors.papier}"
    rounded: "{rounded.segment}"
    padding: "4px 10px"
  menu-entree:
    backgroundColor: "transparent"
    textColor: "{colors.texte}"
    rounded: "{rounded.controle}"
    padding: "8px 12px"
    height: "40px"
  menu-entree-active:
    backgroundColor: "{colors.bonnet-rouge-voile}"
    textColor: "{colors.bonnet-rouge-sombre}"
    rounded: "{rounded.controle}"
    padding: "8px 12px"
    height: "40px"
  onglet:
    textColor: "{colors.texte-secondaire}"
    padding: "8px 12px"
    height: "40px"
  onglet-actif:
    textColor: "{colors.bonnet-rouge}"
    padding: "8px 12px"
    height: "40px"
  tableau-entete:
    backgroundColor: "{colors.fond}"
    textColor: "{colors.texte-secondaire}"
    typography: "{typography.etiquette}"
    padding: "12px 16px"
  tableau-cellule:
    textColor: "{colors.texte}"
    typography: "{typography.texte}"
    padding: "12px 16px"
  pastille:
    backgroundColor: "{colors.fond-appuye}"
    textColor: "{colors.texte}"
    rounded: "{rounded.pastille}"
    padding: "4px 10px"
  pastille-survol:
    backgroundColor: "{colors.bonnet-rouge-voile}"
    textColor: "{colors.bonnet-rouge-profond}"
---

# Design System: Bonnet Rouge — back-office

## Overview

**Creative North Star: "Le registre du chef de secteur"**

Le back-office est l'outil de bureau de ceux qui pilotent le terrain : responsables trade marketing, superviseurs, commerciaux, administrateurs, et les responsables d'agence avec un accès réduit. Ils l'ouvrent entre deux réunions pour répondre à une question précise (combien de PDV sont au niveau, qui n'a pas fait sa tournée, quel produit manque) puis le referment. Le système se comporte comme un registre bien tenu : des colonnes nettes, des chiffres alignés, des titres qui disent ce qu'on regarde, et une seule couleur qui appelle l'action.

La densité est standard, jamais tassée : les tableaux peuvent être longs, mais chaque écran répond d'abord à une question en haut de page, puis donne le détail. La marque vit dans le rouge Bonnet Rouge et dans la précision des détails, pas dans la décoration. Les fonds sont des gris-bleus froids (slate) ; les surfaces sont blanches, plates, bordées d'un trait d'un pixel. Le mot juste compte autant que la mise en page : on vouvoie l'utilisateur, on écrit en français courant suivi du sigle métier entre parenthèses, et un utilisateur non technique ne croise jamais un code interne, un identifiant ou un message de base de données.

Ce que le système refuse : les dégradés décoratifs, les ombres portées sur les cartes, le vert par défaut de Nuxt UI, les titres en capitales, les emojis et glyphes Unicode comme icônes, les menus à plus de deux niveaux. Les seuls dégradés présents sont fonctionnels : le fondu qui signale des onglets hors champ et le reflet des squelettes de chargement.

**Key Characteristics:**
- Une seule couleur d'action, le rouge Bonnet Rouge, sur fond slate froid.
- Surfaces blanches plates, trait de 1 px, aucune ombre hors des couches flottantes.
- Navigation à deux niveaux : un domaine dans le menu latéral (rangé sous quatre intitulés de famille), une vue dans la barre d'onglets.
- Une seule famille, Nunito Sans, en échelle fixe ; chiffres tabulaires partout.
- Français simple et vouvoyé, « français + sigle » ; le détail technique reste dans la console.

## Colors

Une palette retenue : un rouge de marque qui signifie « agir » ou « vous êtes ici », sur une gamme de gris-bleus froids, trois couleurs d'état réservées aux messages, et une échelle bleue ordonnée réservée aux niveaux Perfect Store.

### Primary
- **Rouge Bonnet Rouge** (`bonnet-rouge`) : bouton principal, onglet actif, anneau de focus, tri actif d'une colonne, première série d'un graphique, avatar du compte. Échelle Tailwind `brand` 50 à 950 dans `tailwind.config.ts`, branchée comme `primary` de Nuxt UI.
- **Rouge profond** (`bonnet-rouge-profond`, brand-600) : survol du bouton principal, icône de l'entrée de menu active, texte d'une pastille de filtre au survol.
- **Rouge sombre** (`bonnet-rouge-sombre`, brand-700) : texte de l'entrée de menu active sur voile rouge.
- **Voile rouge** (`bonnet-rouge-voile`, brand-50) : fond de l'entrée de menu active, compteur de filtres avancés, sélection de texte. Jamais en grand aplat.

### Tertiary : niveaux Perfect Store
- **Flagship** (`niveau-flagship`), **VIP** (`niveau-vip`), **Core** (`niveau-core`), **Basic** (`niveau-basic`) : une seule teinte bleue, du plus foncé (le niveau le plus haut) au plus clair. « Non conforme » prend le trait fort slate (#CBD5E1). Source : `NIVEAUX_PS` et `COULEUR_NON_CONFORME` dans `utils/chartPalette.ts`. Employée dans les graphiques, les pastilles de niveau (point de 8 à 10 px devant le mot) et le contrôle segmenté de la liste par niveau.

### Neutral
- **Encre** (`encre`, slate-900) : titres, chiffres clés, segment sélectionné, info-bulle des graphiques.
- **Texte** (`texte`, slate-700) : texte courant, cellules de tableau, libellés de bouton secondaire et discret, entrées de menu.
- **Texte secondaire** (`texte-secondaire`, slate-600) : en-têtes de colonne, phrase d'aide sous le titre, libellés d'indicateur, onglets inactifs, états vides, compteurs. C'est le gris de lecture le plus fréquent après le texte.
- **Texte discret** (`texte-discret`, slate-500) : intitulés de famille du menu, icônes inactives, axes des graphiques, gris « Autre ». 4,8:1 sur blanc, le minimum pour du texte.
- **Trait** (`trait`, slate-200) : bordures de carte, séparateurs de lignes, bordure de l'en-tête et du menu.
- **Trait fort** (`trait-fort`, slate-300) : bordures de champ, de bouton secondaire, de contrôle segmenté ; « Non conforme ».
- **Papier** (`papier`) : cartes, tableaux, menu latéral, en-tête.
- **Fond** (`fond`, slate-50) : fond de page, en-têtes de tableau, survol des lignes et du bouton secondaire.
- **Fond appuyé** (`fond-appuye`, slate-100) : survol des entrées de menu et des boutons discrets, pastilles neutres, squelettes de chargement, grille des graphiques.

### États
- **Succès** (`succes` sur `succes-voile`), **Alerte** (`alerte` sur `alerte-voile`), **Erreur** (`erreur` sur `erreur-voile`) : messages, pastilles de statut et d'évolution, envois en échec, actions réalisées. Toujours accompagnés d'un mot ou d'une icône.

### Graphiques
Palette unique dans `utils/chartPalette.ts` (valeurs dans le fichier compagnon) : huit séries catégorielles dans un ordre fixe qui commence par le rouge de marque, puis un gris « Autre » au-delà ; une couleur par famille de produits (`couleurFamille`), qui suit la famille et non son rang ; des couleurs de statut propres aux graphiques (`STATUT` : bon, alerte, sérieux, critique, neutre) ; axes et grille en slate (`AXES`, police 12 px).

### Named Rules
**The Red Means Act Rule.** Le rouge Bonnet Rouge signale une action ou la position courante, rien d'autre. Un seul bouton rouge plein par zone d'écran ; pas de rouge décoratif, pas de grand aplat rouge. Les actions secondaires (Exporter, Importer, Actualiser, Réinitialiser) sont neutres : `app.config.ts` redéfinit les variantes contour et discrète de `primary` en slate.

**The No Default Green Rule.** Nuxt UI prend `primary = brand` et `gray = slate` dans `app.config.ts`. Aucun composant ne doit retomber sur le vert par défaut.

**The One Gray Rule.** Une seule famille de gris : slate. Les classes `gray-*` de Nuxt UI suivent slate par configuration ; le back-office n'en écrit plus.

**The Ordered Scale Rule.** Une grandeur ordonnée (les niveaux Perfect Store) prend une seule teinte, du foncé au clair, jamais une palette catégorielle ; et le niveau s'écrit toujours en toutes lettres à côté de sa couleur.

**The Family Keeps Its Color Rule.** Une famille de produits garde sa couleur quel que soit le filtre ; au-delà de huit séries, on regroupe en « Autre » au lieu d'inventer une teinte.

## Typography

**Display Font:** Nunito Sans Variable (Google Fonts, auto-hébergée par `@fontsource-variable/nunito-sans` ; repli ui-sans-serif, system-ui)
**Body Font:** Nunito Sans Variable
**Label/Mono Font:** Nunito Sans Variable, chiffres tabulaires activés sur tout le corps

**Character:** Une seule famille humaniste, arrondie et lisible, qui porte titres, libellés, données et boutons. La hiérarchie vient de la taille et de la graisse, pas d'un changement de police.

### Hierarchy
- **Titre de page** (700, 1,5rem / 24px, 1,25, `text-wrap: balance`) : un seul h1 par page, en casse normale, rendu par `AdminPageHeader`. Sans titre fourni, il reprend celui de l'onglet courant dans `utils/adminNavigation.ts`.
- **Phrase d'aide** (texte, 14px, interligne 24px, texte secondaire, 48rem au plus) : sous le h1 ; par défaut la phrase `aide` de l'onglet.
- **Titre de section** (600, 1,125rem / 18px, 1,4) : h2 des blocs d'une page, titre d'une fenêtre modale.
- **Titre de carte** (600, 1rem / 16px, 1,5) : h3 d'un graphique, d'un tableau, d'un bloc de la fiche de visite.
- **Texte** (400, 0,875rem / 14px, 1,5) : texte courant, cellules, libellés de champ (500) et boutons (500).
- **Étiquette** (600, 0,75rem / 12px) : en-têtes de colonne, libellés d'indicateur, pastilles, intitulés de famille du menu. Casse normale.
- **Chiffre** (700, 1,5rem / 24px, interligne 1, tabulaire) : valeur d'un indicateur.

### Named Rules
**The 12-Pixel Floor Rule.** Aucun texte sous 12 px. Aucun `text-[10px]` ni `text-[11px]` dans le back-office.

**The No Shouting Rule.** Pas de titres ni d'en-têtes de colonne en capitales ; pas de sur-titre au-dessus du titre de page.

**The Fixed Scale Rule.** Échelle fixe en rem : pas de `clamp()` sur les titres du back-office.

**The French Plus Acronym Rule.** On écrit le mot français, puis le sigle métier entre parenthèses quand le terrain l'emploie : boutiques (GT), supermarchés (MT), vendeur du distributeur (SSF), fichier du distributeur (DMS), référence (SKU). Mêmes termes partout : écarts au standard, rayon de visite, zone commerciale, direction (South / North), point de vente (PDV). Le sigle seul n'apparaît que dans un espace contraint et déjà expliqué ailleurs sur l'écran.

**The Vous Rule.** On vouvoie l'utilisateur et on lui dit quoi faire : « Reconnectez-vous puis recommencez », « Élargissez les dates ». Les erreurs passent par `messageUtilisateur()` (`utils/supabaseErrors.ts`) : une phrase de cause, une action, jamais un code.

## Layout

Structure d'outil : menu latéral fixe de 256 px (barre d'icônes de 64 px une fois replié, tiroir avec voile slate-900 à 40 % sous 1 024 px), en-tête collant de 56 px avec le fil d'Ariane « Domaine › Vue » à gauche et, à droite, la présence terrain (« N en tournée »), les envois en attente ou en échec, « Aide » (le guide PDF), le mode sombre et le menu du compte (initiales sur pastille rouge). Puis la barre d'onglets du domaine et le contenu, dans une colonne de 1 600 px maximum. Marges de page 16 / 24 / 32 px (mobile / tablette / bureau), 20 puis 24 px en haut. Un lien « Aller au contenu » apparaît au premier Tab.

Chaque page suit le même ordre : titre, phrase d'aide et action principale ; filtres ; indicateurs ; contenu (graphiques puis tableaux). Les blocs sont espacés de 24 px, les grilles d'indicateurs de 12 à 16 px. Les tableaux larges défilent dans leur carte, jamais la page entière.

Les filtres vivent dans une barre blanche bordée : la période d'abord (contrôle segmenté jour / semaine / mois / personnalisé), puis quatre champs au plus par rangée ; les autres derrière « Plus de filtres » avec leur compteur. Les filtres actifs deviennent des pastilles qu'un clic retire. La géographie descend en cascade : direction, sous-région, territoire, zone commerciale, quartier.

### Named Rules
**The Two Levels Rule.** Deux niveaux de navigation, pas plus : un domaine du menu latéral, puis un onglet. Les quatre familles (Piloter, Terrain, Marché, Réglages) sont des intitulés, pas un niveau cliquable. Un registre unique, `utils/adminNavigation.ts`, alimente le menu, les onglets, le fil d'Ariane, le titre du navigateur et le contrôle d'accès. Une famille de produits, un canal ou une personne se choisissent avec un filtre ; une liste de référentiel se choisit dans une colonne de liste, pas dans une barre d'onglets de plus.

**The Question First Rule.** Le haut de chaque page répond à la question pour laquelle on l'ouvre ; le détail vient dessous.

**The Four Across Rule.** Au plus quatre indicateurs par rangée : une colonne sur mobile, deux dès 640 px, quatre à partir de 1 280 px. Un cinquième chiffre va dans le contenu, pas dans la rangée.

**The Access Shapes The Menu Rule.** On ne montre que ce qu'on peut ouvrir. L'accès se déclare par onglet (section de la matrice, `roles` qui restreint, `ouvertA` qui ouvre une page au-delà de la matrice) ; un domaine sans onglet ouvrable disparaît du menu, un onglet fermé disparaît de la barre. Le rôle Agence voit donc une navigation réduite : Planning (Tournées et Règles récurrentes) et, dans Paramètres, Référentiels, Versions de l'app et Import / Export. Le Planning s'y affiche en consultation : pas de bouton de création ni de menu d'actions, et une ligne précédée d'une icône d'œil dit où charger et corriger le routing.

## Elevation & Depth

Le système est plat. La profondeur vient du contraste entre le fond slate-50 et les surfaces blanches bordées, pas des ombres. Seules les couches qui flottent au-dessus du contenu portent une ombre (celles de Nuxt UI) ; les boutons gardent la trace d'ombre d'un pixel de Nuxt UI.

### Shadow Vocabulary
- **Fenêtre modale** (`box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`) : modales et confirmations.
- **Menu flottant** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`) : menus déroulants, listes d'autocomplétion, notifications.
- **Trace de bouton** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`) : boutons pleins et secondaires de Nuxt UI, à peine visible.

### Named Rules
**The Flat-By-Default Rule.** Cartes, tableaux, indicateurs, barres de filtres, menu et en-tête n'ont aucune ombre et ne bougent pas au survol. Le survol change une couleur de fond, jamais une position.

## Shapes

Des angles doucement arrondis et constants : 4 px pour les segments à l'intérieur d'un contrôle segmenté, 6 px pour les contrôles (boutons, champs, entrées de menu, pastille d'icône d'un indicateur), 8 px pour les cartes, barres de filtres et modales, pastilles et compteurs entièrement arrondis. Un trait de 1 px délimite chaque surface ; pas de barre colorée épaisse sur le côté d'une carte ni sur le bord d'une entrée de menu.

## Components

### Buttons
- **Shape:** angles de 6 px, 32 px de haut (taille `sm` de Nuxt UI, la taille par défaut), 500, 14 px ; `xs` en 12 px pour les actions de ligne.
- **Primary:** fond rouge Bonnet Rouge, texte blanc. Une seule action principale par zone.
- **Hover / Focus:** survol en rouge profond ; focus visible par un contour de 2 px rouge décalé de 2 px (règle globale `:focus-visible` de `main.css`, anneau `primary-500` sur les contrôles Nuxt UI).
- **Secondaire (variante contour):** fond blanc, trait slate-300, texte slate-700 ; survol slate-50.
- **Discret (variante ghost):** sans fond ni trait, texte slate-700 ; survol slate-100. Pour « Réinitialiser », « Annuler », « Fermer », « Effacer » et les actions de ligne.
- **Destructif:** discret en rouge pour retirer un élément d'une liste (avec un `aria-label` qui nomme l'élément) ; plein rouge seulement dans la fenêtre de confirmation.

### Contrôle segmenté
- **Style:** boîte blanche, trait slate-300, angles de 6 px, 2 px de marge intérieure ; segments de 12 px, 500, angles de 4 px. Segment choisi : fond encre, texte blanc. Les autres : texte slate-700, survol slate-100. `role="group"` avec un `aria-label`, `aria-pressed` sur chaque segment ; passe à la ligne sur petit écran.
- **Usage:** période (`PeriodFilter`), bascules d'affichage (liste ou carte, équipe), filtre de niveau Perfect Store (alors un point de couleur du niveau précède le mot). Le segment choisi reste neutre, jamais rouge : choisir une vue n'est pas une action.

### Chips
- **Filtre actif:** pastille slate-100, texte slate-700 12 px 500 ; toute la pastille est le bouton qui retire le filtre, avec une croix Heroicons ; survol en voile rouge et texte rouge profond.
- **Statut et évolution:** voiles d'état avec un libellé en clair ; l'évolution d'un indicateur porte une flèche dessinée et le pourcentage.
- **Niveau Perfect Store:** point de couleur du niveau puis le nom du niveau.
- **Compteur:** voile rouge, texte rouge profond, 12 px 600, sur le bouton « Plus de filtres ».

### Cards / Containers
- **Corner Style:** 8 px.
- **Background:** blanc.
- **Shadow Strategy:** aucune (voir Elevation & Depth).
- **Border:** 1 px slate-200.
- **Internal Padding:** 16 px (indicateurs, barres de filtres, blocs de la fiche de visite) ; 20 px pour les tuiles de mesure et les en-têtes de carte larges.

### Inputs / Fields
- **Style:** composants Nuxt UI en taille `sm` : fond blanc, trait slate-300, angles de 6 px, 32 px de haut, libellé au-dessus (14 px, 500), aide éventuelle dessous. Listes longues cherchables (« Rechercher… »). Placeholder qui dit la valeur par défaut : « Tous », « Toutes ».
- **Focus:** anneau de 2 px rouge Bonnet Rouge.
- **Error / Disabled:** message en rouge d'erreur sous le champ ; désactivé à 75 % d'opacité.

### Navigation
- **Menu latéral:** fond blanc, trait à droite, logo et « Bonnet Rouge » en rouge profond en tête. Intitulés de famille en étiquette slate-500. Entrée : 14 px 500, icône Heroicons 20 px slate-500, 40 px de haut, texte slate-700, survol slate-100. Entrée active : voile rouge, texte rouge sombre 600, icône rouge profond, `aria-current="page"`. Replié : icônes seules, `title` et `aria-label`, séparateurs à la place des intitulés.
- **Barre d'onglets:** sous l'en-tête, masquée si le domaine n'a qu'une vue. Onglet 14 px 500 slate-600, 40 px de haut ; survol souligné slate-300 ; actif souligné de 2 px rouge, texte rouge 600. Défile horizontalement, l'onglet actif est ramené dans le champ, un fondu couleur du fond signale les onglets cachés. Les filtres de l'URL suivent d'un onglet à l'autre.
- **Fil d'Ariane:** « Domaine › Vue » en 14 px, domaine slate-600 cliquable (souligné au survol), chevron Heroicons slate-400, vue en encre 600.

### Tableaux
- `.admin-table` : en-tête sur fond slate-50, étiquettes 12 px 600 slate-600 en casse normale ; cellules 14 px slate-700 ; 12 × 16 px de marge ; lignes séparées par un trait slate-200, survol slate-50. Les styles de cellule passent par `:where()`, donc un utilitaire posé sur la cellule (alignement à droite, marge d'un état vide) l'emporte. Nombres alignés à droite en chiffres tabulaires.
- `AdminTableEnhancer` ajoute à chaque tableau une barre d'outils (boutons de 32 px, 12 px 600, trait slate-300), un tri par colonne avec chevrons dessinés (slate-400 au repos, rouge une fois trié) et une rangée de filtres par colonne.
- Les identifiants internes ne s'affichent pas.

### Indicateur (signature)
`StatsCard` : carte blanche bordée de 16 px de marge ; libellé en étiquette slate-600, valeur en chiffre encre, sous-titre 12 px slate-600, pastille d'icône de 32 px à droite (slate par défaut, voile rouge, vert ou ambre selon le sens). La couleur ne teinte que la pastille d'icône, jamais la valeur. Évolution dans une pastille d'état suivie de « par rapport au mois dernier ».

### Chargement et états vides
- **Chargement:** `ChargementContenu` remplace l'état vide tant que les données n'arrivent pas : libellé qui dit ce qui se charge (« Chargement des tournées… ») avec icône qui tourne, puis squelettes slate-100 à reflet (cartes, lignes), ou fine barre rouge sous un champ. `role="status"`, animations coupées si l'utilisateur réduit les mouvements.
- **État vide:** une phrase en texte secondaire, centrée dans la carte ou la cellule, qui dit ce qui manque puis quoi faire : « Aucun point de vente actif. Ajoutez-en depuis l'onglet Liste. », « Aucun compte pour ces filtres. Élargissez le statut, la direction, l'employeur ou le rôle. ». Le chemin d'un autre écran s'écrit « Paramètres › Référentiels ».

### Fenêtres et confirmations
- **Fiche de visite (`VisitDetailModal`):** modale large (jusqu'à 1 024 px), titre au nom du point de vente, blocs en cartes plates (résultat Perfect Store avec point de niveau et mot, disponibilité par référence en tableau, visibilité, concurrence, actions réalisées, commentaire, photos cliquables avec focus visible).
- **Confirmation:** le titre nomme l'élément entre guillemets français et la question (« Retirer le rattachement de « X » ? »), le corps dit la conséquence en clair (« Il n'apparaîtra plus dans les listes ni dans les tournées. », « Cette suppression ne peut pas être annulée. »), le bouton répète le verbe.

### Named Rules
**The Named Confirmation Rule.** Toute confirmation nomme l'élément concerné et dit ce qui arrivera ensuite. « Êtes-vous sûr ? » seul n'est pas une confirmation.

**The Empty State Says What To Do Rule.** Chaque graphique, tableau et liste a un état vide qui dit pourquoi il est vide (période, filtres, rien de créé) et quelle action le remplit.

## Do's and Don'ts

### Do:
- **Do** réserver le rouge Bonnet Rouge aux actions principales, à la position courante et au focus.
- **Do** passer par `AdminPageHeader` pour l'unique h1 de chaque page, en casse normale, et déclarer tout nouvel écran dans `utils/adminNavigation.ts` (libellé, titre, phrase d'aide, accès).
- **Do** utiliser `.admin-surface` pour toute carte, `.admin-table` pour tout tableau, `.admin-toolbar` ou `DashboardFilters` pour les filtres.
- **Do** employer le contrôle segmenté neutre pour choisir une vue ou une période.
- **Do** afficher les niveaux Perfect Store avec `NIVEAUX_PS` : une teinte du foncé au clair, et toujours le mot.
- **Do** traduire chaque erreur technique avec `messageUtilisateur()` et garder le détail dans la console.
- **Do** nommer l'élément et la conséquence dans toute confirmation.
- **Do** donner à chaque graphique et à chaque tableau un état vide qui explique quoi faire, et un chargement qui dit ce qui se charge.
- **Do** écrire « français + sigle » et vouvoyer.

### Don't:
- **Don't** laisser un composant Nuxt UI sans couleur retomber sur le vert par défaut.
- **Don't** ajouter un troisième niveau de navigation (onglets dans des onglets, pastilles de section au-dessus d'onglets).
- **Don't** mettre plus de quatre indicateurs sur une rangée.
- **Don't** colorer en rouge le segment choisi d'un contrôle segmenté.
- **Don't** utiliser une palette catégorielle pour les niveaux Perfect Store, ni la couleur seule pour dire un niveau ou un statut.
- **Don't** utiliser d'emoji ni de caractère Unicode (✓, ▲, ⌕) comme icône : Heroicons, avec un texte pour lecteur d'écran.
- **Don't** afficher un identifiant interne, un code de migration, un nom de table ou un message brut de la base.
- **Don't** mettre d'ombre ou de déplacement au survol sur une carte.
- **Don't** écrire sous 12 px ni en capitales pour les titres et en-têtes.
- **Don't** montrer à un rôle un bouton qu'il ne peut pas utiliser : en lecture seule, l'action disparaît et une ligne dit où agir.
