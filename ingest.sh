#!/usr/bin/env bash
set -e

TS="npx ts-node --project cli/tsconfig.json"

echo "==> [1/2] Catalog sync (all authority boards)..."
$TS cli/orchestration/catalog-sync.ts
echo "==> [2/2] Backfill Asset->Control (COVERED_BY)..."
$TS cli/scripts/backfill-asset-control.ts
echo "==> Ingestion complete."
