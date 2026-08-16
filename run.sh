#!/usr/bin/env bash

echo "==> Starting Vyra..."
(cd api && npm run dev) &
(cd ui && npm run dev) &
(cd agents && npm run schedule) &

wait
