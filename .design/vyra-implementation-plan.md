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

This plan covers **design and sequencing**, one phase at a time. **Phases 0, 0.5, 1, 2, 3, 3.5, 4a, and 4b are done** (4b on synthetic seed data — see its section below).

---

## Task Brief — What's Pending (short form)

One line per JTBD layer (the 7-layer model defined in `vyra-landscape.md`; the fuller status-with-backing view lives in `vyra-tracker.md`), for a quick "what's pending" answer without re-reading the full plan. **Update this whenever a phase materially changes a layer's status** — it, and `vyra-tracker.md`, will drift otherwise.

- **L1 Knowledge** — Regulations/Standards live; Contracts unscoped, SOPs still folded into `Control` (not a distinct catalog item)
- **L2 Interpret** — Requirement→Control→Asset chain live; 2 Security-category assets still unmapped (documented gap)
- **L3 Planning** — 52-week calendar + Org/Role live; `Person` (named individuals) unfed, task-completion tracking not built
- **L4 Graph Spine** — complete (it's the infrastructure itself; "Review" = Autonomy Level 1 human-approval gate)
- **L5 Oversight** — Signal + first agent (`control-intelligence`) live; nothing watches Signals for deviations yet, `signal-intelligence` still a stub
- **L6 Assurance** — Coverage Scoring done (Phase 4a); Audit-Ready Export done on synthetic seed data (Phase 4b) — a real audit-trail source is still needed to replace the fabricated `Audit`/`EvidencePackage`/`Attestation`/`AssuranceStatement` chain
- **L7 Risk** — Per-Finding score + portfolio rollup live (Phase 4a); Scenario Simulation gap, needs agents beyond `control-intelligence`

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

## Phase 3 — Live Operational Context + first real agent ✅ DONE (2026-07-26)

A CSV batch reload is fundamentally incompatible with continuous floor events. This phase needed a genuinely new write path, not an extension of the CLI pipeline.

**Scoping finding that expanded this phase.** Auto-Task creation needs an `Asset → Control` path. None existed: legacy `Asset.assetType` is a constant `'equipment'` across all 7 legacy assets (no discriminating power), and the 31 `:Enterprise` assets' real `category` field had zero Controls to match against — Phase 1 never ingested the second dataset's real Control catalog (`08_Operational_Controls`, 30 rows) or its `ComplianceArea` taxonomy (`07_Compliance_Areas`, 10 rows). **Decision: ingest both now**, since Asset.category and Control.ComplianceAreaID already point at the same real 10-area vocabulary in the source data — not a fabricated link. `ComplianceArea` and a second `Control` batch (`:Catalog`-labeled) were added to Phase 1's catalog via `catalog-sync.ts`; `Asset` gained `complianceAreaId` (Phase 2's `enterprise-sync.ts`) via a manual, name/description-backed mapping table. One category, `Security` (2 of 31 assets), has no corresponding ComplianceArea in the source data — left unmapped, a documented gap, not guessed.

**What actually got built:**
- `Asset -[:COVERED_BY]-> Control`, materialized by a new one-time idempotent script, `cli/scripts/backfill-asset-control.ts`, joining through the shared `ComplianceArea` (`Asset -[:IN_COMPLIANCE_AREA]-> ComplianceArea <-[:BELONGS_TO]- Control`). Verified live: 101 `COVERED_BY` edges; `AST-001` (Fire Suppression) resolves to its 4 real Controls; both `Security`-category assets correctly resolve to zero.
- First non-CLI write path: `POST /operational/signals` (`api/modules/operational/repo.ts`'s `createSignal`), writing directly via `lib/graph-db` — Signal creation and auto-Task creation in one round trip. Task gets `controlIds`/`requirementIds` as native array props (not a single FK — one Asset can match multiple Controls under one ComplianceArea) and an `owner` resolved via `Facility <-[:WORKS_AT]- Person` (falls back to `'UNKNOWN'`, since `Person` is still unfed from Phase 2). Verified live against both a covered and a Security-gap asset, plus an invalid-payload 400 case.
- First functioning agent: `agents/tools/graph-read.ts`/`graph-write.ts` were previously dead code — `db()` handles were constructed but never called, every function returned a hardcoded `[]`/`void`. Both are now wired to real `db().fetch2`/`exec2` calls. `fetchRequirements` also had an actual bug fixed: its Cypher never filtered for "uncontrolled" despite the agent's docstring claiming it did. A shared `runAgentLoop` (observe → reason → act → verify) primitive plus a minimal `reasonWithClaude` helper (single JSON-instructed prompt, not full tool-use — YAGNI for the first agent proving the loop) were added to `agents/runtime/index.ts`. `control-intelligence` is wired end-to-end. New `agents/index.ts` entrypoint (`agents/` never called `dotenv.config()` before this). Verified live: `observe()` returned 4 real uncontrolled `Requirement`s from Neo4j; the loop failed cleanly (not silently, not hung) at the Claude call since `ANTHROPIC_API_KEY` isn't in `.env`.

**Deliberately deferred**: adding `ANTHROPIC_API_KEY` to `.env` and running a live Claude round-trip — that's the user's key to add; verified everything up to that boundary.

**Files**: `cli/semantic-contract/contracts/v2.ts`, `cli/scripts/convert-catalog-seed.ts`, `cli/scripts/convert-enterprise-seed.ts`, new `cli/scripts/backfill-asset-control.ts`, `api/modules/operational/{index.ts,repo.ts}`, `agents/tools/graph-read.ts`, `agents/tools/graph-write.ts`, `agents/runtime/index.ts`, `agents/agents/control-intelligence/index.ts`, new `agents/index.ts`.

---

## Phase 3.5 — 52-Week Compliance Calendar ✅ DONE (2026-07-26)

Not in the original phase plan — added when the user asked what it would take to show the L3 "52-Week Calendar" JTBD row (`vyra-landscape.md`) in the UI. The graph spine's stated reason for leaving `Schedule` unseeded (`13_Schedule_Rules` is `TaskID`-keyed, not `RequirementID`-keyed, so `Schedule -> Requirement` would fabricate a link) stopped one hop too early: `09_Task_Master` (same `TaskID` space, confirmed 1:1 across all 60 rows) carries a real `Control ID` FK into the 30 `Control:Catalog` rows Phase 3 already seeded. The real, non-fabricated chain is `Schedule -> Task -> Control -> Requirement`.

**What got built:**
- Corrected `Schedule`'s target from `Requirement` to `Task` in `v2.ts` (`requirementId`→`taskId`, `APPLIES_TO -> Requirement`→`APPLIES_TO -> Task`), and added `Task.controlId` + `Task -[:IMPLEMENTS]-> Control`.
- `cli/scripts/convert-catalog-seed.ts` extended to convert `09_Task_Master` → `tasks.csv` (60 rows, kept thin per `entity-alignment.md`'s explicit warning against ingesting that 39-column rollup as-is) and `13_Schedule_Rules` → `schedules.csv` (50 of 60 rows — only `Schedule Type = Fixed`; the other 10 are `Condition/Event/Sensor/Risk/AI`-Triggered and correctly stay on the existing Phase 3 Signal→Task path instead).
- `Frequency` (qualitative: `Monthly`, `Quarterly`, etc.) resolved to numeric `cadenceUnit`/`cadenceInterval` via a fixed lookup table — a direct translation, not fabricated data. `"Week NN"` anchors resolved to `2026-01-01 + 7×(NN−1)` days (naive 7-day blocks, not ISO week numbering).
- New `fetchTaskCalendar` in `api/modules/catalog/repo.ts`, exposed as `GET /catalog/calendar?horizonWeeks=`, joining `Schedule -[:APPLIES_TO]->Task-[:IMPLEMENTS]->Control` and expanding each cadence via the existing `computeWindow`. Extended `computeWindow`'s cadence enum with `hour`, and fixed a real bug found during verification: sub-day cadences (`hour`) produced ~24 duplicate date strings per day at `computeWindow`'s day-level granularity — now deduped.
- New UI feature `ui/src/features/calendar/calendar.tsx` (`CalendarView`) at `/calendar`. Original (2026-07-26) shape: fetch-on-mount, 52 week-rows with frequency-colored badges, click-to-drill via `PropRow`/`DrillDrawer` reused from `landscape.tsx`, following the `landscape.tsx` page pattern.

**UI iteration — calendar v2 (2026-07-29, not a separate phase, same feature reworked twice post-ship):**
- Same 2026-07-26 commit also shipped a second, parallel view — `ui/src/features/calendar/calendar-matrix.tsx` at `/calendar/matrix`, linked from the week-row view as "Matrix view (v2)" — an alternate task×week grid laid out as a toggle-away option rather than the default.
- `a26eb83` ("updated calender view to v2", 2026-07-29) consolidated the two into one: `calendar.tsx` itself became the task×week matrix (sticky task-name column, 52-week grid, quarter gridlines), `calendar-matrix.tsx` and its `/calendar/matrix` route were deleted, and the "Matrix view (v2)" toggle link was removed since the matrix is now the only view. Click-to-drill (`PropRow`/`DrillDrawer`) was replaced with hover tooltips — `calendar.tsx` no longer imports from `landscape.tsx`. Per-frequency badge colors were replaced with a single-hue blue ordinal ramp (`FREQUENCY_COLOR` — darker = lower cadence), chosen and validated via the `dataviz` skill's palette validator against this app's dark surface (`#09090b`).

Verified live (2026-07-26 shape): `convert-catalog-seed.ts` produced exactly 60 `tasks.csv` / 50 `schedules.csv` rows; `catalog-sync.ts` loaded them with the expected edge counts (`Schedule-[:APPLIES_TO]->Task`: 50, `Task-[:IMPLEMENTS]->Control`: 60); hit `GET /catalog/calendar` live and confirmed correct occurrence counts per cadence; loaded `/calendar` in a real browser via Playwright, confirmed correct week-bucketing and drill-down, and confirmed zero console errors after the dedup fix. **Not re-verified since**: the `a26eb83` matrix consolidation (drill-down removed, hover tooltip added) has no recorded live/Playwright pass of its own — data-layer claims above still hold (nothing backend-side changed), but the current UI's rendering/interaction hasn't been re-confirmed in a browser.

**Files**: `cli/scripts/convert-catalog-seed.ts`, `cli/domains/catalog/ingest-hints.json`, `cli/semantic-contract/contracts/v2.ts`, `api/modules/catalog/{index.ts,repo.ts}`, `ui/src/lib/api.ts`, `ui/src/features/calendar/calendar.tsx`, `ui/src/app/calendar/page.tsx`. `ui/src/features/landscape/landscape.tsx`'s exported `PropRow`/`DrillDrawer` were used by the original calendar UI and the now-deleted `calendar-matrix.tsx`/`ui/src/app/calendar/matrix/page.tsx`; `calendar.tsx` no longer imports either after the v2 consolidation, but `landscape.tsx` itself still exports them (used elsewhere in that file).

---

## Phase 4 — Compliance posture/landscape views

Scope narrowed 2026-07-29, after an explicit readiness check found the original one-line scope ("aggregation Cypher across catalog + enterprise + operational + intelligence data") bundled a ready slice and a blocked slice together. Split into 4a (start now) and 4b (needs a scoping decision first) rather than treated as one phase.

### Phase 4a — Coverage Scoring + Risk rollup ✅ DONE (2026-07-29)

**Scoping decision**: catalog-origin data only. `Control -[:BELONGS_TO]-> ComplianceArea` and `Asset -[:IN_COMPLIANCE_AREA]->` only exist for `:Catalog`/`:Enterprise`-labeled rows (Phase 3). The 15 legacy per-incident `Control`s (unlabeled, from the original 7-incident pipeline) have no `ComplianceArea` link and are excluded from the coverage score by explicit label filter (`Control:Catalog`, `Asset:Enterprise`) rather than left as an accidental artifact of missing edges — consistent with how the spine already treats every other dual-origin type. Legacy-incident coverage, if wanted later, is a separate follow-up (find or fabricate a second join path), not assumed here.

**What got built**: `api/modules/assurance/repo.ts`'s old `getPosture()` (Requirement/Control/Finding only, no `COVERED_BY`/`ComplianceArea`, dating to the pre-Phase-0 base commit) was replaced with two functions:
- `getCoverageScore()` — four queries (`REQUIREMENT_COVERAGE_TOTAL`, `ASSET_COVERAGE_TOTAL`, `REQUIREMENT_COVERAGE_BY_AREA`, `ASSET_COVERAGE_BY_AREA`) run in parallel and merged in JS by `complianceAreaId`, rather than one fanned-out query — avoids the row-multiplication that a single `Control`×`Requirement`×`Asset` `OPTIONAL MATCH` chain would produce. Returns total + per-`ComplianceArea` breakdown for both Requirement coverage and Asset coverage, plus `assets.unmappedComplianceArea` as its own field (the 2 `Security`-category assets), not folded into "uncovered."
- `getRiskRollup()` — `Risk` grouped by `residualRating`, count + avg score per rating, plus an overall count-weighted average.
- Both exposed via the existing `GET /assurance/posture` route (`api/modules/assurance/index.ts`), now returning `{ coverage, riskRollup }`. Kept in the `assurance` module rather than moved to `catalog` — posture/coverage is an assurance-domain question by the L6 JTBD naming, and no second endpoint was added (YAGNI).
- `listAttestations()` left untouched — still dormant, blocked on Phase 4b.

Verified live against the running API/Neo4j (not a fully-seeded test instance — the actual dev instance): `requirements: {total: 34, covered: 30, coveragePercent: 88.2}` — the 4 uncovered match the count `control-intelligence`'s `fetchRequirements` already found in Phase 3, a real cross-check, not a coincidence; `assets: {total: 31, covered: 29, unmappedComplianceArea: 2, coveragePercent: 93.5}` — matches the documented Security-category gap exactly; `riskRollup` (Critical: 2 @ avg 19, High: 3 @ avg 15.3, Medium: 2 @ avg 10.5, total 7, avg 15) matches the per-incident likelihood/severity table in `vyra-graph-spine.md`'s `Risk` section exactly. `api` workspace typechecks clean (`tsc --noEmit`).

**UI wired 2026-07-29 (same-day follow-up)**: `ui/src/app/assurance/page.tsx`'s `{/* TODO: evidence, posture, attestations */}` stub replaced with `AssuranceView` (`ui/src/features/assurance/assurance.tsx`), following the existing `landscape.tsx`/`calendar.tsx` feature pattern (single-file component, fetch-on-mount, Tailwind zinc-950 theme) rather than introducing new architecture. Sections: Coverage Score (stat tiles + per-`ComplianceArea` table, `scope` string rendered as a visible caption, `unmappedComplianceArea` surfaced as its own labeled tile), Risk Rollup (rating tiles reusing the existing `BADGE_COLORS` red/orange/amber/emerald convention), Evidence (30 live items, reuses `PropRow` exported from `landscape.tsx` rather than duplicating row-rendering), and an explicit Attestations placeholder ("not yet available — blocked on Phase 4b") instead of a silently empty section. `assurance.posture()` in `ui/src/lib/api.ts` typed against the real response shape (`CoverageScore`/`RiskRollup`) instead of implicit `any`. Added an `/assurance` nav link to `landscape.tsx`, alongside Lifecycle/Traceability/Calendar.

Verified live via headless browser (Playwright): `/assurance` renders all four sections with the same real numbers confirmed above (88.2%/93.5% coverage, risk rollup matching the graph-spine table, 30 evidence items), zero console/page errors, and the new nav link confirmed present and pointing at `/assurance` from the landscape page. `ui` workspace typechecks clean (`tsc --noEmit`).

**Files**: `api/modules/assurance/{repo.ts,index.ts}`, `ui/src/lib/api.ts`, new `ui/src/features/assurance/assurance.tsx`, `ui/src/app/assurance/page.tsx`, `ui/src/features/landscape/landscape.tsx` (nav link).

### Phase 4b — Audit-Ready Export ✅ DONE (2026-08-16, synthetic data)

**Scoping decision**: fabricate, don't defer. The user confirmed it's fine to seed `Audit`/`EvidencePackage`/`Attestation`/`AssuranceStatement` with synthetic data now, on the condition that the CSV schema producing it is documented well enough (`vyra-graph-spine.md` Appendix A/B/C) to swap in a real audit-trail source later without a redesign. Every fabricated value reuses a real field already sitting unused in the 7-incident dataset (`Incident.reviewedBy`, `Incident.auditType`, real CAPA/Verification closure state, real `GOVERNED_BY` regulation links) rather than inventing unrelated data — the same "grounded, not random" discipline as Phase 1's `Schedule` and Phase 3's `ComplianceArea`/`Control` backfill.

**What got built**: new `cli/scripts/generate-assurance-seed.ts` derives, one of each per existing Incident (7 of each, 28 nodes total):
- `EvidencePackage` — bundles that incident's `Evidence` (new `Evidence.packageId` FK + `PART_OF` rel, added to `Evidence` in `v2.ts`)
- `Attestation` — `attestedBy` = the incident's real `reviewedBy`, `-[:BACKED_BY]->` the package (this rel was declared in `v2.ts` since the original Phase 1 pass but never fed until now)
- `AssuranceStatement` — `posture` is **computed, not asserted**: walked live from the real `Incident -> Finding -> RCA -> CAPA -> Verification` chain, `"Compliant"` only if every reachable CAPA has a Verification. All 7 incidents resolve to `"Compliant with open corrective action"` — a real, if coincidental, finding (each incident has 2–4 CAPAs but only 1 Verification apiece in the seed data), not a scripting bug. `-[:DERIVED_FROM]->` Attestation (also newly fed), `-[:COVERS]->` Regulation (new edge CSV, reuses `incident_regulation.csv`'s mapping) and `-[:PREPARED_FOR]->` Audit (new edge CSV)
- `Audit` — promoted 1:1 from audit metadata already sitting unused on `Incident` (`auditType`, `incidentTime`, `reviewedBy`)

Wired into the base `grc` ingestion pipeline (unlabeled, same origin as the rest of the 7-incident data — no `:Catalog`/`:Enterprise` label). API: `listAttestations()`'s pre-existing unmapped-response bug fixed, plus new `listEvidencePackages()`/`listAssuranceStatements()`/`listAudits()` and matching `GET /assurance/{evidence-packages,assurance-statements,audits}` routes. UI: `assurance.tsx`'s "Attestations — blocked" placeholder replaced with a real `AuditChainSection` (7 cards, `Audit → AssuranceStatement → Attestation → EvidencePackage`), explicitly labeled "synthetic seed data" in the UI itself, not just the docs.

**Explicitly not done**: no real audit-management data source — this is fabricated data with a documented, regenerable shape (`generate-assurance-seed.ts`), not a solved integration. Swapping in a real source later means replacing that script's inputs, not redesigning the schema.

Verified live: `generate-assurance-seed.ts` produced exactly 7/7/7/7 node rows + 18 `COVERS` + 7 `PREPARED_FOR` edge rows; `./ingest.sh` confirmed via direct Cypher (`EvidencePackage`/`Attestation`/`AssuranceStatement`/`Audit`: 7 each; `PART_OF`: 30, `BACKED_BY`: 7, `DERIVED_FROM`: 7, `COVERS`: 18, `PREPARED_FOR`: 7); `tsc --noEmit` clean on `api/` and `ui/`.

**Files**: `cli/scripts/generate-assurance-seed.ts` (new), `cli/semantic-contract/contracts/v2.ts`, `cli/domains/grc/ingest-hints.json`, `cli/feeds/csv/assurance/{evidence.csv,evidence-packages.csv,attestations.csv,assurance-statements.csv,audits.csv}`, `cli/feeds/csv/edges/{assurance_statement_regulation.csv,assurance_statement_audit.csv}`, `api/modules/assurance/{repo.ts,index.ts}`, `ui/src/lib/api.ts`, `ui/src/features/assurance/assurance.tsx`.

**Explicitly out of scope for Phase 4 entirely**: Scenario Simulation (L7) — needs working agents beyond `control-intelligence`, unscoped, no phase names it yet.

---

## Verification approach (per phase)

- Phase 0 ✅: full-repo grep for each old relationship-type string returned zero hits outside the corrected definition; re-ran existing traversal queries against the local Neo4j instance and confirmed non-empty results where they'd previously silently returned nothing.
- Phase 1 ✅: ran the catalog sync job, confirmed `:Catalog` label present and correct counts via direct query; confirmed the polymorphic `Clause` parent resolves to both `Regulation` and `Standard` nodes; hit all 4 new `/catalog/*` routes live and got correct data (caught and fixed a direction bug in `traceRequirements` this way).
- Phase 2 ✅: ran `enterprise-sync.ts` dry-run, confirmed exact expected node/edge counts (79 nodes: 12 Organization, 16 Role, 20 Facility, 31 Asset; 47 edges: 16 `BELONGS_TO`, 31 `LOCATED_AT`); ran it live and confirmed via direct query; re-ran `./ingest.sh` and confirmed the pre-existing 7 assets now carry `LOCATED_AT` edges; hit all 3 new `/enterprise/*` routes live.
- Phase 3 ✅: ran `catalog-sync.ts`/`enterprise-sync.ts` live, confirmed `ComplianceArea` (10), `Control:Catalog` (30), `IN_COMPLIANCE_AREA` (29) counts; ran `backfill-asset-control.ts`, confirmed 101 `COVERED_BY` edges and spot-checked `AST-001` resolves to its 4 real Controls; POSTed test Signals via the live API against both a covered asset (`controlIds`/`requirementIds` populated) and a Security-gap asset (correctly empty), plus an invalid-payload case (clean 400); ran `agents/index.ts control-intelligence` live and confirmed `fetchRequirements` returns 4 real uncontrolled `Requirement`s from Neo4j, with a clean failure (not a hang, not silent) at the Claude call since `ANTHROPIC_API_KEY` isn't configured — the live Claude round-trip itself is deferred to the user, who needs to add that key.
- Phase 3.5 ✅: ran the updated `convert-catalog-seed.ts`, confirmed exact 60/50 row counts for `tasks.csv`/`schedules.csv`; ran `catalog-sync.ts` live, confirmed `Task:Catalog` (60), `Schedule:Catalog` (50), `Schedule-[:APPLIES_TO]->Task` (50), `Task-[:IMPLEMENTS]->Control` (60) via direct Cypher; hit `GET /catalog/calendar` live and spot-checked occurrence counts per cadence; found and fixed a real bug this way (`Hourly` cadence produced ~24 duplicate dates per day due to `computeWindow`'s day-level granularity); loaded `/calendar` in a real headless browser (Playwright), confirmed correct rendering and drill-down, and confirmed zero console errors post-fix. This verification predates the `a26eb83` matrix-view consolidation (2026-07-29) — the UI has since changed (drill-down → hover) and hasn't been re-run through Playwright.
- Phase 4a ✅: hit `GET /assurance/posture` live against the running dev instance; confirmed `requirements.covered` (30/34) cross-checks exactly against the 4 uncovered `Requirement`s Phase 3's agent already found independently; confirmed `assets.unmappedComplianceArea` (2) surfaces the known `Security`-category gap explicitly rather than folding it into "uncovered"; confirmed `riskRollup` matches `vyra-graph-spine.md`'s per-incident risk table exactly (Critical 2/avg 19, High 3/avg 15.3, Medium 2/avg 10.5); `tsc --noEmit` clean on `api/`.
- Phase 4b ✅: ran `generate-assurance-seed.ts`, confirmed exact 7/7/7/7 node row counts + 18/7 edge row counts; ran `./ingest.sh` live, confirmed via direct Cypher (`EvidencePackage`/`Attestation`/`AssuranceStatement`/`Audit`: 7 each; `PART_OF`: 30, `BACKED_BY`: 7, `DERIVED_FROM`: 7, `COVERS`: 18, `PREPARED_FOR`: 7); `tsc --noEmit` clean on `api/` and `ui/`.

**Correction from the original plan**: this section originally said "each phase should end with `/dev-audit`." That skill's checks are written for a different project template (`app/module/*/edge/api/`, Koa, `dbv4x`) that doesn't exist in this repo — running it produces false negatives, not real coverage. There is no drop-in substitute gate in this repo today; live-query verification against Neo4j (as done for Phase 0/1 above) is the actual closing check until one exists.
