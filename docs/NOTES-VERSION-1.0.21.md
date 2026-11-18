# Notes de version — 18 novembre 2026

Application mobile **1.0.21** (versionCode 24), construite le 18/11 depuis la branche `jl/categorie-sans-produit-actif` (`main` à jour + PR #74). Elle embarque aussi la PR #70, absente de la 1.0.20.

## Ce qui change dans l'application

- **Une catégorie sans produit n'est plus demandée.** Quand tous les produits d'une catégorie sont désactivés dans l'admin (Référentiels › Produits du formulaire), la catégorie disparaît du formulaire de visite : plus d'étape, plus de pastille dans la liste des visites, et elle n'est plus réclamée dans la complétude. C'est le cas d'UHT aujourd'hui : son étape restait affichée, vide et obligatoire. Dès qu'un produit est réactivé, la catégorie revient toute seule.
- **« PDV fermé » avec photos** (PR #70) : une boutique ne se déclare fermée qu'avec deux photos de la devanture prises à l'appareil photo et une position GPS. Entrée « PDV fermé (photos) » dans le menu de chaque point de la tournée, et carte « Boutique fermée ? » sur la fiche du point de vente. L'admin ou le superviseur décide ensuite. Marche hors ligne.

Le reste est identique à la 1.0.20.

## Avant de diffuser

- **La migration `20261106120000` (table `pdv_fermeture`, `declarer_pdv_ferme`) doit être en production** : sans elle, « PDV fermé (photos) » échoue à l'envoi. **Contrôlé le 18/11 : elle n'y est pas** (table `pdv_fermeture` et fonctions `declarer_pdv_ferme`, `fermetures_pdv_signalees`, `traiter_fermeture_pdv` absentes). À appliquer avant d'envoyer la 1.0.21 sur Play.
- Les écrans admin ne changent pas : une catégorie sans produit actif y reste visible (récap, inventaire, visites).

## Notes de version Google Play

À coller dans Play Console › Version › Notes de version (fr-FR) :

```
<fr-FR>
Version 1.0.21
• Une catégorie dont tous les produits sont retirés n'est plus demandée dans la visite (UHT).
• Boutique fermée : à signaler avec deux photos de la devanture, depuis la tournée ou la fiche du point de vente.
</fr-FR>
```

## Message aux merchandisers (WhatsApp)

> Bonjour à tous, la version 1.0.21 de l'application arrive sur le Play Store. Mettez-la à jour depuis le Play Store, sans désinstaller.
> – L'étape UHT ne s'affiche plus dans la visite : vous passez directement à la suite.
> – Boutique fermée : appuyez sur « PDV fermé (photos) » dans votre tournée et prenez deux photos de la devanture.

## Diffusion

- **AAB** `dist-apk/friesland-bonnet-rouge-1.0.21-release.aab` : à envoyer sur le Play Store (les tablettes Atom sont installées depuis Play). Signé avec la clé d'upload Friesland Bonnet Rouge (`scripts/verify-aab-signature.sh` : OK).
- **APK** `dist-apk/friesland-bonnet-rouge-1.0.21-release.apk` : pour les appareils installés par le lien uniquement. Pas encore mis en ligne. Même signature que la 1.0.20 : il s'installe par-dessus.
- Firebase vérifié dans les deux : `google_app_id` présent une fois.
- Ne relever `version_app.version_code_min` à 24 qu'une fois la 1.0.21 en ligne sur Play.
- Aucune nouvelle autorisation Android.

**Poste de build** : Java 21 (`JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`), dépendances installées par `pnpm install --frozen-lockfile`, et `android/local.properties` doit pointer sur le SDK du poste (`sdk.dir=/Users/bfa/Library/Android/sdk`) : il visait un autre compte et le premier build a échoué.
