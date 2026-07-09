# MAJ Perfect Store — 2026-07-09

Diff entre le fichier `BIG FIVE KPI UPDATE` (mis à jour) et les migrations `nouveau/`.
Seule la partie **MT (Modern Trade)** a changé. GT, territoires, distributeurs,
pos_types, tiers, visibilité, min-qty GT : **identiques, rien à faire.**

## ✅ Appliqué
**`20260709120000_friesland_maj_poids_mt_taux_vente.sql`** — poids MT `taux_vente`
révisés pour EVAP (6 SKU) et IMP (7 SKU). Chaque catégorie somme à 1.0. Recalcul
`resultat_perfect_store` inclus. Ajouté au run script + `TOUT_COMBINE.sql`.
GT et tous les `taux_revu` : inchangés.

---

## ⏳ À ARBITRER FRIESLAND (non appliqué — données de la sheet incomplètes)

### 1. SCM MT : passage de 2 à 4 SKU (base « DIVISION »)
La sheet veut désormais 4 SKU en SCM MT `taux_vente` :

| SKU (sheet) | clé app | poids voulu |
|---|---|---|
| Pearl 1kg | `pearl_1kg` | 0.024667 |
| BR 1kg | `br_1kg` | 0.775037 |
| **397 R** (BR SCM 397g) | `br_397g` | 0.074001 |
| **BRB 1Kg** | `brb_1kg` | 0.126295 |

**Bloquant :** `br_397g` et `brb_1kg` ont un **poids** mais **aucun seuil de
disponibilité MT** (l'onglet STANDARD DISPO MT ne liste que BR 1Kg + Pearl 1kg).
Sans seuil, `calculer_perfect_store` les comptera « indisponibles » → OSA SCM MT
faussé. Ces clés étaient déjà signalées « à arbitrer » dans
`20260630120550_friesland_correspondance_imp_scm_fix.sql:19`.

**Décision requise :**
- soit fournir les seuils MT (segment/grade) de `br_397g` et `brb_1kg`, et on
  crée : `reference_produit` (BR 397g / BRB 1kg, rôle à préciser) +
  `correspondance_reference` (`scm`/`br_397g`, `scm`/`brb_1kg`) + poids MT + seuils ;
- soit confirmer que SCM MT reste à 2 SKU (Pearl 1kg / BR 1kg) — dans ce cas
  donner les 2 poids MT voulus (les 4 valeurs ci-dessus ne somment 1.0 qu'à 4 SKU).

### 2. Standard de disponibilité MT réel + facings
La sheet (onglet **STANDARD DISPO MT**) fournit des min-qty **et des facings** par
SKU × format supermarché, censés remplacer le hack provisoire
`20260630120560_friesland_segment_grade_mt.sql` (qui mappe MT → Minimarket A/B).

| SKU | Hyper/Grd Super (qté/facing) | Moyen Super | Petit Super |
|---|---|---|---|
| BR Gold 160g | 96 / 13 | 48 / 8 | 24 / 6 |
| BR 150g | 144 / 13 | 96 / 8 | 48 / 6 |
| BRB 150g | 96 / 13 | 48 / 8 | 24 / 6 |
| BR 380g | 48 / 11 | 24 / 7 | 24 / 5 |
| Pearl 380g | 48 / 11 | 48 / 7 | 24 / 5 |
| BR tin 400g | 24 / 7 | 12 / 4 | 12 / 5 |
| BR tin 900g | 12 / 5 | 6 / 3 | 6 / 3 |
| BR tin 2500g | 6 / 3 | 4 / 2 | 2 / 2 |
| BR Pouch 360g | 30 / 5 | 12 / 2 | 6 / 3 |
| BR Delice Pouch 350g | 30 / 5 | 12 / 2 | 6 / 3 |
| BR Délice 15g | 24 / 2 | 12 / 2 | 12 / 2 |
| BR 15g | 24 / 2 | 12 / 2 | 12 / 2 |
| BR 1kg (SCM) | 24 / 6 | 24 / 4 | 24 / 5 |
| Pearl 1kg (SCM) | 24 / 6 | 24 / 4 | 24 / 5 |

**Bloquant :**
- l'app n'a **pas de catégorie taille-supermarché** (`sous_categorie_pdv` =
  Boutique A/B/C, Superette GT, Kiosque). Il faut décider comment segmenter les PDV MT
  en Hyper / Moyen / Petit.
- `seuil_disponibilite` n'a ni colonne **facings** ni segments MT.
- `calculer_perfect_store` lit le fallback Minimarket pour le MT.

**Décision requise :** définir les segments MT + la règle de catégorisation des PDV MT,
adopter une colonne/table facings, puis câbler le calcul. (Données ci-dessus prêtes.)

### 3. (Info) Colonne TERRITORY `dist` repeuplée
L'onglet TERRITORY a maintenant sa colonne `dist` remplie ; elle **diverge** de
l'onglet `Mapping` (la référence). Elle introduit `LKA SERVICES` (Abobo 2, Aboisso,
Anyama, Bassam) et réassigne quelques territoires (Cocody 1 → PRODISMA, koumassi →
SIDECOM, Port bouet → SDHPA, orthographe « DYNAMYS »…). Le seed suit `Mapping`.
À confirmer si `dist` devient la source canonique.
