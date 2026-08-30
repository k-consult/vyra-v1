# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Vyra v1** — an Agentic Risk & Compliance Infrastructure platform. AI agents continuously transform regulations into operational assurance by reasoning over a shared enterprise graph.

Canonical docs: @.design/vyra-landscape.md (vision + operating model — start here), @.design/vyra-graph-spine.md (schema ground truth), @.design/vyra-implementation-plan.md (sequencing + status).

Before any graph schema, agent design, or domain-model decision, read the landscape doc, then the spine. They are the source of truth — not `.design/__ref/blueprint.md`, which is retired/historical.

---

## Workspace Structure

Monorepo. Each workspace has its own `package.json` and `npm install`.

| Workspace | Port | Purpose |
|-----------|------|---------|
| `lib/` | — | Shared utilities: `graph-db`, `log`, `config` |
| `cli/` | — | Ingestion pipeline: CSV → Parser → Compiler → Projection → LOAD CSV |
| `agents/` | — | Agent runtime: TypeScript + local Ollama LLM |
| `api/` | 4001 | Fastify REST API, reads from Neo4j |
| `ui/` | 3002 | Next.js + React frontend |

**`lib/` must be built before all other workspaces.** Other workspaces import from `lib/` via relative paths (`../../lib/<module>`), not npm package names.

---

## Getting Started

Prerequisites: Node 20 (`.nvmrc`), Neo4j Desktop running with password `vyra-ai@2025`.

```bash
./setup.sh       # install all workspace deps + create the Neo4j 'agentic-grc' database
./ingest.sh      # parse → compile → project → LOAD CSV into Neo4j
./run.sh         # start api (4001) + ui (3002)
```

---

## Packaging / Docker

For Docker/packaging tasks, default to producing a lean final prebuilt app image with minimal instructions — do not include full source code or skippable base images unless explicitly asked.

---

## CLI Ingestion Pipeline

Entry point: `cli/orchestration/index.ts`

```
CSV files (cli/feeds/csv/<domain>/)
  → Parser        (CSV rows → typed objects)
  → Compiler      (objects → Graph IR: nodes + edges)
  → Projection    (IR → node CSVs + edge CSVs + LOAD CSV Cypher)
  → Runtime       (xcopy CSVs to Neo4j import/ → execute LOAD CSV)
```

**This is CSV-native, not JSON-LD.** The compiler reads CSV column names mapped via `cli/semantic-contract/contracts/v2.ts`. The projection generates CSV files copied to Neo4j's `import/` directory and runs `LOAD CSV WITH HEADERS` — not row-by-row MERGE.

Feed files live under `cli/feeds/csv/<graph-domain>/`. The semantic contract (`v2.ts`) is the single source of truth for column → node label/property/axis mappings.

Cypher load order is fixed: indexes → nodes → edges. Never alter this order.

---

## Five Graph Domains

The compliance digital twin is composed of five graphs. For entity types, relationships, and Cypher traversal patterns, invoke `/vyra-graph`.

| Graph | Question | Key nodes |
|-------|----------|-----------|
| Knowledge | What must be done? | Regulation, Clause, Requirement, Control |
| Execution | What are we doing? | Program, Workflow, Task, CAPA |
| Operational | What is happening? | Asset, Vendor, Signal, Event |
| Intelligence | What do we understand? | Finding, Risk, Decision, RCA |
| Assurance | What can we prove? | Evidence, Attestation, AssuranceStatement |

---

## Neo4j

- **Database:** `agentic-grc`
- **Password:** `vyra-ai@2025`
- **API DB access:** via `lib/graph-db` only. UI never touches Neo4j directly. No DML from UI — MATCH only.
- **Cypher rules:** invoke `/neo4j-spine` before writing any query or schema change.

---

## Agent Runtime (`agents/`)

TypeScript + a local Ollama LLM (default model: `llama3.1:8b`, configurable via `OLLAMA_MODEL`) — no API key, no cloud billing. `agents/runtime/index.ts`'s `reasonWithLLM` calls Ollama's local REST API (`OLLAMA_HOST`, default `http://localhost:11434`).

Agents read from and write to the Neo4j graph via `agents/tools/graph-read.ts` and `agents/tools/graph-write.ts`. They never call the REST API.

Agent decisions are persisted as `Decision` nodes in the Intelligence graph, linked to the source entity that triggered reasoning.

Default autonomy level: **Level 1 (Agent Recommends, Human Approves)** unless explicitly elevated.

---

## Coding Conventions

**Invoke `/code-ninja` at the start of every session.** It loads the skill map and activates `/clean-code`.

**Functional style throughout.** Use Ramda (`import * as R from 'ramda'` / `const R = require('ramda')`) for data transformation. Compose chains of small, focused functions.

**Logging:** use `lib/log` (imported as `log`). Never `console.log` / `console.info`.

**No class/function names ending in** `Manager`, `Controller`, `Plugin`, `Helper`, or `Util`.

**Validation:** `guard` functions for argument validation. Use `R.defaultTo`, `R.nth`, `R.path` for safe access. Standard string fallback: `'UNKNOWN'`.

**Comments:** only when the WHY is non-obvious. No docstrings. No task-reference comments.

---

## UI

Ensure any UI-facing output and in-app copy is accurate and actually surfaced in a working page; verify that data unwraps correctly (no `[object Object]` or double-wrapped DB results) and that instructional copy reflects real system behavior.

---

## Skill Guide

| Working on | Invoke |
|------------|--------|
| Any new backend module or file | `/dev-tools` |
| Single backend file edit | `/node-spine` |
| React component or page | `/react-spine` |
| Cypher query or graph schema | `/neo4j-spine` |
| Graph domain design | `/vyra-graph` |
| Pre-commit / pre-PR check | `/dev-audit` |
| Scaffold a new resource | `/dev-gen` |
| API route lookup | `/sync-api-routes` |
| Not sure — start here | `/code-ninja` |

---

## Workflow Preferences

- **Plan first.** For non-trivial tasks, outline the approach and wait for approval before writing code.
- **Be terse.** No trailing summaries after completing work — the diff speaks for itself.
- **Reference the spine.** Before proposing graph schema or agent architecture changes, verify alignment with `.design/vyra-graph-spine.md` (schema) and `.design/vyra-landscape.md` (operating model).

---

## Verification

Always verify changes end-to-end against the live graph/DB (run typecheck, build, and query the live data) before reporting a task as done.

---

## File & Doc Conventions

When saving generated plans or docs, always confirm the exact target filename and directory (typically `.design/`) before writing — do not guess placement.
