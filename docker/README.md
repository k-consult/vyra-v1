# Running Vyra with Docker

Self-contained stack: Neo4j (Enterprise, eval license) + a one-shot ingest job + API + UI.
Requires Docker with Compose v2. Nothing else to install.

## Start everything

```bash
docker compose up --build
```

Order is enforced automatically: Neo4j comes up and goes healthy → `ingest` seeds the
graph once and exits → `api` starts → `ui` starts.

| Service | URL | Notes |
|---|---|---|
| UI | http://localhost:3002 | Next.js frontend |
| API | http://localhost:4001 | Fastify REST API |
| Neo4j Browser | http://localhost:7474 | login `neo4j` / `vyra-ai@2025` |

## Re-seed on demand

The seed is idempotent (all loaders use `MERGE`), so re-running is safe:

```bash
docker compose run --rm ingest
```

## Stop / reset

```bash
docker compose down            # stop, keep the graph (neo4j-data volume)
docker compose down -v         # stop and wipe the graph volume
```

## What runs where

One image (`vyra-app`) is built once and reused by all three app services; the first
arg to the entrypoint selects the mode:

- `ingest` — ensures the `agentic-grc` DB, then runs the 4-step seed
  (enterprise pipeline → catalog sync → enterprise sync → `COVERED_BY` backfill).
- `api` — serves the REST API on :4001.
- `ui` — serves the prebuilt Next.js app on :3002.

Config is passed via compose `environment:` (no `.env` needed in the container).
The `agents/` runtime is **not** included — it needs an `ANTHROPIC_API_KEY` and is out
of scope for the ingest/API/UI package.

## Quick sanity check

```bash
curl -s http://localhost:4001/assurance/posture | jq '.coverage.requirements, .coverage.assets'
# expect requirements total 34 / covered 30, assets total 31 / covered 29 / unmapped 2
```
