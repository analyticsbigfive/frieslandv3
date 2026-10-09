# Réponses d'Atom du 9 octobre 2026 — routing mensuel

Réponses d'Elias aux sept questions du 8 octobre (voir `2026-10-08-point-du-soir.md`, section 3).

## Ce qui est fait

| Réponse | Traduction | État |
|---|---|---|
| 5e lundi, mardi ou samedi du mois : portefeuille libre | Paramètre terrain `routing_semaine_5` = 0 (portefeuille seul), sa valeur par défaut | Rien à faire |
| Propositions de quartiers confirmées ; Port-Bouët 2 = Yopougon | 76 alias « quartier » : les propositions du secteur du merchandiser. Les lieux aux seules propositions hors secteur sont écartés. « Port-Bouët 2 (1) » et « (2) » → `YOPOUGON 3›PORT BOUET 2` | Migration `20261009100000` |
| Lidy, M. Dali, Yao Jaurès, Étienne | 4 alias SSF (Miss Lydie, Dali Romuald Gnakouri, Kouakou Kouassi Jean Jaurès, Aka Kablan Étienne), plus 2 orthographes du fichier : Diaby Ismaël → Diaby Ismaila, Kouassi Apollinaire → Kouassi Appolinaire | Migration `20261009100000` |
| Mme Tea Anne-Marie (Guihi) | Alias commercial « Mme Tea » → NGUESSAN AKUNDAH ANNE MARIE, déjà commerciale de Guihi | Migration `20261009100000` |
| Gui Stéphane remplace Akedan, même compte | `marcorytreichone@gmail.com` renommé GUI STEPHANE, téléphone mis à jour | Fait le 09/10 (script) |
| Yopougon 1 & 2 (Zogbolou) : M. Kamy | Commercial de Zogbolou : SOUARE IBRAHIMA → GAI KAMI | Fait le 09/10 (script) |
| Yopougon 3 & 4 (Deheo) : M. Souaré | Déjà le cas | — |
| Moustapha N'Diaye parti, Port-Bouët vacant | Compte `portbouetone@gmail.com` désactivé, 3 règles désactivées, 6 tournées à venir supprimées | Fait le 09/10 (script) |
| Samedi S4 d'Abbé : Quartier rouge, SSF Tamdia Aliou | Ligne ajoutée dans `~/Downloads/Routing_mensuel_merchandisers_2026-10-09.xlsx`. « Quartier rouge » n'existe pas dans les quartiers des PDV : ce jour-là suit le portefeuille tant qu'il n'est pas rattaché | Fichier corrigé |
| Samedi S4 de Deheo : visite libre | Pas de case : portefeuille | Rien à faire |

Script : `scripts/reponses-client-2026-10-09.mjs` (simulation par défaut, `--apply`, retour arrière en JSON dans `~/Downloads`). Le téléphone est passé en argument, il n'est pas dans le dépôt.

## Simulation de l'import (en mémoire, avec la migration)

| Indicateur | Résultat |
|---|---|
| Merchandisers reconnus | 9 sur 9 |
| Cases | 215, dont 80 sans SSF |
| Lieux reconnus | 146 (70 exacts, 76 par alias) |
| Lieux encore à rattacher | 57 (jours au portefeuille) |
| SSF à créer | 1 (Oboumou Charles, Sodicom-CI) |
| Règles de tournée | 125 |

## Ordre d'application

1. Appliquer les 7 migrations de la PR #14 (`20261008100000` → `160000`), puis `20261009100000_friesland_alias_routing_agence`. Fusionner la PR #14.
2. Admin › Imports terrain :
   - « Routing des SSF (export DMS) » : simuler, puis appliquer ;
   - « Routing mensuel » avec `Routing_mensuel_merchandisers_2026-10-09.xlsx` : simuler, vérifier les chiffres ci-dessus, puis appliquer.
3. Maintenance › Atom › Recalculer les tournées à venir.

## Questions restantes pour Elias

- **57 lieux sans quartier**, dans `~/Downloads/points-de-visite-restants.xlsx` (onglet 2 : les quartiers de la base). Exemples : Batim, Lubafrik, Quartier rouge.
- **SSF de Guihi** : 4 vendredis « Non nommé », 4 samedis « À préciser ».
- **Compte homonyme** `moustapha.ndiaye@friesland-terrain.ci` (Friesland, actif) : ancien compte de test ou personne réelle ?
- **Port-Bouët vacant** : à réaffecter quand un merchandiser sera nommé.

## Soir du 09/10 : lieux rattachés par commune

Vérification après l'import du routing mensuel (lot du 09/10, 16 h 50) : 8 cases avaient un lieu rattaché hors de leur commune, dont 4 hors d'Abidjan. L'import cherchait le libellé dans tout le pays quand il n'existait pas dans le secteur. Cas concernés : « Kennedy 2 » de Seregone à Daloa (tournée du samedi 10/10), « Grand marché » de Gui à Daloa, « Château » de Yao à Adzopé, « Azito » de Deheo dans la zone « Marcory ».

- **Tout de suite** : `~/Downloads/correction-tournees-hors-commune-2026-10-09.sql`, à coller dans l'éditeur SQL. Il remet les périmètres d'avant l'import (5 merchandisers), désactive les 5 règles hors commune et recalcule les tournées à venir.
- **Fichier d'Elias avec Commune et Quartier** : `~/Downloads/Routing_mensuel_merchandisers_avec_quartiers_2026-10-09.csv`. On y a ajouté le samedi S4 d'Abbé (Quartier rouge, Tamdia Aliou), absent du CSV.
- **Nouvel import (PR `jl/routing-commune`)** : un lieu se cherche dans les zones de sa commune et dans les zones principales du portefeuille, jamais ailleurs. Ordre : alias, libellé exact, libellé approché (signalé), puis la commune (portefeuille du merchandiser dans la commune).
- **Simulation sur la production** (lecture seule) : 215 cases.

  | Rattachement | Résultat |
  |---|---|
  | Libellé exact | 65 lieux |
  | Alias | 76 lieux |
  | Approché | 3 lieux : Lubafrik → LUBAFRIQUE, Arras → Aras, Quartier Apollo → Quartier Appolo |
  | Niveau commune | 58 lieux (55 cases) |
  | Portefeuille entier | 1 case (Quartier rouge, sans commune) |

  Aucun PDV hors d'Abidjan.
- **Journées trop courtes** : `etapes_quota_du_jour` complète une case trop petite avec le portefeuille (cas de Pangolin et d'Ananeraie).
- **Correction d'une case** dans Référentiels › Routing mensuel : les règles du merchandiser et ses tournées des 7 jours à venir sont refaites aussitôt.

Ordre :
1. Le SQL ci-dessus.
2. Les migrations `20261009110000` (déjà en production), `20261009120000` et `20261009130000`.
3. Fusionner la PR.
4. Imports terrain › Routing mensuel avec le CSV corrigé : simuler, relire, appliquer.

## Soir du 09/10 (suite) : un point GPS par case, quota atteint au plus près

- **Quota atteint au plus près** (migration `20261009140000`).
  - Le NB du client sur la diapositive « Objectifs quantitatifs » dit : « atteindre le quota journalier au moins ; s'il n'y a pas de superette (aboki, pushcart, porridge), remplacer par boutiques ».
  - Une journée dont le lieu a trop peu de PDV est donc complétée par les PDV du portefeuille du merchandiser **les plus proches du lieu** : il ne sort pas de sa zone.
  - La production avait déjà le complément (PR #15), classé « même zone d'abord » ; la migration le classe par distance.
  - La version « sans complément », envisagée un moment, est abandonnée.
  - Tournées du samedi 10/10 vérifiées : 10 PDV par merchandiser, selon la grille.
- **Positions des lieux.** Analyse dans `~/Downloads/analyse-quartiers-2026-10-09/` : les 204 lieux d'Elias ont une position, dont 160 validées contre nos PDV.
  - Sources : Fable, les coordonnées complémentaires, les corrections de Paillet et de HMA.
  - Il reste 44 lieux à confirmer par Elias (`3f-a-confirmer-elias.csv`), dont 15 hors du portefeuille DMS du merchandiser.
- **Point GPS par case** (migration `20261009160000`). Le fichier de l'agence peut porter Latitude, Longitude et Rayon. La tournée prend alors les PDV du portefeuille du merchandiser dans le rayon (500 m par défaut).
  - Fichier prêt : `~/Downloads/Routing_mensuel_merchandisers_avec_gps_2026-10-09.csv`, avec 164 cases à point.
  - Simulation sur la production : 164 cases par point, 17 au niveau de la commune, aucune sans lieu, aucun PDV hors d'Abidjan.
- **Alias « Quartier rouge »** (migration `20261009150000`) vers RENAULT, FORUM et MARCHE GOURO. Les 153 PDV d'Adjamé sans quartier restent tels quels, en attendant Elias.
- **Application 1.0.12** (code 15) compilée le 09/10 et signée (SHA-1 13b21bc5…), dans `dist-apk/`. L'APK publié le 06/10 était en réalité la 1.0.11 : la 1.0.12 n'avait jamais été compilée.

Ordre :
1. Les migrations `140000` (complément au plus près), `150000` et `160000`. Aucune ne recalcule les tournées déjà générées.
2. `20261009130000`, si ce n'est pas fait (aucun effet en production).
3. Fusionner la PR.
4. Imports terrain › Routing mensuel avec le CSV GPS.
5. Admin › Publier une version : l'APK 1.0.12, version minimale 1.0.12.
