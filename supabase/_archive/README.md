# _archive — migrations appliquées (historique)

Migrations numérotées `001` → `023` + le rattrapage `CATCHUP_019_023.sql`.
**Toutes appliquées sur la base live** (vérifié le 2026-06-30 via
`scripts/probe-migrations.mjs`). Archivées ici pour désencombrer `supabase/`.

Elles restent l'historique de construction de la base (ce projet n'a **pas** de
table de tracking type `supabase_migrations`). Ne pas supprimer : nécessaires
pour reconstruire un environnement neuf.

## État (2026-06-30)

| Migration | Objet | État |
|---|---|---|
| 001–016 | schéma base + perfect store | ✅ tables présentes |
| 017 | géofence pdv → 200 m | ✅ 24876 pdv à 200, 0 à 300 |
| 018 | RBAC section perfect-store | ✅ 4 lignes role_section_access |
| 019 | durcissement RLS/RPC | ✅ rejoué via CATCHUP |
| 020 / 021 | fichiers **vides** (0 o) | contenu réel dans `../nouveau/` |
| 022 | visibilité + poids OSA MT | ✅ 67 + 28 lignes |
| 023 | category_weights + `pos_types.canal` | ✅ (canal ajouté via CATCHUP) |
| CATCHUP_019_023 | rattrapage 019 + canal 023 | ✅ exécuté |

**Rien en attente.** Le schéma canonique courant est dans `../nouveau/`.

## Doublon seed (poids)

`004_seed_visites.sql` (73 Mo) **et** `004_parts/` (70 Mo) = mêmes visites.
`004_parts/` = version splittée lancée par `scripts/run-migrations.sh`.
`git rm` ne réduit pas `.git` (les blobs restent dans l'historique).

## ⚠️ Runner

`scripts/run-migrations.sh` pointe vers `supabase/002`, `003`, `004_parts`.
Ces chemins sont maintenant dans `_archive/`. Mettre à jour `SQL_DIR` →
`_archive/` si tu rejoues le seed sur une base neuve.
