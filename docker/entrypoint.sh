#!/usr/bin/env bash
set -e

MODE="${1:-api}"
TS="npx ts-node --transpile-only --project cli/tsconfig.json"

ensure_db() {
  echo "==> Ensuring Neo4j database '${DB_NAME}' exists..."
  node -e "
    const { DB } = require('./lib/dist/graph-db');
    const creds = { uri: process.env.DB_URI, user: process.env.DB_USER, password: process.env.DB_PASSWORD };
    DB.createDB(creds, process.env.DB_NAME).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
  "
}

case "$MODE" in
  ingest)
    ensure_db
    echo "==> [1/4] Enterprise incident pipeline..."
    $TS cli/orchestration/index.ts
    echo "==> [2/4] Catalog sync..."
    $TS cli/orchestration/catalog-sync.ts
    echo "==> [3/4] Enterprise sync..."
    $TS cli/orchestration/enterprise-sync.ts
    echo "==> [4/4] Backfill Asset->Control (COVERED_BY)..."
    $TS cli/scripts/backfill-asset-control.ts
    echo "==> Ingestion complete."
    ;;
  api)
    cd api && exec npx ts-node --transpile-only index.ts
    ;;
  ui)
    cd ui && exec npx next start -p 3002
    ;;
  *)
    echo "Unknown mode: $MODE (expected: ingest | api | ui)" >&2
    exit 1
    ;;
esac
