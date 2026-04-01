# 📊 Guide Admin — Friesland Bonnet Rouge

> **Application de pilotage terrain pour FrieslandCampina Côte d'Ivoire**

---

## 🔐 Connexion

| | |
|---|---|
| **URL** | `https://frieslandv3.vercel.app/login` |
| **Email** | `admin@friesland.ci` |
| **Mot de passe** | `Test1234!` |

Après connexion, vous êtes automatiquement redirigé vers le **Dashboard Admin**.

---

## 🗂️ Navigation

La **barre latérale gauche** donne accès à toutes les sections. Cliquez sur **« Réduire »** en bas pour la replier en mode icônes.

| Section | Pages | Description |
|---------|-------|-------------|
| **Dashboard** | Accueil | KPIs, graphiques, performance |
| **Routing** | Routing & Planning | Planifier les itinéraires terrain |
| **PDV** | Liste / Répartition / Évolution | Gérer les points de vente |
| **Visites** | Visites / Évolution / Catégories | Suivre les visites terrain |
| **Visibilité** | Ext. / Int. / Récaps | Visibilité produits en rayon |
| **Concurrence** | Évolution / Récap | Suivi concurrentiel |
| **Produits** | EVAP / IMP / SCM / UHT / Yaourt / Céréales | Disponibilité & prix par catégorie |
| **Actions** | Actions | Actions commerciales |
| **Utilisateurs** | Liste utilisateurs | Créer / modifier les comptes |
| **Import/Export** | Import CSV / Export Excel | Échanges de données |
| **Carte** | Carte interactive | Visualisation géographique des PDV |

---

## 📈 Dashboard (page d'accueil)

### KPIs en un coup d'œil
4 cartes en haut de page :
- **Total Visites** — nombre cumulé de visites
- **Visites ce mois** — visites du mois en cours
- **Points de Vente** — nombre de PDV actifs
- **Commerciaux** — nombre de merchandisers actifs

### Taux de présence produits
5 indicateurs colorés (EVAP, IMP, SCM, UHT, YAOURT) montrant le **pourcentage de présence** en rayon :
- 🟢 **≥ 70%** = Bon
- 🟡 **40-69%** = Moyen
- 🔴 **< 40%** = Critique

### Graphiques
- **Évolution des visites** — courbe des visites sur la période
- **Distribution par type de PDV** — diagramme circulaire

### Tableau de performance
Classement des commerciaux par nombre de visites, avec barre de progression.

### Actions disponibles
| Bouton | Action |
|--------|--------|
| **🖨️ Imprimer** | Imprime le dashboard (mise en page paysage) |
| **⬇️ Exporter** | Menu déroulant : KPIs / Performance / Visites par jour / Distribution / Tout |

---

## 🗺️ Routing & Planning

### Onglet « Routings ponctuels »
Planifiez les itinéraires **jour par jour** pour chaque merchandiser.

1. **Filtrez** par date et utilisateur
2. Cliquez **« Nouveau routing »**
3. Choisissez l'**utilisateur**, la **date**, ajoutez des **notes**
4. Dans la liste de PDV, cochez ceux à visiter et définissez l'**ordre de passage**
5. Cliquez **« Enregistrer »**

| Statut | Signification |
|--------|---------------|
| 🟡 `pending` | En attente (pas encore commencé) |
| 🔵 `in_progress` | En cours de tournée |
| 🟢 `completed` | Terminé |
| 🔴 `cancelled` | Annulé |

### Onglet « Templates permanents »
Créez des **modèles réutilisables** (ex : « Tournée Lundi Treichville ») que vous pourrez appliquer chaque semaine.

1. Cliquez **« Nouveau template »**
2. Nommez le template, assignez un utilisateur
3. Sélectionnez les PDV et l'ordre
4. Utilisez **« Appliquer un template »** pour générer automatiquement un routing à une date donnée

---

## 📍 Points de Vente (PDV)

### Liste des PDV
- **Recherche** par nom, zone, secteur
- **Filtres** par canal (General trade / Modern trade), catégorie, statut actif/inactif
- **Actions** sur chaque PDV : Modifier, Activer/Désactiver, Supprimer
- **Import CSV** : Importez une liste de PDV depuis un fichier CSV
- **Export Excel** : Exportez la liste complète

### Répartition
Graphiques montrant la distribution des PDV par :
- Canal de distribution
- Catégorie de PDV
- Zone géographique

### Évolution
Courbe montrant l'ajout de nouveaux PDV dans le temps.

---

## 📋 Visites

### Liste des visites
- Tableau filtrable par date, commercial, PDV
- Chaque visite montre : PDV, date, commercial, statut GPS, produits relevés
- **Export Excel** : Exportez toutes les visites filtrées

### Évolution
Graphique montrant le nombre de visites par jour/semaine/mois.

### Par catégorie
Ventilation des visites par catégorie de PDV (Boutique A, B, C, Kiosque, etc.).

---

## 👁️ Visibilité

Suivi de la **visibilité des produits Friesland** en rayon (extérieure et intérieure).

| Page | Contenu |
|------|---------|
| **Visibilité extérieure** | Présence d'affichage/PLV en façade |
| **Extérieure : Récap** | Tableau récapitulatif par zone |
| **Visibilité intérieure** | Présence en rayon, facing, positionnement |
| **Intérieure : Évolution** | Courbe d'évolution dans le temps |
| **Intérieure GT : Récap** | Récap General Trade |
| **Intérieure MT : Récap** | Récap Modern Trade |

---

## ⚔️ Concurrence

| Page | Contenu |
|------|---------|
| **Visibilité conc. : évolution** | Évolution de la visibilité des concurrents |
| **Visibilité conc. : récap** | Tableau comparatif Friesland vs concurrents |
| **Concurrence : évolution** | Tendances des actions concurrentes |

---

## 📦 Produits

Pour chaque catégorie (EVAP, IMP, SCM, UHT, YAOURT, CÉRÉALES) :

| Onglet | Contenu |
|--------|---------|
| **Disponibilité** | Taux de présence par PDV |
| **Prix** | Conformité des prix relevés (EVAP uniquement) |
| **Récap** | Tableau de synthèse avec filtres |

La page **Récap. produit** offre une vue transversale de toutes les catégories.

---

## 👥 Utilisateurs

### Créer un utilisateur
1. Cliquez **« Nouvel utilisateur »**
2. Remplissez : Nom, Email, Mot de passe (min. 8 caractères), Rôle, Zone
3. Cliquez **« Enregistrer »**

### Rôles disponibles
| Rôle | Accès |
|------|-------|
| **admin** | Dashboard + toutes les pages admin |
| **superviseur** | Dashboard + toutes les pages admin |
| **merchandiser** | App mobile uniquement |
| **commercial** | App mobile uniquement |

### Actions
- **Modifier** : Changer nom, rôle, zone, téléphone
- **Activer/Désactiver** : Un utilisateur désactivé ne peut plus se connecter
- **Supprimer** : Suppression définitive

---

## 📥 Import / Export

### Importer (CSV)
1. Sélectionnez le **type de données** (PDV, Visites, Zones, Routing)
2. Choisissez votre **fichier CSV**
3. Cliquez **« Importer »**

> ⚠️ Le fichier doit être au format CSV avec les colonnes attendues. Utilisez l'export pour obtenir un modèle.

### Exporter (Excel)
- **Visites** : Toutes les visites de la période sélectionnée
- **PDV** : Liste complète des points de vente
- **Routing** : Plannings exportés

---

## 🌙 Mode sombre

Cliquez sur l'icône **☀️/🌙** dans l'en-tête pour basculer entre mode clair et sombre. Le mode est détecté automatiquement selon les préférences de votre système.

---

## 🔔 Indicateurs en-tête

| Indicateur | Signification |
|------------|---------------|
| 🟢 **En ligne** | Connexion internet active |
| 🔴 **Hors ligne** | Pas de connexion |
| 🔄 **X en attente** | Données en attente de synchronisation |

---

## ⌨️ Raccourcis utiles

| Action | Comment |
|--------|---------|
| Replier la sidebar | Cliquez « Réduire » en bas |
| Basculer en app mobile | Menu utilisateur → « App Mobile » |
| Se déconnecter | Menu utilisateur → « Déconnexion » |

---

*Friesland Bonnet Rouge © 2026 — FrieslandCampina Côte d'Ivoire*
