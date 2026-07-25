# Vyra v1 — Implementation Plan

Relocated from `.design/roadmap.md`, renamed as part of the 3-doc consolidation (`vyra-landscape.md` / `vyra-graph-spine.md` / `vyra-implementation-plan.md`), 2026-07-23. For the business-value / JTBD-layer view of where each phase below lands, see `vyra-landscape.md`. For the ground-truth schema each phase modifies, see `vyra-graph-spine.md` — keep this plan and the spine in sync on every phase, not just at the end.

## Context

Vyra today is a working demo pipeline (CSV → Neo4j → read-only API) seeded from a single denormalized Excel export (7 incidents). The user wants to evolve this into a real platform built around four pillars:

1. **Global compliance catalog**, monetizable independently, continuously updated as regulatory authorities publish revisions, with automatic 52-week compliance-window derivation.
2. **Mappable enterprise context** — locations, roles, people as real linked graph entities (today these are free-text strings like `Incident.capturedBy`).
3. **Mappable live operational context** — floor events that create/schedule/track Tasks against people/role profiles (today `Incident` is a static, one-time CSV snapshot, not a live stream).
4. **Accurate, current compliance posture/landscape views**.

Confirmed product decisions (not open questions):
- **Deployment**: one Neo4j instance per enterprise, not a shared multi-tenant graph.
- **Catalog distribution**: the catalog is centrally maintained by Vyra and **synced down into each enterprise's Neo4j periodically** (not queried live cross-service) — chosen for query performance and resilience.

**Open item — revisit after all phases are done:** the catalog-distribution decision above is designed, not built. Today there is no separate "master catalog" service/database — `catalog-sync.ts` reads a local CSV (converted from a spreadsheet) and writes `:Catalog`-labeled nodes directly into the *same* per-enterprise Neo4j database as the enterprise's own data; distinguished only by label, not by a separate store. A real central `vyra-catalog` (versioned master copy, synced down into each customer's `vyra-client` instance) does not exist yet. Also not present: any `:Domain` taxonomy (e.g. `:FireSafety`, `:FoodSafety`) — catalog versioning today is per-node properties (`catalogVersion`, `effectiveFrom`, `supersededBy`), not a domain-label scheme. Don't design against this split until it's explicitly scoped.

An early audit found the codebase was earlier-stage than the docs suggested at the time: `agents/` is 0% functionally implemented (every DB call is a stubbed TODO — still true, unchanged by Phase 0/0.5/1), `cli/`'s semantic contract (`v2.ts`) declared 27 node types across the five graphs but only 13 had real CSV feeds (now 29 types, 18 fed — see `vyra-graph-spine.md`), and there was a confirmed 3-way disagreement between `graph.md`, `v2.ts`, and the code that actually ran about several relationship type names and directions. This plan sequences the four pillars on top of what's real, fixing the foundation first so new work doesn't inherit the drift.

**Second data source:** `.design/__ref/entity-alignment.md` maps `.design/__ref/synthetic-data/data.csv` (a second, independent enterprise seed — Industrial Parks/Warehouse/3PL vertical, entity extraction in `.design/__ref/consolidated-entities.md`) against this plan. It was largely confirmatory for Phase 1 and partially for Phase 2 (Role/Organization/Location present in the source, Person/Identity still missing), surfaced two net-new domain concepts with no current home (`InsuranceClause`, `ComplianceArea`), and flagged a second relationship-vocabulary set — reconciled together with Phase 0's fix.

This plan covers **design and sequencing**, one phase at a time. **Phases 0, 0.5, 1, and 2 are done.** Confirm before starting Phase 3.

---

## Phase 0 — Reconcile relationship-vocabulary drift ✅ DONE (2026-07-21)

Verified directly: `v2.ts` declared `RCA -[:ANALYSES]-> Finding`, but the code that actually ran — `ingest-hints.json` + `api/modules/{intelligence,operational}/repo.ts` — loaded and queried `Finding -[:ANALYSED_BY]-> RCA` (opposite direction, different name). Fixed by treating the live write path as the load-bearing truth and correcting `v2.ts` + the graph-spine doc to match, not the other way around. Also found and fixed, beyond the one example: a `GOVERNED_BY` name collision (Regulation→Jurisdiction vs. the live Incident→Regulation edge), three redundant duplicate-declared edges (`INVOLVES`, `MANAGED_BY`, `CLOSES` declared in both `v2.ts` and `ingest-hints.json`), and a `knowledge/repo.ts` + `execution/repo.ts` + `agents/tools/graph-read.ts` direction mismatch on the dormant Knowledge chain. Verified live: re-ingested, confirmed zero conflicting edges, deleted 15 stale `ANALYSES` edges a prior ingest had already written.

**Files touched**: `cli/semantic-contract/contracts/v2.ts`, `.design/graph.md` (now `vyra-graph-spine.md`), `api/modules/{knowledge,execution}/repo.ts`, `agents/tools/graph-read.ts`.

---

## Phase 0.5 — Catalog-origin labeling convention ✅ DONE (2026-07-22, built into Phase 1)

**Decision: dual-label, not a property flag.** Every catalog-synced node keeps its domain label plus `:Catalog` (e.g. `(:Regulation:Catalog)`). A property flag (`origin: 'catalog'`) is invisible to Cypher pattern matching — every query and every sync-job MERGE would need an explicit `WHERE` filter, easy to forget. A second label makes catalog-scoping structural.

**Implemented as**: `cli/runtime/repo.ts`'s `loadNodes` takes an `extraLabels: string[]` param; `cli/runtime/index.ts`'s `run()` takes an `originLabel?: string` threaded into every node batch for that run. `cli/orchestration/catalog-sync.ts` passes `{ originLabel: 'Catalog' }`; the original enterprise orchestrator passes nothing, so Phase 0's pipeline is untouched. `ON MATCH SET n += row` already merges properties rather than replacing the node, so enterprise-added properties on a catalog node survive re-sync.

**Known gap, not yet closed**: the 16 legacy `Regulation` nodes seeded by the enterprise pipeline before the catalog sync existed are still unlabeled (neither `:Catalog` nor `:Enterprise`) — flagged, deliberately not touched (relabeling already-committed data was called out as its own decision, not a silent side effect of Phase 1).

---

## Phase 1 — Global Compliance Catalog ✅ DONE (2026-07-22)

**What actually got built** (see `vyra-graph-spine.md` for the authoritative schema — this section is a summary, not the source of truth):
- New `Authority` type + `Jurisdiction` finally fed (both were not in the original Phase 1 scope below, but the second data source made them a ~10-line addition and closed the biggest gap `entity-alignment.md` flagged).
- Versioning fields (`catalogVersion`, `effectiveFrom`, `supersededBy`) added to `Regulation`/`Clause`/`Requirement`.
- `Clause` given a polymorphic parent (`Regulation` **or** `Standard`, never both) — the real source data (`05_Clauses`) has no document/section granularity.
- `Schedule` node type added but **not seeded** — the only candidate source (`13_Schedule_Rules`) is Task-keyed, not Requirement-keyed; seeding it would have fabricated a link. `computeWindow()` ships as a pure function over `{cadenceUnit, cadenceInterval, anchorDate}` instead.
- New entrypoint `cli/orchestration/catalog-sync.ts`, new `api/modules/catalog`.
- **Bug found and fixed in shared code during this phase**: `cli/projection/index.ts` grouped edge batches by `relType` alone, silently dropping ~15 of 34 `BELONGS_TO` edges once that name was legitimately reused across two target types. Fixed to group by `(relType, sourceLabel, targetLabel)`.

**Deliberate deviation from the original plan**: `Framework`/`Document`/`Section` (originally scoped below) were **not added** — the real source data has no document/section layer, so adding empty schema-only types would have been speculative. If real document-level data shows up later, add them then.

<details>
<summary>Original Phase 1 scope, as first planned (kept for record — see above for what shipped)</summary>

**Schema additions** (all new/extended nodes carry `:Catalog`):
- `Framework`, `Document`, `Section` — named in blueprint.md Ch.18 but unimplemented. Chain: `Regulation -[:HAS_DOCUMENT]-> Document -[:HAS_SECTION]-> Section -[:HAS_CLAUSE]-> Clause`.
- Versioning fields on `Regulation`/`Clause`/`Requirement`: `catalogVersion`, `effectiveFrom`, `supersededBy`.
- `Schedule` node (Execution graph): `{cadence: {unit, interval}, anchorDate}`, linked `Schedule -[:APPLIES_TO]-> Requirement`.

**52-week window**: compute at query time from `cadence` + `effectiveFrom`/`anchorDate` rather than materializing every future occurrence as nodes.

**Sync job**: new entrypoint alongside `cli/orchestration/index.ts`, reusing the existing compiler → projection → runtime MERGE machinery, scoped to write only `:Catalog`-labeled nodes/edges.

**API**: new `api/modules/catalog` exposing catalog reads + the 52-week window projection.

</details>

---

## Phase 2 — Enterprise Context ✅ DONE (2026-07-25)

Comes after Phase 1 because Person/Role/Location only become useful once there's Requirement/Control data to resolve incidents' free-text fields against.

**Facility vs. Location — resolved.** The original scope left "`Facility` becomes a `Location` subtype or is migrated" as an open call. Decision: **no separate `Location` node type.** Compliance obligations attach to `Facility` — the thing that gets inspected, audited, licensed — not to a bare geographic point. Site/building/zone/room granularity is modeled as plain attributes on `Facility` (site-level: `company`) and `Asset` (`buildingId`/`zoneId`/`roomId`), not as additional nodes.

**What actually got built** (see `vyra-graph-spine.md` for the authoritative schema):
- `Organization` (12) and `Role` (16) — new node types, seeded from the second dataset's `10_Organization_Mapping`/`18_Roles_Master`, `:Enterprise`-labeled.
- `Facility` gained a second, `:Enterprise`-labeled batch (20, from `11_Spatial_Mapping` deduped to Site granularity) alongside the 7 existing unlabeled enterprise-pipeline rows — same dual-origin pattern as `Regulation`/`Regulation:Catalog`.
- `Asset` likewise gained a second `:Enterprise`-labeled batch (31, from `19_Asset_Equipment_Master`), plus new props (`facilityId`, `buildingId`, `zoneId`, `roomId`, `category`) and a new `LOCATED_AT` relationship on the *existing* `Asset` TypeSpec. This closes the gap `vyra-graph-spine.md` had flagged since Phase 0 (`LOCATED_AT` was documented once, found unimplemented, and removed) — and since the original 7-incident `assets.csv` already had a populated `facilityId` column nobody was reading, those 7 assets start emitting real `LOCATED_AT` edges on the next `./ingest.sh` with no new data.
- `Role -[:BELONGS_TO]-> Organization` reuses the `BELONGS_TO` name already used for `Clause→Regulation/Standard` — safe because Phase 1 already fixed edge-batch grouping to key on `(relType, sourceLabel, targetLabel)`, not `relType` alone.
- New entrypoint `cli/orchestration/enterprise-sync.ts` (mirrors `catalog-sync.ts`), new `cli/scripts/convert-enterprise-seed.ts` (mirrors `convert-catalog-seed.ts`), new `api/modules/enterprise`.

**Deliberate deviation from the original plan — `Person` stays schema-only.** `Person` (props: `email`, `roleId`, `facilityId`) and its two relationships (`HAS_ROLE -> Role`, `WORKS_AT -> Facility`) are declared in `v2.ts` exactly as originally scoped, but **not seeded** — `.design/__ref/entity-alignment.md` confirms neither source dataset has any named-individual data, only role titles. `Incident.capturedBy`/`reviewedBy`/`Task.owner` remain free-text strings until a real identity source shows up. This is the same "declared, not yet fed" treatment already used for `Schedule`, `Policy`, `Signal`, etc.

---

## Phase 3 — Live Operational Context + first real agent

A CSV batch reload is fundamentally incompatible with continuous floor events. This phase needs a genuinely new write path, not an extension of the CLI pipeline. **Not started.**

- New API-driven ingestion endpoint(s) (e.g. in `api/modules/operational` or a new `signals` module) writing directly via `lib/graph-db`'s `DB.get(...).exec2`, bypassing the CLI pipeline for this data only.
- Auto Task creation: given a `Signal` against an `Asset`, resolve applicable `Control`/`Requirement` (via the Phase 1 catalog links) and the responsible `Role`/`Person` (via Phase 2 enterprise links), create a `Task`.
- First real agent implementation: build the observe → reason → act → verify loop as a **shared primitive** in `agents/runtime/index.ts` (not agent-specific), and implement the currently-stubbed `agents/tools/graph-read.ts` / `graph-write.ts` execution. Wire `control-intelligence` first since it's the only agent family with partial (if non-functional) wiring today.

**Files**: `api/modules/operational/{index.ts,repo.ts}` (or new module), `agents/runtime/index.ts`, `agents/tools/graph-read.ts`, `agents/tools/graph-write.ts`, `agents/agents/control-intelligence/index.ts`.

---

## Phase 4 — Compliance posture/landscape views

Purely additive once Phases 1–3 exist: aggregation Cypher across catalog + enterprise + operational + intelligence data. Extends `api/modules/dashboard` and `api/modules/assurance`. No new node types expected. **Not started.**

---

## Verification approach (per phase)

- Phase 0 ✅: full-repo grep for each old relationship-type string returned zero hits outside the corrected definition; re-ran existing traversal queries against the local Neo4j instance and confirmed non-empty results where they'd previously silently returned nothing.
- Phase 1 ✅: ran the catalog sync job, confirmed `:Catalog` label present and correct counts via direct query; confirmed the polymorphic `Clause` parent resolves to both `Regulation` and `Standard` nodes; hit all 4 new `/catalog/*` routes live and got correct data (caught and fixed a direction bug in `traceRequirements` this way).
- Phase 2 ✅: ran `enterprise-sync.ts` dry-run, confirmed exact expected node/edge counts (79 nodes: 12 Organization, 16 Role, 20 Facility, 31 Asset; 47 edges: 16 `BELONGS_TO`, 31 `LOCATED_AT`); ran it live and confirmed via direct query; re-ran `./ingest.sh` and confirmed the pre-existing 7 assets now carry `LOCATED_AT` edges; hit all 3 new `/enterprise/*` routes live.
- Phase 3: POST a test Signal via the new endpoint, confirm a Task node is created and linked to the correct Control/Role; run the control-intelligence agent end-to-end against seed data and confirm it writes a real `Decision` node (not `[]`).
- Phase 4: manually query new dashboard endpoints against a fully-seeded test instance and spot-check numbers against known seed data.

**Correction from the original plan**: this section originally said "each phase should end with `/dev-audit`." That skill's checks are written for a different project template (`app/module/*/edge/api/`, Koa, `dbv4x`) that doesn't exist in this repo — running it produces false negatives, not real coverage. There is no drop-in substitute gate in this repo today; live-query verification against Neo4j (as done for Phase 0/1 above) is the actual closing check until one exists.
