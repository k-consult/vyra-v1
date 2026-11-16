# Applicability — Mapping Obligations to Enterprise Operational Context

**How a catalog obligation comes to bind to a specific tenant `Organisation`/`Facility`/`Asset`** — the L2 *Interpret* layer (`foundation.md`, Applicability Scoping · Obligation Linkage). Design, decided 2026-11-16, **not built**. Not canonical on its own: as each step below ships, its schema lands in `graph.md` (Appendix A/B) and `domain.md`, and its status in `track.md`. Every relationship/label name here is a proposal — validate against `/graph-spine` before implementation.

---

## 1. Why the current shape isn't enough

| # | Finding | Evidence |
|---|---|---|
| 1 | Applicability is only expressed *through* a Control. An obligation that applies but has no control is invisible to the enterprise — the most important gap can't surface — and L2 (does it apply?) is conflated with L3 (how do we satisfy it?) | `Asset -[:COVERED_BY]-> Control -[:IMPLEMENTS]-> Obligation`, derived via shared `ComplianceArea`, `confidence: 0.6` (`graph.md` Appendix B, runtime rels) |
| 2 | The binding level is already in the source data but discarded at ingest | CPCB `spo.subject` (`Site`, `Organization`, `DG Set`, `STP`, `Boiler`, `Hazardous Waste Yard`, …) lands only in `Obligation.tags` (`cli/feeds/csv/catalog/cpcb/obligations.csv`). Orchid's real asset register uses the same words in `ASSET_CATEGORY` |
| 3 | Enterprise *structure* is set; applicability *facts* are not | Each act's `applicability_trigger` turns on thresholds (notified capacity, bulk generator, notified noise zone, healthcare premises). `Facility.facilityType` is schema-only, no data; no capacities, no CPCB category |
| 4 | CTE/CTO conditions have no home | `Permit` holds instrument metadata only. The CPCB map's own `meta.note`: limits "vary by state PCB… validate against each site's actual consent order" — the catalog obligation is a template, the consent condition is the instance |
| 5 | Reporting isn't tied to the binding | `REQUIRES_FILING` designed, not active; `ReportSubmission` has no site/permit scope though Form V is filed per site |
| 6 | Clause granularity is one per act (`CLA-WATER_ACT_1974`) | Acceptable for now — not addressed here |

## 2. The model — three separate questions

| Question | Grain | Decided by | Onboarding wizard |
|---|---|---|---|
| **Is this regulation in scope here?** | Regulation × Organisation/Facility | `ApplicabilityRule` over facility facts | Stage 2 — Applicability |
| **What does each obligation bind to?** | Obligation × the entity its `SubjectType` names, inside in-scope sites only | Subject-type match | Stage 3 — Ratification |
| **Is it covered?** | Applicability × Control | `Control -[:IMPLEMENTS]-> Obligation` against an *applicable* binding | Coverage / gap views |

Applicable-but-uncovered is a first-class gap. The LLM never decides applicability where a rule can; rules are evaluated deterministically in Cypher.

## 3. Schema (proposed)

### Catalog side (`:Catalog`, centrally maintained, synced down)

| Node | Purpose | Key properties |
|---|---|---|
| `SubjectType` | Shared bridge vocabulary between obligation subjects and enterprise entities | `id`, `name` (`DG Set`), `bindsAt` (`Organisation`\|`Facility`\|`Asset`) |
| `ApplicabilityRule` | Structured form of an act's (or a "where applicable" obligation's) trigger | `predicates: [{attribute, op, value}]`, `triggerRaw` (verbatim source text — same discipline as `Report.cadenceRaw`), `ruleVersion` |
| `ApplicabilityAttribute` | The standard facts rules may test | `id`, `name`, `dataType`, `unit` — initial set: `facilityType`, `cpcbCategory`, `dgCapacityKva`, `boilerCapacityTph`, `bulkWasteGenerator`, `noiseZone`, `renovationActive` |

Seed `SubjectType` from the 12 CPCB subjects, splitting compound ones (`DG Set / UPS Battery`, `DG Set / Vendor`, `Autoclave/Deep Burial Pit (if on-site)`) into atomic types. Seed `ApplicabilityAttribute` minimally from the 11 act triggers. WINAIM's Activity→Asset→Aspect taxonomy can extend this later; it does not block it.

### Tenant side (`:Enterprise`)

**`Applicability`** — one node per (Obligation or Regulation) × bound entity. Decision-gated (`applicability-proposal`), append-and-supersede on re-evaluation.

| Property | Values |
|---|---|
| `status` | `proposed` \| `applicable` \| `not-applicable` \| `undetermined` |
| `origin` | `rule` \| `consent` \| `declared` \| `inferred` |
| `confidence` | 0–1 |
| `basis` | snapshot of the attribute values the rule tested, or the missing attribute(s) for `undetermined` |
| `ruleVersion`, `evaluatedAt`, `supersededBy` | |

**Why a node, not an edge:** resolves `domain.md`'s open `MappingProvenance` edge-VO note; `not-applicable` is queryable with its basis (`foundation.md` documented-absence guarantee); Tasks, Decisions and Evidence can hang off it — the root the Obligation Cockpit's delegation tree needs (Gap #19: a task is "WA-01 at Hyderabad STP", not "WA-01"). Cardinality (≈ obligations × entities, low thousands per 100-site tenant) is trivial for Neo4j.

### Relationships (proposed)

| Relationship | From → To | Meaning |
|---|---|---|
| `BINDS_TO_TYPE` | Obligation → SubjectType | The entity type an obligation attaches to (from `spo.subject`) |
| `OF_TYPE` | Asset/Facility/Organisation → SubjectType | Tenant entity classification — agent-proposed, ratified |
| `GOVERNED_BY` | Regulation/Obligation → ApplicabilityRule | Rule that decides scope (name collides with `Incident → Regulation`; safe under `(relType, sourceLabel, targetLabel)` grouping, but confirm with `/graph-spine`) |
| `TESTS` | ApplicabilityRule → ApplicabilityAttribute | Attributes a rule reads — what makes re-evaluation targeted |
| `MAPS_TO` | Blueprint `Property` → ApplicabilityAttribute | Tenant-editable blueprint stays free-form; rules see standard facts |
| `OF` | Applicability → Obligation \| Regulation | What is being scoped |
| `BINDS` | Applicability → Organisation \| Facility \| Asset | What it binds to |
| `BASED_ON` | Applicability → ApplicabilityRule \| Permit | Why |
| `REFINES` | Obligation:Enterprise → Obligation:Catalog | Consent condition specialising a catalog obligation |
| `IMPOSED_BY` | Obligation:Enterprise → Permit | The consent that imposes the condition |
| `REQUIRES_FILING` | Obligation → Report | Activate the designed edge |
| `FOR` | ReportSubmission → Facility \| Permit | Per-site / per-consent filing scope |

### CTE/CTO — entity-specific instruments

A consent is addressed, not inferred: no rule needed.
- Each condition → `Obligation:Enterprise {origin: 'consent-condition', parameter, op, value, unit, monitoringPoint}` `-[:REFINES]->` the catalog obligation, `-[:IMPOSED_BY]-> Permit`.
- Its `Applicability` has `origin: 'consent'`, `BASED_ON` the Permit, `BINDS` the asset the consent names (resolved against the asset register; reconcile mismatches via review).
- The existing `permit-proposal` carries extracted conditions; Permit renewal's append-and-supersede retires them with the prior Permit.
- Catalog WA-03 ("hold valid CTO") is satisfied by the Permit itself — activates `AssetHasValidConsentSpecification`.

### Reporting

Filing duty = `Report` × applicable Facility (or Permit). `ReportSubmission -[:FOR]->` that scope. The compliance calendar derives from `Applicability`, not from catalog `Task`s.

### `COVERED_BY` migration

Keep `COVERED_BY` until `Applicability` is live — `getCoverageScore` and `/assurance/posture` depend on it. Then the ComplianceArea inference becomes a candidate generator only; valid coverage requires an `applicable` `Applicability` underneath. **Expect the coverage % to drop at switchover** — the denominator moves from "assets that have controls" to "everything obligations actually bind to." That is the honest number; flag it to posture-view readers first.

## 4. Agent — `applicability-intelligence` (L2 family)

Single-shot constrained extraction/classification — fits today's `reasonWithLLM`; **not blocked on Phase 10**.

| Job | When | Output |
|---|---|---|
| Trigger text → `ApplicabilityRule` predicates | Catalog time, once, at Vyra Central — part of the licensed catalog asset | Ratified centrally |
| `ASSET_CATEGORY`/`ASSET_NAME` → `SubjectType` (choose from list, or `none`) | Onboarding | `OF_TYPE` proposals |
| Blueprint `Property` → `ApplicabilityAttribute` | Onboarding | `MAPS_TO` proposals |
| Consent PDF → conditions | Permit proposal | `consent-condition` obligations |
| Vague predicates ("if on-site", "where applicable") | Evaluation | `undetermined` + a question to a human — never a guess |

Re-evaluation triggers: `ObligationRevised` on catalog sync; asset added/recategorised; attribute value change; Permit approved.

## 5. Decisions (2026-11-16)

**D1 — Regulation-level `Applicability` is kept, and gates obligation-level evaluation.** Triggers are authored per act in the source; one act-level `not-applicable` with one basis replaces N identical obligation-level ones; auditors ask the question at act level. Status does **not** roll upward — a regulation can be `applicable` while some of its obligations are `undetermined` (e.g. Air Act with DG capacity missing).

**D2 — `foundation.md` §2's applicability row revised.** The guarantee ("explicit, inspectable") stands; the path changes from `Asset → Control → Obligation` to a first-class `Applicability` node with coverage as a separate question. Applied 2026-11-16. `graph.md` §2.3's L2 row changes when step 4 below ships, not before.

**D3 — Autonomy elevation is asymmetric by outcome.** A wrong `applicable` costs effort; a wrong `not-applicable` is silent non-compliance.
- All classes start at Level 1.
- First eligible for Level 2: `applicable` outcomes where origin is `rule`, the rule is centrally ratified, every tested fact has `ingestion`/`declared` provenance (not `inferred`), and no LLM step sits in the chain.
- `not-applicable` stays human-approved far longer — possibly permanently — and is always audited.
- Never auto: `undetermined`; `consent` origin (LLM-extracted); any binding whose `SubjectType` was LLM-chosen.
- Elevation via `WorkflowEligibleForAutonomyElevationSpecification`, keyed by (regulation, outcome). Starting threshold (a proposal, not yet validated): ≥95% agreement over ≥50 decisions, zero overturns in the latest window.

## 6. Worked example — Orchid, `ROH-HYD-01`

| Asset | Result |
|---|---|
| STP | Water Act in scope → WA-01 binds STP; WA-02 binds the site |
| DG-01, Boiler-01 | Air Act turns on capacity → `undetermined`, basis "missing `dgCapacityKva`/`boilerCapacityTph`" → data request, not a guess |
| HW-Yard | HWM Rules → HW-yard obligations bind the asset |
| Borewell-01 | No CPCB `SubjectType` → documented unmapped asset; surfaces a real catalog gap (CGWA groundwater NOC) |
| FireSystem | Maps to the fire-safety catalog, currently in `catalog/ignore/` → same documented absence |

## 7. Sequencing

| Step | Scope | Exit check (live graph) |
|---|---|---|
| 1 | Vocabulary: `SubjectType`, `ApplicabilityAttribute` seeds | Every CPCB obligation subject resolves to ≥1 atomic `SubjectType` |
| 2 | Catalog: `subjectType` column in `obligations.csv` + `v2.ts` mapping → `BINDS_TO_TYPE`; `ApplicabilityRule` per regulation | 29/29 CPCB obligations carry `BINDS_TO_TYPE`; 11/11 regulations carry a rule with `triggerRaw` preserved |
| 3 | Tenant facts: asset → `SubjectType` proposals; `Property -[:MAPS_TO]->` attribute; facet intake (`track.md` Onboarding pending) | Orchid's 19 assets each `OF_TYPE` a type or explicitly `none` |
| 4 | `Applicability` node + evaluator + `applicability-proposal` Decision type; wizard Stages 2–3 (bundled per site × regulation) | §6 table reproduces from a live query |
| 5 | Consent conditions on `Permit` | A real CTO's conditions bind to named assets |
| 6 | Reporting: `REQUIRES_FILING`, `ReportSubmission -[:FOR]->` | Form V duty per Orchid site |
| 7 | Gap #19 Obligation Cockpit rooted on `Applicability` | — |

## 8. Still open

- **`SubjectType` vs `Asset.assetType`.** `assetType` already has a controlled vocabulary (`hazardous-material-store`, `fire-pump`, …). Leaning: `SubjectType` is the canonical node; `assetType` values migrate onto it rather than two vocabularies coexisting. Decide at step 1.
- **`WAIVES` target.** The designed `Exception -[:WAIVES]-> Obligation` should probably target `Applicability` — an exception is granted for a binding at a site, not for the obligation everywhere.
- **Consent-to-asset resolution** ("Stack S-2", "Boiler No. 2") will need a reconciliation queue; not designed yet.

## References

- `foundation.md` §2 (applicability, provenance, documented absence), §3 (autonomy earned against evidence)
- `graph.md` — `Obligation`, `Report`, `Permit`, `ReportSubmission`, Tenant Blueprint `Property`; Appendix B `COVERED_BY`, `REQUIRES_FILING`
- `domain.md` — Operational subdomain `MappingProvenance` open note; `AssetHasValidConsentSpecification`
- `track.md` — Catalog vocabulary item, Operational Context applicability-agent item, Onboarding Stages 2–4, Gap #19
- `.docs/cpcb_spo_map.json` — `spo.subject`, `applicability_trigger`
- `cli/feeds/csv/tenants/orchid/structure/` — worked-example source
