# Prompt Claude Code — Changements réunion FrieslandCampina (23 juillet)

> Copie tout le bloc ci-dessous dans Claude Code (dossier `frieslandv3`).
> Ce prompt reprend **uniquement les demandes concrètes d'Agbetou Emmanuel (le décideur)** et **ce que Jean-Luc Houédanou a confirmé** pendant la réunion. Chaque tâche est marquée « ✅ Confirmé JL ».

---

## Contexte

Projet `frieslandv3` : dashboard admin (Nuxt 3 + Supabase) + app mobile (Capacitor/Android) pour le suivi des merchandisers FrieslandCampina (Bonnet Rouge, Côte d'Ivoire).

Traite les tâches **une par une**, lis le code avant de modifier. Après chaque tâche : `npm run lint` + tests concernés.

**Où travailler :**
- Perfect Store : `pages/admin/perfect-store/`, `composables/usePerfectStore.ts`, `components/StatsCard.vue`, `components/DashboardFilters.vue`
- Couverture / Visites : `pages/admin/index.vue`, `pages/admin/visites/`, `stores/visites.ts`, `composables/useUserScope.ts`
- Présence / Disponibilité : `pages/admin/produits/`, `composables/useSkuThresholds.ts`, `components/VisibilityPresenceTile.vue`
- Routing : `pages/admin/routing/index.vue`, `stores/routing.ts`, `composables/useRouting.ts`
- Concurrence : `pages/admin/concurrence/`

---

## Tâche 1 — Perfect Store : le NOMBRE d'abord, le % en dessous ✅ Confirmé JL

Demande Agbetou : « ce qui est important, c'est **combien de points de vente j'ai en Perfect Store**, le nombre. Par exemple 10 Perfect Store. Et **en dessous, le pourcentage**. C'est juste inversé. »

À faire :
1. Afficher **le nombre absolu** en grand (ex. `10`), le pourcentage **en dessous, en petit**.
2. **Sur la même ligne, à côté du nombre**, décomposer par **niveau** : Flagship, VIP, … Basic (ex. sur 1000 : 500 Flagship, X VIP, … Basic). *(« tu as le nombre, et à côté les onglets par niveau »)*
3. Tout doit **se recalculer automatiquement** quand on change le filtre ville / distributeur / pays / cluster. *(« quand on sélectionne la ville, le distributeur, le cluster, ça change »)*
4. Ajouter un **filtre de période** (un PDV Perfect Store cette semaine peut ne plus l'être la suivante). → Jean-Luc a confirmé avoir déjà ajouté la période aux filtres, à finaliser.

---

## Tâche 2 — Couverture : garder l'« effective », ajouter la « couverture des visites » (performance) ✅ Confirmé JL

Demande Agbetou : la couverture actuelle (PDV comptés **une seule fois**) est bonne → c'est la **« couverture effective »**, on la garde. Mais il manque **la performance du vendeur** : « un vendeur doit faire **20 PDV/jour**. S'ils sont 10, on doit faire 200 PDV/jour. Il faut mesurer **le nombre de fois** que le gars est passé. »

À faire :
1. **Garder** le KPI actuel = **« Couverture effective »** (PDV uniques sur l'univers assigné, ex. 14/16). Ne pas y toucher au calcul.
2. Ajouter **« Couverture des visites »** = **nombre total de visites** (les passages multiples comptent), pour suivre l'objectif journalier (20 PDV/jour/merchandiser). Cette donnée est déjà dans la table `visites`.
3. **Faire remonter ce chiffre sur l'écran principal**, avec **le détail des PDV visités par merchandiser** (pour voir s'il a visité plusieurs fois le même PDV). *(Jean-Luc : « je prends ça en note, je vais modifier ça, et surtout faire remonter ça sur la liste de l'écran principal. »)*

---

## Tâche 3 — Filtre période (jour / semaine / mois) OBLIGATOIRE partout ✅ Confirmé JL

Demande Agbetou : « on a **toujours besoin** de filtre par mois, par semaine, par jour… l'idée c'est de **suivre les gars jour après jour**. » Il précise que le filtre par mois est **obligatoire** sur l'onglet Visites.

À faire : ajouter des filtres **jour / semaine / mois** cohérents sur **tous les KPI** (Perfect Store, Couverture, Présence, Disponibilité, Visites, Concurrence). Jean-Luc : « le site sera mis à jour avec ces informations. »

---

## Tâche 4 — Nouveau KPI « Taux de présence » (≠ disponibilité) ✅ Confirmé JL

Demande Agbetou, distinction claire :
- **Présence** = « je le vois » (quantité relevée ≥ 1). C'est la **distribution numérique**.
- **Disponibilité** = quantité relevée **≥ seuil** paramétré. On peut avoir présence 80 % mais disponibilité 40 %.

Jean-Luc confirme : le **seuil de stock définit la disponibilité** (pas la présence), et « **je vais rajouter le taux de présence**, il n'est pas mesuré dans l'application ».

À faire :
1. Ajouter le KPI **« Taux de présence »** sur le dashboard (même fenêtre que Perfect Store / Couverture / Taux de disponibilité).
2. Affichage synthétique **prioritaire** : d'abord par **catégorie**, puis les **2 SKU clés + le DELIS**. *(« ce qui est prioritaire, c'est d'abord la catégorie, puis les 2 SKU plus le DELIS »)*

---

## Tâche 5 — Routing : paramétrer une fois, mise à jour (pas écrasement), changement de territoire ✅ Confirmé JL

Demande Agbetou (2 cas concrets) : après avoir uploadé le routing d'une semaine, « **je ne dois pas revenir paramétrer chaque matin** ». Il doit pouvoir paramétrer toute la période d'un coup, puis la semaine suivante remettre de nouveaux PDV ou recharger les mêmes. Il précise aussi : « on n'a pas assez de merchandisers, **il va tourner chez nos distributeurs, il peut changer de territoire**. »

Jean-Luc confirme :
1. **Import CSV en mode mise à jour, pas écrasement** : à la réimportation, mettre à jour les entrées existantes au lieu de créer des doublons. *(« mettre à jour lors de l'importation du CSV plutôt que d'écraser »)*
2. **Paramétrage pour toute la période en une fois** : si le fichier couvre lundi→fin de mois, pas besoin de se reconnecter chaque jour.
3. **Changement de territoire / distributeur en cours de mois** supporté (un merchandiser peut passer d'un distributeur/zone à un autre). Jean-Luc : « c'est prévu dans le système, il est possible de changer de territoire aux merchandisers. »
4. Le contrôle de **proximité géographique** (« rapprochez-vous du PDV ») reste actif. PDV toujours choisi dans une **liste fermée**, jamais en texte libre.

> Note : Diarra a proposé en plus un modèle **récurrent façon DMS** (« ce PDV chaque lundi », décochable par semaine). Jean-Luc l'a noté comme « logique définitive du routing » — à implémenter si le temps le permet, mais **la priorité Agbetou est : paramétrer une fois + import en mise à jour**.

---

## Tâche 6 — Une nouvelle visite n'écrase pas l'ancienne ✅ Confirmé JL

Point validé : quand un merchandiser repasse dans un PDV (dispo, affiches, quantités différentes), les nouvelles infos **ne remplacent pas** les anciennes → c'est **une nouvelle visite**, l'historique est conservé. Vérifier que c'est bien le cas partout.

---

## Tâche 7 — Concurrence : présence + activité par concurrent ✅ Confirmé JL

Demande Agbetou : aujourd'hui on ne mesure que **la présence** du concurrent. Il veut, pour **chaque concurrent listé** : « est-ce qu'il est **présent** ou pas », puis « est-ce qu'il est **en activité** ou pas », et si oui **quelle activité** (promotion, programme de fidélité, opération de référencement) dans **une case texte à côté du nom**.

Jean-Luc confirme : marques concurrentes **préenregistrées dans les paramètres** (on peut en rajouter) + **onglet dédié aux concurrents** + **filtre par mois**.

À faire :
1. Pour chaque concurrent (ex. EVAP : Cowmilk/Nido…) : **présent / absent** + **en activité oui/non** + **champ texte « action de la concurrence »**.
2. Marques gérées dans les **paramètres** (référentiel), onglet concurrence dédié, **filtre par mois**.
3. *(Secondaire — idée Naya, confirmée par JL)* : possibilité de signaler un **nouveau concurrent** en texte libre + **photo optionnelle**.

---

## Pilote / test terrain ✅ Confirmé JL

Agbetou : prendre **2 commerciaux qui ont déjà leur tablette**, leur donner l'app. Jean-Luc : test **d'une journée** sur le vrai matériel, distribution via **AppTester** (adresses **Gmail** à envoyer). *(Pas de code — juste préparer le build de test.)*

---

## Vérification finale

- `npm run lint` + `npm run test`
- Les KPI restent filtrables par territoire / quartier / distributeur / cluster.
- Build mobile OK : `npm run generate:native` puis `npx cap sync android`.
