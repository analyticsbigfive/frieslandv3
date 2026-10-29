# Notes de version — 29 octobre 2026

Application mobile **1.0.17** (versionCode 20). Elle contient aussi le compteur des visites libres, prévu d'abord en 1.0.16 : le numéro 1.0.16 (versionCode 19) n'est jamais sorti.

## Texte court pour la publication de l'application

À coller dans Paramètres › Versions de l'app › Publier une version (champ « Message ») :

> Version 1.0.17 : la position de la tablette est obligatoire pour faire une visite. Si elle ne vient pas, l'application explique quoi régler. Loin du point de vente, elle demande « Êtes-vous bien devant ? » au lieu de bloquer. Le compteur du jour suit l'objectif (3/20 en visite libre).

## Notes de version Google Play

À coller dans Play Console › Version › Notes de version (fr-FR), 482 caractères sur 500 :

```
<fr-FR>
Version 1.0.17
• Position de la tablette obligatoire pour démarrer et enregistrer une visite, et pour créer un point de vente.
• Si la position ne vient pas, l'application explique quoi régler, étape par étape.
• Loin du point de vente, elle demande « Êtes-vous bien devant ? » au lieu de bloquer.
• Nouveau point de vente : photo de la devanture obligatoire et contrôle des doublons.
• Mon routing et l'accueil comptent l'objectif du jour (3/20 en visite libre, pushcarts compris).
</fr-FR>
```

## Application mobile (tablettes)

**Pas de position, pas de visite**
- La tablette doit trouver sa position, à 50 m près, pour :
  - « Démarrer » un point de vente dans la tournée ;
  - ouvrir le formulaire de visite, puis l'enregistrer ;
  - créer un point de vente.
- Pendant la recherche, l'écran affiche « Recherche de la position… (précision actuelle : X m) ». Il attend 20 secondes au plus.
- **Fin des exceptions** : avant, une visite s'enregistrait sans position hors ligne, ou sur une tablette sans puce GPS. Ce n'est plus possible.
  - Hors ligne, la position est toujours exigée (le GPS marche sans réseau).
  - Une tablette Wi-Fi sans puce GPS doit trouver sa position par le Wi-Fi.

**Écran d'aide de la tablette**
Si la position ne vient pas, l'application dit pourquoi et montre un seul cas, en grosses étapes numérotées, avec un bouton « Réessayer » :
- **A. Localisation coupée** : l'allumer dans les boutons rapides.
- **B. Autorisation refusée ou approximative** : Paramètres → Applications → Friesland Bonnet Rouge (ou Chrome) → Autorisations → Localisation → « Autoriser uniquement pendant l'utilisation de l'application », et allumer « Utiliser la position exacte ». Dans Chrome : ⋮ → Paramètres → Paramètres des sites → Position.
- **C. Position lente ou imprécise** :
  - Services de localisation → « Précision de la localisation Google » et « Recherche Wi-Fi » ;
  - garder le Wi-Fi allumé, couper « Économie d'énergie » ;
  - s'approcher de la porte et attendre 30 secondes.

Les noms des menus peuvent changer un peu selon la version de One UI. L'aide est aussi dans **Plus › Aide GPS de la tablette**, avec un bouton « Vérifier ma position » et le modèle de la tablette.

**Loin du point de vente : on demande au lieu de bloquer**
- Le message « Hors zone » disparaît. Au-delà de 100 m de la position enregistrée d'un point de vente déjà repéré, l'application demande :
  > Vous êtes à X m de la position enregistrée de ce point de vente. Êtes-vous bien devant [nom] ?
  - **Oui, je suis devant** : la visite s'enregistre, et la position de la tablette devient celle du point de vente. L'ancienne est gardée dans l'historique.
  - **Non, annuler** : rien n'est enregistré, la saisie est gardée.
- « Démarrer » ne contrôle plus la distance. La question est posée une seule fois, à l'enregistrement de la visite.
- **Sans question** : un point de vente sans position, ou avec la position d'un fichier (DMS, Atom). Sa première visite fixe sa position, comme en 1.0.15. Pareil pour un pushcart, qui reste itinérant.

**Création d'un point de vente sans doublon**
- Le merchandiser peut toujours créer un point de vente : c'était déjà possible, Atom compris.
- La position est prise sur place, à l'ouverture, avec la même précision. Elle devient la position du point de vente : la première visite ne l'écrase plus.
- **La photo de la devanture est obligatoire.** Hors ligne, elle part dans la file avec le point de vente.
- Avant de créer, l'application montre les points de vente déjà enregistrés à moins de 30 m, avec leur nom, leur distance et leur photo de devanture :
  - **C'est ce PDV** : rien n'est créé, l'application ouvre ce point de vente (la visite, ou sa fiche). S'il n'est pas dans la liste du merchandiser, elle lui dit de prévenir son superviseur au lieu de le recréer.
  - **C'est un nouveau PDV** : le point de vente est créé.
- Un nom presque identique à moins de 15 m demande de cocher « Je confirme que c'est un autre point de vente ».
- Hors ligne, la comparaison se fait sur les points de vente déjà chargés dans la tablette.

**Fiche d'un point de vente** : merchandiser et commercial ne tapent plus la latitude et la longitude à la main. Avant, l'ancienne position était perdue. Le superviseur et l'admin le peuvent toujours, et l'historique est gardé.

**Modèle de la tablette** : envoyé avec chaque visite. On saura quelles tablettes n'ont pas de puce GPS.

**Compteur du jour (merchandisers Atom)**, prévu d'abord en 1.0.16

Avant, l'app comptait les seules étapes de la tournée, sans regarder l'objectif du jour :
- un jour de visite libre, « Mon routing » affichait 0/0, puis 1/1, 2/2… toujours 100 %, et l'accueil « Objectif atteint » dès la première visite. Le 29/10, un merchandiser avait 14/14 alors que 5 visites seulement comptaient ;
- un jour normal, les 2 pushcarts à trouver manquaient : x/18 au lieu de x/20.

Désormais, l'app lit l'objectif que la base tient déjà à jour :
- **visite libre** : titre « Visite libre », « Progression 3/20 », le détail par type (« Boutiques 3/13 · Superettes 0/2 · … ») et la phrase « Pas de point de visite aujourd'hui : visitez les PDV de votre liste. Un PDV déjà visité ce mois-ci ne compte pas. » ;
- **jour normal** : « Progression x/20 » et « Pushcarts 1/2 trouvés » ;
- sur chaque PDV visité qui ne compte pas, la raison : « Déjà vu ce mois-ci, ne compte pas », « Quota du type déjà atteint, ne compte pas »… ;
- **accueil** : l'objectif est celui du jour (20, 15 ou 10). Le paramètre admin « Objectif de visites par jour », s'il est rempli, reste prioritaire.

Les tournées Friesland ne changent pas. Le nombre de PDV qui comptent s'actualise une fois la visite envoyée au serveur.

## Administration

- **Points de vente › Positions à vérifier** (admin et superviseur). Y figurent les points de vente déplacés de plus de 500 m depuis le terrain :
  - par une visite « je suis devant » ;
  - par une première visite ;
  - par une position tapée à la main (anciennes versions de l'app).
  
  Pour chacun : « Garder » ou « Remettre l'ancienne ». Les imports de fichiers et les corrections de l'admin n'y sont pas.
- **Points de vente › Doublons possibles** (admin et superviseur). Y figurent les points de vente créés par un merchandiser ou un commercial à moins de 30 m d'un point de vente existant, quelle que soit la version de l'app. Chaque ligne montre les deux devantures, la distance et la ressemblance des noms. Deux choix :
  - « Deux PDV différents » ;
  - « Doublon : désactiver le nouveau ». Ses visites restent ; les quartiers Atom sont recalculés.
  
  Dès l'application de la migration, l'onglet reprend aussi les paires ATOM déjà en base, au nom presque identique et à moins de 15 m. Le 29/10, cela fait 496 paires, soit 450 points de vente à revoir. Ces lignes portent la mention « Déjà en base ».
- **Fiche d'une visite** : la ligne « Dans le rayon de visite » dit si l'agent a confirmé être devant. La ligne « Tablette » donne son modèle.
- **Liste des points de vente** : le badge « GPS relevé sur le terrain » couvre aussi les positions prises à la création ou confirmées devant le point de vente.
- **Paramètres terrain** :
  - quatre nouveaux réglages : « Distance d'alerte » (100 m), « Déplacement à vérifier » (500 m), « Rayon des doublons » (30 m) et « Rayon des doublons de nom » (15 m) ;
  - « Précision GPS exigée » et « Précision pour géolocaliser un PDV » passent de 30 à 50 m. Sinon, une visite entre 30 et 50 m démarrerait sans jamais fixer la position des points de vente de juillet.

## Ordre de diffusion

Chaque étape attend le oui de Jean Luc.

0. **Appliquer la migration** `supabase/nouveau/20261029170000_friesland_gps_obligatoire.sql`, **avant tout le reste**. ✅ Appliquée en production le 29/10/2026 (migration `friesland_gps_obligatoire`, version 20261029214321), à la demande de Jean Luc. Vérifié juste après : paramètres 50/50/100/500/30/15 m, déclencheurs, fonctions, 496 paires dans Doublons possibles, 196 lignes dans Positions à vérifier.
   - La 1.0.17 envoie le modèle de la tablette et la source « création ». Sans la migration, ses visites et ses créations de points de vente sont refusées.
   - Aucun risque pour les 1.0.15 et 1.0.16, qui n'envoient ni l'un ni l'autre.
   - Effets dès l'application, toutes versions confondues :
     - précision portée à 50 m ;
     - une position tapée à la main est gardée dans l'historique ;
     - une visite rejouée hors ligne peut fixer la position d'un point de vente.
1. AAB et APK construits et signés le 29/10/2026, avec le compteur du jour :
   - `dist-apk/friesland-bonnet-rouge-1.0.17-release.aab` (versionCode 20, 5,6 Mo), pour le Play Store ;
   - `dist-apk/friesland-bonnet-rouge-1.0.17-release.apk` (versionCode 20, 5,9 Mo), pour le lien de téléchargement.
   - Signature vérifiée sur les deux : clé d'upload Friesland Bonnet Rouge, SHA-256 BD:2E:F3:68…:9E:51, la même que la 1.0.14 (l'APK s'installe par-dessus). `pnpm run android:verify` répond « non signé » sur l'APK : il ne lit que la signature v1, alors que l'APK est signé en v2 (`apksigner verify` le confirme).
   - Mêmes autorisations Android que la 1.0.14 (12).
   
   Pour reconstruire (Jean Luc) :
   - `npm run android:release`, puis `npm run android:bundle` ;
   - `npm run android:sync` régénère la liste des plugins Android, `@capacitor/device` compris.
2. Envoi de l'APK : `node scripts/upload-apk.mjs dist-apk/friesland-bonnet-rouge-1.0.17-release.apk --latest`.
3. **Seulement une fois le lien vérifié** (il télécharge bien l'APK) : `version_app.version_code_min = 20`. Avant cette étape, les 1.0.15 et 1.0.16 continuent d'enregistrer des visites sans position.
4. AAB sur le Play Console.

Aucune nouvelle autorisation Android : pas de déclaration Play Console à refaire. `@capacitor/device` lit le modèle sans autorisation.

**Poste de build** : `android/local.properties` du dépôt principal pointe encore vers `/Users/bfaproductionia/…`, un ancien compte. Sur ce Mac, le SDK est dans `/Users/bfa/Library/Android/sdk`. Mettre `sdk.dir=/Users/bfa/Library/Android/sdk`, sinon Gradle répond « SDK location not found ».

**Compteur des visites libres** : il est dans cette 1.0.17 (décision de Jean Luc du 29/10). La 1.0.16 n'est jamais sortie et ne sortira pas ; aucune tablette ne l'avait.

## Fiche de test sur une vraie Galaxy Tab

À faire sur une tablette ATOM, par ATOM ou par Jean Luc.

1. **Noter le modèle** : Paramètres → À propos de la tablette → Numéro de modèle.
   - SM-X130 : Wi-Fi seul, sans puce GPS (position par le Wi-Fi seulement) ;
   - SM-X135 ou SM-X133 : cellulaire, avec GPS.
   
   Le modèle s'affiche aussi dans Plus › Aide GPS de la tablette.
2. **Localisation coupée** :
   - couper la localisation dans les boutons rapides ;
   - ouvrir une tournée et appuyer sur « Démarrer ».
   - Attendu : « Démarrer » ne passe pas, l'écran d'aide montre le cas A (« La localisation de la tablette est coupée »).
3. **Localisation rallumée** :
   - rallumer la localisation, appuyer sur « Réessayer ».
   - Attendu : « Recherche de la position… (précision actuelle : X m) », puis la visite démarre.
4. **Autorisation** :
   - dans Paramètres → Applications → Friesland Bonnet Rouge → Autorisations → Localisation, choisir « Ne pas autoriser », puis ouvrir une visite.
   - Attendu : le cas B. Remettre « Autoriser uniquement pendant l'utilisation » et « Utiliser la position exacte », puis « Réessayer » : la visite s'ouvre.
5. **Position approximative** :
   - couper seulement « Utiliser la position exacte ».
   - Attendu : le cas B, sans attendre 20 secondes.
6. **Création d'un point de vente** :
   - devant un point de vente déjà enregistré, appuyer sur « PDV introuvable ? Créer un PDV » et prendre la photo de la devanture.
   - Attendu : « Ce point de vente existe peut-être déjà », avec sa photo. « C'est ce PDV » ouvre la visite sans rien créer.
7. **Loin du point de vente** :
   - enregistrer une visite à plus de 100 m d'un point de vente déjà visité.
   - Attendu : « Vous êtes à X m… Êtes-vous bien devant [nom] ? ».
   - « Non, annuler » : rien n'est enregistré. « Oui, je suis devant » : la visite s'enregistre.
   - Dans l'admin, la fiche de la visite dit que l'agent a confirmé être devant.
8. **Compteur du jour** (merchandiser Atom) :
   - un jour de visite libre, ouvrir Mon routing. Attendu : « Visite libre », « Progression 0/20 » et le détail par type ;
   - visiter un PDV déjà vu ce mois-ci. Attendu : le compteur ne bouge pas, et le PDV porte « Déjà vu ce mois-ci, ne compte pas » ;
   - un jour normal : « Progression x/20 » et « Pushcarts 0/2 trouvés ».
9. **Hors ligne** :
   - mode avion, localisation allumée, enregistrer une visite.
   - Attendu : la position est exigée, la visite part dans la file et s'envoie au retour du réseau.

## Contrôles faits

- `npm test` : tous les tests passent, dont `tests/gpsVisite.spec.ts` (permission refusée, GPS coupé avec les vrais codes du plugin Android, précision insuffisante, loin du point de vente, point de vente sans GPS).
- `npm run build` : OK.
- La migration a été jouée deux fois de suite sur une base Postgres jetable, avec 46 contrôles :
  - repère à la première visite ;
  - confirmation « devant » ;
  - rejeu hors ligne ;
  - superviseur ;
  - pushcart ;
  - création ;
  - saisie à la main ;
  - positions à vérifier ;
  - remise de l'ancienne position ;
  - voisins à moins de 30 m (actifs seulement) ;
  - création marquée « doublon possible » ;
  - doublon désactivé ;
  - rattrapage des paires ATOM déjà en base.
  
  Elle n'a pas été appliquée en production.
