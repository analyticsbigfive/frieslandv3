# Fiche Google Play — Bonnet Rouge

Textes et visuels de la fiche. Captures 1080×1920 (9:16) générées depuis l'app web en
format téléphone (`scripts` : voir historique de session du 3 septembre 2026), image de
présentation 1024×500, icône 512×512.

## Nom de l'application (30 caractères max)

```
Bonnet Rouge
```

Variante avec la marque mère : `Friesland Bonnet Rouge`.

## Brève description (80 caractères max)

```
Visites en point de vente, routing et Perfect Store pour les équipes terrain.
```

## Description complète (4 000 caractères max)

```
Bonnet Rouge est l'application terrain des équipes commerciales et merchandising de FrieslandCampina en Côte d'Ivoire. Réservée aux collaborateurs disposant d'un compte créé par leur organisation, elle remplace les relevés papier et les formulaires dispersés par un parcours de visite unique.

CE QUE VOUS FAITES AVEC BONNET ROUGE

• Votre routing du jour : les points de vente à visiter, dans l'ordre, avec les objectifs de chaque visite.
• Le relevé de visite en 11 étapes : stock par référence, facings en grande distribution, présence de la concurrence, éléments de visibilité, promotions en cours, actions réalisées et photos du rayon.
• Le score Perfect Store calculé à chaque visite : le magasin est classé Basic, Core, VIP ou Flagship selon la disponibilité, l'assortiment, la visibilité et la promotion.
• La fiche de chaque point de vente : canal, type, distributeur, historique des visites et itinéraire.
• La carte des points de vente autour de vous, avec la distance.
• La création d'un nouveau point de vente lors d'une prospection, avec sa position GPS.
• Le suivi de tournée : votre trajet est enregistré pour restituer la journée de terrain.

CONÇUE POUR LE TERRAIN

• Fonctionne sans réseau : les visites et les photos sont enregistrées sur le téléphone et envoyées automatiquement au retour de la connexion.
• Un formulaire qui s'adapte au type de magasin : une boutique, un kiosque ou un supermarché n'affichent pas les mêmes produits ni les mêmes éléments de visibilité.
• Contrôle de présence : la position GPS est comparée à celle du point de vente au moment de l'enregistrement.
• Photos compressées automatiquement pour économiser la donnée mobile.

DONNÉES ET CONFIDENTIALITÉ

L'application collecte votre position pendant les visites et les tournées, ainsi que les photos que vous prenez dans les points de vente. Ces données servent uniquement au pilotage commercial de votre organisation. Vous pouvez demander la suppression de votre compte et des données associées depuis l'application (onglet Plus) ou depuis la page dédiée, sans être connecté.

ACCÈS

Bonnet Rouge ne propose pas d'inscription libre. Les identifiants sont fournis par l'administrateur de votre organisation. Sans compte, l'application ne peut pas être utilisée.

Éditée par Big Five Abidjan pour FrieslandCampina Côte d'Ivoire.
```

## Visuels

| Fichier | Usage |
|---|---|
| `06-visite-produits.png` | Capture 1 (relevé de stock) |
| `07-visite-visibilite.png` | Capture 2 (visibilité) |
| `02-pdv-liste.png` | Capture 3 |
| `04-carte.png` | Capture 4 |
| `03-pdv-fiche.png` | Capture 5 |
| `05-visite-general.png` | Capture 6 |
| `08-plus.png` | Capture 7 |
| `01-connexion.png` | Capture 8 |
| `09-supprimer-compte.png` | Preuve pour la déclaration « suppression de compte », pas dans la fiche |
| `feature-graphic-1024x500.png` | Image de présentation |
| `icone-512.png` | Icône |

## Identité à déclarer (doit correspondre mot pour mot entre la fiche Play et la politique)

| Élément | Valeur |
| --- | --- |
| Nom du développeur (profil public Play) | `BD & CO` |
| Personne morale | BUSINESS DEVELOPMENT & COMMUNICATION (BD&CO), SARL, SIREN 528 724 362 |
| Adresse | 60 rue François Ier, 75008 Paris, France |
| ID du compte de développeur | 6527229789438339542 |
| E-mail développeur (public) | team@bigfive-edition.com |
| Site web | https://bigfivesolutions.com/ |
| Nom de l'application | Friesland Bonnet Rouge |
| Package | com.bdco.bonnetrouge |

Ces valeurs sont reprises telles quelles dans `pages/privacy-policy.vue` (section
« Identification de l'application et de l'éditeur ») et dans `pages/supprimer-compte.vue`.
Tout changement dans Play Console doit être répercuté dans ces deux pages, sinon le
motif de rejet « Les renseignements sur l'appli ou le développeur ne concordent pas »
revient.

## URL à déclarer (domaine de production : frieslandv3.vercel.app, vérifié le 7 sept. 2026)

- Politique de confidentialité : `https://frieslandv3.vercel.app/privacy-policy` (doit nommer l'app, le package `com.bdco.bonnetrouge` et BD&CO comme personne morale — exigence Play)
- Suppression de compte : `https://frieslandv3.vercel.app/supprimer-compte`

## Fichier à téléverser

`dist-apk/friesland-bonnet-rouge-1.0.4-vc6-release.aab` (version 1.0.4, **versionCode 6**),
signé avec la clé d'upload de production (SHA-1 `13b21bc5c7129073bedf65ebaefd0df645fefdcf`).
Le versionCode 5 a été consommé par un premier upload refusé (« Le code de version 5
a déjà été utilisé ») : `friesland-bonnet-rouge-1.0.4-release.aab` ne doit plus être envoyé.
Play n'accepte que l'AAB : l'APK release du même lot ne sert qu'au test hors-Play.
Contrôler la signature avant envoi avec
`bash scripts/verify-aab-signature.sh dist-apk/friesland-bonnet-rouge-1.0.4-vc6-release.aab`.
Voir `docs/BUILD-ANDROID.md` pour régénérer.

## Déclarations Play Console

Les textes prêts à coller (accès à la localisation en arrière-plan, sécurité des
données, notes de version) sont dans `docs/play-store/DECLARATIONS-PLAY-CONSOLE.md`.
