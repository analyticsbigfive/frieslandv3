#!/bin/bash
set -euo pipefail

DB_URL="${1:-}"
PSQL="${PSQL:-/opt/homebrew/opt/libpq/bin/psql}"
SQL_DIR="$(cd "$(dirname "$0")/../supabase/nouveau" && pwd)"

if [ -z "$DB_URL" ]; then
  echo "Usage: $0 <DATABASE_URL>"
  exit 1
fi

MIGRATIONS=(
  20260630120000_friesland_geographie.sql
  20260630120100_friesland_points_de_vente.sql
  20260630120200_friesland_distributeurs.sql
  20260630120300_friesland_produits_disponibilite.sql
  20260630120400_friesland_perfect_store_niveaux.sql
  20260630120500_friesland_pont_releves.sql
  20260630120550_friesland_correspondance_imp_scm_fix.sql
  20260630120560_friesland_segment_grade_mt.sql
  20260630130000_friesland_visibilite_standard.sql
  20260630130100_friesland_perfect_store_calcul.sql
  20260630130200_friesland_perfect_store_admin.sql
  20260701160000_friesland_perfect_store_liste.sql
  20260709120000_friesland_maj_poids_mt_taux_vente.sql
  20260709130000_friesland_dist_canonique.sql
  20260709140000_friesland_standard_mt_facings.sql
  20260709150000_friesland_cablage_mt_supermarches.sql
)

for migration in "${MIGRATIONS[@]}"; do
  echo "Applying $migration"
  "$PSQL" "$DB_URL" -v ON_ERROR_STOP=1 -f "$SQL_DIR/$migration"
done

echo "BIG FIVE migrations applied successfully."
