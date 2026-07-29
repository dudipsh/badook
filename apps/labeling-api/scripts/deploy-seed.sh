#!/bin/bash
set -e

##############################################################
# deploy-seed.sh — Post-deploy setup for ref-data tables
#
# Creates new tables (without touching existing data),
# migrates suppliers & products from existing samples,
# and loads seed data (construction products, suppliers, cities).
#
# Usage:
#   bash scripts/deploy-seed.sh [API_URL] [API_KEY]
#
# Examples:
#   bash scripts/deploy-seed.sh                                    # local dev
#   bash scripts/deploy-seed.sh https://labeling.example.com sk-xx # production
##############################################################

API_URL="${1:-http://localhost:3002}"
API_KEY="${2:-labeling-dev-key}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_DIR="$SCRIPT_DIR/seed-data/output"

echo "============================================"
echo "  Deploy Seed — Reference Data Setup"
echo "  API: $API_URL"
echo "============================================"
echo ""

# Verify API is reachable
echo "[1/6] Checking API health..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")
if [ "$HTTP_CODE" != "200" ]; then
  echo "  ERROR: API not reachable at $API_URL (HTTP $HTTP_CODE)"
  exit 1
fi
echo "  OK"

# Check current state
echo ""
echo "[2/6] Current ref-data stats..."
STATS=$(curl -s -H "x-api-key: $API_KEY" "$API_URL/ref-data/stats")
echo "  $STATS"

# Migrate suppliers from existing samples
echo ""
echo "[3/6] Migrating suppliers from existing samples..."
RESULT=$(curl -s -X POST -H "x-api-key: $API_KEY" "$API_URL/ref-data/migrate/suppliers-from-samples")
echo "  $RESULT"

# Migrate products from existing samples
echo ""
echo "[4/6] Migrating products from existing samples..."
RESULT=$(curl -s -X POST -H "x-api-key: $API_KEY" "$API_URL/ref-data/migrate/products-from-samples")
echo "  $RESULT"

# Seed reference data
echo ""
echo "[5/6] Loading seed data..."

if [ -f "$SEED_DIR/suppliers.json" ]; then
  echo -n "  Suppliers: "
  curl -s -X POST -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
    -d @"$SEED_DIR/suppliers.json" "$API_URL/ref-data/seed/suppliers"
  echo ""
else
  echo "  SKIP: $SEED_DIR/suppliers.json not found"
fi

if [ -f "$SEED_DIR/construction-products.json" ]; then
  echo -n "  Products: "
  curl -s -X POST -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
    -d @"$SEED_DIR/construction-products.json" "$API_URL/ref-data/seed/products"
  echo ""
else
  echo "  SKIP: $SEED_DIR/construction-products.json not found"
fi

if [ -f "$SEED_DIR/cities.json" ]; then
  echo -n "  Cities: "
  curl -s -X POST -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
    -d @"$SEED_DIR/cities.json" "$API_URL/ref-data/seed/cities"
  echo ""
else
  echo "  SKIP: $SEED_DIR/cities.json not found"
fi

# Final stats
echo ""
echo "[6/6] Final ref-data stats..."
STATS=$(curl -s -H "x-api-key: $API_KEY" "$API_URL/ref-data/stats")
echo "  $STATS"

echo ""
echo "============================================"
echo "  Done!"
echo "============================================"
