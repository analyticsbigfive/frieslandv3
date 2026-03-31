#!/bin/bash
# ============================================================
# Script d'exécution des migrations SQL vers Supabase
# Usage: ./scripts/run-migrations.sh "postgresql://postgres.xxx:PASSWORD@host:6543/postgres"
# ============================================================

set -e

PSQL="/opt/homebrew/opt/libpq/bin/psql"
DB_URL="$1"
SQL_DIR="$(dirname "$0")/../supabase"

if [ -z "$DB_URL" ]; then
  echo "❌ Usage: $0 <DATABASE_URL>"
  echo "   Exemple: $0 \"postgresql://postgres.iirgolfjwdnnesamzcbd:MOT_DE_PASSE@aws-0-eu-west-1.pooler.supabase.com:6543/postgres\""
  exit 1
fi

echo "🚀 Exécution des migrations Supabase"
echo "============================================================"

# 1. 002 - Seed data et fonctions d'import
echo ""
echo "📦 [1/12] 002_seed_data_and_import.sql..."
$PSQL "$DB_URL" -f "$SQL_DIR/002_seed_data_and_import.sql"
echo "   ✅ Done"

# 2. 003 - Zones et secteurs
echo ""
echo "📍 [2/12] 003_seed_zones_secteurs.sql..."
$PSQL "$DB_URL" -f "$SQL_DIR/003_seed_zones_secteurs.sql"
echo "   ✅ Done"

# 3-12. 004 parts - Visites
for i in $(seq -w 1 10); do
  PART_FILE="$SQL_DIR/004_parts/004_part_${i}.sql"
  PART_NUM=$((10#$i + 2))
  if [ -f "$PART_FILE" ]; then
    echo ""
    echo "📋 [${PART_NUM}/12] 004_part_${i}.sql..."
    $PSQL "$DB_URL" -f "$PART_FILE"
    echo "   ✅ Done"
  fi
done

echo ""
echo "============================================================"
echo "🎉 Toutes les migrations ont été exécutées avec succès!"
echo ""
echo "Vérification:"
$PSQL "$DB_URL" -c "SELECT 'zones_secteurs' as table_name, count(*) as rows FROM public.zones_secteurs UNION ALL SELECT 'visites', count(*) FROM public.visites UNION ALL SELECT 'pdv', count(*) FROM public.pdv ORDER BY table_name;"
