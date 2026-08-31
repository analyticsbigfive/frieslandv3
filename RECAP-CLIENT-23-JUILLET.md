Bonjour à tous,

Voici le récapitulatif des évolutions apportées suite à notre réunion du 23 juillet. Pour chaque point soulevé : ce qui a été fait, et ce que ça donne à l'écran.

---

# 1. Perfect Store : le nombre d'abord, le pourcentage ensuite

**Avant** — le tableau de bord affichait « 66,7 % », sans dire de quoi.

**Maintenant** — le nombre s'affiche en grand (ex. **9**), et juste en dessous, en petit : « 64,3 % des 14 PDV visités ».

À côté du chiffre, la répartition par niveau : **3 Flagship · 2 VIP · 4 Core**, plus le nombre de PDV non conformes.

La liste des Perfect Stores est maintenant visible **dès la première page**, avec le niveau de chacun. Plus besoin d'aller sur l'onglet « liste ».

> **À noter : le chiffre a légèrement changé, et c'est normal.**
> L'ancien calcul comptait des **visites**, pas des points de vente : un PDV visité 3 fois pesait 3 fois dans le pourcentage. C'est corrigé — un PDV compte désormais **une seule fois**, sur sa dernière visite de la période.
> D'où l'écart entre 64,3 % (nouveau, juste) et 66,7 % (ancien, gonflé par un PDV visité deux fois).

---

# 2. Deux couvertures, parce que ce sont deux choses différentes

| Indicateur                             | Ce qu'il mesure                                                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Couverture effective**               | Le nombre de PDV **différents** visités sur votre parc (ex. 14/18 = 77,8 %). Celui que vous aviez déjà : il dit si le réseau est couvert. |
| **Couverture des visites** _(nouveau)_ | Le nombre **total de passages**, repassages compris. C'est lui qui permet de suivre l'objectif de **20 visites/jour/merchandiser**.       |

Les deux sont côte à côte sur l'écran principal.

En dessous, le détail **par merchandiser** : nombre de visites, PDV distincts, jours travaillés, moyenne par jour, et la liste des PDV visités avec le nombre de passages sur chacun.

---

# 3. Taux de présence, distinct du taux de disponibilité

Deux notions étaient confondues :

- **Présence** — le produit est là (quantité d'au moins 1).
- **Disponibilité** — le produit est là **en quantité suffisante**, au-dessus du seuil que vous avez paramétré.

Les deux taux sont maintenant affichés séparément, et peuvent diverger.

En dessous : le détail **par catégorie** (EVAP, IMP, SCM) avec les deux barres superposées, puis **par SKU clé** — BR 150g, BR 15g, BR Délice 15g, BR Delice Pouch 350g.

L'écart est déjà visible sur les données actuelles (ex. BR 150g : **83,3 % de présence** pour **75 % de disponibilité**). Il se creusera avec les relevés terrain réels — c'est là que l'indicateur prend tout son sens.

---

# 4. Routing récurrent — le point le plus attendu

**Avant** — un routing à recréer chaque jour, ou un import CSV qui écrasait tout.

**Maintenant** — vous créez une règle : _« ce merchandiser visite ces PDV chaque lundi et chaque jeudi »_. Vous cochez les jours, vous listez les PDV **une fois**, et c'est fini. Les tournées se créent toutes seules, y compris le mois suivant.

**Ce qui vient avec :**

- **Décocher une période sans perdre la règle.** Un bouton « Décocher une semaine » sur chaque règle : vous suspendez toute la tournée ou un seul PDV, sur la période de votre choix (raccourcis « cette semaine » / « semaine prochaine »). La règle reprend d'elle-même après.
- **Aperçu des prochaines tournées.** Chaque règle affiche les dates qu'elle couvre sur 4 semaines, exceptions déduites — vous voyez avant de valider.
- **Changement de zone et de distributeur en cours de mois.** Le territoire est porté par la règle, pas par la fiche du merchandiser. Semaine 1 chez Distributeur A à Abobo, semaine 2 chez Distributeur B à Adjamé : deux règles, et le système suit.
- **Import CSV en mise à jour.** À la réimportation, vous choisissez : **Fusionner** (par défaut — les PDV absents du fichier sont conservés) ou **Remplacer**. Le mode Fusionner permet de corriger un mois déjà importé sans rien perdre.
- **Le PDV reste choisi dans une liste fermée**, jamais saisi en texte libre. Si la règle porte un territoire, la liste s'y restreint automatiquement.
- Le contrôle de proximité GPS (« rapprochez-vous du PDV ») est **inchangé** et reste actif.

> **Un choix fait différemment de ce qui avait été validé.**
> Il avait été retenu de générer la tournée au moment où le merchandiser ouvre l'application. Nous ne l'avons pas fait ainsi : l'application fonctionne **hors connexion**, et un merchandiser qui ouvre son téléphone à 7 h sans réseau se serait retrouvé **sans tournée du tout**.
> Les tournées sont donc **pré-générées 7 jours à l'avance** (à chaque synchronisation du mobile, plus un bouton côté admin), avec un rattrapage à l'ouverture si une journée manque.
> Résultat visible identique — rien à faire pour l'admin — mais ça fonctionne aussi sans réseau.

---

# 5. Suivi de la concurrence enrichi

Pour chaque famille (EVAP, IMP, SCM, UHT), en plus de présent/absent :

- **« En activité ? » oui/non** — un concurrent présent mais inactif n'appelle pas la même réaction qu'un concurrent qui pousse une promotion.
- **« Action de la concurrence »** — champ libre, demandé uniquement si le concurrent est actif : promotion, programme de fidélité, opération de référencement…

**Signaler un nouveau concurrent.** Un bloc « Autre(s) concurrent(s) » permet d'en ajouter autant que nécessaire : nom en saisie libre (obligatoire), en activité oui/non, action, et **photo optionnelle** prise avec l'appareil.

Sur le tableau de bord, un tableau **« Concurrents signalés par les merchandisers »** regroupe tout : nombre de signalements, combien de fois en activité, actions relevées, photos.

Les noms sont regroupés intelligemment — « Cowmilk », « cowmilk » et « Cow Milk » forment **une seule ligne**, pas trois. Sans cela, l'agrégation serait inexploitable.

Deux nouveaux indicateurs en haut de l'onglet : **concurrents en activité** et **concurrents signalés**.

---

# 6. Filtres de période partout

**Jour · Semaine · Mois · Tout · Personnalisé**, en un clic.

En place sur : tableau de bord Perfect Store, onglet Visites, onglet Concurrence, écrans Produits et Visibilité.

Tous les indicateurs y réagissent, et restent filtrables par territoire, quartier et distributeur comme avant.

L'onglet Visites s'ouvre par défaut sur le **mois en cours**, la plage active est toujours affichée — rien n'est masqué en silence. L'export Excel exporte désormais **toutes les visites de la période filtrée**, et non plus seulement la page à l'écran.

---

# Trois points à connaître

- **Carte de suivi** — inchangée. Losange bleu = visite d'un PDV, losange orange = temps passé hors PDV. Le suivi temps réel fonctionne comme avant.
- **Données de démonstration** — la base ne contient aujourd'hui que 15 visites de test. Les indicateurs fonctionnent et affichent déjà des écarts réels, mais leur intérêt se révélera avec les relevés terrain quotidiens : notamment l'écart présence/disponibilité et le suivi des 20 visites par jour.
- **Historique préservé** — les concurrents saisis avant cette mise à jour restent visibles : l'ancien et le nouveau format sont lus tous les deux.
  tesr

---

Restant à votre disposition pour tout échange complémentaire.

Cordialement,
**Jean Luc Houédanou**
