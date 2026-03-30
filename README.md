# Friesland V2 - Application de Gestion des Visites Commerciales

Solution complète avec Dashboard Laravel et Application Flutter pour la gestion des visites commerciales Friesland. Architecture backend + frontend avec synchronisation hors-ligne complète et fonctionnalités géofencing avancées.

## 🚀 Fonctionnalités Principales

### 🖥️ Dashboard Laravel (Backend)
- **API REST complète** : Authentification, PDVs, visites, analytics
- **Panel administrateur Filament** : Gestion complète des données
- **Synchronisation hors-ligne** : Gestion intelligente des conflits
- **Géofencing backend** : Validation des positions, logs d'activité
- **Analytics temps réel** : KPIs, rapports, exports
- **Gestion des utilisateurs** : Rôles et permissions

### 📱 Application Flutter (Frontend)
- **Mode hors-ligne complet** : SQLite local + synchronisation intelligente
- **Géofencing avancé** : Validation automatique des positions PDV
- **Interface moderne** : Design system Friesland
- **Formulaires de visite** : Produits Peak, Three Crowns, Friso
- **Cartes interactives** : PDV avec zones géofencing
- **Photos et signatures** : Capture et synchronisation

### 🔄 Synchronisation Hors-Ligne
- **Fonctionnement 100% offline** : Toutes les fonctions disponibles
- **Sync automatique** : Dès que la connexion est rétablie
- **Gestion des conflits** : Résolution intelligente
- **Queue de synchronisation** : Garantit aucune perte de données
- **Synchronisation différentielle** : Transfert optimisé

## 🏗️ Architecture Technique

### Architecture Globale
```
Friesland V2/
├── dashboard/              # Backend Laravel
│   ├── app/
│   │   ├── Http/Controllers/Api/    # Contrôleurs API REST
│   │   ├── Models/                  # Modèles Eloquent
│   │   └── Filament/               # Interface admin
│   ├── database/migrations/        # Schémas BDD
│   └── routes/api.php             # Routes API
├── lib/                    # Frontend Flutter
│   ├── core/
│   │   ├── database/              # SQLite local
│   │   ├── services/              # Auth, sync, settings
│   │   └── constants/             # Config app
│   ├── data/
│   │   ├── datasources/           # API + local
│   │   ├── models/                # Modèles données
│   │   └── repositories/          # Implémentations
│   ├── domain/                    # Logique métier
│   └── presentation/              # UI Flutter
└── docker-compose-full.yml       # Environnement complet
```

### Stack Technique

#### Backend (Laravel)
- **Laravel 10** : Framework PHP moderne
- **PostgreSQL** : Base de données relationnelle
- **Laravel Sanctum** : Authentification API
- **Filament** : Panel administrateur
- **Docker** : Conteneurisation

#### Frontend (Flutter)
- **Flutter 3.0+** : Framework mobile cross-platform
- **SQLite** : Base données locale (sqflite)
- **Dio** : Client HTTP pour API
- **Provider/BLoC** : Gestion d'état
- **flutter_map** : Cartes interactives
- **geolocator** : GPS et géofencing

## 📱 Écrans Principaux

1. **Dashboard** : KPI, graphiques, alertes temps réel
2. **Carte** : PDV avec géofencing, navigation
3. **Formulaire Visite** : 5 sections produits, validation GPS
4. **Liste Visites** : Historique, filtres, recherche
5. **Profil** : Stats personnelles, sync, export

## 🚀 Installation et Configuration

### 🐋 Démarrage rapide avec Docker

#### Prérequis
- Docker & Docker Compose
- Git

#### Installation complète
```bash
# Clone du repository
git clone [repository-url]
cd frieslandv2

# Démarrage de l'environnement complet
./start-development.sh

# Test de l'intégration
./test-integration.sh
```

#### Accès aux services
- **API Dashboard** : http://localhost/api/v1
- **Interface Admin** : http://localhost (Filament)
- **Base de données** : localhost:5432 (postgres/password)
- **Adminer** : http://localhost:8081

### 📱 Développement Flutter

#### Prérequis
- Flutter SDK 3.0+
- Android Studio / Xcode (pour émulateurs)
- API Keys Google Maps

#### Configuration
```bash
# Installation des dépendances Flutter
flutter pub get

# Configuration de l'API (Docker)
# L'app est préconfigurée pour utiliser http://dashboard:80/api/v1
# En développement local, modifier dans lib/data/datasources/api_datasource.dart

# Run application (avec backend Docker en cours)
flutter run
```

### 🔧 Variables d'environnement

#### Dashboard Laravel (.env)
```bash
APP_ENV=local
DB_CONNECTION=pgsql
DB_HOST=postgres
DB_DATABASE=friesland_dashboard
DB_USERNAME=postgres
DB_PASSWORD=password
```

#### Flutter (lib/core/constants/app_constants.dart)
```dart
class AppConstants {
  static const String apiBaseUrl = 'http://dashboard:80/api/v1';
  static const String googleMapsApiKey = 'YOUR_MAPS_API_KEY';
  static const bool enableOfflineMode = true;
}

## 📊 Modèle de Données

### Table VISITE
- Informations générales : PDV, commercial, géolocalisation
- Produits EVAP : 7 références avec statuts détaillés
- Produits IMP : 8 références avec statuts détaillés
- Produits SCM : 6 références avec statuts détaillés
- UHT/YOGHURT : Présence et prix globaux
- Validation géofencing et précision GPS

### Table PDV
- Identification : Nom, canal, catégorie, sous-catégorie
- Géographie : Région, territoire, zone, secteur, coordonnées
- Configuration : Rayon géofencing (300m par défaut)

### Commerciaux Assignés
- COULIBALY PADIE
- EBROTTIE MIAN CHRISTIAN INNOCENT
- GAI KAMY
- OUATTARA ZANGA
- Guea Hermann

## 🎨 Design System

### Couleurs Bonnet Rouge
- **Primaire** : #E53E3E (Rouge Bonnet Rouge)
- **Secondaire** : #2D3748 (Gris foncé)
- **Succès** : #38A169 (Vert)
- **Attention** : #D69E2E (Orange)
- **Erreur** : #E53E3E (Rouge)

### Typographie
- **Police principale** : Inter (Google Fonts)
- **Police marque** : Bonnet Rouge (custom)

## 🔐 Sécurité

- **Authentification Firebase** : Multi-utilisateurs
- **Permissions géolocalisation** : Demande explicite
- **Validation côté client** : Géofencing obligatoire
- **Chiffrement données** : Transit et stockage

## 📈 Analytics & KPIs

### Métriques Principales
- **Taux présence produits** : % PDV par catégorie
- **Prix respectés** : % conformité tarifaire
- **Performance commerciaux** : Visites/objectifs
- **Couverture géographique** : PDV visités/total

### Exports Disponibles
- **PDF** : Rapports personnalisés
- **Excel** : Données brutes analytics
- **CSV** : Compatible Google Sheets

## 🚀 Déploiement

### Android
```bash
# Build APK
flutter build apk --release

# Build AAB (Play Store)
flutter build appbundle --release
```

### iOS
```bash
# Build iOS
flutter build ios --release
```

### Web (Dashboard admin)
```bash
# Build web
flutter build web --release
```

## 📞 Support

Pour tout support technique ou fonctionnel, contactez l'équipe développement Friesland.

---

**Version** : 1.0.0  
**Dernière mise à jour** : 2024  
**Licence** : Propriétaire Friesland