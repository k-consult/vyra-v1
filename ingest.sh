#!/usr/bin/env bash
set -e

TS="npx ts-node --project cli/tsconfig.json"

echo "==> [1/4] Enterprise incident pipeline..."
$TS cli/orchestration/index.ts "$@"
echo "==> [2/4] Catalog sync (per authority board)..."
for board_dir in cli/feeds/csv/catalog/*/; do
    board=$(basename "$board_dir")
    [ "$board" = "ignore" ] && continue
    echo "    -> $board"
    $TS cli/orchestration/catalog-sync.ts --authority="$board"
done
echo "==> [3/4] Enterprise sync..."
$TS cli/orchestration/enterprise-sync.ts
echo "==> [4/4] Backfill Asset->Control (COVERED_BY)..."
$TS cli/scripts/backfill-asset-control.ts
echo "==> Ingestion complete."
