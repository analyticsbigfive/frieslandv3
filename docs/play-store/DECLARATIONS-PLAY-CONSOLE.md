# Déclarations Play Console — 1.0.4 (textes prêts à coller)

Vérifié le 7 septembre 2026. Toutes les valeurs proviennent du code de la version
1.0.4 (`versionCode 5`) : ne pas les modifier sans mettre à jour `composables/useTournee.ts`,
`components/LocationDisclosureModal.vue` et `pages/privacy-policy.vue`.

**Binaire à téléverser : `dist-apk/friesland-bonnet-rouge-1.0.4-release.aab`**
(4,7 Mo, clé d'upload SHA-1 `13b21bc5c7129073bedf65ebaefd0df645fefdcf`).
Play n'accepte **que l'AAB** ; l'APK release du même lot sert uniquement au test
hors-Play (side-load). Contrôler la signature avant envoi :

    bash scripts/verify-aab-signature.sh dist-apk/friesland-bonnet-rouge-1.0.4-release.aab

---

## Ordre des étapes (l'inverse fait rejeter la release)

1. Héberger la vidéo de divulgation (§2) — nécessaire au formulaire §4.
2. Vérifier que les deux URL publiques répondent (§3).
3. Créer la release Production en **brouillon** avec l'AAB (§5) : le formulaire
   d'accès en arrière-plan ne devient remplissable qu'une fois un bundle déclarant
   `ACCESS_BACKGROUND_LOCATION` téléversé.
4. Remplir « Accès aux données de localisation » (§4) puis « Sécurité des données » (§6).
5. Vérifier le nom du développeur (§7).
6. Envoyer la release en revue.

---

## 1. Ce que fait réellement l'application (base factuelle des déclarations)

| Élément | Valeur dans le code |
| --- | --- |
| Permission déclarée | `ACCESS_BACKGROUND_LOCATION` (`AndroidManifest.xml:38`) |
| Déclencheur du suivi | Bouton « Démarrer la tournée », explicite, par l'utilisateur |
| Arrêt du suivi | Bouton « Terminer la tournée » — aucune collecte hors de cet intervalle |
| Notification persistante | Titre « Tournée en cours », texte « Suivi GPS de votre tournée actif » |
| Échantillonnage | 1 point max / 120 s et seulement après 15 m de déplacement |
| Usage au premier plan | Géorepérage de validation de visite, rayon 200 m, précision min. 10 m |
| Divulgation préalable | `LocationDisclosureModal.vue`, bloquante, avant tout prompt système |

## 2. Vidéo de divulgation (à héberger avant le formulaire §4)

YouTube en **non répertorié** ou Drive en lien public accessible sans connexion.
Doit montrer, sans coupure, dans cet ordre :

1. Ouverture de l'app et connexion.
2. Appui sur « Démarrer la tournée ».
3. **La modale de divulgation** — laisser le texte lisible 3 s à l'écran.
4. Appui sur « Accepter ».
5. **Puis seulement** le prompt système Android de localisation.
6. La notification « Tournée en cours » visible dans le volet de notifications.
7. Appui sur « Terminer la tournée » et disparition de la notification.

## 3. URL à déclarer (`Contenu de l'application`)

- Politique de confidentialité : `https://frieslandv3.vercel.app/privacy-policy`
- Suppression de compte : `https://frieslandv3.vercel.app/supprimer-compte`

Les deux répondent 200 et nomment l'app, le package `com.bdco.bonnetrouge` et
BD & CO comme personne morale (vérifié le 7 septembre 2026). La même URL de
politique doit aussi figurer dans `Croissance › Présence sur le Play Store › Fiche principale`.

---

## 4. « Accès aux données de localisation » — textes à coller

`Règles et programmes › Contenu de l'application › Accès aux données de localisation`

### Fonctionnalité qui nécessite l'accès en arrière-plan

> Suivi de tournée terrain. L'application enregistre le trajet d'un commercial
> pendant une tournée qu'il démarre lui-même, afin de reconstituer l'itinéraire
> réellement parcouru entre les points de vente visités et de calculer la distance
> et la durée de la tournée. Le suivi commence à l'appui sur « Démarrer la tournée »
> et s'arrête à l'appui sur « Terminer la tournée ».

### Bénéfice pour l'utilisateur

> L'application est un outil professionnel interne, réservé aux équipes commerciales
> et merchandising de l'entreprise. Le suivi de tournée dispense l'utilisateur de
> tout relevé manuel de kilométrage et de justificatif de déplacement : son trajet,
> sa distance et ses temps de visite sont calculés automatiquement et servent au
> remboursement de ses frais et à la planification de ses tournées suivantes.

### Pourquoi l'accès au premier plan ne suffit pas

> Une tournée dure plusieurs heures et l'utilisateur conduit entre deux points de
> vente : son téléphone est en poche, écran éteint, ou il utilise une application
> de navigation. Sans accès en arrière-plan, le trajet serait interrompu à chaque
> mise en veille et l'itinéraire reconstitué serait une succession de fragments
> inexploitables. L'accès en arrière-plan est strictement limité à l'intervalle
> entre « Démarrer » et « Terminer la tournée ».

### Mesures de limitation (si un champ libre le permet)

> Collecte limitée à un point toutes les 120 secondes et uniquement après 15 mètres
> de déplacement. Une notification permanente « Tournée en cours » reste affichée
> pendant toute la durée du suivi. Aucune position n'est collectée en dehors d'une
> tournée active. Les positions ne sont ni vendues, ni partagées avec des tiers,
> ni utilisées à des fins publicitaires.

### Vidéo

> Coller ici le lien de la vidéo du §2 (YouTube non répertorié ou Drive public).

---

## 5. Notes de version — texte à coller

`Tester et publier › Production › Créer une release › Notes de version (fr-FR)`

> Version 1.0.4
> - Divulgation explicite avant toute demande d'accès à la localisation : l'application
>   collecte des données de localisation pour valider la présence en point de vente et
>   reconstituer le trajet d'une tournée, y compris lorsque l'application est fermée ou
>   n'est pas utilisée. Le suivi est limité à l'intervalle entre « Démarrer » et
>   « Terminer la tournée ».
> - Rôles et cloisonnement des données par zone.
> - Tableaux de bord par zone, fraîcheur des visites et historique par point de vente.
> - Référentiel produits et relevé concurrence.
> - Corrections de stabilité du suivi de tournée hors connexion.

---

## 6. Sécurité des données — réponses à saisir

`Règles et programmes › Contenu de l'application › Sécurité des données`

| Question | Réponse |
| --- | --- |
| Les données sont-elles chiffrées en transit ? | Oui (HTTPS/TLS) |
| L'utilisateur peut-il demander la suppression de ses données ? | Oui — `https://frieslandv3.vercel.app/supprimer-compte` |
| Données partagées avec des tiers ? | **Non**, pour toutes les catégories |

Types de données à déclarer comme **collectées** :

| Catégorie | Type | Obligatoire | Finalité |
| --- | --- | --- | --- |
| Position | Position exacte | Oui | Fonctionnalité de l'application (géorepérage de visite, suivi de tournée) |
| Informations personnelles | Nom | Oui | Fonctionnalité, gestion du compte |
| Informations personnelles | Adresse e-mail | Oui | Fonctionnalité, gestion du compte |
| Photos et vidéos | Photos | Oui | Fonctionnalité (preuve de visite en point de vente) |
| Fichiers et documents | — | Non | ne pas déclarer |

Ne rien déclarer en publicité, analyse marketing ou personnalisation : l'application
n'en fait pas.

---

## 7. Nom du développeur

`Paramètres › Détails du compte développeur › Nom du développeur` = `BD & CO`
(esperluette entourée d'espaces, exactement comme dans `pages/privacy-policy.vue`).
Une modification ici peut déclencher une revérification d'identité : la traiter
avant d'envoyer la release, pas après.

Le détail des autres valeurs d'identité (SIREN, adresse, e-mail public) est dans
`docs/play-store/FICHE-PLAY-STORE.md`.
