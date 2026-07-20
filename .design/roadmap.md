# Vyra v1 — Nextgen Agentic GRC Platform Roadmap

## Context

Vyra today is a working demo pipeline (CSV → Neo4j → read-only API) seeded from a single denormalized Excel export (7 incidents). The user wants to evolve this into a real platform built around four pillars:

1. **Global compliance catalog**, monetizable independently, continuously updated as regulatory authorities publish revisions, with automatic 52-week compliance-window derivation.
2. **Mappable enterprise context** — locations, roles, people as real linked graph entities (today these are free-text strings like `Incident.capturedBy`).
3. **Mappable live operational context** — floor events that create/schedule/track Tasks against people/role profiles (today `Incident` is a static, one-time CSV snapshot, not a live stream).
4. **Accurate, current compliance posture/landscape views**.

Confirmed product decisions (not open questions):
- **Deployment**: one Neo4j instance per enterprise, not a shared multi-tenant graph.
- **Catalog distribution**: the catalog is centrally maintained by Vyra and **synced down into each enterprise's Neo4j periodically** (not queried live cross-service) — chosen for query performance and resilience.

An audit (this session) found the codebase is earlier-stage than CLAUDE.md's docs suggest: `agents/` is 0% functionally implemented (every DB call is a stubbed TODO), `cli/`'s semantic contract (`v2.ts`) already declares 27 node types across the five blueprint graphs but only 13 have real CSV feeds, and there's a confirmed 3-way disagreement between `graph.md`, `v2.ts`, and the code that's actually running (`ingest-hints.json` + `api/`) about several relationship type names and directions. This plan sequences the four pillars on top of what's real today, and fixes the foundation first so new work doesn't inherit the drift.

**Second data source:** `.design/entity-alignment.md` maps `.design/synthetic-data/data.csv` (a second, independent enterprise seed — Industrial Parks/Warehouse/3PL vertical, entity extraction in `.design/consolidated-entities.md`) against this roadmap. It's largely confirmatory for Phase 1 (Global Compliance Catalog) and partially for Phase 2 (Enterprise Context — Role/Organization/Location present, Person/Identity still missing), surfaces two net-new domain concepts with no current home (`InsuranceClause`, `ComplianceArea`), and adds a second relationship-vocabulary set that should be reconciled together with Phase 0's fix rather than after it.

This plan covers **design and sequencing only** — each phase below is a separate implementation pass, not all done in one shot. Confirm before starting Phase 0.

---

## Phase 0 — Reconcile relationship-vocabulary drift (prerequisite, small)

Verified directly: `v2.ts:225` declares `RCA -[:ANALYSES]-> Finding`, but the code that actually runs — `cli/domains/grc/ingest-hints.json:27` and `api/modules/intelligence/repo.ts:65`, `api/modules/operational/repo.ts:92` — loads and queries `Finding -[:ANALYSED_BY]-> RCA` (opposite direction, different name). This isn't cosmetic: anything written against the documented direction returns nothing.

**Rule**: `ingest-hints.json` + the API queries it's paired with are the *load-bearing* truth (that's what a running instance actually does) — update `v2.ts` and `graph.md` to match reality, not the other way around. Then grep every relType in `v2.ts`'s `rels` arrays against `ingest-hints.json`'s `edgeMap` and every `api/modules/*/repo.ts` Cypher string, fix each mismatch, and re-verify with a full-repo grep for the old names before moving on. Small, mechanical, but blocks everything else — new schema work built on inconsistent relationship names compounds the problem.

**Files**: `cli/semantic-contract/contracts/v2.ts`, `.design/graph.md`, `cli/domains/grc/ingest-hints.json`, `api/modules/{intelligence,operational}/repo.ts` (and any other repo.ts with drifted rel names, confirm via grep).

---

## Phase 0.5 — Catalog-origin labeling convention (decision, precedes Phase 1)

Once the catalog is synced into the same Neo4j instance as enterprise data, the sync job must never clobber enterprise-authored nodes/edges layered on top of catalog nodes (e.g. an enterprise `Control -[:IMPLEMENTS]-> Requirement`).

**Decision: dual-label, not a property flag.** Every catalog-synced node keeps its domain label plus `:Catalog` (e.g. `(:Regulation:Catalog)`); enterprise-authored nodes of comparable kind get `:Enterprise` (e.g. `(:Control:Enterprise)`). A property flag (`origin: 'catalog'`) is invisible to Cypher pattern matching — every query and every sync-job MERGE would need an explicit `WHERE` filter, which is easy to forget. A second label makes catalog-scoping structural: the sync job's MERGE and any retirement/delete logic can be written to match `:Catalog` only, and is then *incapable* of touching `:Enterprise` nodes even under a bug. Keep the existing ID-prefix convention (`REG-`, `CTL-`) as a complementary human-readable cue, not as the enforcement mechanism.

Note: `cli/runtime/repo.ts`'s `ON MATCH SET n += row` already merges properties rather than replacing the node, so enterprise-added *properties* on a catalog node already survive re-sync today. The label split is about scoping which nodes/edges the sync job may create, update, or retire — not about property overwrite risk.

---

## Phase 1 — Global Compliance Catalog

**Schema additions** (all new/extended nodes carry `:Catalog`):
- `Framework`, `Document`, `Section` — named in blueprint.md Ch.18 but unimplemented. Chain: `Regulation -[:HAS_DOCUMENT]-> Document -[:HAS_SECTION]-> Section -[:HAS_CLAUSE]-> Clause`.
- Versioning fields on `Regulation`/`Clause`/`Requirement`: `catalogVersion`, `effectiveFrom`, `supersededBy` (self-referential — a repealed clause is superseded, never deleted, so forward/reverse traceability over time keeps working per blueprint Ch.9/20/26).
- `Schedule` node (blueprint Ch.18, Execution graph): `{cadence: {unit, interval}, anchorDate}`, linked `Schedule -[:APPLIES_TO]-> Requirement`.

**52-week window**: compute at query time from `cadence` + `effectiveFrom`/`anchorDate` rather than materializing every future occurrence as nodes — avoids an unbounded, re-sync-fragile shadow dataset. Lives as a pure function in the new API module.

**Sync job**: new entrypoint alongside `cli/orchestration/index.ts`, reusing the existing compiler → projection → `cli/runtime/repo.ts` MERGE machinery (already idempotent on `id`), scoped to write only `:Catalog`-labeled nodes/edges. Source data can stay CSV-shaped initially (matches current pipeline) even if the long-term catalog source becomes a Vyra-hosted feed.

**API**: new `api/modules/catalog` (or extend `knowledge`) exposing catalog reads + the 52-week window projection — this is the independently-monetizable read surface.

**Files**: `cli/semantic-contract/contracts/v2.ts`, `cli/domains/grc/ingest-hints.json`, `cli/orchestration/index.ts` (new sync entrypoint), `cli/runtime/repo.ts` (confirm MERGE scoping), new `api/modules/catalog/{index.ts,repo.ts}`.

---

## Phase 2 — Enterprise Context

Comes after Phase 1 because Person/Role/Location only become useful once there's Requirement/Control data to resolve incidents' free-text fields against.

**Schema additions** (all `:Enterprise`):
- `Organization`, `Location` (`Facility` becomes a `Location` subtype or is migrated), `Role`, `Person` (blueprint names this `Identity` under Operational).
- Relationships: `Person -[:HAS_ROLE]-> Role`, `Role -[:BELONGS_TO]-> Organization`, `Person -[:WORKS_AT]-> Location`, `Asset -[:LOCATED_AT]-> Location`.

**Ingestion**: org charts and location lists are naturally batch data — extend the existing CSV pipeline (new contract entries + feed files under a new `cli/domains/enterprise/` or similar), no new ingestion mechanism needed.

**API**: new `api/modules/enterprise` exposing org/location/role/people reads.

**Files**: `cli/semantic-contract/contracts/v2.ts`, new `cli/domains/enterprise/ingest-hints.json` + `cli/feeds/csv/enterprise/`, new `api/modules/enterprise/{index.ts,repo.ts}`.

---

## Phase 3 — Live Operational Context + first real agent

A CSV batch reload is fundamentally incompatible with continuous floor events. This phase needs a genuinely new write path, not an extension of the CLI pipeline:

- New API-driven ingestion endpoint(s) (e.g. in `api/modules/operational` or a new `signals` module) writing directly via `lib/graph-db`'s `DB.get(...).exec2`, bypassing the CLI pipeline for this data only.
- Auto Task creation: given a `Signal` against an `Asset`, resolve applicable `Control`/`Requirement` (via the Phase 1 catalog links) and the responsible `Role`/`Person` (via Phase 2 enterprise links), create a `Task`.
- First real agent implementation: build the observe → reason → act → verify loop as a **shared primitive** in `agents/runtime/index.ts` (not agent-specific — risk/assurance agents need the same loop next), and implement the currently-stubbed `agents/tools/graph-read.ts` / `graph-write.ts` execution. Wire `control-intelligence` first since it's the only agent family with partial (if non-functional) wiring today.

**Files**: `api/modules/operational/{index.ts,repo.ts}` (or new module), `agents/runtime/index.ts`, `agents/tools/graph-read.ts`, `agents/tools/graph-write.ts`, `agents/agents/control-intelligence/index.ts`.

---

## Phase 4 — Compliance posture/landscape views

Purely additive once Phases 1–3 exist: aggregation Cypher across catalog + enterprise + operational + intelligence data. Extends `api/modules/dashboard` and `api/modules/assurance`. No new node types expected.

---

## Verification approach (per phase)

- Phase 0: full-repo grep for each old relationship-type string returns zero hits outside the corrected definition; re-run existing traversal queries in `api/modules/*/repo.ts` against the local Neo4j instance and confirm they now return non-empty results where they previously silently returned nothing.
- Phase 1: run the new catalog sync job twice in a row against a test enterprise DB and confirm idempotency (no duplicate nodes, `updatedAt` bumps, `:Catalog` label present); confirm an `:Enterprise`-labeled node manually added on top of a catalog node survives a re-sync untouched.
- Phase 2: re-run `./ingest.sh` and confirm new Person/Role/Location/Organization nodes load without breaking existing seed data.
- Phase 3: POST a test Signal via the new endpoint, confirm a Task node is created and linked to the correct Control/Role; run the control-intelligence agent end-to-end against seed data and confirm it writes a real `Decision` node (not `[]`).
- Phase 4: manually query new dashboard endpoints against a fully-seeded test instance and spot-check numbers against known seed data.

Each phase should end with `/dev-audit` (per CLAUDE.md skill gate) before moving to the next.
