# Déclarations Play Console — 1.0.4, écran par écran (textes prêts à coller)

Vérifié le 7 septembre 2026. Toutes les valeurs proviennent du code de la version
1.0.4 : ne pas les modifier sans mettre à jour `composables/useTournee.ts`,
`components/LocationDisclosureModal.vue` et `pages/politique-de-confidentialite.vue`.

**Binaire à téléverser : `dist-apk/friesland-bonnet-rouge-1.0.4-vc6-release.aab`**
(versionName 1.0.4, **versionCode 6**, clé d'upload SHA-1
`13b21bc5c7129073bedf65ebaefd0df645fefdcf`).

> Pourquoi versionCode 6 : Play a refusé le premier AAB 1.0.4 avec « Le code de
> version 5 a déjà été utilisé » — un bundle en versionCode 5 avait été téléversé
> une première fois (même en brouillon supprimé, Play garde le numéro consommé).
> Le versionCode est un compteur à sens unique par package : tout nouvel upload
> doit être strictement supérieur au plus grand jamais téléversé, pas seulement
> au plus grand publié. Le livrable de référence est `…-1.0.4-vc6-release.aab`
> (reconstruit depuis `66cf486`, 7 sept. 19:00) ; n'envoyer qu'un seul bundle
> par versionCode — un second upload en 6 sera refusé de la même façon.

Play n'accepte **que l'AAB** ; l'APK release du même lot sert uniquement au test
hors-Play (side-load). Contrôler la signature avant envoi :

    bash scripts/verify-aab-signature.sh dist-apk/friesland-bonnet-rouge-1.0.4-vc6-release.aab

---

## Ordre des étapes (l'inverse fait rejeter la release)

1. Héberger la vidéo de divulgation (§ Étape 2, préalable).
2. Vérifier que les deux URL publiques répondent (§ Étape 4).
3. Créer la release Production en **brouillon** avec l'AAB (Étape 1) : le formulaire
   d'accès en arrière-plan ne devient remplissable qu'une fois un bundle déclarant
   `ACCESS_BACKGROUND_LOCATION` téléversé.
4. Remplir « Accès aux données de localisation » (Étape 2) puis « Sécurité des données » (Étape 3).
5. Vérifier le nom du développeur (Étape 5).
6. Envoyer la release en revue.

## Base factuelle (ce que Google compare à la vidéo)

| Élément | Valeur dans le code |
| --- | --- |
| Permission déclarée | `ACCESS_BACKGROUND_LOCATION` (`AndroidManifest.xml:38`) |
| Déclencheur du suivi | Bouton « Démarrer la tournée », explicite, par l'utilisateur |
| Arrêt du suivi | Bouton « Terminer la tournée » — aucune collecte hors de cet intervalle |
| Notification persistante | Titre « Tournée en cours », texte « Suivi GPS de votre tournée actif » |
| Échantillonnage | 1 point max / 120 s et seulement après 15 m de déplacement |
| Usage au premier plan | Géorepérage de validation de visite, rayon 200 m, précision min. 10 m |
| Divulgation préalable | `LocationDisclosureModal.vue`, bloquante, avant tout prompt système |

---

## Étape 1 — Le binaire

**Chemin :** Play Console › app *Friesland Bonnet Rouge* › menu gauche
**Tester et publier › Production** › bouton **Créer une release**.

**Fichier à glisser dans la zone « App bundles » :**
`dist-apk/friesland-bonnet-rouge-1.0.4-vc6-release.aab`.
Si Play affiche « Ce bundle est signé avec une clé incorrecte », c'est un autre
fichier du dossier qui a été pris. Si Play affiche « Le code de version N a déjà
été utilisé », incrémenter `versionCode` dans `android/app/build.gradle`,
rebuilder (`docs/BUILD-ANDROID.md`) et recommencer.

**Ce que Play affiche après l'upload :** un avertissement jaune « Cette release
contient l'autorisation ACCESS_BACKGROUND_LOCATION — vous devez remplir la
déclaration ». Normal : c'est l'Étape 2.

**Nom de la release :** laisser la valeur proposée (`6 (1.0.4)`).

**Notes de version — coller dans le bloc `<fr-FR>` :**

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

**Boutons :** **Enregistrer** (en bas), puis **Suivant**. **Ne pas** cliquer
« Envoyer pour examen » tant que les Étapes 2 à 5 ne sont pas faites : la release
reste en brouillon, c'est voulu.

---

## Étape 2 — Déclaration accès à la position en arrière-plan

**Chemin :** menu gauche **Règles et programmes › Contenu de l'application** ›
ligne **Accès aux données de localisation** › **Commencer** / **Gérer**.

Le formulaire réel (constaté le 7 septembre 2026) ne comporte que **trois**
saisies : deux champs libres de **500 caractères maximum** et un lien vidéo de
**30 secondes maximum**. Les textes ci-dessous sont calibrés pour tenir dans ces
limites — ne pas y ajouter de phrase sans recompter.

### Autorisations listées par Play (aucune action)

Play affiche les trois permissions issues du manifeste :
`ACCESS_BACKGROUND_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`.
La présence de `ACCESS_FINE_LOCATION` impose de déclarer **Position exacte** à
l'Étape 3 : une déclaration en « position approximative » serait incohérente
avec le manifeste et constitue un motif de rejet distinct.

### Champ 1 — « Quelle est la finalité principale de votre application ? » (489/500)

> Bonnet Rouge est un outil professionnel interne de collecte de données terrain,
> réservé aux équipes commerciales et merchandising de BD & CO en Côte d'Ivoire.
> L'accès exige un compte créé par l'administrateur. Sur le terrain, l'utilisateur
> visite des points de vente : il relève la disponibilité des produits, les prix et
> la visibilité, photos à l'appui, valide sa présence par géorepérage et enregistre
> sa tournée — itinéraire parcouru, distance et temps passé dans chaque point de vente.

### Champ 2 — « Décrivez 1 fonctionnalité… » (491/500)

Une seule fonctionnalité, comme Play l'exige. Le texte dit explicitement où elle
se trouve dans l'interface (« lancé depuis l'écran d'accueil »), ce que Google
demande, et il condense en une phrase la justification de l'arrière-plan.

> Suivi de tournée, lancé depuis l'écran d'accueil. L'utilisateur appuie sur
> « Démarrer la tournée » ; l'application enregistre sa position toutes les 120
> secondes et seulement après 15 mètres, jusqu'à l'appui sur « Terminer la tournée ».
> Elle en reconstitue l'itinéraire, la distance et les temps de visite, qui justifient
> ses frais. Une tournée dure des heures, écran éteint ou GPS au premier plan : sans
> arrière-plan le trajet serait fragmenté. Notification « Tournée en cours » permanente.

### Champ 3 — Instructions vidéo (YouTube, 30 s maximum)

Play exige une URL **YouTube** (pas Drive), en **Non répertorié** — surtout pas
« Privé », que Google ne peut pas lire. La vidéo doit montrer la divulgation
*avant* l'invite système et expliquer pourquoi l'arrière-plan est nécessaire.

Découpage tenant en 30 secondes :

| Temps | À l'écran | Incrustation ou voix off |
| --- | --- | --- |
| 0-3 s | Écran d'accueil, doigt vers « Démarrer la tournée » | « Bonnet Rouge — suivi de tournée terrain » |
| 3-11 s | **La modale de divulgation, immobile et lisible** | « Divulgation affichée avant toute demande d'autorisation » |
| 11-14 s | Appui sur « Accepter » | — |
| 14-19 s | **Invite système Android**, choix « Toujours autoriser » | « L'invite système n'apparaît qu'après l'acceptation » |
| 19-25 s | Volet de notifications : « Tournée en cours » | « Le trajet continue écran éteint, entre deux points de vente » |
| 25-30 s | Appui sur « Terminer la tournée », notification disparue | « Aucune position collectée hors tournée » |

Trois règles de tournage : aucune coupure entre la modale et l'invite système
(c'est précisément l'enchaînement que Google vérifie), le texte de la modale doit
rester lisible à l'image, et la vidéo doit être en ligne **avant** l'ouverture du
formulaire — le champ n'accepte pas de brouillon sans lien valide.

## Étape 3 — Sécurité des données

**Chemin :** **Règles et programmes › Contenu de l'application › Sécurité des
données** › **Commencer**.

**Page 1 — Vue d'ensemble**

| Question | Réponse |
| --- | --- |
| Votre application collecte-t-elle ou partage-t-elle des données utilisateur ? | **Oui** |
| Toutes les données sont-elles chiffrées en transit ? | **Oui** (HTTPS/TLS) |
| Proposez-vous un moyen de demander la suppression des données ? | **Oui** — `https://frieslandv3.vercel.app/suppression-de-compte` |

**Page 2 — Types de données** : cocher exactement ces quatre lignes, rien d'autre.

| Catégorie | Type |
| --- | --- |
| Position | **Position exacte** — pas « approximative » : le géorepérage tourne en `enableHighAccuracy` |
| Informations personnelles | Nom |
| Informations personnelles | Adresse e-mail |
| Photos et vidéos | Photos |

**Page 3 — Pour chacune des quatre**

- Collectée : **Oui** — Partagée : **Non**
- Traitement éphémère : **Non**
- Obligatoire ou facultative : **Obligatoire** (l'app ne fonctionne ni sans compte ni sans position)
- Finalité : **Fonctionnalités de l'application** uniquement ; pour Nom et E-mail,
  ajouter **Gestion du compte**. Ne cocher ni Analyse, ni Publicité, ni Personnalisation.

**Boutons :** **Enregistrer** puis **Envoyer**.

---

## Étape 4 — Les URL (trois endroits)

Les deux pages répondent 200 et nomment l'app, `com.bdco.bonnetrouge` et BD & CO
comme personne morale (vérifié le 7 septembre 2026).

**4a. Politique de confidentialité** — **Règles et programmes › Contenu de
l'application › Politique de confidentialité** › **Commencer** :

    https://frieslandv3.vercel.app/politique-de-confidentialite

**Enregistrer**.

**4b. Suppression de compte** — **Règles et programmes › Contenu de l'application ›
Suppression de compte** › **Commencer** :

| Question | Réponse |
| --- | --- |
| Votre application permet-elle de créer un compte ? | **Oui** (créés par l'admin, mais Play les considère comme comptes utilisateur) |
| Proposez-vous un moyen de demander la suppression ? | **Oui** |
| URL | `https://frieslandv3.vercel.app/suppression-de-compte` |
| Suppression partielle des données sans supprimer le compte ? | **Non** |

**Enregistrer**.

**4c. Fiche principale** — **Croissance › Présence sur le Play Store › Fiche
principale** › tout en bas, champ **Politique de confidentialité** → la même URL
qu'en 4a. Play l'exige aux deux endroits ; l'oubli de 4c est un motif de rejet
fréquent.

---

## Étape 5 — Nom du développeur

**Chemin :** icône **Paramètres** (roue, en bas du menu gauche) › **Compte
développeur › Détails du compte développeur**.

**Champ « Nom du développeur »**, exactement :

    BD & CO

Esperluette entourée de deux espaces, comme dans `pages/politique-de-confidentialite.vue`.
Pas `BD&CO`, pas `BD & Co`.

- Déjà `BD & CO` : ne rien toucher.
- À modifier : Google peut rouvrir la vérification d'identité (justificatif
  SIREN 528 724 362 + adresse 60 rue François Ier, 75008 Paris). Le faire **avant**
  d'envoyer la release, sinon elle reste bloquée en attente de vérification du compte.

Les autres champs (adresse, e-mail public `team@bigfive-edition.com`, site
`bigfivesolutions.com`) doivent correspondre au tableau d'identité de
`docs/play-store/FICHE-PLAY-STORE.md`.

---

## Envoi

Retour dans **Tester et publier › Production** › la release en brouillon ›
**Examiner la release**. Play liste en rouge les erreurs restantes ; s'il n'y en a
aucune, **Démarrer le déploiement en production**. Une revue avec déclaration de
localisation en arrière-plan prend en général 3 à 7 jours, contre quelques heures
pour une mise à jour ordinaire.
