# Domain Extension — SPO Registry ↔ Vyra Domain Map

**Maps an external SPO (Subject–Predicate–Object) concept registry onto Vyra's domain model** — what's already covered, what required a decision, and what's still a gap. Not canonical: `domain.md`/`graph.md` are — whatever's decided here lands there, and this file points at where. Status of every open item → `track.md`.

**Source:** `.design/.docs/grc_registry_model_explorer.html` — a Concept/Facet/Predicate/SPO registry for a Fire Safety & Hazard Management vertical (48 concepts, 5 facet groups, 36 predicates, 38 worked SPO triples). Same meta-model shape as `.design/.docs/cpcb_spo_map.json` (the CPCB catalog, already live in the Knowledge graph) — a different vertical run through the same comparison method.

---

## Concept Map (by Vyra graph domain)

| Registry concept cluster | Vyra domain | Status |
|---|---|---|
| `HazardousMaterialStore`, `FireSafetySystem` | Operational (`Asset`) | Covered — `Asset.assetType` vocabulary |
| `Hazard`, `HazardAssessment` | Operational / Intelligence | Live |
| `EmergencyPlan` | Operational | Live |
| `Drill` | Execution / Assurance | Covered — resolved onto `Task` + `Evidence` |
| `SafetyDataSheet`, `EvidenceType`, `LabReport` | Assurance (`Evidence`) | Covered — `Evidence.type` vocabulary |
| `NonConformance` | Intelligence (`Finding`) | Covered |
| `Deviation` | Execution (`CAPA`) | Covered — `CAPA` properties |
| `InspectionEvent`, `Form`, `Question`, `Observation`; IoT sensor as capture source | Execution / Operational | **Gap** — undecided, see below |

## Already covered — resolved onto existing nodes, no new node type

- **`HazardousMaterialStore`, `FireSafetySystem`** → `Asset.assetType` controlled vocabulary (`hazardous-material-store`, `fire-alarm-panel`, `sprinkler-system`, `fire-hydrant-system`, `fire-pump`).
- **`NonConformance`** → `Finding`. A detected breach is a `Finding`; `CAPA.findingId` links the corrective action to it.
- **`Deviation`** → `CAPA.deviationApprovedBy`/`deviationDueBy`/`deviationReason` — the approved-exception shape as `CAPA` fields, not a new node.
- **`EvidenceType`, `LabReport`** → `Evidence.type = 'lab-report'`; `Task.evidenceMethod = 'Lab'`.
- **`SafetyDataSheet`** → `Evidence.type = 'safety-data-sheet'`, reached via `Evidence -[:PRODUCED_BY]-> Task`.
- **`Drill`** → not a node: a recurring `Task` + `Task -[:VERIFIES]-> EmergencyPlan`; its evidence is `Evidence.type = 'drill-report'` via the same `PRODUCED_BY` edge.

## Live — built onto new nodes

- **`Hazard`** (Operational) — `hazardType` discriminator (`fire`/`chemical`/`electrical`/`structural`), `-[:LOCATED_AT]-> Facility`/`Asset`.
- **`HazardAssessment`** (Intelligence, the registry's HIRA) — the proactive counterpart to `RCA` (reactive). `score` computed server-side (`likelihood × severity`), never trusted as proposer-supplied arithmetic. `Hazard -[:ASSESSED_BY]-> HazardAssessment`.
- **`EmergencyPlan`** (Operational) — per-`Facility`, `-[:COVERS]-> Facility`.

All three: zero CSV seed, live-write-only, Decision-gated — same propose→approve shape as `Contract`/`Blueprint`/`CutoverCriterion`. Schema → `graph.md` Appendix A/B. Build/verification status → `track.md`.

## Gaps to address

- **`Form`/`Question`/`InspectionEvent`/`Observation` execution-capture layer.** No execution-capture layer exists between `Schedule`→`Task` and `Evidence` today — `Signal` is the closest live analog but models floor/system events, not a structured checklist run against an `Asset`. The largest, most architecturally consequential item in the registry — needs its own design pass before anything in this cluster is built. Tracked in `track.md`'s Operational Context pending list.
- **IoT sensor as a capture source.** `Actor` (`:Human`/`:Agent`) is designed, not active, and has no sensor/device variant even in its own design. Revisit once `Actor` has real infrastructure.
- **Live Drill-task generation.** `Task -[:VERIFIES]-> EmergencyPlan` is schema-designed but nothing creates the recurring `Task` from `EmergencyPlan.drillFrequency` yet. Tracked in `track.md`.
- **UI.** No screen proposes or lists `Hazard`/`HazardAssessment`/`EmergencyPlan` yet — write paths are real; nothing in `ui/` calls them. Tracked in `track.md`.
- **Registry groups not reviewed.** Scheduling and Measurement's facet thresholds, the full Consent Portfolio facet set beyond what `Permit`/CPCB already cover. Revisit only if a concrete feature needs them.

## Prior SPO comparisons (resolved)

Two earlier comparisons against other external sources, both substantially closed — kept as a pointer, not re-litigated here:

- **CTN-SPO generic model** (tenant/relationship/versioning meta-model) — Vyra's typed-edge, per-tenant-database model already covers it. One narrow open item: a `PredicateDefinition` reference catalog (self-documenting the relationship vocabulary `graph.md` Appendix B already has) — decided in shape, not built, not scheduled.
- **WINAIM Concept Tree** (535-concept FM/EHS/Food-Safety vocabulary) — closed for onboarding purposes. `Facility -[:IN_JURISDICTION]-> Jurisdiction`, `Asset.assetType`, `Permit`, `Warranty` are all live (same resolution pattern as this doc's Fire/Hazard cluster). `InsurancePolicy`/`Coverage`/`Exclusion`/`Claim` has a decided home in the Assurance graph, not yet built. Role enrichment (`Responsibility`/`Competency`/decision `Authority`) remains open — tracked in `track.md`'s **Not MVP-gating** section, not here (it's white-label-parity content, not an onboarding-transition requirement). Likely direction: `Role.decisionAuthority` as a property, not a new node — avoids a homonym clash with the existing `Authority` = regulatory-body node.

## References

- `.design/.docs/grc_registry_model_explorer.html` — this doc's primary source
- `.design/.docs/cpcb_spo_map.json` — same meta-model shape, CPCB catalog, already live
- `graph.md` — `Permit` entry (`instrumentType` discriminator precedent), `RCA`/`Finding` entries (`ANALYSED_BY` direction precedent), `Risk` entry (computed-score discipline), `CAPA` entry
- `domain.md` — Operational subdomain's `MappingProvenance` open note, `Asset` Aggregate note
- `foundation.md` §2 (agent proposals ratified through the Decision gate), §4 (ecosystem extension points)
- `track.md` — current status of every gap named above
