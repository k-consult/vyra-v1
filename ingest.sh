#!/usr/bin/env bash
set -e

TS="npx ts-node --project cli/tsconfig.json"

echo "==> [1/2] Catalog sync (per authority board)..."
for board_dir in cli/feeds/csv/catalog/*/; do
    board=$(basename "$board_dir")
    [ "$board" = "ignore" ] && continue
    echo "    -> $board"
    $TS cli/orchestration/catalog-sync.ts --authority="$board"
done
echo "==> [2/2] Backfill Asset->Control (COVERED_BY)..."
$TS cli/scripts/backfill-asset-control.ts
echo "==> Ingestion complete."
