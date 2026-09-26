# Vyra Build Tracker

**The current build status of Vyra, mapped to the 7-layer GRC operating model** — what's live, what's partial, what's still a gap, right now. This is the *tracking* view, deliberately kept out of `foundation.md` so the specification stays a clean model/value/guarantees read without build-status noise.

> **Audience: internal** — engineering and product. For the operating model itself (personas, capabilities, the loop) with no status, read `foundation.md`. For *why* an item sits where it does and what unblocks it, follow the phase references into `plan.md`.

**Keep this in sync with the plan on every phase — it drifts otherwise.** When a phase changes a layer's status, update the matching row here *and* the "Net" summary below. `plan.md` is the authoritative source for phase completion; this doc is a layer-readiness lens over it, not a second source of truth.

---

## Phase rollup

**Phases 0–9 are ✅ done**, plus three standalone closures: the L1 Contract entity, a Gap Review (Escalation Paths / `HAS_ROLE` / SOPs — all confirmed to have no real closure path), and an Intelligence-UI usability pass. **2026-09-22: 12 of the 17 onboarding-readiness gaps below closed in one batch** (#1, #3, #4, #5, #10, #11, #12, #13, #14, #15, #16, #17 — the last two partially, scoped to one agent family). #2/#6 remain correct-by-design (no work needed); #7/#8/#9 remain out of scope for this batch, still needing their own dedicated design pass. **2026-09-25: #8 (Onboarding-as-a-phase) gets its first real slice** — `CutoverCriterion` is now a live node, closing the "cutover-overdue is queryable" half of `foundation.md` §0's claim. **2026-09-26: #8 gets a second slice** — `Blueprint` is now a live node, closing `foundation.md` §2's blueprint-ratification claim for its human-proposed first cut; `ContinuityBaseline`/shadow-mode/decommissioning remain open, each its own future slice. **Phases 10–11 ("Agentic Completion Track") are 🔲 planned, not started.** Sequencing and open decisions → `plan.md`. Full per-phase narrative and verification evidence → `.design/__ref/implementation-history.md`.

---

## JTBD Layer Status

One row per capability from `foundation.md`'s 7-layer operating model, scored on **whether the graph can actually feed it right now.** The layer/persona/capability definitions themselves live in the foundation doc — this table only adds the status lens, in plain language. Where a row is 🟡/🔴, "What This Means" cross-references the matching numbered Gap in the Onboarding Readiness section below for the full Requirement/Implementation/Gap/Resolution writeup — it isn't repeated here. Full investigation detail behind any 🟡/🔴 row → `.design/__ref/implementation-history.md`.

Status key: **🟢 live** = real data, working queries · **🟡 partial** = modeled but incomplete or unstructured · **🔴 gap** = nothing built.

| L | Layer | Capability | Status | What This Means |
|---|---|---|---|---|
| L1 | **Knowledge** | Regulations | 🟢 live | Regulations from both the shared catalog and this enterprise's own data are loaded and queryable. |
| | | Standards | 🟢 live | Industry standards from the shared catalog are loaded and queryable. |
| | | Contracts | 🟢 live | Vendor contracts are loaded with real links to the vendors, coordinators, and facilities they cover — visible at `/enterprise/contracts`. Contracts aren't yet linked to the controls they might require. |
| | | SOPs | 🟢 live | `Control.docType` (policy/sop) now distinguishes the two on the 15 legacy `knowledge/controls.csv` rows — see **Gap #1** below (closed 2026-09-22). |
| L2 | **Interpret** | Applicability Scoping | 🟡 partial | Most enterprise assets are linked to a control that covers them; 2 Security-area assets aren't — see **Gap #2** below. |
| | | Obligation Linkage | 🟡 partial | Every obligation traces back to the regulation/standard clause it comes from, and every control traces to the obligation it satisfies, scoped down to the asset it covers. Marked partial because it inherits Applicability Scoping's 2-asset gap above, not a separate issue. |
| L3 | **Planning** | 52-Week Calendar | 🟢 live | 50 recurring compliance tasks are scheduled and shown in the Calendar view; a task's status can now be marked directly in the UI (`PATCH /execution/tasks/:id`), and the 10 event-triggered tasks reactivate on their real trigger (Signal ingress or a Risk/AI graph check) — see **Gap #3** below (closed 2026-09-22). |
| | | Location + Role Assign | 🟢 live | Org structure, roles, and people are loaded, and `HAS_ROLE` now resolves for 6 of 7 people via a functional-domain title→role mapping — see **Gap #4** below (closed 2026-09-22). |
| L4 | **CTN Knowledge Graph Spine** — Capture • Review | *(the graph itself)* | 🟢 live (as infrastructure) | This layer is the graph itself — every other layer reads and writes through it. "Review" means a real human approve/reject step exists before an agent's proposal becomes permanent. |
| L5 | **Oversight** | Deviation Alerts | 🟢 live | The platform watches incoming operational signals continuously and raises a reviewable decision when something looks off, without creating duplicates on repeat checks. |
| | | Escalation Paths | 🟡 partial | Incidents still record escalation as free text, but a partial structured chain (`ESCALATES_TO {order}` to a real seeded Role) now sits alongside it for the hops that resolve — see **Gap #5** below (closed 2026-09-22). |
| L6 | **Assurance** | Coverage Scoring | 🟢 live | The platform can state, right now, how many obligations and assets actually have a covering control (30/34 obligations, 29/31 assets) — visible at `/assurance`. |
| | | Audit-Ready Export | 🟡 partial | The platform now builds real evidence chains for new activity, gated by human approval. The original 7 incidents behind the first version of this feature are still test data, not real — see **Gap #6** below. |
| L7 | **Risk** | Residual Risk Score | 🟡 partial | Every finding gets a risk score, rolled up into a portfolio-level view, and the platform proposes scores for newly-arrived findings automatically. Marked partial because scoring is applied incrementally as new findings arrive rather than as a single verified pass across the whole portfolio. |
| | | Scenario Simulation | 🔴 gap | There's no way yet to ask "what happens if this control fails" and get a real answer — see **Gap #7** below. |

**Net**: Phases 0–9 + the L1 Contracts addition are live, plus the 2026-09-22 batch closing SOPs, the 52-Week Calendar's completion tracking, `HAS_ROLE`, and (partially) Escalation Paths. The remaining partial/gap items — full Applicability Scoping (by design, not a gap), Audit-Ready Export's synthetic original 7 — were each investigated and confirmed to have no real, non-fabricated closure path today, not left by oversight. **L7 Scenario Simulation** is the one genuine open gap. Full evidence for every investigated item → `.design/__ref/implementation-history.md`'s Gap Review.

---

## Onboarding Readiness — Gap Inventory

**Distinct from the JTBD Layer Status above.** That table scores whether the 7 operating-model *layers* are fed by live data. This section scores whether the platform could actually onboard a new enterprise end-to-end per `foundation.md` §0's transition guarantee — compiled 2026-09-20, ahead of a first real onboarding attempt, revised 2026-09-20 to separate feed gaps from code gaps, revised 2026-09-22 to close 12 of the 15 remaining gaps in one batch (see the Net summary at the end of this section).

**`foundation.md` is the master spec; every Requirement below is traced to it.** This is a greenfield project — every row in every seed CSV is simulated data, not a live regulatory or enterprise feed. That changes what "closing a gap" means: where something is missing only because the *synthetic feed* never populated it, the fix is a **feed-generator** addition, not new application code. Where the platform genuinely lacks a capability regardless of data completeness (a screen, a route, a reasoning loop), that's a **code gap**. Some rows need both. And where the code already declines to fabricate a value it wasn't given (fails soft/throws) or falls back to a domain-consistent default (`'UNKNOWN'`, etc.), that's correct behavior already — not a gap to fix by writing more code, only by feeding it real data.

Each gap is stated as: what `foundation.md` actually requires (**Requirement**), what's true today in plain terms (**Implementation**), what's missing and why it matters (**Gap**), the specific datum the synthetic feed would need to carry, if any (**Feed Datum Missing**), and what actually closes it (**Resolution**).

Status tags used below: 🟡 **partial** = real but incomplete · 🔴 **gap** = nothing built · ⚪ **by-design** = correctly implements a `foundation.md` requirement already — not an open item, listed for traceability only.

> **Cross-cutting fact that shapes most code-side Resolutions below**: the entire API has exactly two write routes — `POST /operational/signals` and `POST /intelligence/decisions/:id/{approve,reject}`. Every other route, across all 8 modules, is read-only, and no `PATCH`/`PUT` exists anywhere. So wherever a Resolution calls for "a screen to do X," it also implies a mutation route that doesn't exist yet.

### Summary

**Open**
1. [Scenario Simulation](#gap-7)
2. [Domain model is anemic vs. `domain.md`](#gap-9)

**Closed**
1. [SOPs](#gap-1)
2. [Applicability Scoping](#gap-2) *(by design)*
3. [52-Week Calendar](#gap-3)
4. [`HAS_ROLE`](#gap-4)
5. [Escalation Paths](#gap-5)
6. [Audit-Ready Export](#gap-6) *(by design)*
7. [Onboarding-as-a-phase](#gap-8) *(partial — `CutoverCriterion` + `Blueprint` slices)*
8. [Onboarding UI is ingestion-only](#gap-10)
9. [`Signal` has no "Who"](#gap-11)
10. [Catalog versioning is scaffolded, not exercised](#gap-12)
11. [No source-span retention on catalog text](#gap-13)
12. [No sync-run attribution on catalog nodes/edges](#gap-14)
13. [`COVERED_BY` edges carry no provenance](#gap-15)
14. [Agent reasoning is single-shot, not multi-turn/tool-using](#gap-16)
15. [No learning-from-overrides feedback loop](#gap-17)

<a id="gap-1"></a>

### 1. SOPs — ✅ closed 2026-09-22 (JTBD L1)

**Requirement:** Policies and SOPs should be distinguishable in the catalog — a regulation's binding legal text is a different kind of thing from an enterprise's own internal operating procedure, even though a human eventually complies with both.

**Implementation:** Both are stored as `Control` nodes; policy/SOP content is folded into `Control.controlType = 'policy-sop'` — a reasonable domain-consistent default given neither source carries a discriminator. `controlType` itself still doesn't split Policy from SOP (that finding stands).

**Resolution:** Added a `docType: policy | sop` column to the 15 `cli/feeds/csv/knowledge/controls.csv` rows (an editorial split, since neither source dataset carries a real discriminator — see the file's inline split) and a matching `docType` prop on `Control` in `cli/semantic-contract/contracts/v2.ts`. The 30 `:Catalog`-labeled Control rows never populate it, so `controlType`'s unrelated Preventive/Detective/Corrective vocabulary for that feed is untouched.

<a id="gap-2"></a>

### 2. Applicability Scoping — ⚪ by-design, not a gap (JTBD L2)

**Requirement:** Every enterprise asset in scope for a compliance area should be linked to at least one control that covers it — and `foundation.md` §2 explicitly requires that an uncovered asset be **queryable as a known gap**, distinct from "not yet checked."

**Implementation:** 29 of 31 enterprise assets are mapped to a covering control (`Asset → Control → Obligation`). The 2 remaining — both in the `Security` compliance area — are `foundation.md` §2's own worked example of "documented absence as a first-class state."

**Gap:** None. This is not an omission to close — it's the platform correctly proving it can represent and surface a real coverage gap instead of hiding it.

**Feed Datum Missing:** N/A — deliberately not filled. Backfilling coverage here via the feed generator would erase the one live example of `foundation.md`'s documented-absence requirement.

**Resolution:** None needed. If the business later decides Security should have a real control, that's a deliberate catalog decision, not a data-completeness fix.

<a id="gap-3"></a>

### 3. 52-Week Calendar — ✅ closed 2026-09-22 (JTBD L3)

**Requirement:** The Planner needs a full annual calendar of compliance work — every control's recurring due dates, scheduled and assigned — and needs to know not just what's due but what's actually been done, to know whether the enterprise is on schedule.

**Implementation:** 50 recurring tasks are generated and scheduled, each traceable back to the regulation it exists to satisfy, shown in the Calendar view.

**Resolution:** Added `PATCH /execution/tasks/:id` (`api/modules/execution/{index,repo,spec}.ts`, a fixed `open`/`in-progress`/`done`/`closed` vocabulary, fails fast on any other value) plus a per-row status `<select>` in `ui/src/features/calendar/calendar.tsx`. Catalog `:Catalog` Tasks now carry a real `status` from the seed (`cli/scripts/convert-catalog-seed.ts`): `open` for the 50 Fixed-schedule tasks, `closed` for the 10 event/risk/AI-triggered ones with no `Schedule`. Those 10 now reactivate on their real trigger — 8 Sensor/Event/Condition-triggered via the live Signal ingress (`api/modules/operational/repo.ts`'s `CREATE_SIGNAL_AND_TASK`, keyed on shared `Control` coverage), 2 Risk/AI-triggered via `agents/tools/graph-write.ts`'s `reactivateRiskAndAiTriggeredTasks()`, called once per `agents/scheduler.ts` cycle (pure graph read/write, no Ollama call, adds no serialization risk). Verified live: firing a Signal against an Asset covered by `CTRL-004` flipped `TSK-0008` (a closed, non-Fixed Task on that Control) to `open` with `lastTriggeredAt` set.

<a id="gap-4"></a>

### 4. `HAS_ROLE` — ✅ closed 2026-09-22 (JTBD L3)

**Requirement:** Every Person should resolve to a real seeded Role via their job title, so responsibility for a control or task traces to an actual role in the org.

**Implementation:** `Person`/`Role`/`Organization` are live; `WORKS_AT` (Person→Facility) fires, and `HAS_ROLE` (Person→Role) now fires too. The matching logic itself (`v2.ts:315`, `sourceField: 'roleId'`) was already correct — it just needed `roleId` populated with a real, matching value.

**Resolution:** New `cli/scripts/lib/title-role-map.ts`'s `TITLE_TO_ROLE` maps each of the 6 mappable free-text job titles to the nearest functional-domain equivalent among the 16 seeded Roles (e.g. `Corporate EHS → EHS Manager (Regional)`), each justified inline; `generate-person-seed.ts` now writes `roleId: TITLE_TO_ROLE[title] ?? ''`. `HAS_ROLE` fires for 6 of 7 people — `QA Executive` has no defensible equivalent and correctly stays unmapped (fail-soft, not a guess). Verified live: `MATCH (p:Person)-[:HAS_ROLE]->(r:Role)` returns 6 rows post-ingest.

<a id="gap-5"></a>

### 5. Escalation Paths — ✅ closed 2026-09-22, partial by design (JTBD L5)

**Requirement:** When an incident escalates, the platform should be able to trace who it escalates to, as a real chain through the org hierarchy — not just a name.

**Implementation:** `Incident.escalationPath` stays free text, unchanged, for audit fidelity — never mutated.

**Resolution:** Added `Incident -[:ESCALATES_TO {order}]-> Role`, populated by new `cli/scripts/generate-escalation-seed.ts` (registered in `cli/domains/enterprise/ingest-hints.json`'s `edgeMap`, so `Role` nodes exist by load time). Each `escalationPath` segment is mapped through `title-role-map.ts`'s `ESCALATION_TITLE_TO_ROLE` where a defensible functional-domain match exists; `order` is the segment's original 1-based position, never renumbered, so a gap in the sequence (e.g. orders 1, 2, 4 with no 3) is itself the documented signal of an unmapped hop — deliberately partial, not forced to 100% coverage (the escalation titles come from a different industrial vertical than the 16 seeded Roles, same as `HAS_ROLE`'s finding). Verified live: 9 `ESCALATES_TO` edges created across the 7 seeded Incidents.

<a id="gap-6"></a>

### 6. Audit-Ready Export — ⚪ by-design, minor feed opportunity (JTBD L6)

**Requirement:** Every audit-ready evidence package should say honestly whether it reflects real activity or example data — `foundation.md` §1's "attributed interpretation, not axiom" and §2's "every mapping carries provenance."

**Implementation:** `assurance-intelligence` proposes real evidence chains live for new activity, gated via Decision approve/reject. Every endpoint tags results `origin: 'agent-proposed' | 'synthetic'` — which is exactly the honest labeling `foundation.md` requires.

**Gap:** None behaviorally — the origin tagging is correct. The only residual is volume: just 7 synthetic seed Incidents exist to exercise the export path.

**Feed Datum Missing:** Optional — additional synthetic Incident records, if greater test scale is wanted. Not required to close a gap, since none exists.

**Resolution:** None required. Optionally extend the feed generator to produce more synthetic Incidents purely to stress-test the export path at volume — clearly still tagged `synthetic`, never presented as real.

<a id="gap-7"></a>

### 7. Scenario Simulation — 🔴 gap, code-only (JTBD L7)

**Requirement:** A Risk Manager should be able to ask "what happens if this control fails" and get a real answer — reasoning across risk, control, and signal intelligence together over the live graph.

**Implementation:** Nothing implements this. `ui/src/features/simulator/simulator.tsx` exists but only generates synthetic test Signals via `createSignal` — a test-data generator, not a what-if reasoning engine.

**Gap:** The one genuine ground-zero capability gap. Worth flagging on its own: the existing "Simulator" screen's name invites confusion with this capability and should be renamed or clearly scoped as a test-data tool.

**Feed Datum Missing:** N/A — this is a reasoning capability, not a data-completeness issue.

**Resolution:** Unscoped — needs its own backend (multiple agent families reasoning over shared graph state simultaneously) and its own screen, built from scratch (Phase 11).

<a id="gap-8"></a>

### 8. Onboarding-as-a-phase (§0) — 🟡 partial, two slices closed (2026-09-25, 2026-09-26)

**Requirement:** Bringing a new enterprise onto Vyra should run as a measured, visible transition — legacy and Vyra running in parallel, a clear per-workflow cutover criterion, an inferred-and-ratified org/role/asset blueprint, and a decommissioning decision made on evidence, including a **continuity baseline captured as graph data at day zero** (`foundation.md` §0).

**Implementation:** `CutoverCriterion` is a live node (`graph.md`'s Onboarding Graph section) — a workflow's target criterion, window (`dueBy`), and system-of-record are held as real graph state, human-proposed through the same Decision-gate discipline as `Contract` (`POST /onboarding/cutover-criteria` → pending Decision → approval creates the node). `foundation.md` §0's most concrete single claim — *"past that window it becomes a first-class, queryable `cutover-overdue` state"* — is real: `effectiveStatus` is derived live from `dueBy` vs. now(), never stamped, visible at `/onboarding`. `Blueprint` (2026-09-26) is now also live, closing `foundation.md` §2's "the blueprint is inferred and proposed, never self-asserted... ratified through the same Decision gate" for its first slice: a per-`Facility` proposal naming the `Role`s/`Asset`s it ratifies, validated referentially at proposal time (`POST /onboarding/blueprints` → pending Decision → approval creates the node with real `ABOUT`/`COVERS` edges), visible at `/onboarding`.

**Gap:** Still no shadow mode / dual-write parallel-run tracking, no continuity baseline, no decommissioning-as-a-Decision, and no real `Workflow` node — `CutoverCriterion.workflowName` is a plain string (documented exception: the one Decision-write path in the codebase with no `ABOUT` edge, since there's no real workflow entity to point at). `Blueprint`'s construction is still human-proposed only, not agent-inferred — no onboarding agent family exists yet (Phase 11, unscoped).

**Feed Datum Missing:** For the continuity-baseline piece specifically — a synthetic "pre-Vyra legacy" dataset (obligation coverage %, task cadence/completion rate, incident and escalation volumes as of a mock cutover date) that a feed-generator could produce and ingest as baseline nodes. Shadow mode and decommissioning remain pure workflow state — no feed fixes those.

**Resolution:** `CutoverCriterion` and `Blueprint` (these two slices) close the cutover-tracking and org/role/asset-ratification pieces. Still needed: `ContinuityBaseline` (+ its feed-generator), shadow-mode dual-tracking, decommissioning-as-a-Decision, a real `Workflow` node so `CutoverCriterion` can reference one instead of a free-text name, and an onboarding agent family so `Blueprint` proposals move from human-authored to agent-inferred. Each is its own future slice, not a batch fix.

<a id="gap-9"></a>

### 9. Domain model is anemic vs. `domain.md` — 🔴 gap, code-only

**Requirement:** Per `domain.md`, the platform's core entities (Regulation, Obligation, Control, Decision, ...) should behave as real domain objects — enforcing their own invariants, raising events when meaningful state changes — not just rows fetched and handed back as-is.

**Implementation:** `api/modules/*/repo.ts` are plain functions running Cypher and returning raw `properties(n)` bags; the only behavior-shaped code is two `spec.ts` validation-predicate files.

**Gap:** None of `domain.md`'s Aggregates, Domain Events, or Factories exist in code — they describe an intended design, not what's built.

**Feed Datum Missing:** N/A — pure architecture, unrelated to data completeness.

**Resolution:** Not a single-file fix. Introducing real entity behavior at the repo boundary is an architecture decision to make deliberately, not a side effect of closing another gap.

<a id="gap-10"></a>

### 10. Onboarding UI is ingestion-only — ✅ closed 2026-09-22, Contract slice only

**Requirement:** Not every enterprise's org/role/facility/asset structure should have to arrive as a clean CSV — a human should be able to build or correct that structure interactively, proposed and ratified the same way an agent's recommendation already is (`foundation.md` §2).

**Implementation:** `Organization`/`Role`/`Person`/`Facility`/`Asset`/`Vendor` are still seeded entirely by CSV batch. `Contract` now has a live write path.

**Resolution:** Scoped to `Contract` as the first slice (the other 6 enterprise entity types remain read-only — deliberately, not by oversight). `POST /enterprise/contracts` (`api/modules/enterprise/{repo,spec,index}.ts`) never writes a `Contract` directly — Contracts, like Regulations, are immutable sources of truth (user-confirmed constraint, 2026-09-21): it always creates a `pending` `Decision {type: 'contract-proposal', origin: 'human'}`. Approving it via the already-live `POST /intelligence/decisions/:id/approve` (`api/modules/intelligence/repo.ts`'s new `contract-proposal` branch) creates a **new** `Contract:HumanProposed` node; for an amendment (`priorContractId` given), the only write to the prior Contract is `SET supersededBy` — its terms are never touched. `ui/src/features/enterprise/contracts.tsx` gained a proposal form. Verified live end to end: proposed a new contract, approved it, proposed an amendment against it, approved that too, and confirmed via direct Cypher that the original Contract's `serviceType` was unchanged while `supersededBy` pointed at the new version.

<a id="gap-11"></a>

### 11. `Signal` has no "Who" — ✅ closed 2026-09-22

**Requirement:** Every operational signal should answer all four of What, When, Where, and Who raised it.

**Implementation:** A create-Signal screen exists (`simulator.tsx`'s Signals tab), covering What (`type`/`payload`), When (`timestamp`), Where (`assetId`); other optional fields already default sensibly (`source` → `'UNKNOWN'`, matching this platform's own fallback convention).

**Resolution:** Added `Signal.raisedBy` (required) + `Signal -[:RAISED_BY]-> Person` — reusing `Person`, not the designed-but-not-active `Actor` (building that polymorphic type for one edge would be scope creep; `Person` is the only concrete, live human-actor node today). `api/modules/operational/spec.ts` and `guardSignalInput` in `repo.ts` **throw** if `raisedBy` is missing or doesn't resolve to a real Person — no `'UNKNOWN'` fallback, per the original finding that an unattributed signal is a materially weaker audit record. `ui/src/features/simulator/simulator.tsx`'s Signals tab gained a required "Reported by" picker. Verified live: a Signal posted without `raisedBy` gets a 400; with a bogus id, a 400; with a real `Person.id`, a 201 with the `RAISED_BY` edge written.

<a id="gap-12"></a>

### 12. Catalog versioning is scaffolded, not exercised — ✅ closed 2026-09-22

**Requirement:** A regulation that's revised or repealed should be superseded, never silently replaced, so the platform can always answer "what did we believe was true on any past date" (`foundation.md` §1).

**Implementation:** `catalogVersion`/`effectiveFrom`/`supersededBy` exist as real properties on catalog nodes, and are now exercised.

**Resolution:** `cli/scripts/convert-catalog-seed.ts` now generates a real second version, `REG-001-V2` (`catalogVersion: '2.0'`, `effectiveFrom: '2026-01-01'`), with `REG-001` carrying `supersededBy: 'REG-001-V2'`. Every other regulation keeps `catalogVersion: '1.0'`, `supersededBy: ''`. New `GET /knowledge/regulations/:id/history` returns the version chain, surfaced in the new `ui/src/features/knowledge/knowledge.tsx`'s version-history strip. Verified live via direct Cypher post-ingest.

<a id="gap-13"></a>

### 13. No source-span retention on catalog text — ✅ closed 2026-09-22

**Requirement:** An auditor asking "where does this obligation come from" should get the exact source text — document, version, and location within it — not a citation string (`foundation.md` §1).

**Implementation:** `Clause`/`Obligation` now carry `sourceDocumentId`/`sourceAnchor`.

**Resolution:** `convert-catalog-seed.ts` synthesizes `sourceDocumentId: '<RegulationID|StandardID>-DOC'` and `sourceAnchor: 'Clause <Clause Number>'` per Clause from `05_Clauses`' real `Source ID`/`Clause Number` columns (the actual in-document locator the source has, not a fabricated page number it doesn't); each Obligation inherits its parent Clause's span. Schema fields added to `v2.ts`. Surfaced as a "Source" line per chain link in the new Knowledge UI feature. Verified live: `CLA-0001` → `sourceDocumentId: 'STD-008-DOC'`, `sourceAnchor: 'Clause 17.7'`.

<a id="gap-14"></a>

### 14. No sync-run attribution on catalog nodes/edges — ✅ closed 2026-09-22

**Requirement:** "How current is our regulatory posture" should be a question the platform can answer on demand (`foundation.md` §1).

**Implementation:** Every batch-synced node and edge now carries `syncedAt`/`sourceRevision`.

**Resolution:** `cli/runtime/repo.ts`'s `loadNodes`/`loadEdges` stamp `syncedAt` (write-time `datetime()`) and `sourceRevision` (the semantic contract's `v2.version`) unconditionally, on both `ON CREATE` and `ON MATCH` — never optional. New `GET /knowledge/sync-status` exposes the graph-wide `max(syncedAt)`, surfaced in the new Knowledge UI as "last synced." Verified live: 571 nodes carry `syncedAt` post-ingest.

<a id="gap-15"></a>

### 15. `COVERED_BY` edges carry no provenance — ✅ closed 2026-09-22

**Requirement:** Every asset-control mapping should say how it was made — inferred, declared, or backfilled — so it can be trusted or questioned (`foundation.md` §2).

**Implementation:** `COVERED_BY` edges now carry `origin`/`confidence`/`derivedAt`.

**Resolution:** `cli/scripts/backfill-asset-control.ts`'s one writer now stamps `origin: 'inferred'`, `confidence: 0.6` (a documented fixed constant — taxonomy-only inference, not a validated per-asset review), and `derivedAt: datetime()` unconditionally (not just `ON CREATE`, so a rerun also backfills provenance onto edges written before this fix). Verified live: all 101 `COVERED_BY` edges carry `origin: 'inferred'`, `confidence: 0.6`.

<a id="gap-16"></a>

### 16. Agent reasoning is single-shot, not multi-turn/tool-using — ✅ closed 2026-09-22, `control-intelligence` only

**Requirement:** An agent should decide what to look at next in the graph across multiple steps before acting, not answer from one fixed prompt (`foundation.md` §3).

**Implementation:** `reasonWithLLM` is unchanged and still one-shot; `control-intelligence` now has a multi-turn alternative.

**Resolution:** New, additive `agents/runtime/index.ts`'s `reasonWithTools(prompt, tools, toolRegistry, extraSchema?, maxTurns=3)` — a bounded, strictly sequential tool-calling loop (every extra turn is another awaited Ollama call *inside* one `reason()` invocation, so it adds no concurrency against the single-shared-model constraint `agents/scheduler.ts` already enforces). New `agents/tools/graph-read.ts`'s `TOOL_REGISTRY` allowlist wraps `fetchControlsForObligation`. `control-intelligence` is the one family wired to it so far, as a deliberate minimal-first-slice (same reasoning as Gap #10's Contract-only scope) — the other 3 families still use `reasonWithLLM` unchanged. Verified live against the real local Ollama model with a standalone script: the log line `runtime: reasonWithTools calling tool checkWeather` confirmed the mid-reasoning round trip fired and the final answer correctly incorporated the tool result. (Not exercisable through the live agent itself in this pass — the seed graph currently has zero uncontrolled Obligations left for `control-intelligence` to observe.)

<a id="gap-17"></a>

### 17. No learning-from-overrides feedback loop — ✅ closed 2026-09-22, `control-intelligence` only

**Requirement:** A human's rejection or correction of an agent's proposal should shape that agent family's future reasoning — otherwise "Learn" in the agent lifecycle is aspirational (`foundation.md` §3).

**Implementation:** `Decision.status` history now feeds back into `control-intelligence`'s prompt.

**Resolution:** `Decision` gained `origin: 'agent'` (stamped unconditionally by `writeDecision`) / `'human'` (stamped by the new `proposeContractChange`), so an agent family's agreement rate excludes human-authored proposals. New `GET /intelligence/decisions/agreement-rates` (`api/modules/intelligence/repo.ts`'s `getAgreementRates`) and `agents/tools/graph-read.ts`'s `fetchAgreementRate(agentId)` compute approved/rejected tallies; `control-intelligence` fetches its own rate once per `run()` cycle and interpolates it into the reasoning prompt. New Agreement Rates panel in `ui/src/features/intelligence/intelligence.tsx`. The other 3 families don't consume their rate yet — scoped the same way as Gap #16. Pre-existing Decisions predate `origin` and are correctly excluded from the stat (`origin: null`), not miscounted.

---

**Net**: rows 1–7 are the existing JTBD partial/gap set, restated in Requirement/Implementation/Gap/Feed-Datum/Resolution form. Rows 8–17 are net-new, from a requirement-by-requirement audit of every `foundation.md` §0–§4 table row against the codebase. **Two rows were reclassified on this pass**: #2 (Applicability Scoping) and #6 (Audit-Ready Export) are **not gaps** — both are `foundation.md` requirements already correctly implemented (documented absence, honest provenance tagging respectively) and are listed for traceability only.

**2026-09-22: 12 of the remaining 15 gaps closed in one batch** — #1, #3, #4, #5, #10, #11, #12, #13, #14, #15, #16, #17 (the last two scoped to `control-intelligence` only; #5, #10, #16 closed partially/scoped by design, documented above; every other one fully closed). **#8 (Onboarding-as-a-phase), #9 (anemic domain model), and #7 (Scenario Simulation)** remained open, excluded from this batch by explicit decision — each is Phase-11-class work needing its own dedicated design pass, not a batch fix. **2026-09-25: #8 gets its first real slice** (`CutoverCriterion`, above) — partial, not closed. **2026-09-26: #8 gets a second slice** (`Blueprint`, above) — still partial; `ContinuityBaseline`/shadow-mode/decommissioning still need their own passes. **#9 (anemic domain model) and #7 (Scenario Simulation)** remain fully open. Of those two, **#7 Scenario Simulation is the one true ground-zero JTBD gap** (see the JTBD Layer Status table above); #9 is an architecture/subsystem decision.

---

## Where to go next

- **Why this must be agentic at all** (no status) → `foundation.md`
- **Model, value and guarantees** (no status) → `foundation.md`
- **Phase sequencing, what's done, what's next, verification** → `plan.md`
- **Schema, relationships, live/dormant status, Cypher patterns** → `graph.md`
- **Software layers & components** → `architecture.md`
