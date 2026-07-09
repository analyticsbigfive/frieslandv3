# MAJ Perfect Store — 2026-07-09

Diff entre le fichier `BIG FIVE KPI UPDATE` (mis à jour) et les migrations `nouveau/`.
Seule la partie **MT (Modern Trade)** + le **mapping distributeurs** ont changé.

## ✅ Appliqué (nouvelles migrations)

| Migration | Contenu |
|---|---|
| `20260709120000_..._maj_poids_mt_taux_vente.sql` | Poids MT `taux_vente` EVAP (6) + IMP (7) révisés + recalcul de l'historique. |
| `20260709130000_..._dist_canonique.sql` | **Colonne `dist` = source canonique** du mapping territoire→distributeur (décision Friesland). Ajoute `LKA SERVICES` ; `DYNAMYS`→`DYNAMIS` ; réaffecte Cocody 1, koumassi, Port bouet, Bouna, Dabou, Dimbokro… ; **5 des 7 territoires jadis non assignés** sont désormais couverts. |
| `20260709140000_..._standard_mt_facings.sql` | Standard de disponibilité MT réel (quantité min + **facings**) par SKU × Hyper/Moyen/Petit supermarché → **chargé** dans `seuil_disponibilite_mt`. Table de référence, **pas encore branchée au calcul** (voir point 2). |

**Inchangé** (vérifié) : poids GT, tous les `taux_revu`, territoires/areas, types PDV, quantités min GT, niveaux, standards de visibilité GT.

---

## ⏳ À ARBITRER FRIESLAND (irrésolvable depuis le fichier)

### 1. SCM Modern Trade — 2 SKU sans seuil
Le fichier veut passer SCM MT à 4 SKU (`Pearl 1kg`, `BR 1kg`, **`397 R`**, **`BRB 1Kg`**). Mais `397 R` et
`BRB 1Kg` n'ont **aucune quantité minimale / seuil nulle part** dans le fichier (absents de
STANDARD DISPO MT et des tables GT — ils n'existent que comme entrées de calcul dans l'onglet
DISPONIBILITE SCM MT). Sans seuil, le moteur les compterait « indisponibles » → OSA SCM MT faussé.
**En attendant, SCM MT reste à 2 SKU (poids d'origine).**
**Décision :** fournir les seuils de `397 R` et `BRB 1Kg` (par segment), ou confirmer SCM MT à 2 SKU.

### 2. Segmentation des PDV Modern Trade — la classification vient de l'onglet TYPE DE POINT DE VENTE
Le classement des supermarchés existe déjà dans le fichier (onglet TYPE DE POINT DE VENTE → table
`type_pdv`) : `Hypermarket`, `Supermarket A` (Premium), `Supermarket B` / `Supermarket C` (Value),
tous canal MT. Le grade A/B/C = la taille (cohérent avec Boutique A/B/C, Superette A/B/C…).

Correspondance proposée avec les 3 paliers de STANDARD DISPO MT :
- `Hypermarket` + `Supermarket A` → « Hypermarchés / Grands Supermarchés » (`Hypermarche`)
- `Supermarket B` → « Moyens Supermarchés » (`MoyenSuper`)
- `Supermarket C` → « Petits Supermarchés » (`PetitSuper`)

**✅ CÂBLÉ** (migration `20260709150000`, en assumant A=Grand/B=Moyen/C=Petit) :
- les supermarchés sont scorés sur le vrai standard MT (segment `SupermarcheMT`, grade A/B/C),
  au lieu du repli Minimarket. Aucune modification du moteur de calcul.
- (a) déjà en place : les formulaires PDV proposent les types Supermarket A/B/C / Hypermarket
  (source = référentiel `type_pdv`) ; la visibilité MT est mappée (`superette`) ; `canal='MT'`.

**Reste juste la confirmation Friesland :** valider la correspondance A/B/C → Grand/Moyen/Petit
(Hypermarket + Supermarket A = Grand ; B = Moyen ; C = Petit). Si Friesland corrige, il suffit
d'ajuster les grades dans la migration `20260709150000` — pas de refonte.

### 3. Adzope & Agboville — distributeur manquant
Dans la colonne `dist`, ces 2 territoires répètent leur propre nom (placeholder) → restent **sans
distributeur** après la mise à jour.
**Décision :** quel distributeur pour Adzope et Agboville ?
