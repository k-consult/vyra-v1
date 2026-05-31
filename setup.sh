#!/usr/bin/env bash
set -e

echo "==> Installing workspace dependencies..."
cd lib && npm install && cd ..
cd cli && npm install && cd ..
cd agents && npm install && cd ..
cd api && npm install && cd ..
cd ui && npm install && cd ..

echo "==> Building lib (required by other workspaces)..."
cd lib && npm run build && cd ..

echo "==> Creating Neo4j database 'agentic-grc'..."
node -e "
require('dotenv').config();
const { DB } = require('./lib/dist/graph-db');
const creds = { uri: process.env.DB_URI, user: process.env.DB_USER, password: process.env.DB_PASSWORD };
DB.createDB(creds, 'agentic-grc').then(() => { console.log('agentic-grc ready'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
"

echo "==> Setup complete."
