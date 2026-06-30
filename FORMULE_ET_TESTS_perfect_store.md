# `compute_perfect_store` — formule exacte & tests de parité

> Référence d'implémentation : fonction SQL `compute_perfect_store` (migration `013_016_perfect_store.sql`).
> Le scorer TS `utils/perfectStore.ts` doit produire **exactement** ces résultats.
>
> ⚠️ **Le brief ne fixe NI la combinaison des piliers NI les seuils de tier.** Tout ce qui suit
> en est donc une proposition **entièrement paramétrable** (tables `perfect_store_tier_config`
> et `perfect_store_score_config`). Rien n'est codé en dur. À valider avec le category management.

---

## 1. Notations
Pour une visite sur un PDV donné, on résout :
- `group`, `tier` ← `pos_standard_map[pdv.sous_categorie_pdv]` (ex. `Boutique A` → `BOUTIQUE`, `A`)
- `trade` ← `MT` si `pdv.canal` contient « modern » ou vaut `MT`, sinon `GT`
- `objectif` ← `pdv.objectif_perfect_store` (défaut `BASIC`)
- `basis` ← `taux_vente` (défaut) ou `taux_revu`

On ne score que les catégories **evap / imp / scm** (périmètre merchandising du fichier source).

## 2. Les 4 piliers (chacun ∈ [0,1])

### a) Disponibilité par SKU
```
dispo(sku) = 1  si  quantité_relevée(sku) ≥ min_quantity(sku, group, tier)
             0  sinon
```
Quantité lue dans `visites.data.produits.<cat>.quantites.<sku>` (0 si absente).
> Distinction **Présence (≥1) ≠ Disponibilité (≥ seuil)**.

### b) OSA linéaire
```
OSA_lin = nb_SKU_dispo / nb_SKU_évalués
```

### c) OSA pondérée — normalisée
```
OSA_pond = Σ( dispo(sku) · poids(sku) ) / Σ poids(sku)
```
`poids(sku)` ← `availability_weights[cat, trade, basis, sku]`, sinon `0`. La normalisation par
Σpoids évite que les SKU sans poids (ex. IMP non seedé) ne polluent l'OSA pondérée.

### d) Assortiment
```
Assort = min( nb_SKU_dispo / min_sku_present(group, tier) , 1 )
```
NULL si `min_sku_present` non défini.

### e) Visibilité
```
Visi = nb_éléments_requis_présents / nb_éléments_requis
```
Éléments PLV requis ← `visibility_standards[group, objectif, is_required]`. Présence lue dans
`visites.data.visibilite.<zone>.<element_key>` (booléen).

## 3. Score composite (% final continu)
```
score_global = ( wL·OSA_lin + wP·OSA_pond + wA·Assort + wV·Visi )
               / ( somme des poids des composantes NON nulles )
```
Poids défaut (`perfect_store_score_config`) : `wL=0.10, wP=0.45, wA=0.15, wV=0.30`.
Renormalisé sur les composantes présentes (pilier NULL → poids hors dénominateur).
Indicateur continu (tendances) — ne décide PAS du statut PS.

## 4. Gating → tier (binaire, conjonctif)
```
tier_atteint = tier de plus haut rang T tel que :
      OSA_pond ≥ osa_min(T)  ET  Assort ≥ assort_min(T)
  ET  Visi ≥ visi_min(T)      ET  ( promo_min(T) NULL OU Promo ≥ promo_min(T) )
is_perfect_store = (tier_atteint ≠ aucun)
```
Seuils défaut (`perfect_store_tier_config`, **à valider**) :

| tier | osa_min | assort_min | visi_min | promo_min | rang |
|---|:--:|:--:|:--:|:--:|:--:|
| FLAGSHIP | 0.95 | 1.00 | 1.00 | (off) | 4 |
| VIP | 0.85 | 0.90 | 1.00 | (off) | 3 |
| CORE | 0.75 | 0.80 | 1.00 | (off) | 2 |
| BASIC | 0.60 | 0.60 | 1.00 | (off) | 1 |

---

## 5. Tests de parité — EVAP GT (`utils/perfectStore.spec.ts`)
Bloc TAUX VENTE. Colonnes `[br_160g, brb_160g, br_400g, brb_400g, br_gold, pearl_400g]`,
poids `[0.75, 0.08, 0.05, 0.01, 0.01, 0.10]` (Σ = 1.00).

| PDV | dispo | OSA_lin | OSA_pond | note/10 | tier (défaut) |
|---|---|:--:|:--:|:--:|:--:|
| PDV1 | 1,0,1,1,1,1 | 83.3 % | 92.0 % | 9.20 | VIP |
| PDV2 | 0,1,1,0,1,0 | 50.0 % | 14.0 % | 1.40 | aucun |
| PDV3 | 1,0,1,0,1,1 | 66.7 % | 91.0 % | 9.10 | VIP |

PDV2 : 3/6 SKU (50 % linéaire) mais 14 % pondéré car rate le héros `br_160g` (poids 75 %).

> `computeOsa(dispoMap, weights)` : linéaire = moyenne des booléens ; pondérée = Σ(dispo·poids)/Σ(poids).
> Le tier/score composite (seuils paramétrables) sont testés avec une config figée en fixture.

## 6. TODO mapping non confirmé (ne pas inventer)
- IMP (GT & MT) + SCM MT : poids/standards en commentaire dans la migration, à valider format↔SKU.
- Visibilité : seul `BOUTIQUE` seedé ; compléter MINI MARKET / KIOSQUE / etc.
- Promo : désactivée (`promo_min = NULL`) — activable plus tard via config.
