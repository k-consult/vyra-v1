#!/usr/bin/env bash

echo "==> Starting Vyra..."
lsof -ti:4001 | xargs kill -9 2>/dev/null
(cd api && npm run dev) &
(cd ui && npm run dev) &
(cd agents && npm run schedule) &

wait
