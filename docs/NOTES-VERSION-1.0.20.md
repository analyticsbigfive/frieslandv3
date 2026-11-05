# Notes de version — 5 novembre 2026

Application mobile **1.0.20** (versionCode 23), pour le Play Store.

## Ce qui change

- **Les messages s'affichent enfin.** Aucun message de l'application ne s'affichait (« Zone et région requises », « Position obligatoire », erreurs d'envoi…) : l'agent appuyait sans rien voir. Ils apparaissent maintenant en haut de l'écran.
- **Création d'un point de vente sur place :**
  - l'aide GPS qui s'ouvre par-dessus le formulaire répond de nouveau (« Réessayer », « Fermer ») ; avant, les appuis passaient au formulaire caché dessous ;
  - le bouton « Fermer » de cette aide était hors de l'écran sur tablette ;
  - la zone se choisit dans une liste (les territoires du merchandiser), le quartier aussi (quartiers de la zone) : plus de zone tapée à la main ;
  - le distributeur proposé est celui de la zone (il restait sur ADIALEA) ;
  - le type de point de vente est obligatoire ;
  - le motif d'un refus s'affiche aussi sous le bouton « Créer le PDV ».

Le reste est identique à la 1.0.19.

## Notes de version Google Play

À coller dans Play Console › Version › Notes de version (fr-FR) :

```
<fr-FR>
Version 1.0.20
• Les messages d'erreur et de confirmation s'affichent de nouveau.
• Création d'un point de vente : zone et quartier à choisir dans une liste, type obligatoire, aide GPS de nouveau utilisable.
</fr-FR>
```

## Texte court pour la publication de l'application

> Version 1.0.20 : les messages de l'application s'affichent ; création d'un point de vente corrigée (zone et quartier en liste, aide GPS utilisable).

## Diffusion

- Envoyer l'AAB `friesland-bonnet-rouge-1.0.20-release.aab` sur le Play Store (les tablettes Atom sont installées depuis Play).
- Ne relever `version_app.version_code_min` à 23 qu'une fois la 1.0.20 en ligne sur Play.
