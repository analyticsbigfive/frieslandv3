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
