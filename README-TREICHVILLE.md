# Configuration Test Treichville - Friesland Bonnet Rouge

## 🎯 Objectif

Configuration de test avec utilisateur et PDV à Treichville, rue Roger Abinader selon les demandes spécifiques.

## 🚀 Installation Rapide

### 1. Dashboard Laravel (Backend)

```bash
cd dashboard
chmod +x setup-test-data.sh
./setup-test-data.sh
```

### 2. App Flutter (Mobile)

```bash
# Dans le dossier racine
flutter pub get
flutter run
```

## 📋 Données de Test Créées

### 👤 Utilisateurs

| Rôle | Email | Mot de passe | Description |
|------|-------|--------------|-------------|
| Admin | admin@friesland.local | admin123 | Administrateur système |
| Commercial | commercial@friesland.local | commercial123 | Commercial de base |
| Superviseur | superviseur@friesland.local | superviseur123 | Superviseur terrain |
| **Test Treichville** | **test.treichville@friesland.ci** | **test123** | **Merchandiser test spécifique** |

### 📍 PDV Créés à Treichville

#### Route Principale - Rue Roger Abinader
1. **Boutique Roger Abinader 1** - 5.2495, -4.0240
2. **Superette Roger Abinader** - 5.2500, -4.0235
3. **Magasin Roger Abinader Centre** - 5.2505, -4.0230
4. **Épicerie Roger Abinader 2** - 5.2510, -4.0225
5. **Commerce Roger Abinader Sud** - 5.2485, -4.0245

#### Route Alternative - Zone Portuaire
1. **Marché Treichville - Entrée Nord** - 5.2520, -4.0210
2. **Pharmacie Boulevard Lagunaire** - 5.2475, -4.0260
3. **Station Total Treichville** - 5.2515, -4.0200

## 🗺️ Fonctionnalités Carte OpenStreetMap

### Dans l'App Flutter

1. **Accès à la carte** : Bouton "Carte" dans l'AppBar principal
2. **Visualisation** : Tous les PDV Treichville avec géofencing 300m
3. **Géolocalisation** : Position actuelle avec validation de zone
4. **Sélection PDV** : Tap sur un marqueur pour voir les détails
5. **Démarrage visite** : Bouton actif si dans le géofencing

### Fonctionnalités Disponibles

- ✅ **Carte OpenStreetMap** centrée sur Treichville
- ✅ **Géofencing visuel** (cercles rouges 300m)
- ✅ **Marqueurs PDV** avec couleur Bonnet Rouge
- ✅ **Position actuelle** (marqueur bleu)
- ✅ **Filtrage par secteur**
- ✅ **Optimisation de tournée** (algorithme plus proche voisin)
- ✅ **Validation géofencing** en temps réel
- ✅ **Démarrage visite** depuis la carte

## 🔧 Système de Routing

### Tournée Optimisée Rue Roger Abinader

```
Départ → PDV 1 → PDV 2 → PDV 3 → PDV 4 → PDV 5 → Arrivée
```

- **Distance totale** : ~500m
- **Temps estimé** : 90 minutes (15 min/PDV + déplacements)
- **Géofencing** : 300m par PDV selon CLAUDE.md

### Métadonnées PDV

Chaque PDV contient :
- `route_name` : Nom de la tournée
- `ordre_visite` : Position dans la séquence
- `temps_estime_minutes` : Durée prévue de la visite
- `distance_precedent_metres` : Distance depuis le PDV précédent

## 🏃‍♂️ Test Rapide

### 1. Lancer le Dashboard

```bash
cd dashboard
php artisan serve
# Accès: http://localhost:8000/admin
```

### 2. Connexion Dashboard

- **Email** : `test.treichville@friesland.ci`
- **Mot de passe** : `test123`

### 3. Lancer l'App Flutter

```bash
flutter run
# Utiliser un émulateur avec GPS ou device réel
```

### 4. Tester le Géofencing

1. Ouvrir l'app Flutter
2. Appuyer sur le bouton "Carte"
3. Se positionner virtuellement à Treichville (5.2500, -4.0235)
4. Sélectionner un PDV
5. Vérifier le géofencing (cercle rouge = zone validée)

## 🌍 Coordonnées de Test

### Centre Treichville
- **Latitude** : 5.2500
- **Longitude** : -4.0235
- **Zone** : Rue Roger Abinader, Treichville, Abidjan

### Pour Émulateur Android Studio
1. Ouvrir Extended Controls (⋯)
2. Aller dans Location
3. Entrer les coordonnées : 5.2500, -4.0235
4. Cliquer "Send"

### Pour Émulateur iOS
1. Simulator > Device > Location > Custom Location
2. Entrer : 5.2500, -4.0235

## 🔧 Dépannage

### Problème de Géolocalisation
```bash
# Vérifier les permissions Android
adb shell pm grant com.example.friesland_dashboard android.permission.ACCESS_FINE_LOCATION
```

### Base de données vide
```bash
cd dashboard
php artisan migrate:fresh --seed
```

### Erreur cartes Flutter
```bash
flutter clean
flutter pub get
flutter run
```

## 📚 Conformité CLAUDE.md

- ✅ **Géofencing 300m** : Implémenté avec validation temps réel
- ✅ **Thème Bonnet Rouge** : Couleur #E53E3E sur tous les éléments
- ✅ **Structure utilisateur** : Commercial avec zone assignée
- ✅ **PDV avec géolocalisation** : Coordonnées précises Treichville
- ✅ **Formulaire multi-onglets** : 4 sections selon spécifications
- ✅ **API Laravel compatible** : Structure JSON conforme
- ✅ **Mode hors-ligne** : Synchronisation différée implémentée

## 🎉 Résultat Attendu

1. **Dashboard fonctionnel** avec utilisateur test Treichville
2. **App Flutter** avec carte OpenStreetMap centrée sur rue Roger Abinader
3. **Géofencing visuel** avec validation 300m temps réel
4. **Système de routing** optimisé pour tournées Treichville
5. **Démarrage de visite** directement depuis la carte

---

**Configuration terminée avec succès ! 🚀**
