# Import massif — VISITE (3).xlsx + VisiteAfter (31/08/2026)

Migrations générées depuis les sources :

- `VISITE (3).xlsx` — onglet **PDV** (25 368 lignes) et onglet **VISITE** (26 240 lignes)
- `VisiteAfter - ZONE SECTEUR.csv` (881 lignes zone/secteur, 24 merchandisers + 23 commerciaux uniques)

Les onglets Excel ont été exportés vers `csv/VISITE - PDV.csv`, `csv/VISITE - VISITE.csv`
et `csv/VISITE - ZONE SECTEUR.csv` (format legacy : dates `DD/MM/YYYY [HH:MM:SS]`,
booléens `TRUE/FALSE`), puis les générateurs existants ont produit les SQL.

## Fichiers générés

| Fichier | Contenu | Idempotence |
|---|---|---|
| `supabase/003_seed_zones_secteurs.sql` | 881 zones/secteurs (TRUNCATE + INSERT par lots de 100) | ⚠️ TRUNCATE en tête |
| `supabase/005_seed_pdv.sql` | 25 368 PDV (INSERT par lots de 200, `ON CONFLICT (pdv_id) DO UPDATE`) | ✅ upsert |
| `supabase/004_seed_visites.sql` | 26 240 visites via `import_visite_from_csv(jsonb)` (`ON CONFLICT (visite_id) DO UPDATE`) — 96 Mo | ✅ upsert |
| `supabase/004_parts/004_part_01..14.sql` | Découpage de 004 en 14 morceaux (~2 000 visites/fichier) pour le SQL Editor | ✅ upsert |

## Ordre d'exécution

Prérequis : le schéma et la fonction `public.import_visite_from_csv` doivent exister
(déjà en place en prod ; sinon appliquer `supabase/_archive/001a-001c` puis
`supabase/_archive/002_seed_data_and_import.sql`).

```bash
PSQL="/opt/homebrew/opt/libpq/bin/psql"
DB="postgresql://postgres.iirgolfjwdnnesamzcbd:MOT_DE_PASSE@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"

# 1. Zones / secteurs (remplace tout le référentiel)
$PSQL "$DB" -f supabase/003_seed_zones_secteurs.sql

# 2. PDV (avant les visites, même si la fonction crée des placeholders)
$PSQL "$DB" -f supabase/005_seed_pdv.sql

# 3. Visites (96 Mo — en une passe via psql, ou par parts via le SQL Editor)
$PSQL "$DB" -f supabase/004_seed_visites.sql
```

## Utilisateurs (merchandisers + commerciaux)

Les comptes auth ne se créent pas en SQL : après l'étape 1, lancer

```bash
node scripts/create-users-from-zones.mjs --dry-run
node scripts/create-users-from-zones.mjs --password=MotDePasseInitial
```

Le script lit `zones_secteurs`, déduplique par e-mail et crée, via l'API admin
(`SUPABASE_SERVICE_ROLE_KEY` requis dans `.env`) :
- 24 comptes rôle `merchandiser` (colonne Merchandiser / e-mail)
- 23 comptes rôle `commercial` (colonne Sales rep / email Sales rep)

avec `profiles.nom`, `role`, `zone_assignee`, `region` renseignés. Les e-mails déjà
présents dans `profiles` sont ignorés (ré-exécutable sans risque).

## Points d'attention

- **Bug corrigé** dans `scripts/generate-seed-sql.mjs` : les colonnes
  « Exécution d’activités promotionnelles » et « Pause d’affiches » utilisent une
  apostrophe typographique (’) dans le header ; le lookup en apostrophe droite les
  ratait et ces deux actions étaient toujours importées à `false`. Après correction :
  1 717 et 5 923 visites à `true` respectivement. Une ré-exécution de 004 corrige
  les visites déjà en base (upsert).
- 4 `pdv_id` référencés par des visites sont absents de l'onglet PDV : la fonction
  d'import crée automatiquement des PDV placeholder (`nom_pdv = 'PDV <id>'`).
- `003` fait un `TRUNCATE zones_secteurs` : les éventuelles modifications manuelles
  du référentiel seront écrasées.
- Vérifications post-import (commentées en fin de chaque fichier) :
  `SELECT count(*) FROM pdv;` → ~25 368 · `SELECT count(*) FROM visites;` → ≥ 26 240.
