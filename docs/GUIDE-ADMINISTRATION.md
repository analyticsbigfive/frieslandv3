# Guide d'administration — Big Five / Perfect Store (Friesland Bonnet Rouge)

> Mise à jour du 9 octobre 2026. Application 1.0.12 (`package.json`).
> Référence de l'équipe technique et des administrateurs avancés : le
> back-office web (`/admin`) et tous les réglages qui pilotent l'application
> mobile, sans passer par l'éditeur SQL. Le guide d'utilisation, ouvert par le
> bouton Aide, est `docs/guides/GUIDE-ADMIN.pdf` (compte agence :
> `docs/guides/GUIDE-ADMIN-ATOM.pdf`).
> Données de référence Perfect Store : fichier client « BIG FIVE KPI UPDATE »
> (copie CSV dans `docs/big-five-kpi-csv/`), vérifié conforme à la base.
>
> Changements du 9 octobre : navigation à deux niveaux décrite par un registre
> unique (§1.5) ; rôle Agence (§1.2 et §1.3) ; Référentiels en colonne de
> listes (§5) ; Standards Perfect Store en sections empilées (§4) ; la famille
> de produits devient un filtre (§6) ; Planning en quatre onglets (§7 bis) ;
> versions de l'app en un seul endroit (§8) ; Import / Export avec aperçu et
> imports terrain ouverts à l'agence (§11) ; Maintenance renommée « Tâches
> automatiques » (§12) ; Permissions avec colonne Agence (§7).

---

## 1. Connexion et rôles

### 1.1 Connexion

- **Adresse** : <https://frieslandv3.vercel.app/login>. Le back-office s'ouvre
  dans un navigateur ; l'application Android renvoie toute adresse `/admin`
  vers `/mobile`.
- **Comptes** : un administrateur les crée dans `Paramètres › Utilisateurs`.
  Aucun identifiant ni mot de passe ne figure dans ce document : ils sont
  remis séparément, en main propre.
- **Mot de passe** (`utils/motDePasse.ts`) : pour un admin, un superviseur ou
  un compte agence, au moins 12 caractères, au moins 3 types parmi minuscule,
  majuscule, chiffre et symbole, sans mot courant (admin, azerty, 123456…) ni
  l'identifiant du compte. Pour un commercial ou un merchandiser, au moins 8
  caractères (saisie sur téléphone).
- **Changer de mot de passe** : menu du compte › Changer mon mot de passe
  (`/mon-mot-de-passe`) ; le changement imposé à la première connexion passe
  par `/changer-mot-de-passe`.
- **Page d'arrivée** (`homePathForRole`, `utils/roles.ts`) :

| Rôle | Arrive sur |
|---|---|
| admin, superviseur | `/admin` (Perfect Store › Vue d'ensemble) |
| agence | `/admin/routing` (Planning › Tournées) |
| commercial | `/mobile/equipe` ; l'analyse web (`/admin`) reste ouverte depuis un navigateur |
| merchandiser | `/mobile` |

### 1.2 Les rôles

Le rôle est `profiles.role` (contrainte `profiles_role_check` : `admin`,
`superviseur`, `commercial`, `agence`, `merchandiser`). Trois couches décident
de ce qu'un compte voit :

1. la base (RLS) : les lignes qu'il lit et écrit ;
2. la matrice `role_section_access` (`Paramètres › Permissions`) : les
   sections du back-office qui s'ouvrent ;
3. le registre `utils/adminNavigation.ts` : les onglets réservés à certains
   rôles (`roles`) et les écrans ouverts page par page (`ouvertA`).

Droits avec la matrice par défaut (un administrateur peut changer les cases) :

| Rôle | Écrans du back-office | Données visibles | Écritures |
|---|---|---|---|
| `admin` | Tout, toujours : court-circuit dans `useAccessControl` et `middleware/admin.ts`, colonne verrouillée dans Permissions. Seul rôle à ouvrir `Paramètres › Utilisateurs` et `Paramètres › Permissions`. | Tout le parc | Tout. Réservé à l'admin côté serveur (`requireAdmin`) : comptes (création, import, mot de passe, suppression), Équipes, publication d'une version. Dans l'interface : version minimale, import des tournées (`Planning › Tournées`, bouton Importer), les cinq imports terrain. |
| `superviseur` | Toutes les sections sauf Paramètres : tous les tableaux de bord et le Planning complet (tournées et règles : création, modification, génération). Fermés : les écrans de `Paramètres` et `Points de vente › Distributeurs` (section `parametres`). Si l'admin lui coche Paramètres : Référentiels, Standards Perfect Store, Produits du formulaire, Équipes, Versions de l'app, Import / Export et Distributeurs s'ouvrent ; Utilisateurs et Permissions restent fermés (`roles: ['admin']`), les imports terrain aussi. | Tout le parc | Terrain (PDV, visites, photos : `peut_ecrire_terrain()`), suppression d'une visite. La base l'autorise aussi sur les standards et référentiels Perfect Store (`est_gestionnaire_perfect_store()` = admin ou superviseur) et le recalcul, utilisables dès que Paramètres lui est ouvert. |
| `commercial` | Mêmes sections que le superviseur, en consultation. Dans le Planning, seulement Programme merchandiser et Écarts de tournée : Tournées et Règles récurrentes lui sont fermés (`roles`). Son travail quotidien est dans l'application : équipe, actions commerciales, field coaching. | Ses territoires et quartiers ; écarts de tournée : les merchandisers dont il est le commercial | Aucune écriture terrain (PDV, visites) ; actions commerciales et coaching depuis l'application. |
| `agence` | Sections `principal` et `visites` : Perfect Store › Vue d'ensemble, Activité, Carte et suivi, Planning (Tournées et Règles récurrentes en lecture seule, Programme merchandiser, Écarts de tournée), Visites. Ouverts en plus par `ouvertA` : `Paramètres › Référentiels` (listes « Routing mensuel » et « Alias d'import (orthographes) » seulement), `Paramètres › Versions de l'app`, `Paramètres › Import / Export` (imports terrain : routing mensuel seul). | Les merchandisers de son agence (`profiles.employeur`), leurs PDV, tournées, règles, visites, positions et installations | Routing mensuel de ses merchandisers, ses propres lots d'import « routing-mensuel », alias de type « quartier ». |
| `merchandiser` | Aucun : toutes ses cases sont fermées, le middleware le renvoie vers `/mobile`. | PDV de ses territoires (et de ses quartiers s'ils sont renseignés) | Visites, création et correction de PDV, photos, depuis l'application. |

Un administrateur peut ouvrir une section à un commercial ou à un
merchandiser : les écrans correspondants du back-office s'ouvrent aussi.

**Matrice par défaut** (migrations `20260630130200`, `20260701170000`,
`20260907140100`, `20261010100000`). La production peut différer si un
administrateur a changé une case : la page Permissions montre l'état réel.

| Section (clé) | Libellé dans Permissions | Superviseur | Commercial | Agence | Merchandiser |
|---|---|---|---|---|---|
| `principal` | Accueil et pilotage | oui | oui | oui | non |
| `perfect-store` | Perfect Store (détail) | oui | oui | non | non |
| `pdv` | Points de vente | oui | oui | non | non |
| `visites` | Visites | oui | oui | oui | non |
| `visibilite` | Visibilité | oui | oui | non | non |
| `concurrence` | Concurrence | oui | oui | non | non |
| `produits` | Produits | oui | oui | non | non |
| `actions` | Actions | oui | oui | non | non |
| `parametres` | Paramètres | non | non | non | non |

Matrice absente ou vide pour un rôle : refus par défaut, sauf le superviseur,
qui garde toutes les sections hors Paramètres. Les anciennes lignes
`administration` valent pour `parametres`.

### 1.3 Le compte agence

- **Pour qui** : le responsable du routing d'une agence (par exemple Atom
  BTL). Il charge et corrige lui-même le routing mensuel de ses
  merchandisers, sans le rôle admin (décision du 09/10/2026).
- **Création** : `Paramètres › Utilisateurs`, rôle « Agence », champ
  « Agence » obligatoire. `profiles.employeur` porte le code de l'agence,
  jamais `friesland` (contrainte `profiles_agence_rattachee`). Le compte ne
  peut changer ni son rôle ni son agence.
- **Cloisonnement en base** (migrations `20261010100000_friesland_role_agence.sql`
  et `20261010110000_friesland_role_agence_cloisonnement.sql`, à appliquer
  avant de créer le premier compte) :
  - `agence_courante()` rend le code de l'agence du compte connecté (null pour
    tout autre compte) ; `merch_ids_agence()` ses merchandisers ;
    `pdv_ids_agence()` les PDV de leurs territoires, portefeuilles (règles),
    tournées et visites ;
  - lecture ajoutée sur `pdv`, `visites`, `routings`, `routing_pdv`,
    `routing_templates`, `routing_template_pdv`, `version_installee`,
    `position_tournee` ; `pdv_ids_perimetre()` ne rend plus rien à un compte
    agence (sans territoire, il voyait tout le parc) ;
  - politiques restrictives sur `resultat_perfect_store` et
    `visite_perfect_store` : seulement les visites de ses merchandisers ;
  - statistiques précalculées (`v_stats_visites`, `v_performance_commerciaux`,
    `v_visites_par_jour`, `v_distribution_pdv`) : vides pour un compte agence,
    d'où des compteurs globaux vides dans son écran Activité ;
  - écriture : `routing_mensuel` (ses merchandisers), `import_lot` (type
    `routing-mensuel`, créés par lui), `alias_import` (type `quartier`) ;
  - planning et contrôle d'écart (`peut_lire_routing`, `ecarts_binome_resume`,
    `ecarts_binome`) : ses merchandisers.
- **Imports** : la route `/api/admin/imports/[type]/appliquer` (clé de
  service) passe par `requireAdminOuAgence` (`server/utils/adminGuard.ts`),
  n'accepte que les imports de `IMPORTS_AGENCE` et vérifie chaque opération
  juste avant de l'écrire (`scripts/lib/imports/portee-agence.mjs`). Un compte
  agence ne voit et n'annule que ses propres lots ; il ne retire le commercial
  d'un SSF qu'en annulant son lot.
- **Interface** : Planning en lecture seule (bandeau « Consultation »), bouton
  Aide vers `GUIDE-ADMIN-ATOM.pdf`.

### 1.4 Organisation du terrain

- Le **commercial** (sales officer, salarié FrieslandCampina) est responsable
  des PDV de son territoire. Deux personnes travaillent pour lui : le
  **vendeur du distributeur (SSF)**, dont la tournée vient du fichier du
  distributeur (DMS), et le **merchandiser** (employé d'une agence). Aucun des
  deux ne commande l'autre ; leur seul lien est le **routing mensuel** de
  l'agence (tel jour, tel lieu, avec tel SSF) pour passer dans les mêmes PDV
  (§7 bis).
- **Employeur** (fiche utilisateur) : code d'agence (table `agence`) :
  `friesland` (salariés, tournées par périmètre), `atom` (Atom BTL, Abidjan),
  `agence-north` (intérieur)… Les agences « programme » ont des tournées par
  quotas (§7 bis).
- **Direction** (fiche utilisateur) : South (Abidjan), North (intérieur) ou
  MT (supermarchés). Vide : déduite des territoires ; MT se choisit. Une
  personne peut avoir deux comptes (par exemple commercial MT et
  merchandiser).
- Ce qu'un compte terrain voit dépend de ses **territoires** et, s'ils sont
  renseignés, de ses **quartiers**. Le rattachement à un commercial
  (`Paramètres › Équipes`) est organisationnel : il ne change pas ce qu'on
  voit.

### 1.5 Navigation

Le back-office a deux niveaux de navigation, jamais trois. Un seul registre,
`utils/adminNavigation.ts`, les décrit ; le menu latéral, la barre d'onglets,
le fil d'Ariane, le titre de l'onglet du navigateur, le titre de la page
(`AdminPageHeader`), la page Permissions et le contrôle d'accès
(`useAccessControl`, `middleware/admin.ts`) le lisent tous.

- **Menu de gauche** : quatre familles (`ADMIN_GROUPS`), chacune avec ses
  domaines (`ADMIN_DOMAINS`). Un domaine n'apparaît que si le compte peut en
  ouvrir au moins un onglet ; son entrée mène au premier onglet ouvrable.
- **Barre d'onglets** : les vues du domaine (`tabs`), affichée seulement quand
  le compte en voit plus d'une. Les filtres de l'adresse (période, direction,
  famille…) suivent d'un onglet à l'autre, sauf `vue` et `page`
  (`lienEntreOnglets`).
- **Pas de troisième niveau** : ce qui était un onglet dans un onglet devient
  un filtre d'adresse (famille de produits, direction du Programme), une
  colonne de listes (Référentiels) ou des sections empilées (Standards).

| Famille | Domaines |
|---|---|
| Piloter | Perfect Store, Activité, Carte et suivi |
| Terrain | Planning, Points de vente, Visites, Actions |
| Marché | Visibilité, Concurrence, Produits |
| Réglages | Paramètres |

**Registre complet** (section = clé de la matrice ; « réservé » = `roles`,
l'admin passe toujours ; « ouvert à » = `ouvertA`) :

| Domaine › Onglet | Chemin | Section | Restriction |
|---|---|---|---|
| Perfect Store › Vue d'ensemble | `/admin` | `principal` | |
| Perfect Store › Liste par niveau | `/admin/perfect-store/liste` | `perfect-store` | |
| Perfect Store › Synthèse par zone | `/admin/perfect-store/zones` | `perfect-store` | |
| Perfect Store › Écarts au standard | `/admin/perfect-store/gaps` | `perfect-store` | |
| Activité | `/admin/activite` | `principal` | |
| Carte et suivi › Carte des PDV | `/admin/map` | `principal` | |
| Carte et suivi › Suivi des équipes | `/admin/trajets` | `principal` | |
| Planning › Tournées | `/admin/routing` | `principal` | réservé : admin, superviseur, agence |
| Planning › Règles récurrentes | `/admin/routing?vue=regles` | `principal` | réservé : admin, superviseur, agence |
| Planning › Programme merchandiser | `/admin/routing/programme-merchandiser` | `principal` | |
| Planning › Écarts de tournée | `/admin/routing/ecarts-ssf` | `principal` | |
| Points de vente › Liste | `/admin/pdv` | `pdv` | |
| Points de vente › Répartition | `/admin/pdv/repartition` | `pdv` | |
| Points de vente › Évolution | `/admin/pdv/evolution` | `pdv` | |
| Points de vente › Historique | `/admin/pdv/historique` | `pdv` | |
| Points de vente › Distributeurs | `/admin/distributeurs` | `parametres` | |
| Visites › Toutes les visites | `/admin/visites` | `visites` | |
| Visites › Évolution | `/admin/visites/evolution` | `visites` | |
| Visites › Par catégorie | `/admin/visites/categories` | `visites` | |
| Visites › Par merchandiser | `/admin/visites/commerciaux` | `visites` | |
| Visites › Coaching terrain | `/admin/visites/coaching` | `visites` | |
| Actions › Synthèse | `/admin/actions` | `actions` | |
| Actions › Actions commerciales | `/admin/actions/commerciales` | `actions` | |
| Visibilité › Extérieure | `/admin/visibilite` | `visibilite` | |
| Visibilité › Extérieure : détail | `/admin/visibilite/exterieure-recap` | `visibilite` | |
| Visibilité › Intérieure | `/admin/visibilite/interieure` | `visibilite` | |
| Visibilité › Intérieure : évolution | `/admin/visibilite/interieure-evolution` | `visibilite` | |
| Visibilité › Intérieure : boutiques | `/admin/visibilite/interieure-gt-recap` | `visibilite` | |
| Visibilité › Intérieure : supermarchés | `/admin/visibilite/interieure-mt-recap` | `visibilite` | |
| Visibilité › Promotion | `/admin/visibilite/promotion-recap` | `visibilite` | |
| Concurrence › Évolution | `/admin/concurrence` | `concurrence` | |
| Concurrence › Détail par point de vente | `/admin/concurrence/visibilite-recap` | `concurrence` | |
| Concurrence › Visibilité | `/admin/concurrence/visibilite-evolution` | `concurrence` | |
| Produits › Synthèse | `/admin/produits/recap` | `produits` | |
| Produits › Disponibilité | `/admin/produits/familles` | `produits` | |
| Produits › Prix | `/admin/produits/familles?vue=prix` | `produits` | |
| Produits › Détail par visite | `/admin/produits/familles?vue=releves` | `produits` | |
| Produits › Inventaire | `/admin/produits/inventaire` | `produits` | |
| Paramètres › Référentiels | `/admin/referentiels` | `parametres` | ouvert à : agence |
| Paramètres › Standards Perfect Store | `/admin/perfect-store/standards` | `parametres` | |
| Paramètres › Produits du formulaire | `/admin/produits/seuils` | `parametres` | |
| Paramètres › Utilisateurs | `/admin/users` | `parametres` | réservé : admin |
| Paramètres › Équipes | `/admin/users/equipes` | `parametres` | |
| Paramètres › Permissions | `/admin/permissions` | `parametres` | réservé : admin |
| Paramètres › Versions de l'app | `/admin/users/versions` | `parametres` | ouvert à : agence |
| Paramètres › Import / Export | `/admin/import-export` | `parametres` | ouvert à : agence |

**En-tête** (`layouts/admin.vue`) :

- fil d'Ariane « Domaine › Vue » ; un clic sur le domaine revient à sa
  première vue ouvrable ; un domaine à une seule vue n'a qu'un maillon ;
- « N en tournée » : personnes dont un point GPS est arrivé il y a moins de
  10 minutes ; lien vers `Carte et suivi › Suivi des équipes` ;
- envois en attente ou en échec sur cet appareil ;
- **Aide** : ouvre `/guides/GUIDE-ADMIN.pdf`, ou `/guides/GUIDE-ADMIN-ATOM.pdf`
  pour un compte agence. Ces fichiers sont servis par
  `server/routes/guides/[nom].get.ts` (connexion requise, sinon renvoi vers
  `/login`), depuis `server/assets/guides/`, où `scripts/generer-guides-pdf.mjs`
  copie les guides génériques de `docs/guides/` (jamais les guides
  personnalisés) ;
- mode sombre, puis le menu du compte : Application mobile, Changer mon mot de
  passe, Se déconnecter.

**Contrôle d'accès** (`peutOuvrirOnglet`, `peutOuvrirChemin`) :

- l'admin passe toujours ;
- `roles` réserve l'onglet à ces rôles, pour cette page exacte seulement
  (Utilisateurs est réservé à l'admin, Équipes, sous le même chemin, suit la
  section) ;
- `ouvertA` ouvre l'onglet à ces rôles même si leur section est fermée ;
- sinon, la case de la matrice décide ;
- un chemin qui n'est pas un onglet suit la section du chemin d'onglet ou
  d'alias le plus long qui le couvre ; un chemin inconnu du registre vaut
  `parametres`, donc refusé à tout autre rôle que l'admin.

**Accès refusé** (`middleware/admin.ts`) : le compte est renvoyé vers la
première page qu'il peut ouvrir, dans l'ordre du menu (`premiereOuvrable`),
avec `?acces_refuse=<Domaine › Vue>`. Le layout affiche « Vous n'avez pas
accès à « … » » (« Demandez à un administrateur si vous en avez besoin »),
puis retire le paramètre de l'adresse. Sans aucun écran ouvrable
(merchandiser) : `/mobile`.

**Anciennes adresses** (favoris, liens dans les messages) :

| Ancienne adresse | Devient |
|---|---|
| `/admin/produits/<famille>?tab=…` | redirection 301 vers `/admin/produits/familles?famille=<famille>` ; `tab=prix` donne `vue=prix`, `tab=recap` donne `vue=releves` |
| `/admin/referentiels?onglet=<id>` | `?liste=<id>` (réécrit par la page) |
| `/admin/routing/programme-atom` | `/admin/routing/programme-merchandiser?direction=south` |
| `/admin/perfect-store` | `/admin` |
| `/admin/perfect-store/visites` | `/admin/visites` |
| Référentiels › Application mobile › Version minimale, Versions installées, Publier une version | `Paramètres › Versions de l'app` |
| Référentiels › Application mobile › Maintenance | `Paramètres › Référentiels`, liste « Tâches automatiques » |
| Écarts SSF ↔ merch, Programme merchandiser South / North (barre latérale) | `Planning › Écarts de tournée`, `Planning › Programme merchandiser` |

**Ajouter un écran** :

1. Créer la page `pages/admin/<chemin>.vue` avec
   `definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })` et
   `<AdminPageHeader />` : sans `title` ni `description`, le titre et la
   phrase d'aide viennent du registre.
2. Ajouter l'onglet dans `utils/adminNavigation.ts`, dans les `tabs` de son
   domaine : `id` unique au format « domaine.vue », `label`, `path`, `access`
   (une clé existante de la matrice) et, au besoin, `title`, `query` (onglets
   sur un même chemin), `roles`, `ouvertA`, `aide`. Un nouveau domaine prend
   `id`, `label`, `icon` (Heroicons) et `group`.
3. Une page qui ne fait que rediriger : un alias dans `ADMIN_ALIASES` (ou un
   chemin couvert par un onglet parent), et son chemin dans `REDIRECTIONS` du
   test.
4. Compléter `tests/adminNavigation.spec.ts` : les cas de droits du nouvel
   écran dans « droits par rôle ». Le test vérifie déjà que chaque page est un
   onglet ou une redirection couverte, que chaque onglet pointe vers une page
   existante, l'unicité des identifiants et la validité des sections. Le test
   « même section d'accès que l'ancien code » compare chaque page à
   l'ancienne table de préfixes (`ancienneSection`) : un chemin hors des
   préfixes connus demande de l'y ajouter. Lancer
   `npx vitest run tests/adminNavigation.spec.ts`.
5. Une nouvelle section de matrice demande une migration (une ligne
   `role_section_access` par rôle), l'ajout de la clé à `AccessSection` et
   `ACCESS_SECTIONS`, et son libellé dans `SECTIONS`
   (`composables/useAccessControl.ts`). Les clés existantes ne se renomment
   pas sans migration.

Le menu, les onglets, le fil d'Ariane, le titre, la page Permissions (écrans
couverts par chaque case) et le contrôle d'accès suivent sans autre
modification.

---

## 2. Le tableau de bord Perfect Store (`Perfect Store › Vue d'ensemble`, `/admin`)

C'est le premier écran après connexion d'un admin ou d'un superviseur. De
haut en bas :

1. **Filtres** : période (Jour, Semaine, 30 jours par défaut, Mois,
   Trimestre, Tout, Personnalisé), puis la cascade **Direction → Territoire →
   Quartier** et **Distributeur**. Ils pilotent toute la page : les
   indicateurs sont recalculés côté serveur sur le périmètre choisi et les
   listes sont filtrées. Chaque filtre actif apparaît en pastille ;
   « Réinitialiser » revient à la vue réseau. Division `ABIDJAN` = South ;
   `UP COUNTRY` = North.
2. **Perfect Stores** : nombre de PDV au standard, leur part parmi les PDV
   visités sur la période et la répartition par niveau (Flagship, VIP, Core,
   Basic, Non conforme).
3. **Quatre indicateurs** : Points de vente visités (X / Y et %, sur le parc
   actif), Disponibilité en rayon (OSA pondérée), Assortiment moyen, Score
   global moyen.
4. **Passer au niveau supérieur** : pour chaque PDV, le niveau actuel, le
   niveau visé et les critères exacts qui manquent à la dernière visite
   (disponibilité insuffisante, assortiment, éléments de visibilité ou de
   promotion absents). Les moins conformes d'abord ; lien vers
   `Perfect Store › Écarts au standard`. C'est l'outil d'action terrain : il
   dit quoi corriger dans chaque magasin.
5. **Points de vente Perfect Store** : dernière visite de chaque PDV au
   standard, tous niveaux ou un seul (contrôle segmenté).
6. **Évolution du taux de Perfect Stores** : courbe quotidienne.
7. **Présence et disponibilité** : par catégorie, références clés et gamme
   Délice.
8. **Perfect Store par type de magasin** : accordéons par type (level 4), un
   seul ouvert à la fois.
9. **Visites par merchandiser** : PDV visités par personne sur la période.
10. **Seuils par niveau** : rappel des seuils, avec un lien vers
    `Paramètres › Standards Perfect Store` pour qui peut l'ouvrir.

L'activité du terrain (visites, performance des équipes, points à traiter)
est sur `Piloter › Activité` (`/admin/activite`).

---

## 3. Comment le niveau Perfect Store est calculé

**Perfect Store = Disponibilité (OSA) + Assortiment + Visibilité + Promotion (optionnelle).**

À chaque visite enregistrée, le moteur (`calculer_perfect_store`) calcule :

1. **Canal et segment** : le type du PDV (level 4, par exemple « Boutique A »,
   « Supermarket B ») détermine :
   - le **canal** boutiques (GT) ou supermarchés (MT), par la catégorie
     level 3 ;
   - le **segment et le grade de disponibilité** (par exemple Boutique/A,
     SupermarcheMT/B) ;
   - le **segment de visibilité** (boutique, superette, mt, kiosque_aboki…).
2. **Disponibilité par catégorie (EVAP / IMP / SCM)** : moyenne pondérée des
   références (poids par canal), où une référence compte « disponible » si :
   - **boutiques (GT)** : quantité relevée ≥ quantité minimale du
     segment/grade ;
   - **supermarchés (MT)** : quantité ≥ minimum **et** faces en rayon
     (facings) ≥ minimum (règle ET des standards MT).
   La disponibilité rayon est la moyenne des 3 catégories. Attention :
   disponibilité ≠ présence. Présence = au moins 1 unité ; disponibilité =
   quantité minimale atteinte.
3. **Assortiment** : nombre de références présentes ≥ minimum du
   segment/grade ; références prioritaires (hero SKU, rôle « phare » dans la
   liste « Références ») obligatoires si configuré.
4. **Visibilité** : part des éléments **exigés** du niveau qui sont
   installés (matrice par segment). Les éléments marqués optionnels ne
   pénalisent jamais.
5. **Promotion** : évaluée seulement si « promotion applicable » a été coché
   sur la visite ; sinon exclue du score.

Les poids utilisés par le moteur sont ceux de la base `taux_vente`
(paramètre `p_base_calcul`, valeur par défaut du calcul à la saisie et du
recalcul global). Voir la remarque du §4 sur les poids cibles.

**Niveau atteint** = le plus haut niveau dont TOUS les critères passent :

| Niveau | Dispo rayon min | Visibilité | Promotion (si applicable) |
|---|---|---|---|
| FLAGSHIP | ≥ 95 % | 100 % de l'exigé | 100 % |
| VIP | ≥ 85 % | 100 % | 100 % |
| CORE | ≥ 75 % | 100 % | 100 % |
| BASIC | ≥ 60 % | 100 % | 100 % |

En dessous de BASIC : « Non conforme ». Ces seuils s'éditent dans
`Paramètres › Standards Perfect Store`, section « Seuils des niveaux ».

---

## 4. Paramétrer les standards : où éditer quoi

`Paramètres › Standards Perfect Store` (`/admin/perfect-store/standards`)
présente cinq sections empilées, sans onglets : Seuils des niveaux,
Assortiment, Poids des références dans la disponibilité, Visibilité exigée,
Types de PDV. Un sommaire « Sur cette page » les liste sur grand écran.
Admin et superviseur modifient ; les autres comptes qui ouvrent la page la
consultent seulement. Chaque ligne s'enregistre par son bouton
« Enregistrer ».

Les listes que cette page couvre entièrement ne sont plus dans les
Référentiels (`ailleurs:` dans les définitions de
`pages/admin/referentiels/index.vue`) : Niveaux Perfect Store, Assortiment,
Standards visibilité, Segment et grade des types de PDV, Segment de
visibilité des types de PDV.

| Je veux régler… | Écran | Table |
|---|---|---|
| Quantités minimales en boutiques (GT), par référence × segment × grade | `Paramètres › Référentiels`, liste « Seuils de disponibilité » | `seuil_disponibilite` |
| Quantités et faces en rayon en supermarchés (MT), par référence × format (hypermarché, supermarché moyen, petit supermarché) | `Paramètres › Référentiels`, liste « Seuils de disponibilité, supermarchés (MT) » | `seuil_disponibilite_mt` |
| Assortiment (références cibles, minimum présent, références prioritaires obligatoires) | `Paramètres › Standards Perfect Store`, section « Assortiment » | `standard_assortiment` |
| Poids cibles des références (« taux revus », GT et MT, 100 % par famille et par canal) | `Paramètres › Standards Perfect Store`, section « Poids des références dans la disponibilité » | `poids_reference` (`base_calcul = 'taux_revu'`) |
| Poids selon les ventes, ou ajouter une référence au calcul | `Paramètres › Référentiels`, liste « Poids des références » (colonne Pondération) | `poids_reference` (`taux_vente` ou `taux_revu`) |
| Matrice de visibilité (éléments exigés par niveau et segment, caractère optionnel) | `Paramètres › Standards Perfect Store`, section « Visibilité exigée » (filtres Segment et Pilier) | `standard_visibilite` |
| Rattacher un type de PDV à ses standards (grille de visibilité, segment et grade de disponibilité) | `Paramètres › Standards Perfect Store`, section « Types de PDV » | `segment_grade_type_pdv`, `segment_visibilite_type_pdv` |
| Seuils des niveaux (95 / 85 / 75 / 60) | `Paramètres › Standards Perfect Store`, section « Seuils des niveaux » | `niveau_perfect_store` |
| Produits du formulaire (libellé, ordre, actif, seuil « stock bas ») | `Paramètres › Produits du formulaire` (`/admin/produits/seuils`) | `sku_thresholds` |
| Relier un produit du formulaire à une référence notée | `Paramètres › Référentiels`, liste « Correspondance des références » | `correspondance_reference` |
| Rôle d'une référence (phare, soutien, croissance, nouveauté, à retirer) | `Paramètres › Référentiels`, liste « Références » | `reference_produit.role` |

**Poids cibles et poids du score.** La section « Poids des références dans
la disponibilité » édite les poids `taux_revu`. Le moteur note, lui, avec les
poids `taux_vente` (§3). Tant que ce choix n'est pas tranché, modifier un
poids dans Standards ne change pas les scores ; pour changer les poids
effectivement utilisés, éditer les lignes « Poids selon les ventes (taux de
vente) » de la liste « Poids des références », puis recalculer.

### Après TOUTE modification de standard : recalculer

Le moteur recalcule automatiquement **à la saisie d'une visite**, pas quand
un standard change. Après une modification, la page Standards affiche un
bandeau « Vous avez modifié des standards… » avec **Recalculer maintenant** ;
le bouton **Recalculer toutes les visites** de l'en-tête fait de même. Une
confirmation est demandée, puis le recalcul tourne par lots de 500 visites
(`compter_visites_a_recalculer`, `recalculer_perfect_store_lot`) avec une
progression « N / total » : gardez la page ouverte. Un recalcul interrompu
indique où il s'est arrêté ; relancez-le. Sans recalcul, les scores affichés
reflètent les anciens standards.

### Segments de visibilité disponibles

`boutique`, `superette`, `mt` (supermarchés : Niche, Wobbler, Top shelf,
Bacs, Réglettes, TG, Plot, Hôtesses), `table_top`, `pushcart`, `porridge`,
`kiosque_aboki`. Les éléments eux-mêmes (ajout, suppression) s'éditent dans
`Paramètres › Référentiels`, liste « Éléments de visibilité (PLV) » ; leur
caractère optionnel, dans la section « Visibilité exigée » des Standards.

### Scorer un type de PDV aujourd'hui non couvert (par exemple Pharmacy, Bakery)

Les 41 types du fichier client existent tous, mais seuls les formats retail
cœur ont des standards. Pour couvrir un nouveau type, sans migration :

1. `Paramètres › Référentiels`, liste « Seuils de disponibilité » : créer les
   quantités minimales du type (choisir un segment existant, ou réutiliser le
   plus proche).
2. `Paramètres › Standards Perfect Store`, section « Types de PDV » :
   rattacher le type au segment/grade de disponibilité et à la grille de
   visibilité choisis.
3. Facultatif : section « Assortiment » pour ce segment/grade.
4. **Recalculer toutes les visites**.

---

## 4 bis. Produits du formulaire de visite

Depuis l'application 1.0.12, la liste des produits relevés dans la visite
vient de la base : `Paramètres › Produits du formulaire`
(`/admin/produits/seuils`).

| Action | Comment | Effet |
|---|---|---|
| Renommer un produit | Modifier son libellé | Immédiat sur le web ; téléphones à leur prochaine ouverture |
| Réordonner | Modifier l'ordre | Ordre des lignes dans l'étape de la catégorie |
| Retirer un produit | Décocher « Dans le formulaire » | Il disparaît du formulaire ; l'historique reste (tableaux, export) |
| Ajouter un produit | Libellé et seuil en bas de la catégorie | Clé générée et **figée** (elle range les quantités dans les visites) |
| Seuil « stock bas » | Modifier le seuil | Pastilles du téléphone et inventaire des références (hors score) |

Règles :

- On ne supprime jamais un produit : on le retire du formulaire.
- Un produit noté au Perfect Store (présent dans « Correspondance des
  références ») ne peut pas être retiré : la base le refuse, sinon toutes les
  nouvelles visites le noteraient à 0. Retirer d'abord la correspondance.
- Un nouveau produit est saisi et exporté, mais ne compte au Perfect Store
  qu'après une correspondance, suivie de **Recalculer toutes les visites**
  (qui renote aussi l'historique).
- Les **catégories** (EVAP, IMP, SCM, UHT, Yaourt, Céréales…) se gèrent dans
  `Paramètres › Référentiels`, liste « Catégories du relevé » : libellé,
  ordre, actif, faces en rayon (facings) en supermarchés (MT). Une nouvelle
  catégorie (code en minuscules, figé) apparaît dans le formulaire dès
  qu'elle a des produits ; elle n'est pas notée au Perfect Store.
- Les téléphones en 1.0.10 / 1.0.11 gardent leur liste intégrée : un nouveau
  produit n'y apparaît qu'après la mise à jour en 1.0.12.
- Si la migration du catalogue manque, la page l'annonce (« Le libellé,
  l'ordre et la présence dans le formulaire seront modifiables après une mise
  à jour du serveur ») et seul le seuil reste modifiable.

---

## 5. Référentiels (`Paramètres › Référentiels`, `/admin/referentiels`)

- **Choix de la liste** : une colonne à gauche, avec une recherche
  « Rechercher une liste » et une entrée par liste, groupées par thème, avec
  le nombre de lignes. Sur téléphone, un menu « Liste ». La liste choisie est
  dans l'adresse : `/admin/referentiels?liste=<id>` (l'ancien `?onglet=<id>`
  est réécrit).
- **Dans une liste** : recherche, pagination par 50, bouton
  « Ajouter : » suivi du nom de la liste, menu de chaque ligne (Modifier, Supprimer). La
  suppression nomme la ligne et demande confirmation ; elle est définitive.
- **Liste non chargée** (table absente, migration non appliquée) : la page
  l'annonce (« Ces listes n'ont pas pu être chargées : … ») ; les autres
  restent utilisables.
- **Compte agence** : seulement « Routing mensuel » et « Alias d'import
  (orthographes) » ; les autres tables ne sont pas chargées.
- Les listes couvertes par une autre page n'apparaissent plus ici : Niveaux
  Perfect Store, Assortiment, Standards visibilité et les deux rattachements
  des types de PDV (`Paramètres › Standards Perfect Store`) ; Version minimale
  et Versions installées (`Paramètres › Versions de l'app`).

| Groupe | Liste (`?liste=`) | Table | Remarques |
|---|---|---|---|
| Géographie | Régions (`region`) | `region` | Divisions North / South. Hiérarchie : pays > division > sous-région > territoire > zone commerciale (area) > quartier |
| Géographie | Sous-régions (`sous_region`) | `sous_region` | |
| Géographie | Territoires (`territoire`) | `territoire` | |
| Géographie | Zones commerciales (areas) (`zone`) | `zone` | Code de la zone, territoire ; distributeur et nombre de quartiers affichés |
| Géographie | Quartiers (`quartier`) | `quartier` | Rattachés à une zone commerciale |
| Géographie | Alias de territoire (`territoire_alias`) | `territoire_alias` | Libellé hors référentiel (tel qu'écrit sur les PDV ou les comptes) → territoire réel |
| Distribution et vendeurs | Distributeurs (`distributeur`) | `distributeur` | Couverture « National » = proposé partout. Le renommage est reporté sur les PDV et les règles de tournée ; l'ancien nom reste reconnu dans les imports |
| Distribution et vendeurs | Territoires des distributeurs (`territoire_distributeur`) | `territoire_distributeur` | Distributeurs d'un territoire |
| Distribution et vendeurs | Zones des distributeurs (`zone_distributeur`) | `zone_distributeur` | Exception par zone commerciale : un territoire peut avoir des distributeurs différents selon la zone |
| Distribution et vendeurs | Agences (`agence`) | `agence` | Nom, code (figé, lu par l'app), direction, « programme », active. Pas de suppression (§7 bis) |
| Distribution et vendeurs | Vendeurs des distributeurs (SSF) (`ssf`) | `ssf` | Nom, autres orthographes (séparées par « \| »), téléphone, distributeur, commercial, actif, « distributeur à confirmer ». Pas de suppression |
| Distribution et vendeurs | Quartiers des vendeurs (SSF) (`ssf_quartier`) | `ssf_quartier` | Origine : déduite des visites, fichier client ou saisie manuelle ; une ligne modifiée ici devient manuelle et n'est plus recalculée par les imports |
| Distribution et vendeurs | Routing mensuel (`routing_mensuel`) | `routing_mensuel` | Merchandiser × jour × semaine du mois : point de visite, commune, point GPS et rayon, quartiers, SSF (§7 bis) |
| Distribution et vendeurs | Alias d'import (orthographes) (`alias_import`) | `alias_import` | Nom tel qu'écrit dans les fichiers → merchandiser, distributeur, SSF, point de visite (quartiers des PDV) ou commercial ; comparaison texte exact, commence par, contient |
| Points de vente | Catégories de PDV (`categorie_pdv`) | `categorie_pdv` | Level 3, libellé français, canal boutiques (GT) ou supermarchés (MT) |
| Points de vente | Types de PDV (`type_pdv`) | `type_pdv` | Level 4, libellé français, catégorie |
| Points de vente | Fréquence de visite (`frequence_visite`) | `frequence_visite` | Jours entre deux visites, par territoire et type (la ligne la plus précise l'emporte) ; au-delà, le PDV passe « en retard » dans la Synthèse par zone |
| Points de vente | Fenêtre de suivi (`parametre_suivi`) | `parametre_suivi` | En mois ; au-delà, un PDV bascule « à prospecter » |
| Produits | Catégories produit (`categorie_produit`) | `categorie_produit` | |
| Produits | Références (`reference_produit`) | `reference_produit` | Catégorie et rôle (phare = hero SKU) |
| Produits | Correspondance des références (`correspondance_reference`) | `correspondance_reference` | Produit du formulaire ↔ référence notée ; clé = catégorie + produit |
| Produits | Marques concurrentes (`marque_concurrente`) | `marque_concurrente` | |
| Produits | Références concurrentes (`marque_concurrente_sku`) | `marque_concurrente_sku` | |
| Produits | Catégories du relevé (`categorie_releve`) | `categorie_releve` | §4 bis |
| Perfect Store | Poids des références (`poids_reference`) | `poids_reference` | Référence × canal × pondération (taux de vente ou taux revu), poids de 0 à 1 |
| Perfect Store | Seuils de disponibilité (`seuil_disponibilite`) | `seuil_disponibilite` | Boutiques (GT) |
| Perfect Store | Seuils de disponibilité, supermarchés (MT) (`seuil_disponibilite_mt`) | `seuil_disponibilite_mt` | Quantité et faces en rayon par format |
| Perfect Store | Éléments de visibilité (PLV) (`element_visibilite`) | `element_visibilite` | |
| Application mobile | Paramètres terrain (`parametre_app`) | `parametre_app` | §8 |
| Application mobile | Canal des quotas (`canal_atom_sous_categorie`) | `canal_atom_sous_categorie` | Sous-catégorie de PDV → canal de la grille ; « Hors quota » = jamais proposé |
| Application mobile | Types d'action (`type_action_commerciale`) | `type_action_commerciale` | Désactiver plutôt que supprimer |
| Application mobile | Engins de vente (`engin_vente`) | `engin_vente` | |
| Application mobile | Objectifs de coaching (`coaching_objectif`) | `coaching_objectif` | Champ masqué dans l'app tant que la liste est vide |
| Application mobile | Grille de coaching, supermarchés (MT) (`coaching_critere`) | `coaching_critere` | Standards d'exécution MT ; vide tant que le client ne l'a pas fournie |
| Application mobile | Quotas du programme merchandiser (`quotas_atom`) | `routing_quota_canal` | Vue dédiée : grille canal × jour (§7 bis) |
| Application mobile | Tâches automatiques (`maintenance`) | (fonctions) | Vue dédiée, ancienne Maintenance (§12) |

Le level 4 pilote tout le scoring : ne renommez pas un type de PDV sans
revérifier son rattachement dans `Paramètres › Standards Perfect Store`,
section « Types de PDV ».

---

## 6. PDV, visites et produits

- **`Points de vente › Liste`** (`/admin/pdv`) : recherche, création,
  correction. La fiche porte le **code client du distributeur (DMS)**
  (`pdv.mdm`) et le **rayon de visite** propre au PDV (`rayon_geofence`, 20 à
  2 000 m ; vide = rayon des paramètres terrain). Un PDV sans coordonnées n'a
  ni rayon de visite ni ordre de tournée ; un compteur les signale.
  Onglets voisins : Répartition, Évolution, Historique (un PDV, par
  `?pdv_id=`), Distributeurs (`/admin/distributeurs`, section `parametres`).
- **`Visites › Toutes les visites`** (`/admin/visites`) : visites avec niveau
  Perfect Store, score, détail complet au clic (relevé, piliers, photos).
  Suppression : admin et superviseur. Onglets voisins : Évolution, Par
  catégorie, Par merchandiser (ex « Par commercial »), Coaching terrain.
- **`Perfect Store › Liste par niveau`** (`/admin/perfect-store/liste`) : tous
  les PDV visités, leur niveau et leur score, filtrables.
- **Produits** : la famille (EVAP, IMP, SCM…) est un filtre `?famille=` de
  `/admin/produits/familles`, et les onglets Disponibilité, Prix
  (`?vue=prix`) et Détail par visite (`?vue=releves`) gardent la famille
  choisie. Les anciens liens `/admin/produits/<famille>?tab=` redirigent (301,
  §1.5).
- **Import / Export** : `Paramètres › Import / Export` (§11). L'export des
  visites contient toutes les visites de la plage, avec statut et quantité de
  chaque produit du catalogue.

---

## 7. Utilisateurs, équipes, versions et permissions

- **`Paramètres › Utilisateurs`** (`/admin/users`, admin seulement) :
  création et édition des comptes (rôle parmi les cinq, employeur (agence)
  pour un merchandiser, agence obligatoire pour un compte agence, direction,
  territoires et quartiers assignés, commercial responsable, actif ou
  inactif). Un badge signale les merchandisers d'une agence « programme » et
  les comptes agence. L'export CSV contient l'agence et la direction.
- **`Paramètres › Équipes`** (`/admin/users/equipes`) : rattacher les
  merchandisers à un commercial (filtres « mon équipe », relances WhatsApp).
  L'enregistrement passe par `/api/admin/equipes` (admin seulement). Ne
  change pas ce que chacun voit.
- **`Paramètres › Versions de l'app`** (`/admin/users/versions`) : seul
  endroit pour la version minimale et la publication (§8). On y trouve aussi
  l'adoption de l'application (filtres statut, direction, employeur, rôle ;
  la synthèse suit les filtres) et l'inventaire « Comptes par direction et
  par rôle » (comptes de test exclus, personnes à plusieurs comptes
  signalées, « Exporter les comptes »). Un compte agence y voit ses
  merchandisers.
- Un **merchandiser** ne voit que les PDV de ses territoires (et de ses
  quartiers s'ils sont renseignés). Admin et superviseur voient tout ; le
  compte agence, son agence (§1.3).
- **`Paramètres › Permissions`** (`/admin/permissions`, admin seulement) :
  matrice rôle × section (`role_section_access`, clés inchangées :
  `principal`, `perfect-store`, `pdv`, `visites`, `visibilite`,
  `concurrence`, `produits`, `actions`, `parametres`). Colonnes Admin
  (cochée, verrouillée), Superviseur, Commercial, Agence, Merchandiser.
  Chaque ligne liste les écrans qu'elle couvre (`sectionCoverage`, lu dans le
  registre). Une case s'enregistre aussitôt ; le message propose
  « Annuler ». Sous la matrice : les écrans que le compte agence ouvre
  toujours (`ecransOuvertsA('agence')`), et le rappel qu'Utilisateurs et
  Permissions restent réservés à l'administrateur. Seul l'admin peut écrire
  dans la table (politique `rsa_admin_write`).

---

## 7 bis. Programme merchandiser : agences, routing mensuel, quotas

Principe : chaque PDV du portefeuille d'un merchandiser d'agence est visité
**une fois par mois civil**. L'agence fixe son **routing mensuel** : pour
chaque jour de chaque semaine du mois (1 à 4), un point de visite et, souvent,
le **vendeur du distributeur (SSF)** avec qui il travaille ce jour-là. SSF et
merchandiser dépendent du **commercial** ; aucun ne dirige l'autre, ils
passent dans les mêmes PDV, l'un pour vendre, l'autre pour l'exécution.

| Je veux… | Où | Table |
|---|---|---|
| Créer ou nommer une agence, sa direction, « programme » | `Paramètres › Référentiels`, liste « Agences » | `agence` |
| Rattacher un merchandiser à son agence | `Paramètres › Utilisateurs`, champ « Employeur (agence) » | `profiles.employeur` |
| Donner au responsable de l'agence son propre accès | `Paramètres › Utilisateurs`, rôle « Agence », champ « Agence » (§1.3) | `profiles.role`, `profiles.employeur` |
| Charger le routing mensuel de l'agence | `Paramètres › Import / Export`, Imports terrain, « Routing mensuel des merchandisers (fichier de l'agence) » (admin ou compte agence) | `routing_mensuel` |
| Rattacher un lieu, un nom de merchandiser, de SSF ou de commercial | `Paramètres › Référentiels`, liste « Alias d'import (orthographes) » | `alias_import` |
| Corriger une case (point de visite, commune, point GPS, SSF) | `Paramètres › Référentiels`, liste « Routing mensuel » | `routing_mensuel` |
| Créer ou corriger un SSF (dont son commercial) | `Paramètres › Référentiels`, liste « Vendeurs des distributeurs (SSF) » | `ssf` |
| Quartiers d'un SSF | `Paramètres › Référentiels`, liste « Quartiers des vendeurs (SSF) » | `ssf_quartier` |
| Charger les tournées des SSF (fichier du distributeur) | `Paramètres › Import / Export`, Imports terrain, « Tournées des vendeurs du distributeur (SSF) » | `ssf_pdv` |
| Voir les PDV hors tournée du SSF | `Planning › Écarts de tournée` | `ecarts_binome_resume(jour)`, `ecarts_binome` |
| Nombre de PDV par canal et par jour | `Paramètres › Référentiels`, liste « Quotas du programme merchandiser » | `routing_quota_canal` |
| Canal d'une sous-catégorie de PDV | `Paramètres › Référentiels`, liste « Canal des quotas » | `canal_atom_sous_categorie` |
| 5e semaine du mois (jours 29 à 31) | `Paramètres › Référentiels`, liste « Paramètres terrain », `routing_semaine_5` | `parametre_app` |
| Suivi du mois | `Planning › Programme merchandiser` (direction South ou North) | `programme_merchandiser(mois, direction)` |

**Fichier de l'agence** (`.xlsx` ou `.csv`) : une ligne par case. Colonnes
reconnues (`scripts/lib/imports/routing-mensuel.mjs`) : Zone (secteur),
Commune, Quartier, Merchandiser, Distributeur, Sales rep (commercial), Jour,
**Occurrence** (semaine du mois : « 1 », « 1, 3 », « Toutes » ; vide = les
4 semaines), Point de visite, SSF (« Aucun SSF » possible), Type SSF (engin),
et, facultatives, Latitude, Longitude, Rayon. Il faut au moins Merchandiser,
Jour et Point de visite (ou Quartier, ou Zone). Un exemple fictif
(merchandiser « EXEMPLE ») se télécharge depuis la carte d'import :
`/guides/exemple-routing-mensuel.csv` (connexion requise) ; le simuler
n'écrit rien. L'import :

- met le routing à jour **sans doublon** (clé merchandiser × jour × semaine)
  et désactive les cases d'un merchandiser cité qui ne sont plus dans le
  fichier ; seuls les merchandisers du fichier sont modifiés ;
- remplace les règles « SSF — » et « Routing mensuel — » du merchandiser par
  une règle par (jour, lieu, SSF) avec ses semaines
  (`routing_templates.semaines_du_mois`) ;
- passe la règle de portefeuille (« Portefeuille DMS ») en **repli**
  (`repli = true`) : elle ne sert que les jours sans case applicable
  (5e semaine, case vide, lieu non reconnu) ;
- met à jour les quartiers des SSF, rattache un SSF sans commercial au
  commercial de ses cases, élargit le périmètre du merchandiser ;
- en option, recalcule les tournées des 7 prochains jours.

**Lieu d'une case** :

- avec un **point GPS** (Latitude, Longitude, Rayon de 100 à 3 000 m,
  500 m par défaut) : les PDV du portefeuille du merchandiser (son
  distributeur, celui du SSF) dans ce rayon (migration
  `20261009160000_friesland_routing_mensuel_point.sql`) ;
- sinon, le point de visite est cherché parmi les quartiers des PDV,
  **toujours dans la commune de la ligne** et les zones principales du
  portefeuille, jamais ailleurs : alias « Point de visite » validé, libellé
  identique, puis libellé approché (signalé dans le rapport, 4 quartiers au
  plus) ;
- quartier introuvable : la case vaut pour la commune (portefeuille du
  merchandiser dans la commune) ; sans commune, tout le portefeuille.

L'import ne change jamais le commercial des merchandisers : les écarts entre
le fichier et la base sont signalés. Les noms écrits autrement (orthographe,
civilité, mots en plus) sont reconnus. Ceux qui restent incertains se
règlent par un **alias**, puis par une nouvelle simulation. Aucun
rapprochement approximatif n'est appliqué seul.

**Corriger une case** dans la liste « Routing mensuel » refait aussitôt les
règles du merchandiser et ses tournées des 7 jours à venir (celle du jour ne
change pas) ; la correction vaut jusqu'au prochain import.

**Tournée du jour** (générée chaque nuit pour 7 jours,
`etapes_quota_du_jour`) : d'abord les PDV de la case du jour (point GPS, ou
quartiers du point de visite, ou commune), puis ceux des quartiers du SSF,
puis le portefeuille du merchandiser **le plus proche du lieu** pour
atteindre le quota ; quotas par canal ; un canal absent est complété par des
boutiques ; jamais un PDV déjà planifié ou visité dans le mois (migration
`20261009140000_friesland_quota_complement_au_plus_pres.sql`). Un complément
(sous-zone du SSF ou portefeuille) à plus de **1,5 km** du lieu ne sert plus
au quota d'un canal : une boutique proche le remplace ; il n'est pris qu'en
dernier recours, pour atteindre le quota du jour (migration
`20261010120000_friesland_quota_limite_1500m.sql`). Grille de
lancement, commune aux directions : 20 PDV du lundi au jeudi, 15 le
vendredi, 10 le samedi (Superette, Boutique, Aboki et Kiosque, Pushcart,
Porridge) ; pas de tournée le dimanche. Semaine du mois = (jour − 1) ÷ 7 + 1.
La 5e semaine (jours 29 à 31) suit le paramètre `routing_semaine_5` :

- 0 = portefeuille seul (défaut) ;
- 1 = reprendre la semaine 1 ;
- 4 = reprendre la semaine 4.

**Écarts de tournée** (`Planning › Écarts de tournée`,
`/admin/routing/ecarts-ssf`) : pour un jour, chaque tournée de merchandiser
est comparée à la tournée, dans le fichier du distributeur, du SSF prévu ce
jour-là. Statuts : Aligné, Écart (détail des PDV et du vendeur qui les suit
dans le fichier du distributeur), Tournée du vendeur manquante (importer
« Tournées des vendeurs du distributeur (SSF) »), Sans vendeur ce jour. Le
fichier du distributeur ne donne pas le jour : un PDV de sa tournée vaut pour
tous les jours du SSF. Un commercial y voit son équipe ; un compte agence,
ses merchandisers.

**Planning d'équipe** : `Planning › Tournées` (`/admin/routing`) propose
trois affichages, mémorisés sur le poste : Planning d'équipe (grille
personne × jour, lundi → samedi : PDV faits / prévus, « Prévue par une
règle, à générer », SSF du jour ; un filtre par agence ; un clic ouvre la
tournée du jour), Liste par personne (avec une date de début et une date de fin) et Calendrier
(d'une personne). Actions : Exporter ; Nouvelle tournée (sauf agence) ;
Modèle de fichier (Excel) et Importer (admin). `Planning › Règles
récurrentes` (`?vue=regles`) : règles par personne, Générer les 7 prochains
jours, Générer sur une période, Nouvelle règle, exceptions, PDV du
portefeuille d'une règle. Le compte agence consulte ces deux onglets sans
rien modifier.

**Objectif mensuel** (`Planning › Programme merchandiser` et écran mobile
« Mes objectifs ») : la grille additionnée sur les jours de tournée du mois
(420 sur quatre semaines pleines, 465 en octobre 2026). La direction se
choisit par un contrôle segmenté South | North (`?direction=south` ou
`north`) avec le mois ; South = ex-Programme Atom ; North se remplit dès que
des merchandisers sont rattachés à une agence de direction North. Colonnes :
Portefeuille, Éligibles, Planifiés, Visités, Perfect Store, Objectif du mois,
Reste à visiter.

**Après un changement** de routing, de règle ou de grille :
`Paramètres › Référentiels`, liste « Tâches automatiques » → **Recalculer
les tournées à venir** (§12). Les tournées non commencées sont refaites ;
celle du jour n'est jamais modifiée. La grille des quotas propose aussi
« Appliquer aux tournées à venir ».

**Côté téléphone**

- Plus → **Ma semaine (SSF)** : le SSF de chaque jour de la semaine en cours,
  son téléphone et les quartiers, hors ligne. Quand la base a la fonction
  `routing_semaine` (migration `20261008130000`), la page montre aussi le
  point de visite, la semaine du mois et les jours sans SSF ; sinon elle se
  limite au planning SSF.
- Champ SSF dans la visite, prérempli avec le SSF du jour, « autre » pour un
  nom libre ; bandeau orange si le PDV est hors des quartiers du SSF (non
  bloquant). Le SSF est enregistré dans la visite (`visites.ssf_id` /
  `ssf_brut`).

**Données de départ** : cases reprises des règles « SSF — » en place (origine
« Règle existante », déduites des visites de septembre). Le routing mensuel
de l'agence les remplace dès qu'il est appliqué.

**Field coaching** : le vendeur coaché en boutiques (GT) est un SSF (choisi
parmi les SSF du distributeur ; la liste des PDV se limite à ses clients du
fichier du distributeur). Objectif du coaching : liste « Objectifs de
coaching » (champ masqué tant qu'elle est vide). Coaching **supermarchés
(MT)** (un commercial MT suit un merchandiser, standards d'exécution MT) :
proposé quand la liste « Grille de coaching, supermarchés (MT) » sera
remplie. Rapport filtrable GT / MT dans `Visites › Coaching terrain`.

---

## 8. Application mobile (ce que vos réglages pilotent)

- **Sélection du PDV** : chaque option affiche `Nom (Territoire) · GT/MT` ;
  après sélection, un badge indique boutiques (GT) ou supermarchés (MT) et le
  type.
- **Disponibilité** : une étape par **catégorie active** du catalogue (§4
  bis), saisie des **quantités** par produit. Si le PDV est en supermarché
  (MT) et que la catégorie a les faces en rayon, un champ **« F »
  (facings)** apparaît à côté de chaque quantité ; il est requis par la règle
  MT (quantité ET facings). Le champ s'encadre en orange si la valeur saisie
  est sous le minimum.
- **Visibilité / Promotion** : les éléments affichés viennent de la **matrice
  du segment** du PDV (un supermarché affiche Niche, Top shelf, Bacs… ; une
  boutique affiche Réglette, Maison BR…). Modifier la matrice dans l'admin
  change le formulaire mobile.
- **Création de PDV** (merchandiser) : cascade Catégorie → Type (le canal se
  déduit), Territoire → Zone, **distributeur** proposé : ceux de la zone
  commerciale (s'il y en a), sinon ceux du territoire, plus les nationaux.
- **Hors ligne** : les visites et les statuts d'étape de tournée se mettent
  en file et se synchronisent au retour du réseau ; le score est calculé à la
  synchronisation. Le catalogue, les paramètres et le planning SSF sont
  gardés sur le téléphone.

### Paramètres terrain (`Paramètres › Référentiels`, liste « Paramètres terrain »)

Lus par l'app 1.0.12 à son lancement et à chaque retour au premier plan
(cache hors ligne). Portée : « Tous les utilisateurs », ou une agence (Atom
BTL, FrieslandCampina…), qui prime pour ses utilisateurs. Bornes contrôlées.

| Paramètre | Départ | Effet |
|---|---|---|
| `geofence_rayon_m` | 300 m | Rayon de visite : distance maximale agent ↔ PDV ; rayon des PDV sans rayon propre |
| `gps_precision_min_m` | 10 m | Au-delà : visite enregistrée « GPS non validé » (motif précision), l'agent est prévenu |
| `gps_precision_pdv_max_m` | 30 m | Pour géolocaliser un PDV depuis le terrain |
| `gps_precision_tournee_max_m` | 50 m | Points de trajet moins précis ignorés |
| `tracking_intervalle_s` / `tracking_distance_m` | 120 s / 15 m | Fréquence des points de tournée |
| `tracking_envoi_s` / `tracking_lot_max` | 300 s / 200 | Envoi groupé des points |
| `objectif_visites_jour` | 10 ; vide pour Atom | Objectif de l'accueil ; vide = taille de la tournée du jour |
| `routing_semaine_5` | 0 | Tournées des jours 29 à 31 (§7 bis) |

### Version minimale et publication (`Paramètres › Versions de l'app`)

C'est le seul endroit pour ces deux réglages (admin). La version minimale
(`version_app`, plateforme android) : « Modifier la version minimale », par
son numéro interne (1.0.10 = 13, 1.0.12 = 15…) ; en dessous, l'application
affiche un écran de mise à jour obligatoire. Vérifiez d'abord dans le
tableau d'adoption que la plupart des comptes l'ont installée.

Section **Publier une nouvelle version** :

1. Choisir l'APK signé (`friesland-bonnet-rouge-<version>-release.apk`) : la
   page lit son `versionCode` et refuse une version plus ancienne.
2. Publier **sans** « Rendre cette version obligatoire » : le lien de
   téléchargement est mis à jour, les téléphones 1.0.12 et suivants proposent
   la mise à jour sans bloquer.
3. Quand la version est **en ligne sur le Play Store**, republier en cochant
   **Rendre cette version obligatoire** (message facultatif, confirmation) :
   les versions plus anciennes sont bloquées sur l'écran de mise à jour.
4. Suivre l'adoption dans le tableau de la même page.

Procédure complète, AAB et Play Console : `docs/play-store/PUBLIER-MISE-A-JOUR.md`.

---

## 9. Procédures courantes (pas à pas)

**Changer un seuil de disponibilité en boutiques (GT)** (par exemple BR Gold
en Boutique A : 24 → 30)

1. `Paramètres › Référentiels`, liste « Seuils de disponibilité » : chercher
   « BR Gold », ligne Boutique / A, Modifier.
2. `Paramètres › Standards Perfect Store` : **Recalculer toutes les
   visites**.

**Changer un standard en supermarchés (MT) (quantité ou faces en rayon)**

1. `Paramètres › Référentiels`, liste « Seuils de disponibilité,
   supermarchés (MT) » : ligne référence × format, Modifier.
2. **Recalculer toutes les visites**. L'édition est effective tout de suite
   pour les nouvelles visites : le moteur lit cette table en direct.

**Rendre un élément de visibilité exigé pour un niveau**

1. `Paramètres › Standards Perfect Store`, section « Visibilité exigée » :
   choisir le segment, cocher la case élément × niveau, Enregistrer.
2. **Recalculer toutes les visites**.

**Affecter un distributeur différent à une zone commerciale précise**

1. `Paramètres › Référentiels`, liste « Zones des distributeurs » : Ajouter,
   choisir la zone et le distributeur. Supprimer les lignes héritées du
   territoire si elles ne s'appliquent plus à cette zone.
2. Aucune autre action : la création de PDV mobile propose aussitôt le bon
   distributeur.

**Ajouter un distributeur**

1. `Paramètres › Référentiels`, liste « Distributeurs » : Ajouter (cocher
   « Couverture nationale » s'il couvre tous les territoires).
2. Le rattacher : listes « Territoires des distributeurs » et, au besoin,
   « Zones des distributeurs ».

**Créer le compte d'une agence**

1. Vérifier que l'agence existe : `Paramètres › Référentiels`, liste
   « Agences » (code, direction, « programme »).
2. Vérifier que ses merchandisers ont cette agence comme employeur
   (`Paramètres › Utilisateurs`).
3. `Paramètres › Utilisateurs` : nouveau compte, rôle « Agence », champ
   « Agence ». Le mot de passe suit la règle des 12 caractères (§1.1) ; il
   est remis séparément.
4. Contrôler avec le compte : il n'arrive que sur ses merchandisers
   (`Planning › Tournées`, `Visites`).

**Activer une promotion dans le score**

- La promotion est comptée par visite : le merchandiser coche « promotion
  applicable » puis les types en place (standard, hôtesses, dégustation ;
  plot et hôtesses en supermarchés). Si elle n'est pas applicable, elle est
  exclue du score (pas de pénalité).

**Vérifier « pourquoi ce PDV n'est pas Flagship »**

- `Perfect Store › Vue d'ensemble`, tableau « Passer au niveau supérieur » :
  la ligne du PDV liste les critères exacts qui manquent. Ou
  `Perfect Store › Écarts au standard`. Sinon `Visites › Toutes les visites`,
  clic sur la visite : détail des piliers.

---

## 10. Dépannage

| Symptôme | Cause probable | Correction |
|---|---|---|
| Les scores n'ont pas bougé après la modification d'un standard | Recalcul non lancé (le bandeau « recalcul en attente » le rappelle) | `Paramètres › Standards Perfect Store` : **Recalculer toutes les visites** |
| Un poids modifié dans Standards ne change rien | La section édite les poids cibles (`taux_revu`), le moteur note avec `taux_vente` | Voir §4 ; liste « Poids des références », puis recalculer |
| Un PDV « Non évaluable » ou dispo vide | Type du PDV non rattaché à un segment/grade | Standards, section « Types de PDV » : rattacher le type |
| Un supermarché est noté 0 en visibilité | Visite saisie avant la matrice MT (anciens codes) | Refaire une visite (le formulaire propose les bons éléments) ou recalculer après correction |
| Un PDV en supermarché (MT) chute en dispo alors que le stock est bon | Faces en rayon non saisies (règle MT = quantité ET facings) | Saisir les facings dans la visite |
| Le distributeur proposé n'est pas le bon | Rattachement zone ou territoire | `Paramètres › Référentiels`, listes « Zones des distributeurs » / « Territoires des distributeurs » |
| Un merchandiser ne voit pas ses PDV | Territoires assignés ≠ territoire du PDV (texte exact) | `Paramètres › Utilisateurs` : aligner les territoires ; ou liste « Alias de territoire » |
| « Ces listes n'ont pas pu être chargées : … » dans les Référentiels | Migration `supabase/nouveau/` non appliquée | Appliquer les migrations dans l'ordre des horodatages (§13) |
| « Vous n'avez pas accès à « … » » | Section fermée pour ce rôle, ou onglet réservé (Utilisateurs, Permissions : admin ; Tournées et Règles : admin, superviseur, agence) | `Paramètres › Permissions` (case de la section) ; changer de rôle si l'onglet est réservé |
| Un compte agence ne voit aucun merchandiser | Ses merchandisers n'ont pas son agence comme employeur, ou migrations agence non appliquées | `Paramètres › Utilisateurs` (Employeur (agence)) ; migrations `20261010100000`, `20261010110000` |
| L'Activité d'un compte agence affiche des compteurs vides | Statistiques précalculées globales, fermées à l'agence (§1.3) | Normal ; ses visites restent dans `Visites` |
| Une tournée d'agence sort du lieu du jour | Point de visite non rattaché (alias manquant), mauvaise commune, ou case à corriger | Liste « Alias d'import (orthographes) » (type Point de visite), liste « Routing mensuel » (commune, point GPS), puis Recalculer les tournées à venir |
| Écarts de tournée : « Tournée du vendeur manquante » | Tournée du SSF non chargée | Import « Tournées des vendeurs du distributeur (SSF) » |
| Un jour sans tournée Atom | Aucune règle active ce jour (ou règle suspendue) | `Planning › Règles récurrentes` : cocher le jour sur la bonne règle |
| « Ce produit est noté au Perfect Store… » en retirant un produit | Correspondance existante | Retirer la correspondance, puis le produit |
| Un nom du fichier du distributeur (DMS) ou d'Atom n'est pas reconnu | Variante d'écriture | Liste « Alias d'import (orthographes) », puis relancer la simulation |
| Les tableaux de bord ne reflètent pas un import | Statistiques recalculées chaque heure | Liste « Tâches automatiques » : **Rafraîchir les statistiques maintenant** |

---

## 11. Import / Export (`Paramètres › Import / Export`, `/admin/import-export`)

Ouvert à la section `parametres` et, par `ouvertA`, au compte agence, qui ne
voit que la carte « Routing mensuel des merchandisers ».

**Importer des points de vente** (CSV au format de l'export des PDV ; pas
pour l'agence) : le fichier est lu, puis un **aperçu** montre le nombre de
lignes, celles avec un PDV ID (mise à jour si le PDV existe) et sans (nouveau
PDV), les 5 premières lignes (PDV ID, Nom du PDV, Canal, Zone, Quartier) et
une alerte si la colonne « Nom du PDV » manque. Le bouton
« Importer N points de vente » ouvre une **confirmation** ; rien n'est écrit
avant.

**Exporter** : visites de la période (Du / Au), tous les PDV ; les tournées
s'exportent depuis `Planning › Tournées` (Exporter), au format réimportable.

**Imports terrain** (`components/AdminImportsTerrain.vue`) : réservés à
l'admin (les cinq) et au compte agence (routing mensuel de ses
merchandisers). Un superviseur à qui l'on a ouvert Paramètres voit le
message « réservés aux administrateurs ». Ils remplacent les scripts de
l'équipe technique.

| Import | Fichier | Ce qu'il fait |
|---|---|---|
| Clients du distributeur (DMS) vers les points de vente | Fichier des clients du distributeur (.xlsx) | Relie chaque client à son PDV par le code client, le nom et le GPS ; crée les clients manquants près de leurs voisins. Option : un point GPS partagé par N clients ou plus est le dépôt du distributeur, écarté |
| Affectation des merchandisers (DMS) | Fichier des clients du distributeur et, facultatif, fichier des mails des merchandisers (.xlsx) | Périmètre de chaque merchandiser et sa règle « Portefeuille DMS », employeur ; tournées à partir d'une date, génération des 7 premiers jours en option. Après l'import des clients |
| Visites Atom (export Bonnet Rouge) | Export Bonnet Rouge, feuille « Routing détaillé » (.xlsx) | Importe les visites (préfixe `ATOM-`, jamais deux fois), retrouve ou crée les PDV, rattache distributeur et SSF |
| Routing mensuel des merchandisers (fichier de l'agence) | Fichier de l'agence (.xlsx ou .csv) ; exemple téléchargeable | Routing sans doublon, règles par jour et semaine, portefeuille en repli, quartiers et commercial des SSF, périmètres ; recalcul des 7 prochains jours en option (§7 bis) |
| Tournées des vendeurs du distributeur (SSF) | Fichier des clients du distributeur (.xlsx) | Tournée de chaque SSF (`ssf_pdv`), SSF manquants créés ; sert aux Écarts de tournée. Après l'import des clients |

Déroulé : **Simuler** (aucune écriture ; résumé, rapport et CSV
téléchargeables) → relire → **Appliquer (N écritures)** (par lots,
progression, relançable sans doublon ; impossible tant qu'un point bloquant
est signalé) → **Historique des imports** (chaque lot, avec **Annuler le
lot**, confirmé, pour défaire ses écritures). Un nom mal reconnu se corrige
dans la liste « Alias d'import (orthographes) ».

Côté serveur : `/api/admin/imports/[type]/appliquer` revalide chaque
opération (types autorisés pour l'import, colonnes en liste blanche),
50 opérations au plus par envoi, et tient l'avancement du lot (`import_lot`).
Pour un compte agence : imports de `IMPORTS_AGENCE` seulement, portée
vérifiée opération par opération (§1.3).

---

## 12. Tâches automatiques (`Paramètres › Référentiels`, liste « Tâches automatiques »)

Ancienne « Maintenance » (`components/AdminMaintenance.vue`).

- **Tournées** : choisir les merchandisers concernés (une agence ou tous),
  puis **Recalculer les tournées à venir** (`recalculer_tournees_a_venir`,
  après un changement de routing, de règle ou de grille) ou **Générer les
  tournées manquantes (7 jours)** (`materialiser_routings_periode`). Seules
  les tournées à venir non commencées sont refaites ; celle du jour ne change
  jamais.
- **Statistiques des tableaux de bord** : **Rafraîchir les statistiques
  maintenant** (`programmer_rafraichissement_stats`) ; sinon chaque heure.
  Le calcul tourne en arrière-plan, les tableaux sont à jour moins d'une
  minute plus tard.
- **Tâches planifiées** (`etat_taches_planifiees`) : état, dernier passage,
  message d'erreur, horaire modifiable (`modifier_horaire_tache`) au format
  cron à cinq valeurs (minute, heure, jour du mois, mois, jour de la
  semaine ; 0 = dimanche), traduit en clair sous le champ. Heure d'Abidjan =
  UTC.

---

## 13. Ce qui reste du ressort de l'équipe technique

Restent dans le code, car ils changent la structure de l'application :

- la liste des rôles (contrainte `profiles_role_check`, `utils/roles.ts`,
  `AdminRole` et `MANAGED_ROLES`) et le registre de navigation
  (`utils/adminNavigation.ts`, §1.5) ; la matrice Permissions, elle, se règle
  dans l'admin ;
- les objectifs d'une étape de tournée (Stock, Encaissement, Photos,
  Merchandising, Prospection), les questions du field coaching, les textes
  des notifications ;
- les guides PDF (sources `docs/guides/source/`, génération
  `scripts/generer-guides-pdf.mjs`) et l'exemple de routing mensuel
  (`server/assets/guides/`) ;
- la construction de l'application Android (APK, AAB) et sa publication sur
  le Play Store (`docs/play-store/PUBLIER-MISE-A-JOUR.md`) ;
- les migrations de la base (`supabase/nouveau/`), appliquées une à une, dans
  l'ordre des horodatages. Avant d'en appliquer une, vérifiez lesquelles la
  production a déjà. Pour la version 1.0.12, après celles de la 1.0.11
  (`20261006120000`, `20261006130000`) :
  1. `20261007100000_friesland_ssf_sous_zones.sql`
  2. `20261007110000_friesland_admin_autonomie.sql`
  3. `20261007120000_friesland_parametres_app.sql`
  4. `20261007130000_friesland_catalogue_releve.sql`
  5. `20261007140000_friesland_import_lot.sql`
- puis, pour le programme merchandiser, le routing mensuel et le rôle
  agence :
  1. `20261008100000_friesland_agence.sql`
  2. `20261008110000_friesland_direction_profil.sql`
  3. `20261008120000_friesland_ssf_commercial.sql`
  4. `20261008130000_friesland_routing_mensuel.sql`
  5. `20261008140000_friesland_routing_ssf.sql`
  6. `20261008150000_friesland_programme_merchandiser.sql`
  7. `20261008160000_friesland_field_coaching_mt_objectif.sql`
  8. `20261009100000_friesland_alias_routing_agence.sql`
  9. `20261009110000_friesland_ssf_source_imports.sql`
  10. `20261009120000_friesland_routing_mensuel_commune.sql`
  11. `20261009130000_friesland_ssf_contraintes_prod.sql`
  12. `20261009140000_friesland_quota_complement_au_plus_pres.sql`
  13. `20261009150000_friesland_alias_quartier_rouge.sql`
  14. `20261009160000_friesland_routing_mensuel_point.sql` (avant le
      déploiement du front qui écrit le point GPS)
  15. `20261010100000_friesland_role_agence.sql`
  16. `20261010110000_friesland_role_agence_cloisonnement.sql` (les deux
      avant de créer un compte agence)
  17. `20261010120000_friesland_quota_limite_1500m.sql`
- la table historique `zones_secteurs` : plus éditée dans l'admin, mais
  encore lue par le préchargement hors ligne de l'application
  (`composables/useOfflineData.ts`). La retirer d'abord du code, puis de la
  base une fois les téléphones mis à jour.

---

## Annexe : conformité au fichier client (vérifiée le 16/07/2026)

Comparaison automatique base ↔ `docs/big-five-kpi-csv/` :

- **Seuils de disponibilité GT et MT (quantités et facings)** : 167 valeurs,
  0 écart.
- **Pondérations** (taux de vente et taux revus, GT et MT) : 0 écart (SCM MT
  maintenu à 2 références, arbitrage Friesland du 15/07).
- **Matrices de visibilité** : conformes pour boutique, superette,
  kiosque/aboki, porridge, pushcart, table top ; matrice **MT dédiée** créée
  depuis `crictere-perfect-store-mt.csv` (les supermarchés ne sont plus notés
  sur la matrice superette).
- **Types de PDV** : 41/41 présents (level 3 → level 4).
- **Distributeurs** : les 37 du fichier, plus les ajouts arbitrés (LKA
  SERVICES, placeholders Adzopé/Agboville).
- **Territoires et zones** : hiérarchie complète, équivalences North/South =
  `UP COUNTRY` / `ABIDJAN`.
