# Vyra v1 — Implementation Plan

**What's next, and what's blocking it** — that's all this doc carries now. For *what's live today*, see `vyra-tracker.md` (single source of truth for status, not duplicated here). For the full build narrative behind every closed phase — what was scoped, what actually shipped, deviations, bugs found, live-verification evidence — see `.design/__ref/implementation-history.md`; nothing there is more current than this doc or the tracker. Full reading order: `.design/README.md`.

## Context

Vyra started as a demo pipeline (CSV → Neo4j → read-only API) seeded from a single denormalized Excel export (7 incidents) and has since grown around four pillars:

1. **Global compliance catalog**, monetizable independently, continuously updated as regulatory authorities publish revisions, with automatic 52-week compliance-window derivation.
2. **Mappable enterprise context** — locations, roles, people as real linked graph entities.
3. **Mappable live operational context** — floor events that create/schedule/track Tasks against people/role profiles.
4. **Accurate, current compliance posture/landscape views.**

**Confirmed product decisions:**
- One Neo4j instance per enterprise, not a shared multi-tenant graph.
- The catalog is centrally maintained by Vyra and synced down into each enterprise's Neo4j periodically (not queried live cross-service).

**Open item — revisit once Phases 10–11 are done:** the catalog-distribution decision above is designed, not built. There's no separate "master catalog" service today — `catalog-sync.ts` reads a local CSV and writes `:Catalog`-labeled nodes into the *same* per-enterprise Neo4j database, distinguished only by label. A real central `vyra-catalog` synced down into each customer's `vyra-client` instance doesn't exist yet. Don't design against that split until it's explicitly scoped.

## Status

**Phases 0 through 9 are done**, plus three standalone (non-numbered) closures: the L1 Contract entity, a Gap Review confirming three tracker items (Escalation Paths, `HAS_ROLE`, SOPs) have no real closure path, and an Intelligence-UI usability pass. Full narrative for all of it: `.design/__ref/implementation-history.md`. Current per-layer status: `vyra-tracker.md`.

| Phase | Shipped | Date |
|---|---|---|
| 0 | Reconciled relationship-vocabulary drift between `v2.ts`, the live write path, and the graph-spine doc | 2026-07-21 |
| 0.5 | `:Catalog`/`:Enterprise` dual-label convention for shared-vs-tenant data | 2026-07-22 |
| 1 | Global Compliance Catalog — `Authority`, `Jurisdiction`, versioned `Regulation`/`Clause`/`Requirement`, `catalog-sync.ts` | 2026-07-22 |
| 2 | Enterprise Context — `Organization`, `Role`, second `Facility`/`Asset` batches, `enterprise-sync.ts` | 2026-07-25 |
| 3 | Live Operational Context + first real agent — `Asset -COVERED_BY-> Control`, `POST /operational/signals`, `control-intelligence` | 2026-07-26 |
| 3.5 | 52-Week Compliance Calendar — `Schedule -> Task -> Control`, `GET /catalog/calendar`, `/calendar` UI | 2026-07-26 |
| 4a | Coverage Scoring + Risk rollup — `GET /assurance/posture`, `/assurance` UI | 2026-07-29 |
| 4b | Audit-Ready Export on **synthetic seed data** (7 incidents) — `EvidencePackage`/`Attestation`/`AssuranceStatement`/`Audit` | 2026-08-16 |
| 5 | `signal-intelligence` agent — Deviation Alerts (L5) | 2026-08-16 |
| 6 | `Person` fed from free-text names already in the data; `WORKS_AT` (many-valued) | 2026-08-16 |
| 7 | Human-in-the-Loop Decision Gate — real approve/reject on `Decision`, `Control`/`Finding:AgentProposed` | 2026-08-16 |
| 8 | Complete the Agent Roster — `risk-intelligence`, `assurance-intelligence` live | 2026-08-16 |
| 9 | Continuous Agent Execution — `agents/scheduler.ts` polls all 4 agents, wired into `run.sh` | 2026-08-16 |
| — | L1 Contract entity (vendor service agreements) | 2026-08-22 |
| — | Gap Review — confirmed Escalation Paths / `HAS_ROLE` / SOPs have no real closure path | 2026-08-23 |
| — | Intelligence UI — tabs, origin→result timeline, `/simulator` | 2026-08-23 |

---

## What's Next — Open Decisions

Phases 10–11 are each blocked on a decision that hasn't been made yet — neither is "just build it."

### Phase 10 — Multi-Turn Tool-Use Reasoning 🔲 PLANNED

`reasonWithLLM` (`agents/runtime/index.ts`) is one fixed prompt assembled by TypeScript, sent to Ollama once, parsed as JSON — an LLM call in a loop, not an agent deciding what to look at next.

**Open decision — real technical risk, not just a preference**: `llama3.1:8b` via local Ollama may not do reliable multi-turn tool-calling. The project deliberately moved off the Anthropic API to stay local/free (Phase 3's Ollama follow-up, 2026-08-16) — going deeper on tool-use may mean testing a larger local model or accepting a hosted-model fallback for this one capability specifically. A values tradeoff for the user to make explicitly, not to default silently.

### Phase 11 — Scenario Simulation (L7) 🔲 PLANNED — UNSCOPED

The one capability that needs *multiple* agent families reasoning over the same graph state together (e.g. risk + control) — `vyra-tracker.md` already flags this as the one genuine remaining L7 gap.

**Blocking**: there is currently no working definition of what a "scenario" is here (a regulation changing? a control failing? something else?) — needs a product spec from the user before it can become a real phase.

---

## Notes for future work

- **`dev-audit` doesn't apply to this repo.** Its 12 checks are written for a different project's file layout (`app/module/*/edge/api/`, `dbv4x`) that doesn't exist here — it would report "clean" without ever inspecting `vyra-v1`'s real `api/modules/<domain>/{index,repo}.ts` shape. There is no drop-in substitute gate today; live-query verification against Neo4j (per phase, in `implementation-history.md`) is the actual closing check until one exists. See `.design/__ref/eng-practices-drift-2026aug22.md` for the fuller engineering-practices gap analysis (no CI, no independent review, two silent-failure bugs in the read/write paths) — that report is the basis for any future self-verification/gating work on this repo.

## Where to go next

- **Why this must be agentic at all** → `vyra-foundation.md`
- **Model, value and guarantees** (no status) → `vyra-foundation.md`
- **Current build status** → `vyra-tracker.md`
- **Schema, relationships, Cypher patterns** → `vyra-graph-spine.md`
- **Software layers & components** → `vyra-architecture.md`
- **Full historical build narrative** → `.design/__ref/implementation-history.md`
