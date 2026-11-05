# Notes de version — 5 novembre 2026

Application mobile **1.0.20** (versionCode 23), construite le 05/11 depuis `main` (PR #61 et #66).

## Ce qui change dans l'application

- **Les messages s'affichent enfin.** Aucun message de l'application ne s'affichait (« Zone et région requises », « Position obligatoire », erreurs d'envoi…) : l'agent appuyait sans rien voir. Ils apparaissent maintenant en haut de l'écran.
- **Création d'un point de vente sur place :**
  - **le distributeur est celui du routing du merchandiser.** Un seul distributeur → il est affiché (« Votre distributeur : SIDECOM ») sans choix possible ; plusieurs → l'agent choisit parmi les siens, et le bouton « Créer le PDV » reste bloqué tant qu'il n'a pas choisi. Avant, le premier distributeur national (ADIALEA RCI) était pris d'office : 138 boutiques avaient été rangées chez lui ;
  - **le quartier se choisit dans la liste des points de visite** du merchandiser (« Petit marché · Marcory »), et la zone se remplit toute seule avec la commune du point : plus de quartier et de zone tapés à la main, ni à l'envers ;
  - sans routing (agents Friesland) : zone et quartier dans des listes, et le distributeur n'est choisi d'office que s'il est le seul de la zone ;
  - le type de point de vente est obligatoire ;
  - le motif d'un refus reste affiché sous le bouton « Créer le PDV » ;
  - l'aide GPS qui s'ouvre par-dessus le formulaire répond de nouveau (« Réessayer », « Fermer ») et ne ferme plus le formulaire ; son bouton « Fermer » était hors de l'écran sur tablette.

Le reste est identique à la 1.0.19.

## Déjà en place côté serveur (sans mise à jour)

Ces changements du 05/11 marchent aussi avec la 1.0.19 :

- une boutique créée par un merchandiser prend d'office le distributeur de son routing, son territoire et son quartier ; les 138 boutiques mal rangées et leurs 122 visites ont été corrigées (PR #65) ;
- **une boutique créée et visitée le même jour compte dans la tournée du jour** (1 de plus en faits et en total) ; rattrapé du 01/11 au 05/11 : Gui Stéphane passe de 20/39 à 22/41 le 04/11.

## Notes de version Google Play

À coller dans Play Console › Version › Notes de version (fr-FR), 402 caractères sur 500 :

```
<fr-FR>
Version 1.0.20
• Les messages d'erreur et de confirmation s'affichent enfin.
• Nouveau point de vente : le distributeur est celui de votre routing, choisi d'office s'il est seul.
• Le quartier se choisit dans la liste de vos points de visite, la zone se remplit toute seule.
• Type de point de vente obligatoire, et motif d'un refus affiché sous le bouton.
• L'aide GPS du formulaire répond de nouveau.
</fr-FR>
```

## Message aux merchandisers (WhatsApp)

> Bonjour à tous, la version 1.0.20 de l'application arrive sur le Play Store. Mettez-la à jour depuis le Play Store, sans désinstaller.
> Ce qui change quand vous créez une boutique :
> – le distributeur est déjà celui de votre routing, vous n'avez plus à le choisir (si vous en avez plusieurs, choisissez le bon) ;
> – le quartier se choisit dans la liste de vos points de visite, la zone se remplit toute seule ;
> – le type de boutique est obligatoire.
> Les messages de l'application (erreurs, confirmations) s'affichent maintenant en haut de l'écran.
> Et bonne nouvelle : une boutique que vous créez et visitez le même jour compte maintenant dans votre tournée du jour.

## Diffusion

- **AAB** `dist-apk/friesland-bonnet-rouge-1.0.20-release.aab` : à envoyer sur le Play Store (les tablettes Atom sont installées depuis Play). Signé avec la clé d'upload Friesland Bonnet Rouge (`scripts/verify-aab-signature.sh` : OK).
- **APK** `dist-apk/friesland-bonnet-rouge-1.0.20-release.apk` : en ligne sur le lien le 05/11 (`friesland-bonnet-rouge-1.0.20.apk` et `friesland-bonnet-rouge-latest.apk`), téléchargé et vérifié. Même signature que la 1.0.19 : il s'installe par-dessus. Il ne sert qu'aux appareils installés par le lien.
- Firebase vérifié dans les deux : `google_app_id` présent une fois (la 1.0.17 était partie sans).
- Ne relever `version_app.version_code_min` à 23 qu'une fois la 1.0.20 en ligne sur Play.
- Aucune nouvelle autorisation Android.

**Poste de build** : Java 21 est nécessaire (`brew install openjdk@21`, puis `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`). Dans une copie de travail, installer ses propres dépendances (`pnpm install --frozen-lockfile`) : celles du dépôt principal n'avaient pas `@capacitor/device`.
