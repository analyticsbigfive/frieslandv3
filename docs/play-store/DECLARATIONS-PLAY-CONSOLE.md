# Déclarations Play Console — 1.0.4, écran par écran (textes prêts à coller)

Vérifié le 7 septembre 2026. Toutes les valeurs proviennent du code de la version
1.0.4 : ne pas les modifier sans mettre à jour `composables/useTournee.ts`,
`components/LocationDisclosureModal.vue` et `pages/privacy-policy.vue`.

**Binaire à téléverser : `dist-apk/friesland-bonnet-rouge-1.0.4-vc6-release.aab`**
(versionName 1.0.4, **versionCode 6**, clé d'upload SHA-1
`13b21bc5c7129073bedf65ebaefd0df645fefdcf`).

> Pourquoi versionCode 6 : Play a refusé le premier AAB 1.0.4 avec « Le code de
> version 5 a déjà été utilisé » — un bundle en versionCode 5 avait été téléversé
> une première fois (même en brouillon supprimé, Play garde le numéro consommé).
> Le versionCode est un compteur à sens unique par package : tout nouvel upload
> doit être strictement supérieur au plus grand jamais téléversé, pas seulement
> au plus grand publié. Le fichier `friesland-bonnet-rouge-1.0.4-release.aab`
> (versionCode 5) est conservé pour trace mais ne doit plus être envoyé.

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
ligne **Accès aux données de localisation** (parfois « Autorisations sensibles »)
› **Commencer** / **Gérer**.

### Préalable : la vidéo

YouTube en **Non répertorié** (pas « Privé », sinon Google ne peut pas la lire) ou
Drive avec « Toute personne disposant du lien ». Plan de tournage, **sans coupure**
(Google rejette les montages qui masquent l'ordre des écrans) :

1. Ouverture de l'app et connexion.
2. Appui sur « Démarrer la tournée ».
3. **La modale de divulgation, lisible 3 secondes** (« Bonnet Rouge collecte des
   données de localisation… y compris lorsque l'application est fermée ou n'est
   pas utilisée »).
4. Appui sur « Accepter ».
5. **Puis seulement** le prompt système Android « Autoriser Bonnet Rouge à accéder
   à la position de cet appareil ? ».
6. Volet de notifications montrant « Tournée en cours — Suivi GPS de votre tournée actif ».
7. Appui sur « Terminer la tournée » → la notification disparaît.

### Le formulaire, champ par champ

**Autorisations demandées** — cocher `ACCESS_BACKGROUND_LOCATION` (les autres
sont pré-cochées d'après le manifeste).

**Quelle fonctionnalité de votre application utilise la position en arrière-plan ?**

> Suivi de tournée terrain. L'application enregistre le trajet d'un commercial
> pendant une tournée qu'il démarre lui-même, afin de reconstituer l'itinéraire
> réellement parcouru entre les points de vente visités et de calculer la distance
> et la durée de la tournée. Le suivi commence à l'appui sur « Démarrer la tournée »
> et s'arrête à l'appui sur « Terminer la tournée ».

**En quoi cette fonctionnalité est-elle utile à l'utilisateur ?**

> L'application est un outil professionnel interne, réservé aux équipes commerciales
> et merchandising de l'entreprise. Le suivi de tournée dispense l'utilisateur de
> tout relevé manuel de kilométrage et de justificatif de déplacement : son trajet,
> sa distance et ses temps de visite sont calculés automatiquement et servent au
> remboursement de ses frais et à la planification de ses tournées suivantes.

**Pourquoi l'accès au premier plan ne suffit-il pas ?** — le champ décisif

> Une tournée dure plusieurs heures et l'utilisateur conduit entre deux points de
> vente : son téléphone est en poche, écran éteint, ou il utilise une application
> de navigation. Sans accès en arrière-plan, le trajet serait interrompu à chaque
> mise en veille et l'itinéraire reconstitué serait une succession de fragments
> inexploitables. L'accès en arrière-plan est strictement limité à l'intervalle
> entre « Démarrer » et « Terminer la tournée ».

**Mesures prises pour limiter la collecte** (si le champ est présent)

> Collecte limitée à un point toutes les 120 secondes et uniquement après 15 mètres
> de déplacement. Une notification permanente « Tournée en cours » reste affichée
> pendant toute la durée du suivi. Aucune position n'est collectée en dehors d'une
> tournée active. Les positions ne sont ni vendues, ni partagées avec des tiers,
> ni utilisées à des fins publicitaires.

**Lien vidéo** — coller l'URL YouTube / Drive.

**Case de conformité** — cocher « Je confirme que mon application respecte le
règlement sur les autorisations de localisation ».

**Bouton :** **Enregistrer**.

---

## Étape 3 — Sécurité des données

**Chemin :** **Règles et programmes › Contenu de l'application › Sécurité des
données** › **Commencer**.

**Page 1 — Vue d'ensemble**

| Question | Réponse |
| --- | --- |
| Votre application collecte-t-elle ou partage-t-elle des données utilisateur ? | **Oui** |
| Toutes les données sont-elles chiffrées en transit ? | **Oui** (HTTPS/TLS) |
| Proposez-vous un moyen de demander la suppression des données ? | **Oui** — `https://frieslandv3.vercel.app/supprimer-compte` |

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

    https://frieslandv3.vercel.app/privacy-policy

**Enregistrer**.

**4b. Suppression de compte** — **Règles et programmes › Contenu de l'application ›
Suppression de compte** › **Commencer** :

| Question | Réponse |
| --- | --- |
| Votre application permet-elle de créer un compte ? | **Oui** (créés par l'admin, mais Play les considère comme comptes utilisateur) |
| Proposez-vous un moyen de demander la suppression ? | **Oui** |
| URL | `https://frieslandv3.vercel.app/supprimer-compte` |
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

Esperluette entourée de deux espaces, comme dans `pages/privacy-policy.vue`.
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
