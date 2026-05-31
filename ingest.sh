#!/usr/bin/env bash
set -e

echo "==> Running ingestion pipeline..."
npx ts-node --project cli/tsconfig.json cli/orchestration/index.ts "$@"
echo "==> Ingestion complete."
