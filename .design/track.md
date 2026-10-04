# Vyra Onboarding Checklist — Must-Have Items

**Trimmed view: only what's still partial or open.** Closed items, by-design items (resolved, no action needed), and full build history live in `track-platform.md` — this doc exists so a first-customer onboarding effort isn't wading through everything already done.

> Same numbering as `track-platform.md`, so an item here can always be cross-referenced back to its full history there. Status tags: 🟡 **partial** = real but incomplete · 🔴 **gap** = nothing built.

---

## Open Items

1. [Obligation Cockpit foundations](#gap-19) — 🔴 gap
2. [Fire/Hazard domain cluster has no graph home](#gap-21) — 🟡 partial

**On hold (2026-10-04, by request)** — tracked in full in `track-platform.md`, not repeated here:
- Scenario Simulation (#7)
- Onboarding-as-a-phase (#8)
- Domain model is anemic vs. `domain.md` (#9)
- First-customer (tenant) onboarding readiness (#22)

**Not an onboarding gate (2026-10-04, reclassified)** — Gap #18's last open item, `Role` enrichment (`Responsibility`/`Competency`/decision `Authority`), was WINAIM-parity/white-label content (`foundation.md` §4), not an onboarding-transition requirement (§0) — nothing in `Blueprint`/`CutoverCriterion`'s proposal or approval path reads it. Moved to `track-platform.md`'s general **Domain Model Gaps** section; Gap #18 itself is now fully ✅ closed for onboarding purposes (all of (a)/(b)/(c)/(d) built) and dropped from this checklist entirely.

---

<a id="gap-19"></a>

### 19. Obligation Cockpit foundations — 🔴 gap, code-only

**Requirement:** `.design/journey/`'s four mockups (Catalog Ingestion → Catalog Browsing → Enterprise Onboarding → Obligation Cockpit) and `.design/journey/concept-notes.md`'s design work name a real target: obligations superimposed on the ratified Blueprint, drillable by WHO/WHERE/WHEN/Demography, with each task's rendering driven by where it sits in the agent lifecycle (dormant/pending-decision/reasoning/informed). None of this is buildable yet — the schema it depends on doesn't exist.

**Implementation:** Nothing. The Obligation Cockpit mockup runs entirely on static sample data (25 hand-authored workflow classes); no `Task`-delegation edges, per-class Autonomy Level, or Loop-stage state exist in the real graph today. Separately, two smaller catalog-side concepts invented for the earlier mockups (Demography/`workerCategory`, Industry/Asset-Category controlled vocabularies) also have no home in `graph.md`/`domain.md` — they were never put through a `domain-extension.md`-style decision, unlike gap #18's items.

**Gap:** Two distinct clusters, detailed in `.design/journey/v1-plan.md`:
- **Cockpit foundations** (Phase J5 of that plan) — the delegation-tree relationship (`Obligation`/`Task` → sub-task) that everything else depends on; Autonomy Level as a per-workflow-class aggregate (today `Decision.autonomyLevel` exists only per-Decision instance); Loop-stage as a real state model (today `Decision.status` is only pending/approved/rejected).
- **Undecided catalog concepts** (Phase J3 of that plan) — Demography and Industry/Asset-Category need a decision pass before either is built, the same discipline gap #18 already went through for WINAIM's concepts.

**Feed Datum Missing:** N/A — pure schema/design gap, not a data-completeness issue.

**Resolution:** Not started. `.design/journey/v1-plan.md` sequences this as Phase J3 (decide the undecided catalog concepts) then Phase J5 (design and build the delegation tree, Autonomy Level aggregate, and Loop-stage state model, in that order — nothing in Phase J5 is buildable out of sequence). Signal/Event flow (how a floor signal or Schedule firing actually resolves to a Task under this tree) is explicitly deferred again — it needs its own design pass once this gap's foundations are real, not before.

---

<a id="gap-21"></a>

### 21. Fire/Hazard domain cluster has no graph home — 🟡 partial, decided and first slice live (2026-10-04)

**Requirement:** Per `foundation.md` §4's "ecosystem extends without forking," a new regulatory domain (Fire Safety, Hazard Management) should be representable as data on the existing graph, not require a parallel schema. `grc_registry_model_explorer.html` (WINAIM reference, 28-Sep-2026) specifies this domain's concepts, facets, and predicates as an extension of the same Concept/Facet/Predicate/SPO meta-model Vyra's CPCB seed already runs on.

**Implementation:** The decision pass this gap called for is done — `domain-extension.md` §8, same method Gap #18 used for WINAIM. Resolved onto *existing* nodes, no new label: `HazardousMaterialStore`/`FireSafetySystem` → `Asset.assetType` vocabulary; `SafetyDataSheet`/`LabReport`/`Drill` → `Evidence.type` vocabulary (+ `Task.evidenceMethod`); `NonConformance` → already `Finding` (no change, same resolution #6/§7.3 gave WINAIM's CAPA mapping); `Deviation` → new `CAPA.deviationDueBy`/`deviationReason` properties alongside the existing `deviationApprovedBy`. **Built live same day:** `Hazard` (Operational, `hazardType` discriminator, `-[:LOCATED_AT]-> Facility`/`Asset`), `HazardAssessment` (Intelligence, the proactive counterpart to `RCA`, `-[:ASSESSED_BY]<-Hazard`, `score` computed server-side), `EmergencyPlan` (Operational, `-[:COVERS]-> Facility`) — all three zero-seed, live-write-only, Decision-gated exactly like `Contract`/`Blueprint`/`CutoverCriterion` (`api/modules/onboarding/{repo,spec,index}.ts`, new `intelligence/repo.ts` approval branches). Verified live: proposed and approved one `Hazard`/`HazardAssessment`/`EmergencyPlan` against real seeded `FAC-1002`, confirmed `LOCATED_AT`/`ASSESSED_BY`/`COVERS`/`RESULTED_IN` edges and the computed `score` (4×5=20) via direct Cypher; a rejected proposal left no orphan node.

**Gap:** `Form`/`Question`/`InspectionEvent`/`Observation` (the execution-capture layer between `Schedule`→`Task` and `Evidence`) and IoT-sensor-as-`Actor` remain explicitly deferred — the largest, most architecturally consequential piece, deliberately not designed in this pass (`domain-extension.md` §8.5). No live Drill-task generator exists yet either — `Task -[:VERIFIES]-> EmergencyPlan` is schema-designed but nothing creates the recurring Task from `EmergencyPlan.drillFrequency` (no CSV feed to hook a batch generator into, no agent family targets it). No UI screen proposes or lists any of the three new nodes — same state `Permit` has been in since its own schema landed.

**Feed Datum Missing:** N/A for the built slice (live-write-only, no seed). The deferred execution-capture layer is a schema/design gap, not a data-completeness issue, same category as #9 and #19.

**Resolution:** Built: `Hazard`/`HazardAssessment`/`EmergencyPlan` write paths (above). Still needed, each its own future slice: a live Drill-task generator off `EmergencyPlan.drillFrequency`; a UI screen (propose + list, same as `Blueprint`'s `/onboarding` form); the deferred execution-capture layer decision (`Form`/`Question`/`InspectionEvent`/`Observation` — own subdomain vs. folded into `Signal`) before anything in that space gets built.

---

## Where to go next

- **Full build history, closed items, by-design items, JTBD layer status** → `track-platform.md`
- **Model, value and guarantees** (no status) → `foundation.md`
- **Phase sequencing, what's done, what's next, verification** → `plan.md`
- **Schema, relationships, live/dormant status, Cypher patterns** → `graph.md`
- **Software layers & components** → `architecture.md`
