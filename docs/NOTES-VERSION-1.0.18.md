# Notes de version — 2 novembre 2026

Application mobile **1.0.18** (versionCode 21). Même contenu que la 1.0.17, qui plantait au démarrage.

## Ce qui est corrigé

La 1.0.17 a été construite sans le fichier Firebase (`google-services.json`, non versionné). Sur une tablette où les notifications sont autorisées, l'app se fermait quelques secondes après chaque ouverture avec « L'application Friesland Bonnet Rouge s'est fermée car elle comporte un bug ». Premier cas signalé : GUI STEPHANE (Marcory, Treichville), le 2 novembre.

La 1.0.18 contient le fichier. Un build release sans lui est désormais refusé (`android/app/build.gradle`).

## En attendant la mise à jour

Sur une tablette qui plante :
- Paramètres › Applications › Friesland Bonnet Rouge › Notifications : désactiver ;
- si l'app demande d'autoriser les notifications, toucher « Ne pas autoriser » ;
- ne pas désinstaller : on perdrait les visites pas encore envoyées.

## Notes de version Google Play

À coller dans Play Console › Version › Notes de version (fr-FR) :

```
<fr-FR>
Version 1.0.18
• Corrige la fermeture de l'application au démarrage sur certaines tablettes.
• Reprend les nouveautés de la 1.0.17 : position obligatoire pour les visites, aide pour régler la localisation, photo de la devanture et contrôle des doublons à la création d'un point de vente.
</fr-FR>
```

## Texte court pour la publication de l'application

> Version 1.0.18 : corrige la fermeture de l'application au démarrage.
