# Running Vyra with Docker

Self-contained stack: Neo4j (Enterprise, eval license) + a one-shot ingest job + API + UI + the
agent scheduler. Requires Docker with Compose v2, plus **Ollama running on the host machine**
(the agents container reasons against it over `host.docker.internal:11434` — Ollama itself is
not containerized).

## 0. Install Ollama on the host (one-time)

The agent runtime (`control-intelligence`, `signal-intelligence`, `risk-intelligence`,
`assurance-intelligence`) calls a local Ollama LLM — no API key, no cloud billing, but it has to
actually be running on whatever machine hosts Docker.

```bash
# macOS
brew install ollama
ollama serve &          # or just launch the Ollama.app — it runs a background service
ollama pull llama3.1:8b # ~4.7GB, one-time

# Linux
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b
```

Confirm it's reachable before starting the stack:

```bash
curl http://localhost:11434/api/tags   # should list llama3.1:8b
```

If you skip this step, `neo4j`/`ingest`/`api`/`ui` all work fine — only `agents` will fail its
reasoning calls (logged per-cycle, not fatal; see `agents/scheduler.ts`'s per-agent try/catch).

## Start everything

```bash
docker compose up --build
```

Order is enforced automatically: Neo4j comes up and goes healthy → `ingest` seeds the
graph once and exits → `api` starts → `ui` starts → `agents` starts polling.

| Service | URL | Notes |
|---|---|---|
| UI | http://localhost:3002 | Next.js frontend |
| API | http://localhost:4001 | Fastify REST API |
| Neo4j Browser | http://localhost:7474 | login `neo4j` / `vyra-ai@2025` |
| Agents | — | no HTTP surface — polls the graph every `AGENT_POLL_INTERVAL_MS` (default 60s); watch with `docker compose logs -f agents` |

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

One image (`vyra-app`) is built once and reused by all four app services; the first
arg to the entrypoint selects the mode:

- `ingest` — ensures the `agentic-grc` DB, then runs the 4-step seed
  (enterprise pipeline → catalog sync → enterprise sync → `COVERED_BY` backfill).
- `api` — serves the REST API on :4001.
- `ui` — serves the prebuilt Next.js app on :3002.
- `agents` — runs `agents/scheduler.ts`, polling all 4 agent families against the graph on a
  continuous cycle (default 60s), reasoning against Ollama on the host via
  `host.docker.internal:11434`. Same "propose only, human approves" Autonomy Level 1 behavior
  as running it locally — see `vyra-graph-spine.md`'s `Decision` node.

Config is passed via compose `environment:` (no `.env` needed in the container). Per the
architecture doc's invariants, `agents` and `api` never call each other — they only meet in
the graph, so `agents` depends on `ingest` completing (a seeded graph to reason over), not on
`api` being up.

## Quick sanity check

```bash
curl -s http://localhost:4001/assurance/posture | jq '.coverage.requirements, .coverage.assets'
# expect requirements total 34 / covered 30, assets total 31 / covered 29 / unmapped 2

docker compose logs agents --tail 20
# expect real reasoning cycles ("scheduler: running control-intelligence" ... "done"), not
# connection-refused errors — if you see those, Ollama isn't reachable from the container
# (recheck step 0)
```
