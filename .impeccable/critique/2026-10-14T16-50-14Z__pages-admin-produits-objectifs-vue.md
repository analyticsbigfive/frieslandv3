---
target: écran Objectifs de disponibilité + grille Référentiels
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/bfaproduction/Documents/GitHub/frieslandv3/pages/admin/produits/objectifs.vue"
target_fingerprint: "sha256:d9704fe4608f1c4ee2915fb38af49e33ecc006169258978510a43b46acf74036"
target_path: /Users/bfaproduction/Documents/GitHub/frieslandv3/pages/admin/produits/objectifs.vue
timestamp: 2026-10-14T16-50-14Z
slug: pages-admin-produits-objectifs-vue
closed: true
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Trimestre en cours (5 PDV) jugé sans avertissement ; squelette de chargement sans libellé |
| 2 | Match System / Real World | 3 | « GT UPC » dans les infobulles ; objectif National = moyenne simple non dite |
| 3 | User Control and Freedom | 2 | Filtres absents de l'URL ; la grille perd les saisies au changement de trimestre |
| 4 | Consistency and Standards | 3 | Squelette maison au lieu de ChargementContenu ; boutons désactivés visibles en lecture seule |
| 5 | Error Prevention | 2 | Pas de garde au changement de trimestre ni à la sortie ; pas d'aria-invalid |
| 6 | Recognition Rather Than Recall | 3 | Écart à calculer de tête ; aide repliée en bas |
| 7 | Flexibility and Efficiency | 2 | Tri sur le texte brut ; pas de copie du trimestre précédent |
| 8 | Aesthetic and Minimalist Design | 2 | 4 lignes × 80 cases ; pastilles sur les colonnes vides ; sélecteur Année à une option |
| 9 | Error Recovery | 3 | Message de validation hors écran, sous la grille |
| 10 | Help and Documentation | 3 | Aide en bas, chemins d'écran non cliquables |
| **Total** | | **25/40** | **Acceptable** |

## Design Specificity Verdict
LLM : contenu propre au produit (canaux, 15 produits du client, base par case, « base faible »), fidèle au Registre net ; mais gabarit maison (filtres, 4 tuiles, tableaux) qui ne montre jamais l'écart à l'objectif.
Détecteur : CLI 0 constat (exit 0) sur les 2 fichiers ; overlay navigateur « No anti-patterns found » sur les 2 pages. Contrastes ≥ 4,76:1. Débordement horizontal à 1024 px sur Référentiels (AdminObjectifsDisponibilite.vue:11, groupe de boutons non rétrécissable).

## Priority Issues
1. [P1] Trimestre en cours (5 PDV) affiché par défaut avec des verdicts rouges ; tuiles qui ignorent la base faible (objectifs.vue trimestreDe, tuiles, état vide à 0 seulement).
2. [P1] Le haut de page ne dit pas où l'on est en retard ni de combien ; l'écart n'est jamais affiché ; tri des colonnes sur le texte brut.
3. [P1] Grille de saisie : perte silencieuse des saisies au changement de trimestre ; actions avant le choix du trimestre ; message de validation hors écran ; débordement à 1024 px ; pas de copie du trimestre précédent.
4. [P2] Colonne National : moyenne simple des objectifs comparée à un réalisé pondéré ; verdict sur valeurs non arrondies (« 91 % / objectif 91 % / Proche »).
5. [P2] Trop de pastilles et de texte par case ; première colonne non figée sur mobile.

## Persona Red Flags
Alex : pas de classement par écart, filtres non partageables, export placé dans le bloc EVAP. Sam : explication de la base en title seulement, 20 arrêts de tabulation d'en-têtes, aria-label qui masque la valeur des listes. Agence / lecture seule : boutons désactivés affichés.

## Minor Observations
Option vide « Tous » ; « objectif — » au lieu de « pas d'objectif » ; apostrophes mélangées ; chemins non cliquables ; tuiles affichées à 0 PDV ; tuile « Sans canal » à déplacer en avertissement.

## Questions to Consider
Quelle phrase doit dire le haut de page ? Un trimestre de deux semaines doit-il recevoir un verdict ? National : canal ou chiffre de tête, pondéré comment ?
