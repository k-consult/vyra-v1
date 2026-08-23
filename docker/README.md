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

## Explore the modules

Each UI page maps to one of the five graph domains (`vyra-graph-spine.md`):

| Page | URL | Domain |
|---|---|---|
| Lifecycle / Traceability | `/validation/lifecycle`, `/validation/traceability` | forward/reverse trace across all five |
| Calendar | `/calendar` | Knowledge — `Schedule → Task → Control` cadences |
| Assurance | `/assurance` | Assurance — Coverage Score, Risk Rollup, Audit-Ready Export chain |
| Intelligence | `/intelligence` | Intelligence — `Decision`s from the live agents, in 5 tabs (Decisions/Proposed Controls/Findings/Risks/People) with a per-Decision origin→reasoned→reviewed→result timeline (below) |
| Contracts | `/enterprise/contracts` | Operational — vendor service agreements |
| Simulator | `/simulator` | Operational — fire live agent triggers from a form, no terminal needed (below) |

`/dashboard`, `/knowledge`, `/execution` are unbuilt `TODO` placeholders, not linked from nav.
Catalog (`Regulation`/`Standard`/`Control`/`ComplianceArea`) has no dedicated page — it's what
backs Calendar/Assurance; browse it directly: `curl http://localhost:4001/catalog/regulations`.

## How the agents work — and what actually triggers them

**Nothing you click starts a reasoning cycle.** `agents` is a standalone poller
(`agents/scheduler.ts`) that wakes up on a timer — every `AGENT_POLL_INTERVAL_MS` (default
60s) — and runs all 4 agent families in sequence, whether or not anyone is looking at the UI.
That's a deliberate architecture choice (`vyra-architecture.md`'s invariants): **agents never
call the API, and the API never calls agents** — they only ever meet through the graph. So
there's no `POST /agents/run` endpoint to hit; the only way to make an agent do something new
is to change the graph state it's watching for, and wait for the next poll.

Each cycle, per agent: **observe** (a Cypher query for a specific kind of unreasoned-about
state) → **reason** (one call to the local Ollama model) → **act** (write a `Decision` node,
`status: pending`) — never a direct write to `Control`/`Finding`/`Risk` etc. That's Autonomy
Level 1: agents recommend, a human approves. The 4th step, **verify**, is what your Approve/
Reject click on `/intelligence` actually does.

| Agent | Watches for | Decision `type` | Can *you* give it something new to look at? |
|---|---|---|---|
| `control-intelligence` | `Requirement`s with no `Control` | `control-recommendation` | Not live — these come from seed data (4 real ones on first boot); there's no API to add a bare `Requirement` |
| `signal-intelligence` | `Signal`s with no assessment yet | `deviation-assessment` | **Yes** — `POST /operational/signals` is a real, live write path (see below) |
| `risk-intelligence` | `Finding`s never scored for risk | `risk-assessment` | **Yes, indirectly** — approving a `deviation-assessment` Decision creates a new `Finding`, which this agent picks up on its *next* poll |
| `assurance-intelligence` | Incidents with unbundled `Evidence` | `assurance-package-proposal` | Not live — `Incident`/`Evidence` only come from the CLI ingest seed, no live write path exists yet |

Every `Decision` starts `pending`. `/intelligence` lands on the **Decisions** tab filtered to
**Pending** (the actionable inbox); each row shows a horizontal timeline — Origin (what
triggered the agent) → Reasoned (agent + when) → Reviewed (who/when, or "awaiting review") →
Result. Pick a reviewer and Approve/Reject right there
(`POST /intelligence/decisions/:id/{approve,reject}`); approving writes the real node the agent
recommended, labeled `:AgentProposed` (e.g. a `Control:AgentProposed` for an approved
`control-recommendation`) — and the timeline's Result stage links straight to it.

### Try it yourself: trigger the full chain

`signal-intelligence` is the only agent with a genuine live trigger — but approving its output
creates a `Finding`, which cascades into `risk-intelligence` on the next cycle. This walks that
whole chain, entirely through graph state, the way the real system is meant to work.

**Easiest path — use the Simulator UI:** open `/simulator`, pick an asset and a signal type on
the **Signals** tab, click **Fire signal**. A dialog confirms what got written and tells you
what to check next — no curl, no terminal. Its **Feeds** tab is an honest placeholder (not a
button) explaining that `control-intelligence`/`assurance-intelligence` have no live trigger yet
— see the table above.

Or drive it directly, the way the Simulator does under the hood:

```bash
# 1. Post a live "floor event" against a real, control-covered asset
curl -X POST http://localhost:4001/operational/signals \
  -H 'Content-Type: application/json' \
  -d '{"id":"SIG-DEMO-001","type":"fire-alarm-trip","assetId":"FSD-BLR-WH-B-447"}'
```

Wait one poll interval (default 60s), then:

```bash
docker compose logs agents --tail 20   # confirm signal-intelligence just ran
curl -s http://localhost:4001/intelligence/decisions | jq '.decisions[] | select(.type=="deviation-assessment")'
```

Open `/intelligence`, find that card, pick a reviewer, click **Approve** — this creates a real
`Finding:AgentProposed`. Wait one more poll interval, then check again:

```bash
curl -s http://localhost:4001/intelligence/decisions | jq '.decisions[] | select(.type=="risk-assessment")'
# a brand-new risk-assessment Decision should now exist for the Finding you just approved
```

Approve that one too, then confirm the graph actually changed:

```bash
curl -s http://localhost:4001/assurance/posture | jq '.riskRollup.totalRisks'
# should have incremented by 1 — a real Risk:AgentProposed node now counts toward the portfolio
```

No agent ever called another agent here — each one only ever saw the consequence of your
approval sitting in the graph on its next scheduled look.
