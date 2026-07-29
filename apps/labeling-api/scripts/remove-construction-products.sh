#!/bin/bash
set -e

##############################################################
# remove-construction-products.sh
#
# Removes seeded construction products from ref_products table
# and empties the construction-products.json seed file.
#
# Usage:
#   bash scripts/remove-construction-products.sh [API_URL] [API_KEY]
##############################################################

API_URL="${1:-http://localhost:3002}"
API_KEY="${2:-labeling-dev-key}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_FILE="$SCRIPT_DIR/seed-data/output/construction-products.json"

echo "============================================"
echo "  Remove Construction Products"
echo "  API: $API_URL"
echo "============================================"
echo ""

# Check API
echo "[1/4] Checking API health..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")
if [ "$HTTP_CODE" != "200" ]; then
  echo "  ERROR: API not reachable at $API_URL (HTTP $HTTP_CODE)"
  exit 1
fi
echo "  OK"

# Current stats
echo ""
echo "[2/4] Current ref-data stats..."
STATS=$(curl -s -H "x-api-key: $API_KEY" "$API_URL/ref-data/stats")
echo "  $STATS"

# Delete by categories
echo ""
echo "[3/4] Deleting construction products by categories..."
CATEGORIES='{"categories":["איטום ובידוד","אינסטלציה","בטון ומלט","בטיחות","בלוקים ולבנים","ברגים ומחברים","ברזל ופלדה","דלתות וחלונות","חומרי בנייה כלליים","חשמל","כלי עבודה","עץ ונגרות","צבעים וחומרי גמר","ריצוף וחיפוי"]}'
RESULT=$(curl -s -X DELETE -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
  -d "$CATEGORIES" "$API_URL/ref-data/products/by-categories")
echo "  $RESULT"

# Empty the seed file
echo ""
echo "[4/4] Emptying construction-products.json..."
echo "[]" > "$SEED_FILE"
echo "  Done"

# Final stats
echo ""
echo "Final ref-data stats:"
STATS=$(curl -s -H "x-api-key: $API_KEY" "$API_URL/ref-data/stats")
echo "  $STATS"

echo ""
echo "============================================"
echo "  Done!"
echo "============================================"
