---
name: Bonnet Rouge — back-office
description: Le back-office de FrieslandCampina Côte d'Ivoire pour piloter l'exécution terrain (Perfect Store, visites, planning, visibilité).
colors:
  bonnet-rouge: "#C8102E"
  bonnet-rouge-profond: "#9B0D23"
  bonnet-rouge-voile: "#FDE8EC"
  encre: "#0F172A"
  texte: "#334155"
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
  erreur: "#DC2626"
  erreur-voile: "#FEF2F2"
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
  etiquette:
    fontFamily: "Nunito Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.01em"
  chiffre:
    fontFamily: "Nunito Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: "tnum"
rounded:
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
    padding: "8px 14px"
    height: "36px"
  bouton-principal-survol:
    backgroundColor: "{colors.bonnet-rouge-profond}"
    textColor: "{colors.papier}"
  bouton-secondaire:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.texte}"
    rounded: "{rounded.controle}"
    padding: "8px 14px"
    height: "36px"
  bouton-discret:
    backgroundColor: "transparent"
    textColor: "{colors.texte}"
    rounded: "{rounded.controle}"
    padding: "8px 10px"
  champ:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.encre}"
    rounded: "{rounded.controle}"
    padding: "8px 12px"
    height: "36px"
  carte:
    backgroundColor: "{colors.papier}"
    rounded: "{rounded.carte}"
    padding: "20px"
  menu-entree-active:
    backgroundColor: "{colors.bonnet-rouge-voile}"
    textColor: "{colors.bonnet-rouge-profond}"
    rounded: "{rounded.controle}"
    padding: "8px 12px"
  onglet-actif:
    textColor: "{colors.bonnet-rouge}"
    padding: "10px 12px"
  pastille:
    backgroundColor: "{colors.fond-appuye}"
    textColor: "{colors.texte}"
    rounded: "{rounded.pastille}"
    padding: "2px 10px"
---

# Design System: Bonnet Rouge — back-office

## Overview

**Creative North Star: "Le registre du chef de secteur"**

Le back-office est l'outil de bureau de ceux qui pilotent le terrain : responsables trade marketing, superviseurs, commerciaux, responsables d'agence. Ils l'ouvrent entre deux réunions pour répondre à une question précise (combien de PDV sont au niveau, qui n'a pas fait sa tournée, quel produit manque) puis le referment. Le système se comporte comme un registre bien tenu : des colonnes nettes, des chiffres alignés, des titres qui disent ce qu'on regarde, et une seule couleur qui appelle l'action.

La densité est standard, jamais tassée : les tableaux peuvent être longs, mais chaque écran répond d'abord à une question en haut de page, puis donne le détail. La marque vit dans le rouge Bonnet Rouge et dans la précision des détails, pas dans la décoration. Les fonds sont des gris-bleus froids (slate) ; les surfaces sont blanches, plates, bordées d'un trait d'un pixel. Le mot juste compte autant que la mise en page : un utilisateur non technique ne doit jamais croiser un code interne, un identifiant ou un message de base de données.

Ce que le système refuse : les dégradés décoratifs, les ombres portées sur les cartes, le vert par défaut de Nuxt UI, les titres en capitales, les emojis comme icônes, les menus à plus de deux niveaux.

**Key Characteristics:**
- Une seule couleur d'action, le rouge Bonnet Rouge (#C8102E), sur fond slate froid.
- Surfaces blanches plates, trait de 1 px (#E2E8F0), aucune ombre hors des couches flottantes.
- Navigation à deux niveaux : un domaine dans le menu latéral, une vue dans la barre d'onglets.
- Une seule famille, Nunito Sans, en échelle fixe ; chiffres tabulaires.
- Français simple partout ; le détail technique reste dans la console.

## Colors

Une palette retenue : un rouge de marque qui signifie « agir » ou « vous êtes ici », sur une gamme de gris-bleus froids, avec trois couleurs d'état réservées aux messages.

### Primary
- **Rouge Bonnet Rouge** (#C8102E) : bouton principal, entrée de menu et onglet actifs, anneau de focus, première série d'un graphique. Texte blanc dessus : 5,9:1.
- **Rouge profond** (#9B0D23) : survol du bouton principal, texte de l'entrée de menu active sur voile rouge.
- **Voile rouge** (#FDE8EC) : fond de l'entrée de menu active et des éléments sélectionnés. Jamais en grand aplat.

### Neutral
- **Encre** (#0F172A, slate-900) : titres de page et de section, chiffres clés.
- **Texte** (#334155, slate-700) : texte courant, cellules de tableau, libellés de bouton secondaire.
- **Texte discret** (#64748B, slate-500) : aides, légendes, en-têtes de colonne. 4,8:1 sur blanc, le minimum autorisé pour du texte.
- **Trait** (#E2E8F0, slate-200) : bordures de carte, séparateurs de lignes.
- **Trait fort** (#CBD5E1, slate-300) : bordures de champ et de bouton secondaire.
- **Papier** (#FFFFFF) : cartes, tableaux, menu latéral, en-tête.
- **Fond** (#F8FAFC, slate-50) : fond de page ; en-têtes de tableau.
- **Fond appuyé** (#F1F5F9, slate-100) : survol des lignes et des entrées de menu, pastilles neutres.

### États
- **Succès** (#047857 sur #ECFDF5), **Alerte** (#B45309 sur #FFFBEB), **Erreur** (#DC2626 sur #FEF2F2) : messages, pastilles de statut, écarts au standard. Toujours accompagnés d'un mot ou d'une icône, jamais la couleur seule.

### Named Rules
**The Red Means Act Rule.** Le rouge Bonnet Rouge signale une action ou la position courante, rien d'autre. Un seul bouton rouge plein par zone d'écran ; pas de rouge décoratif, pas de grand aplat rouge.

**The No Default Green Rule.** Nuxt UI prend `primary = brand` et `gray = slate` dans `app.config.ts`. Aucun composant ne doit retomber sur le vert par défaut.

**The One Gray Rule.** Une seule famille de gris : slate. `gray-*` n'est plus employé dans le back-office.

## Typography

**Display Font:** Nunito Sans Variable (repli ui-sans-serif, system-ui)
**Body Font:** Nunito Sans Variable
**Label/Mono Font:** Nunito Sans Variable, chiffres tabulaires (`tabular-nums`)

**Character:** Une seule famille humaniste, arrondie et lisible, qui porte titres, libellés, données et boutons. La hiérarchie vient de la taille et de la graisse, pas d'un changement de police.

### Hierarchy
- **Titre de page** (700, 1,5rem / 24px, 1,25) : un seul h1 par page, en casse normale, rendu par `AdminPageHeader`.
- **Titre de section** (600, 1,125rem / 18px, 1,4) : h2 des blocs d'une page.
- **Titre de carte** (600, 1rem / 16px, 1,5) : titre d'un graphique, d'un tableau, d'une carte.
- **Texte** (400, 0,875rem / 14px, 1,5) : texte courant et cellules. Paragraphes d'aide limités à 70 caractères par ligne.
- **Étiquette** (600, 0,75rem / 12px, 0,01em) : libellés de champ, en-têtes de colonne, pastilles. Casse normale.
- **Chiffre** (700, 1,5rem / 24px, tabulaire) : valeur d'un indicateur.

### Named Rules
**The 12-Pixel Floor Rule.** Aucun texte sous 12 px. Les tailles `text-[10px]` et `text-[11px]` disparaissent.

**The No Shouting Rule.** Pas de titres ni d'en-têtes de colonne en capitales ; pas de sur-titre au-dessus du titre de page.

**The Fixed Scale Rule.** Échelle fixe en rem : pas de `clamp()` sur les titres du back-office.

## Layout

Structure classique d'outil : menu latéral fixe de 256 px (barre d'icônes de 64 px une fois replié, tiroir sous 1024 px), en-tête collant avec le fil d'Ariane « Domaine › Vue », barre d'onglets du domaine, puis le contenu dans une colonne de 1 600 px maximum. Marges de page 16 / 24 / 32 px (mobile / tablette / bureau).

Chaque page suit le même ordre : titre et action principale, filtres, indicateurs (quatre au plus), contenu (graphiques puis tableaux). Les blocs sont espacés de 24 px, l'intérieur des cartes de 20 px. Les tableaux larges défilent dans leur carte, jamais la page entière.

### Named Rules
**The Two Levels Rule.** Deux niveaux de navigation, pas plus : une entrée du menu latéral, puis un onglet. Une famille de produits, un canal ou une personne se choisissent avec un filtre ; une liste de référentiel se choisit dans une colonne de liste, pas dans une barre d'onglets de plus.

**The Question First Rule.** Le haut de chaque page répond à la question pour laquelle on l'ouvre ; le détail vient dessous.

## Elevation & Depth

Le système est plat. La profondeur vient du contraste entre le fond slate-50 et les surfaces blanches bordées, pas des ombres. Seules les couches qui flottent au-dessus du contenu portent une ombre : fenêtres modales, menus déroulants, notifications.

### Shadow Vocabulary
- **Couche flottante** (`box-shadow: 0 10px 30px -12px rgba(15, 23, 42, 0.25)`) : modales, menus déroulants, notifications.

### Named Rules
**The Flat-By-Default Rule.** Cartes, tableaux, indicateurs, menu et en-tête n'ont aucune ombre et ne bougent pas au survol. Le survol change une couleur de fond, jamais une position.

## Shapes

Des angles doucement arrondis et constants : 6 px pour les contrôles (boutons, champs, entrées de menu), 8 px pour les cartes et les modales, pastilles entièrement arrondies. Un trait de 1 px délimite chaque surface ; pas de barre colorée épaisse sur le côté d'une carte.

## Components

### Buttons
- **Shape:** angles de 6 px, hauteur 36 px (32 px en petit).
- **Primary:** fond rouge Bonnet Rouge (#C8102E), texte blanc, 600. Une seule action principale par zone.
- **Hover / Focus:** survol en rouge profond (#9B0D23) ; focus visible par un anneau de 2 px rouge décalé de 2 px.
- **Secondaire:** fond blanc, trait slate-300, texte slate-700 ; survol slate-50.
- **Discret:** sans fond ni trait, texte slate-600 ; survol slate-100. Pour « Réinitialiser », « Annuler », les actions de ligne.
- **Destructif:** texte rouge d'erreur en version discrète ; le bouton plein rouge n'apparaît que dans la confirmation, qui nomme ce qui sera supprimé.

### Chips
- **Style:** pastille slate-100, texte slate-700, 12 px, avec croix de retrait pour les filtres actifs.
- **State:** les statuts utilisent les voiles d'état (succès, alerte, erreur) avec un libellé en clair.

### Cards / Containers
- **Corner Style:** 8 px.
- **Background:** blanc.
- **Shadow Strategy:** aucune (voir Elevation & Depth).
- **Border:** 1 px slate-200.
- **Internal Padding:** 20 px ; 16 px sous 640 px.

### Inputs / Fields
- **Style:** fond blanc, trait slate-300, angles de 6 px, hauteur 36 px, libellé au-dessus en étiquette.
- **Focus:** anneau de 2 px rouge Bonnet Rouge.
- **Error / Disabled:** trait et message en rouge d'erreur sous le champ ; désactivé en slate-100 avec texte slate-400.

### Navigation
- **Menu latéral:** fond blanc, trait à droite. Intitulés de groupe en étiquette slate-500 (Piloter, Terrain, Marché, Réglages). Entrée : 14 px, icône 18 px, hauteur 36 px, texte slate-700, survol slate-100. Entrée active : voile rouge, texte rouge profond, 600, trait rouge de 3 px à gauche. Replié : icônes seules avec info-bulle et `aria-label`.
- **Barre d'onglets:** sous l'en-tête, texte 14 px slate-600 ; onglet actif souligné de 2 px rouge, texte rouge. Défile horizontalement sur mobile avec un fondu sur le bord.
- **Fil d'Ariane:** « Domaine › Vue » en 14 px, domaine en slate-500 cliquable, vue en encre.

### Tableaux
- En-tête sur fond slate-50, étiquettes 12 px slate-600 en casse normale ; lignes 14 px slate-700, séparées par un trait slate-200, survol slate-50. Les nombres s'alignent à droite en chiffres tabulaires. Les identifiants internes ne s'affichent pas.

### Indicateur (signature)
Carte blanche bordée : libellé en étiquette slate-500, valeur en chiffre encre, évolution dans une pastille d'état, phrase d'aide d'une ligne. Quatre indicateurs au plus par écran.

## Do's and Don'ts

### Do:
- **Do** réserver le rouge Bonnet Rouge (#C8102E) aux actions principales, à la position courante et au focus.
- **Do** passer par `AdminPageHeader` pour l'unique h1 de chaque page, en casse normale.
- **Do** utiliser `.admin-surface` pour toute carte et `.admin-table` pour tout tableau.
- **Do** traduire chaque erreur technique en une phrase claire avec `messageUtilisateur()` et garder le détail dans la console.
- **Do** nommer ce qui sera supprimé dans toute confirmation destructive.
- **Do** donner à chaque graphique et à chaque tableau un état vide qui explique quoi faire.

### Don't:
- **Don't** laisser un composant Nuxt UI sans couleur retomber sur le vert par défaut.
- **Don't** ajouter un troisième niveau de navigation (onglets dans des onglets, pastilles de section au-dessus d'onglets).
- **Don't** utiliser d'emoji ni de caractère Unicode (✓, ▲, ⌕) comme icône : Heroicons, avec un texte pour lecteur d'écran.
- **Don't** afficher un identifiant interne, un code de migration, un nom de table ou un message brut de la base.
- **Don't** mettre d'ombre ou de déplacement au survol sur une carte.
- **Don't** écrire sous 12 px ni en capitales pour les titres et en-têtes.
