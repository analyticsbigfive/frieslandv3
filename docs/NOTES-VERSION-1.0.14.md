# Notes de version — 16 octobre 2026

Application mobile **1.0.14** (versionCode 17).

## Texte court pour la publication de l'application

À coller dans Paramètres › Versions de l'app › Publier une version (champ « Message ») :

> Version 1.0.14 : en créant un PDV, la liste propose les distributeurs de votre secteur (par exemple SIDECOM à Treichville et Marcory). Les PDV de votre tournée s'affichent toujours avec leur nom.

## Application mobile (téléphones)

**Créer un PDV**
- La liste des distributeurs propose ceux du secteur du quartier choisi, en plus des nationaux. Auparavant, un profil dont le territoire était écrit en majuscules (« TREICHVILLE », « KOUMASSI ») ne voyait que les nationaux.
- Le territoire du nouveau PDV est déduit du quartier choisi.
- La liste des distributeurs est rechargée à chaque ouverture du formulaire : un distributeur ajouté par l'administration apparaît sans redémarrer l'app.

**Tournées**
- Les PDV de la tournée s'affichent avec leur nom, même hors du secteur de la fiche. Ce correctif est côté serveur et s'applique déjà à toutes les versions depuis le 16/10.
- Si un PDV ne peut vraiment pas être lu, l'app écrit « PDV hors secteur » au lieu d'un code seul : Mon routing, Tournées, Calendrier, Accueil, Équipe.

## Avant publication
- Migration `20261016100000_friesland_perimetre_tournee.sql` : déjà appliquée en production le 16/10.
- Aucune nouvelle autorisation Android : pas de déclaration Play Console à refaire.
