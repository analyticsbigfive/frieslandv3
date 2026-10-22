# Notes de version — 22 octobre 2026

Application mobile **1.0.15** (versionCode 18).

## Texte court pour la publication de l'application

À coller dans Paramètres › Versions de l'app › Publier une version (champ « Message ») :

> Version 1.0.15 : à la première visite d'un PDV, sa position est prise sur place. Aux visites suivantes, il faut être au PDV pour démarrer et enregistrer la visite.

## Application mobile (téléphones)

**Position du PDV : la première visite fait foi**
- **Première visite d'un PDV** (position venue du fichier DMS ou Atom, ou pas de position) :
  - « Démarrer » dans la tournée passe sans contrôle de distance ;
  - la visite s'enregistre, et la position de la tablette devient celle du PDV.
- **Visites suivantes** : le merchandiser doit être dans le rayon de cette position (300 m par défaut).
  - « Démarrer » et « Enregistrer la visite » proposent « Réessayer », et plus « Soumettre quand même ».
  - Le message donne la distance et la date du repérage, par exemple : « Vous êtes à 850 m de ce PDV, repéré sur place le 21/10. »
- **GPS imprécis sur un PDV déjà repéré** : l'app demande de réessayer au lieu d'enregistrer sans contrôle. Le seuil est le réglage « Précision GPS exigée », passé à 30 m le 22/10.
- **Inchangé** :
  - les tablettes sans puce GPS enregistrent toujours sans position (bandeau) ;
  - une visite hors ligne sans position aussi.

**Administration : fiche d'une visite**
La ligne « Dans le rayon de visite » dit d'où vient la position. Trois cas possibles :
- « 1re visite : position du PDV fixée ici, à 120 m de l'ancienne position » ;
- « Oui, à 45 m du repère (précision 6 m) » ;
- « Non, position GPS imprécise (40 m) ».

**Si une première visite a été faite au mauvais endroit** : corriger la position dans la fiche du PDV (Administration › PDV). Elle devient la nouvelle référence, et aucune visite ne peut plus la déplacer.

## Avant publication
- Migration `20261022100000_friesland_gps_premiere_visite.sql` : déjà appliquée en production le 22/10. Elle s'applique aussi aux téléphones restés en 1.0.14 : la première visite fixe la position, et ensuite plus rien ne la déplace.
- Ordre de diffusion :
  1. `node scripts/upload-apk.mjs dist-apk/friesland-bonnet-rouge-1.0.15-release.apk --latest` ;
  2. publier la version dans l'administration (`version_app`) ;
  3. envoyer l'AAB sur le Play Console ;
  4. relever la version minimum seulement une fois le lien en ligne.
- Aucune nouvelle autorisation Android : pas de déclaration Play Console à refaire.
