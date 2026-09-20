# Vyra Build Tracker

**The current build status of Vyra, mapped to the 7-layer GRC operating model** — what's live, what's partial, what's still a gap, right now. This is the *tracking* view, deliberately kept out of `foundation.md` so the specification stays a clean model/value/guarantees read without build-status noise.

> **Audience: internal** — engineering and product. For the operating model itself (personas, capabilities, the loop) with no status, read `foundation.md`. For *why* an item sits where it does and what unblocks it, follow the phase references into `plan.md`.

**Keep this in sync with the plan on every phase — it drifts otherwise.** When a phase changes a layer's status, update the matching row here *and* the "Net" summary below. `plan.md` is the authoritative source for phase completion; this doc is a layer-readiness lens over it, not a second source of truth.

---

## Phase rollup

**Phases 0–9 are ✅ done**, plus three standalone closures: the L1 Contract entity, a Gap Review (Escalation Paths / `HAS_ROLE` / SOPs — all confirmed to have no real closure path), and an Intelligence-UI usability pass. **Phases 10–11 ("Agentic Completion Track") are 🔲 planned, not started.** Sequencing and open decisions → `plan.md`. Full per-phase narrative and verification evidence → `.design/__ref/implementation-history.md`.

---

## JTBD Layer Status

One row per capability from `foundation.md`'s 7-layer operating model, scored on **whether the graph can actually feed it right now.** The layer/persona/capability definitions themselves live in the foundation doc — this table only adds the status lens, in plain language. Where a row is 🟡/🔴, "What This Means" cross-references the matching numbered Gap in the Onboarding Readiness section below for the full Requirement/Implementation/Gap/Resolution writeup — it isn't repeated here. Full investigation detail behind any 🟡/🔴 row → `.design/__ref/implementation-history.md`.

Status key: **🟢 live** = real data, working queries · **🟡 partial** = modeled but incomplete or unstructured · **🔴 gap** = nothing built.

| L | Layer | Capability | Status | What This Means |
|---|---|---|---|---|
| L1 | **Knowledge** | Regulations | 🟢 live | Regulations from both the shared catalog and this enterprise's own data are loaded and queryable. |
| | | Standards | 🟢 live | Industry standards from the shared catalog are loaded and queryable. |
| | | Contracts | 🟢 live | Vendor contracts are loaded with real links to the vendors, coordinators, and facilities they cover — visible at `/enterprise/contracts`. Contracts aren't yet linked to the controls they might require. |
| | | SOPs | 🟡 closed-by-decision | Standard operating procedures aren't distinguished from formal policies — see **Gap #1** below. |
| L2 | **Interpret** | Applicability Scoping | 🟡 partial | Most enterprise assets are linked to a control that covers them; 2 Security-area assets aren't — see **Gap #2** below. |
| | | Obligation Linkage | 🟡 partial | Every obligation traces back to the regulation/standard clause it comes from, and every control traces to the obligation it satisfies, scoped down to the asset it covers. Marked partial because it inherits Applicability Scoping's 2-asset gap above, not a separate issue. |
| L3 | **Planning** | 52-Week Calendar | 🟡 partial | 50 recurring compliance tasks are scheduled and shown in the Calendar view, each traceable back to its regulation. There's no way to mark a task done yet, and 10 event-triggered tasks aren't wired up — see **Gap #3** below. |
| | | Location + Role Assign | 🟡 closed-by-decision | Org structure, roles, and people are all loaded, but people aren't actually linked to their seeded role — see **Gap #4** below. |
| L4 | **CTN Knowledge Graph Spine** — Capture • Review | *(the graph itself)* | 🟢 live (as infrastructure) | This layer is the graph itself — every other layer reads and writes through it. "Review" means a real human approve/reject step exists before an agent's proposal becomes permanent. |
| L5 | **Oversight** | Deviation Alerts | 🟢 live | The platform watches incoming operational signals continuously and raises a reviewable decision when something looks off, without creating duplicates on repeat checks. |
| | | Escalation Paths | 🟡 closed-by-decision | Incidents record who they escalate to as free text only, not a traceable chain through the org — see **Gap #5** below. |
| L6 | **Assurance** | Coverage Scoring | 🟢 live | The platform can state, right now, how many obligations and assets actually have a covering control (30/34 obligations, 29/31 assets) — visible at `/assurance`. |
| | | Audit-Ready Export | 🟡 partial | The platform now builds real evidence chains for new activity, gated by human approval. The original 7 incidents behind the first version of this feature are still test data, not real — see **Gap #6** below. |
| L7 | **Risk** | Residual Risk Score | 🟡 partial | Every finding gets a risk score, rolled up into a portfolio-level view, and the platform proposes scores for newly-arrived findings automatically. Marked partial because scoring is applied incrementally as new findings arrive rather than as a single verified pass across the whole portfolio. |
| | | Scenario Simulation | 🔴 gap | There's no way yet to ask "what happens if this control fails" and get a real answer — see **Gap #7** below. |

**Net**: Phases 0–9 + the L1 Contracts addition are live. The remaining partial/gap items — SOPs, full Applicability Scoping, `HAS_ROLE`, task-completion tracking, Escalation Paths, Audit-Ready Export's synthetic original 7 — were each investigated and confirmed to have no real, non-fabricated closure path today, not left by oversight. **L7 Scenario Simulation** is the one genuine open gap. Full evidence for every investigated item → `.design/__ref/implementation-history.md`'s Gap Review.

---

## Onboarding Readiness — Gap Inventory

**Distinct from the JTBD Layer Status above.** That table scores whether the 7 operating-model *layers* are fed by live data. This section scores whether the platform could actually onboard a new enterprise end-to-end per `foundation.md` §0's transition guarantee — compiled 2026-09-20, ahead of a first real onboarding attempt, revised 2026-09-20 to separate feed gaps from code gaps.

**`foundation.md` is the master spec; every Requirement below is traced to it.** This is a greenfield project — every row in every seed CSV is simulated data, not a live regulatory or enterprise feed. That changes what "closing a gap" means: where something is missing only because the *synthetic feed* never populated it, the fix is a **feed-generator** addition, not new application code. Where the platform genuinely lacks a capability regardless of data completeness (a screen, a route, a reasoning loop), that's a **code gap**. Some rows need both. And where the code already declines to fabricate a value it wasn't given (fails soft/throws) or falls back to a domain-consistent default (`'UNKNOWN'`, etc.), that's correct behavior already — not a gap to fix by writing more code, only by feeding it real data.

Each gap is stated as: what `foundation.md` actually requires (**Requirement**), what's true today in plain terms (**Implementation**), what's missing and why it matters (**Gap**), the specific datum the synthetic feed would need to carry, if any (**Feed Datum Missing**), and what actually closes it (**Resolution**).

Status tags used below: 🟡 **partial** = real but incomplete · 🔴 **gap** = nothing built · ⚪ **by-design** = correctly implements a `foundation.md` requirement already — not an open item, listed for traceability only.

> **Cross-cutting fact that shapes most code-side Resolutions below**: the entire API has exactly two write routes — `POST /operational/signals` and `POST /intelligence/decisions/:id/{approve,reject}`. Every other route, across all 8 modules, is read-only, and no `PATCH`/`PUT` exists anywhere. So wherever a Resolution calls for "a screen to do X," it also implies a mutation route that doesn't exist yet.

### 1. SOPs — 🟡 partial, feed-fixable (JTBD L1)

**Requirement:** Policies and SOPs should be distinguishable in the catalog — a regulation's binding legal text is a different kind of thing from an enterprise's own internal operating procedure, even though a human eventually complies with both.

**Implementation:** Both are stored as `Control` nodes; policy/SOP content is folded into `Control.controlType = 'policy-sop'` — a reasonable domain-consistent default given neither source carries a discriminator.

**Gap:** Neither source dataset carries a Policy-vs-SOP discriminator, so the merge is the only honest option today.

**Feed Datum Missing:** A `docType: policy | sop` column (or equivalent) per Control/SOP row — doesn't exist in either source CSV.

**Resolution:** Write a feed-generator step that assigns a real discriminator per row, then have the CLI read it instead of folding to one type. Until that datum exists, keep the merged default — that's the correct fallback, not a bug.

### 2. Applicability Scoping — ⚪ by-design, not a gap (JTBD L2)

**Requirement:** Every enterprise asset in scope for a compliance area should be linked to at least one control that covers it — and `foundation.md` §2 explicitly requires that an uncovered asset be **queryable as a known gap**, distinct from "not yet checked."

**Implementation:** 29 of 31 enterprise assets are mapped to a covering control (`Asset → Control → Obligation`). The 2 remaining — both in the `Security` compliance area — are `foundation.md` §2's own worked example of "documented absence as a first-class state."

**Gap:** None. This is not an omission to close — it's the platform correctly proving it can represent and surface a real coverage gap instead of hiding it.

**Feed Datum Missing:** N/A — deliberately not filled. Backfilling coverage here via the feed generator would erase the one live example of `foundation.md`'s documented-absence requirement.

**Resolution:** None needed. If the business later decides Security should have a real control, that's a deliberate catalog decision, not a data-completeness fix.

### 3. 52-Week Calendar — 🔴 gap, code-only (JTBD L3)

**Requirement:** The Planner needs a full annual calendar of compliance work — every control's recurring due dates, scheduled and assigned — and needs to know not just what's due but what's actually been done, to know whether the enterprise is on schedule.

**Implementation:** 50 recurring tasks are generated and scheduled, each traceable back to the regulation it exists to satisfy, shown in the Calendar view.

**Gap:** There is no way anywhere in the platform to mark a task completed. The Calendar page (`ui/src/features/calendar/calendar.tsx`) is read-only — its only interactive elements are refresh/retry buttons — and `execution/index.ts` has no status-change route. Separately, 10 of 60 tasks are meant to fire from a real-world trigger (an incident, a sensor reading) rather than a fixed date, and nothing creates them when that trigger occurs.

**Feed Datum Missing:** N/A on both counts. Task completion is runtime state that only exists after seeding — no CSV column could represent it. The 10 event-triggered tasks are already correctly classified in the source feed (`13_Schedule_Rules`'s `Schedule Type`); what's missing is a listener to act on that classification, not more data.

**Resolution:** Add `PATCH /execution/tasks/:id` plus a status control in `calendar.tsx` — the interface should require a valid status value (fail fast on garbage input) rather than silently accepting anything. Add a trigger listener alongside `agents/scheduler.ts`'s existing time-based polling that creates the Task when its event condition fires.

### 4. `HAS_ROLE` — 🟡 partial, feed-fixable (JTBD L3)

**Requirement:** Every Person should resolve to a real seeded Role via their job title, so responsibility for a control or task traces to an actual role in the org.

**Implementation:** `Person`/`Role`/`Organization` are live; `WORKS_AT` (Person→Facility) fires, but `HAS_ROLE` (Person→Role) never does. The code already does the right thing here: `cli/scripts/generate-person-seed.ts:70` explicitly declines to force a match — *"Forcing a match would be a guess; HAS_ROLE simply doesn't fire for these rows."*

**Gap:** None of the seeded Persons' free-text job titles match any of the 16 seeded Role names — the code fails soft (skips) rather than fabricating a link, which is correct.

**Feed Datum Missing:** Person role-title values that actually correspond to one of the 16 seeded Role names (or a shared `roleId` join key) — the current Person source uses a different vertical's title vocabulary entirely.

**Resolution:** Write a feed-generator step that assigns each synthetic Person a title drawn from (or mapped to) the seeded Role vocabulary, so `HAS_ROLE` has something real to match against. No code change needed — the matching logic is already correct.

### 5. Escalation Paths — 🟡 partial, feed + schema (JTBD L5)

**Requirement:** When an incident escalates, the platform should be able to trace who it escalates to, as a real chain through the org hierarchy — not just a name.

**Implementation:** `Incident.escalationPath` is carried through from the source CSV as free text, unchanged (`cli/semantic-contract/contracts/v2.ts:214`).

**Gap:** The text never matches any seeded Role, and — separately — there's no schema slot to hold a structured chain even if it did. This is two things, not one: missing data, and nowhere to put better data if it existed.

**Feed Datum Missing:** A structured escalation chain (e.g. an ordered list of Role ids) instead of free text.

**Resolution:** Add a schema shape for a structured escalation chain (e.g. `Incident -[:ESCALATES_TO {order}]-> Role`) — this doesn't exist today, no amount of feed generation helps without it — then generate feed data that populates it using the seeded Role vocabulary.

### 6. Audit-Ready Export — ⚪ by-design, minor feed opportunity (JTBD L6)

**Requirement:** Every audit-ready evidence package should say honestly whether it reflects real activity or example data — `foundation.md` §1's "attributed interpretation, not axiom" and §2's "every mapping carries provenance."

**Implementation:** `assurance-intelligence` proposes real evidence chains live for new activity, gated via Decision approve/reject. Every endpoint tags results `origin: 'agent-proposed' | 'synthetic'` — which is exactly the honest labeling `foundation.md` requires.

**Gap:** None behaviorally — the origin tagging is correct. The only residual is volume: just 7 synthetic seed Incidents exist to exercise the export path.

**Feed Datum Missing:** Optional — additional synthetic Incident records, if greater test scale is wanted. Not required to close a gap, since none exists.

**Resolution:** None required. Optionally extend the feed generator to produce more synthetic Incidents purely to stress-test the export path at volume — clearly still tagged `synthetic`, never presented as real.

### 7. Scenario Simulation — 🔴 gap, code-only (JTBD L7)

**Requirement:** A Risk Manager should be able to ask "what happens if this control fails" and get a real answer — reasoning across risk, control, and signal intelligence together over the live graph.

**Implementation:** Nothing implements this. `ui/src/features/simulator/simulator.tsx` exists but only generates synthetic test Signals via `createSignal` — a test-data generator, not a what-if reasoning engine.

**Gap:** The one genuine ground-zero capability gap. Worth flagging on its own: the existing "Simulator" screen's name invites confusion with this capability and should be renamed or clearly scoped as a test-data tool.

**Feed Datum Missing:** N/A — this is a reasoning capability, not a data-completeness issue.

**Resolution:** Unscoped — needs its own backend (multiple agent families reasoning over shared graph state simultaneously) and its own screen, built from scratch (Phase 11).

### 8. Onboarding-as-a-phase (§0) — 🔴 gap, mostly code + one feed piece

**Requirement:** Bringing a new enterprise onto Vyra should run as a measured, visible transition — legacy and Vyra running in parallel, a clear per-workflow cutover criterion, and a decommissioning decision made on evidence, including a **continuity baseline captured as graph data at day zero** (`foundation.md` §0).

**Implementation:** None. No shadow mode, no continuity baseline, no cutover criteria, no decommissioning workflow exist anywhere in the code (`cutover`/`shadowMode`/`continuityBaseline`/`decommission` — zero hits across `api/`, `agents/`, `cli/`, `lib/`).

**Gap:** There is no concept of "onboarding a new enterprise" anywhere in the platform — not even a status screen showing where a workflow sits in its transition.

**Feed Datum Missing:** For the continuity-baseline piece specifically — a synthetic "pre-Vyra legacy" dataset (obligation coverage %, task cadence/completion rate, incident and escalation volumes as of a mock cutover date) that a feed-generator could produce and ingest as baseline nodes. Shadow mode, cutover criteria, and decommissioning are pure workflow state — no feed fixes those.

**Resolution:** A new subsystem, not a small fix: graph state for shadow mode / cutover criteria per workflow, API routes to read and write it, and an onboarding-status screen — plus the baseline feed-generator above to make the continuity claim provable rather than asserted. Phase 11-class work to sequence deliberately.

### 9. Domain model is anemic vs. `domain.md` — 🔴 gap, code-only

**Requirement:** Per `domain.md`, the platform's core entities (Regulation, Obligation, Control, Decision, ...) should behave as real domain objects — enforcing their own invariants, raising events when meaningful state changes — not just rows fetched and handed back as-is.

**Implementation:** `api/modules/*/repo.ts` are plain functions running Cypher and returning raw `properties(n)` bags; the only behavior-shaped code is two `spec.ts` validation-predicate files.

**Gap:** None of `domain.md`'s Aggregates, Domain Events, or Factories exist in code — they describe an intended design, not what's built.

**Feed Datum Missing:** N/A — pure architecture, unrelated to data completeness.

**Resolution:** Not a single-file fix. Introducing real entity behavior at the repo boundary is an architecture decision to make deliberately, not a side effect of closing another gap.

### 10. Onboarding UI is ingestion-only — 🔴 gap, code-only

**Requirement:** Not every enterprise's org/role/facility/asset structure should have to arrive as a clean CSV — a human should be able to build or correct that structure interactively, proposed and ratified the same way an agent's recommendation already is (`foundation.md` §2).

**Implementation:** `Organization`/`Role`/`Person`/`Facility`/`Asset`/`Vendor`/`Contract` are seeded entirely by CSV batch (`enterprise-sync.ts`).

**Gap:** Confirmed read-only end to end — `ui/src/app/enterprise/contracts/page.tsx` and `features/enterprise/contracts.tsx` contain no form and no write call, and the entire `enterprise` API module is GET-only.

**Feed Datum Missing:** N/A — this is a missing capability, not missing data; better seed data wouldn't add a write path.

**Resolution:** Add mutation routes for enterprise entities and interactive forms under `ui/src/app/enterprise`, following the same propose → Decision-gate → ratify pattern already live for Control/Finding proposals (Phase 7).

### 11. `Signal` has no "Who" — 🔴 gap, code-only

**Requirement:** Every operational signal should answer all four of What, When, Where, and Who raised it.

**Implementation:** A create-Signal screen exists (`simulator.tsx`'s Signals tab), covering What (`type`/`payload`), When (`timestamp`), Where (`assetId`); other optional fields already default sensibly (`source` → `'UNKNOWN'`, matching this platform's own fallback convention).

**Gap:** Neither the form nor the schema has a place for Who at all — `CreateSignalInput` carries no actor/reporter field, so there's nothing to default *or* capture.

**Feed Datum Missing:** N/A — `Signal` has no CSV feed; it's written live by the events sink, so this is purely a schema/API/UI gap, not a data one.

**Resolution:** Add a `Signal -[:RAISED_BY]-> Actor` edge (the `Human`/`Agent` polymorphic Actor idiom `domain.md` already proposes elsewhere) to the schema and the `/operational/signals` write path — make it required and throw if absent, rather than defaulting Who to `'UNKNOWN'`, since an unattributed signal is a materially weaker audit record than an unattributed source string. Then add the field to the existing create-Signal form.

### 12. Catalog versioning is scaffolded, not exercised — 🟡 partial, feed-fixable

**Requirement:** A regulation that's revised or repealed should be superseded, never silently replaced, so the platform can always answer "what did we believe was true on any past date" (`foundation.md` §1).

**Implementation:** `catalogVersion`/`effectiveFrom`/`supersededBy` exist as real properties on catalog nodes.

**Gap:** `catalogVersion` is hardcoded `'1.0'` by our own feed converter (`cli/scripts/convert-catalog-seed.ts:100-129`) — not an upstream limitation, a choice our synthetic generator makes — and `supersededBy` has never been set because no second version has ever been generated to supersede the first.

**Feed Datum Missing:** A genuine second version of at least one regulation — a revised row with a reason, linked back to the original via `supersededBy` — doesn't exist in the source feed today.

**Resolution:** Extend the feed generator to produce one real revision (e.g. "REG-001 v2") and wire `supersededBy` between old and new during conversion instead of hardcoding `'1.0'` unconditionally. Once real, add a version-history view.

### 13. No source-span retention on catalog text — 🔴 gap, feed + schema

**Requirement:** An auditor asking "where does this obligation come from" should get the exact source text — document, version, and location within it — not a citation string (`foundation.md` §1).

**Implementation:** None. Clauses and obligations carry no pointer to their originating document.

**Gap:** No `sourceSpan`/document/anchor concept exists anywhere in ingestion or the graph — and there's nowhere to put one even if the feed had it.

**Feed Datum Missing:** A source document/version/anchor (or page/section locator) per Clause/Obligation row — the current source CSV has clause text (`Clause Text (Synthetic)`) but no locator pointing back to where that text supposedly came from.

**Resolution:** Add `SourceSpan` properties to `Clause`/`Obligation` in the schema (currently absent), then extend the feed generator to produce a plausible document/anchor per row, and add a source-excerpt view to the clause/obligation detail screen.

### 14. No sync-run attribution on catalog nodes/edges — 🔴 gap, code-only

**Requirement:** "How current is our regulatory posture" should be a question the platform can answer on demand (`foundation.md` §1).

**Implementation:** Catalog sync runs (`catalog-sync.ts`) populate nodes, but nothing records when a given sync happened.

**Gap:** No `syncedAt`/`sourceRevision` property exists anywhere.

**Feed Datum Missing:** N/A — this is process metadata the sync script itself should generate at run time (a timestamp, a revision counter), not something any feed would supply.

**Resolution:** Stamp each synced node/edge with `syncedAt`/`sourceRevision` unconditionally in the sync write path — this should never be optional or defaulted, since a missing sync stamp on a synced node is itself a bug, not an absent-input case. Then surface "last synced" on the Knowledge/Catalog screens.

### 15. `COVERED_BY` edges carry no provenance — 🔴 gap, code-only

**Requirement:** Every asset-control mapping should say how it was made — inferred, declared, or backfilled — so it can be trusted or questioned (`foundation.md` §2).

**Implementation:** `COVERED_BY` edges exist and drive coverage scoring.

**Gap:** The one writer, `cli/scripts/backfill-asset-control.ts:20`, writes a bare `MERGE` with zero properties.

**Feed Datum Missing:** N/A — provenance here (origin `'inferred'`, a confidence value, a timestamp) is knowledge the backfill script already has about its own behavior; no feed could supply "how confident was this heuristic."

**Resolution:** The script should stamp `origin: 'inferred'`, a confidence value, and a timestamp on every edge it writes, unconditionally — this is a fixed code change, not something that depends on data availability.

### 16. Agent reasoning is single-shot, not multi-turn/tool-using — 🔴 gap, code-only

**Requirement:** An agent should decide what to look at next in the graph across multiple steps before acting, not answer from one fixed prompt (`foundation.md` §3).

**Implementation:** `agents/runtime/index.ts:55-83`'s `reasonWithLLM` sends one prompt to Ollama and parses one JSON reply; confirmed in `control-intelligence`'s `reason` step, which builds one static prompt with no follow-up graph reads.

**Gap:** True platform-wide — every agent family shares this one-shot primitive.

**Feed Datum Missing:** N/A — a reasoning-capability gap, not a data gap; more or better seed data doesn't change how many times the agent can query it per decision.

**Resolution:** Give `reasonWithLLM` (or a successor) the ability to request another graph read mid-reasoning and re-prompt with the result — a runtime-level change, not a per-agent fix.

### 17. No learning-from-overrides feedback loop — 🔴 gap, code-only

**Requirement:** A human's rejection or correction of an agent's proposal should shape that agent family's future reasoning — otherwise "Learn" in the agent lifecycle is aspirational (`foundation.md` §3).

**Implementation:** Every `Decision` records an approve/reject `status`.

**Gap:** Nothing reads that history back into a future reasoning step, and no screen shows agreement-rate or override history for an agent family.

**Feed Datum Missing:** N/A — the history already exists live in `Decision` nodes; this is purely a missing read-back mechanism, not missing data.

**Resolution:** Compute an agreement-rate query per agent family and feed it into that family's prompt context on future runs, plus add an aggregate view (agreement rate, override count) to the `intelligence` or `assurance` feature.

---

**Net**: rows 1–7 are the existing JTBD partial/gap set, restated in Requirement/Implementation/Gap/Feed-Datum/Resolution form. Rows 8–17 are net-new, from a requirement-by-requirement audit of every `foundation.md` §0–§4 table row against the codebase. **Two rows were reclassified on this pass**: #2 (Applicability Scoping) and #6 (Audit-Ready Export) are **not gaps** — both are `foundation.md` requirements already correctly implemented (documented absence, honest provenance tagging respectively) and are listed for traceability only. **Feed-fixable via a new feed-generator, no code change needed**: #1, #4. **Feed-fixable but also needs a schema/code slot first**: #5, #12, #13. **Pure code gaps, no feed component**: #3, #7, #9, #10, #11, #14, #15, #16, #17. **Mixed**: #8 (mostly code, one feed-generator piece for the continuity baseline). Of the true gaps, **3, 10, 11, and 16 most directly block a credible first onboarding**; the rest are provenance/versioning/learning debt deferrable past a first onboarding but not a second enterprise.

---

## Where to go next

- **Why this must be agentic at all** (no status) → `foundation.md`
- **Model, value and guarantees** (no status) → `foundation.md`
- **Phase sequencing, what's done, what's next, verification** → `plan.md`
- **Schema, relationships, live/dormant status, Cypher patterns** → `graph.md`
- **Software layers & components** → `architecture.md`
