# 📱 Guide App Mobile — Friesland Bonnet Rouge

> **Application terrain pour les merchandisers FrieslandCampina**

---

## 🔐 Connexion

| | |
|---|---|
| **URL** | `https://votre-domaine.com/login` |
| **Email** | `merchandiser@friesland.ci` |
| **Mot de passe** | `Test1234!` |

Après connexion, vous arrivez sur la **page d'accueil Visites**.

> 💡 L'app fonctionne aussi **hors connexion**. Les données seront synchronisées automatiquement au retour du réseau.

---

## 📲 Installation sur téléphone

L'app est une **PWA** (Progressive Web App). Pour l'installer :

### Android (Chrome)
1. Ouvrez l'URL dans Chrome
2. Appuyez sur **« Installer »** dans la bannière ou via le menu ⋮ → « Installer l'application »
3. L'icône apparaît sur l'écran d'accueil

### iPhone (Safari)
1. Ouvrez l'URL dans Safari
2. Appuyez sur **Partager** (📤) → **« Sur l'écran d'accueil »**
3. Confirmez en appuyant **« Ajouter »**

---

## 🗂️ Navigation

La **barre de navigation en bas** donne accès à 5 sections :

| Icône | Section | Description |
|-------|---------|-------------|
| 📋 | **Visites** | Liste de vos visites + créer une nouvelle |
| 📍 | **PDV** | Liste des points de vente |
| 👥 | **Contacts** | Annuaire des collègues |
| 🗺️ | **Routing** | Votre itinéraire du jour |
| 🗺️ | **Map** | Carte interactive des PDV |

---

## 🏠 Page d'accueil — Mes Visites

### Mini-dashboard
En haut : compteur de visites du jour avec **barre de progression** vers l'objectif (10 visites/jour).

### Liste des visites
Vos visites les plus récentes avec :
- **Nom du PDV**
- **Date et heure**
- **Badge GPS ✓** si la géolocalisation a été validée
- **Indicateurs produits** (EVAP, IMP, SCM, UHT) en vert si présent

### Actions
| Action | Comment |
|--------|---------|
| **Voir une visite** | Appuyez sur la carte de la visite |
| **Nouvelle visite** | Appuyez sur le bouton rouge **+** en bas à droite |
| **Rechercher** | Tapez dans la barre de recherche |
| **Filtrer par date** | Appuyez sur l'icône entonnoir 🔽 |
| **Rafraîchir** | Tirez la page vers le bas (pull-to-refresh) |

---

## ➕ Créer une visite (9 étapes)

Appuyez sur le bouton **+** rouge pour lancer l'assistant de visite.

### Étape 1 — Général
- **PDV** : Sélectionnez le point de vente (recherche possible)
- **Date** : Date de la visite (aujourd'hui par défaut)
- **PDV introuvable ?** → Bouton « Créer un PDV » pour en ajouter un à la volée

### Étape 2 — Localisation GPS
- La position GPS est capturée automatiquement
- ✅ **Badge vert** = vous êtes dans le périmètre du PDV (300m)
- ⚠️ **Badge orange** = vous êtes hors périmètre
- Vous pouvez continuer même hors périmètre, mais ce sera signalé

### Étape 3 — Produits EVAP
Pour chaque produit EVAP (lait, crème, etc.) :
- **Présent** : Oui / Non
- **Stock** : Quantité en rayon
- **Prix** : Prix relevé

### Étape 4 — Produits IMP
Même principe pour les produits Importés.

### Étape 5 — Produits SCM
Même principe pour les produits SCM.

### Étape 6 — Produits UHT
Même principe pour les produits UHT.

### Étape 7 — Visibilité
- **Visibilité extérieure** : PLV, affiches, signalétique en façade
- **Visibilité intérieure** : Facing, positionnement en rayon

### Étape 8 — Concurrence
- Relevé des produits concurrents présents
- Prix et visibilité des concurrents

### Étape 9 — Photos
- Prenez des **photos du rayon**, de la **façade**, des **produits**
- Appuyez sur le bouton photo pour capturer
- Les photos sont compressées automatiquement

### Enregistrer
Appuyez sur **« Enregistrer la visite »** pour sauvegarder.
- ✅ **En ligne** : Envoi immédiat vers le serveur
- 📴 **Hors ligne** : Sauvegardée localement, envoyée au retour du réseau

> 💡 Vous pouvez naviguer entre les étapes librement avec les boutons **Précédent / Suivant** ou en cliquant sur les onglets en haut.

---

## 🗺️ Mon Routing

Le routing est l'**itinéraire planifié** par votre superviseur pour la journée.

### En-tête
- **Date du jour** affichée
- **Barre de progression** : X PDV visités sur Y au total
- **Statut** : En attente / En cours / Terminé

### Liste des PDV à visiter
Chaque PDV affiché montre :
- 📍 **Nom** et **adresse/secteur**
- 🔢 **Ordre de passage** (1, 2, 3…)
- **Objectifs** : icônes indiquant ce qui est attendu (stock, photos, merchandising…)
- **Statut** :
  - ⚪ En attente
  - 🔵 En cours
  - ✅ Terminé
  - ⏭️ Ignoré

### Actions sur chaque PDV
| Bouton | Action |
|--------|--------|
| **Commencer** | Lance la visite pour ce PDV |
| **Ignorer** | Marque le PDV comme ignoré (raison demandée) |
| **Navigation** | Ouvre Google Maps vers ce PDV |

### Pas de routing ?
Si le message « Aucun routing prévu » s'affiche, c'est que votre superviseur n'a pas encore créé de routing pour aujourd'hui. Contactez-le.

---

## 📍 Points de Vente

### Liste
- Tous les PDV de votre zone assignée
- **Recherche** par nom
- Appuyez sur un PDV pour voir le détail

### Détail d'un PDV
- Nom, adresse, canal, catégorie
- Coordonnées GPS
- Historique des visites effectuées sur ce PDV
- Bouton **« Visiter »** pour lancer une visite rapide

---

## 👥 Contacts

Annuaire de tous les utilisateurs de l'application :
- Nom, email, rôle, zone assignée
- Recherche par nom ou email
- Utile pour contacter un superviseur ou collègue

---

## 🗺️ Carte

Carte interactive (Leaflet) montrant :
- 📍 Tous les **PDV** de votre zone sous forme de marqueurs
- Votre **position GPS actuelle** (point bleu)
- Appuyez sur un marqueur pour voir le nom du PDV

---

## 🌙 Mode sombre

Appuyez sur l'icône **☀️/🌙** dans l'en-tête (à côté du GPS) pour basculer entre mode clair et sombre.

---

## 📡 Fonctionnement hors ligne

L'application continue de fonctionner **sans connexion internet** :

| Fonction | Hors ligne |
|----------|-----------|
| Voir mes visites | ✅ (cache local) |
| Créer une visite | ✅ (sauvegarde locale) |
| Voir les PDV | ✅ (cache local) |
| Mon routing | ✅ (cache local) |
| Prendre des photos | ✅ |
| Synchronisation | 🔄 Automatique au retour du réseau |

### Indicateurs
- 🟢 **Point vert** en haut à droite = en ligne
- 🔴 **Point rouge** = hors ligne
- 🟡 **Badge orange « X »** = X éléments en attente de sync

---

## 📍 GPS et Géofencing

L'app utilise le **GPS de votre téléphone** pour :

1. **Valider votre présence** au PDV (périmètre de 300m)
2. **Enregistrer les coordonnées** de chaque visite
3. **Afficher votre position** sur la carte

### Indicateur GPS (en-tête)
| Couleur | Signification |
|---------|---------------|
| 🟢 Vert | GPS actif, position obtenue |
| 🟡 Orange clignotant | Recherche en cours |
| 🔴 Rouge | Erreur GPS |
| ⚪ Gris | GPS non activé |

### Conseils
- **Autorisez la localisation** quand le navigateur la demande
- **Restez à l'extérieur** pour une meilleure précision
- Si le GPS ne fonctionne pas, appuyez sur l'icône 📍 pour relancer

---

## ❓ Problèmes fréquents

| Problème | Solution |
|----------|----------|
| « Aucun routing prévu » | Demandez à votre superviseur de créer un routing |
| GPS ne se déclenche pas | Vérifiez les autorisations de localisation dans les paramètres du navigateur |
| Données non synchronisées | Vérifiez votre connexion internet, les données seront envoyées automatiquement |
| App lente | Fermez et rouvrez l'app, ou videz le cache du navigateur |
| Impossible de se connecter | Vérifiez votre email et mot de passe, contactez l'admin si besoin |

---

## 📞 Support

En cas de problème, contactez votre **superviseur** via la page **Contacts** de l'application, ou écrivez à l'administrateur à `admin@friesland.ci`.

---

*Friesland Bonnet Rouge © 2026 — FrieslandCampina Côte d'Ivoire*
