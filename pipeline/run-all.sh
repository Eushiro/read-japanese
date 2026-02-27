#!/bin/bash
# Run the full pipeline: generate → review → upload
#
# Usage:
#   ./run-all.sh japanese          # small trial (2 batches), review, dry-run upload
#   ./run-all.sh japanese 10       # 10 batches
#   ./run-all.sh japanese 4 --upload   # 4 batches + real upload to Convex
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

LANGUAGE="${1:?Usage: ./run-all.sh <language> [trial-count] [--upload]}"
TRIAL="${2:-2}"
UPLOAD=false

for arg in "$@"; do
  if [ "$arg" = "--upload" ]; then
    UPLOAD=true
  fi
done

echo ""
echo "========================================"
echo "  Pipeline: ${LANGUAGE} | ${TRIAL} batches"
echo "========================================"

# Step 1: Generate
echo ""
echo "--- Step 1: Generate ---"
npx tsx generate.ts --language "$LANGUAGE" --trial "$TRIAL"

# Step 2: Review
echo ""
echo "--- Step 2: Review ---"
npx tsx review.ts --language "$LANGUAGE" --verbose

# Step 3: Upload (dry-run unless --upload passed)
echo ""
if [ "$UPLOAD" = true ]; then
  echo "--- Step 3: Upload (LIVE) ---"
  npx tsx upload.ts --language "$LANGUAGE"
else
  echo "--- Step 3: Upload (DRY RUN) ---"
  npx tsx upload.ts --language "$LANGUAGE" --dry-run
fi

echo ""
echo "Done!"
