# External Domain Comparisons ↔ Vyra Domain Map

**A comparison note, not a canonical doc.** Working analysis reviewing external proposed models (from win-aim document drops, not versioned in this repo) against Vyra's own domain model. Captures what's structurally comparable, what Vyra was found to be missing, and the design decision on how to close it — so the reasoning doesn't have to be redone if this is revisited. Status: **decided, not yet implemented.**

Two comparisons, different purpose:
- **§1–6 (2026-09-25): CTN-SPO** — tests Vyra's *meta-model* (can the schema flex to represent tenants/relationships/versions at all). Mostly "no gap"; one real narrow item (`PredicateDefinition`).
- **§7 (2026-09-26): WINAIM Concept Tree** — tests Vyra's *domain content* (does the Catalog/Enterprise graph actually cover the vocabulary a real vertical needs). **Corrected framing, important:** WINAIM is not a peer system to reconcile against — it white-labels Vyra. Its 535-concept tree is a specification of general domain/industry requirements Vyra's own graph must be able to represent for this vertical (and, by the same logic, any future one) — a content gap here is a Vyra gap, not a WINAIM-vs-Vyra difference to negotiate.

> Not part of the `.design/README.md` reading order. Treat like `.design/__ref/` — background for a specific decision, not ground truth. `domain.md` and `graph.md` remain canonical; if anything here is ever implemented, it should land there, and this file should be updated to point at where.

---

## 1. What CTN-SPO is

An external logical-data-contract workbook proposing a generic semantic model for a multi-tenant compliance/operations platform:

`Concept` (global vocabulary, e.g. "Asset") → `Entity` (tenant instance) → `SPO` (Subject–Predicate–Object relationship, governed by a `PREDICATE_MASTER` table with domain/range/cardinality/inverse) → `Event` (what happened) → `Observation` (what was captured).

It's a triple-store pattern implemented over a relational/JSONB schema, with tenant isolation done via a `Tenant_ID` column and a live integrity-formula layer (FK/domain/range/cardinality/temporal-overlap checks, proven with seeded `NEGATIVE_TEST` rows). Source file: `/Users/krishnan/_ks/work/win-aim/documents/from-winaim/25-SEP-2026/CTN-SPO-Model.xlsx`.

## 2. Concept map

| CTN-SPO concept | Vyra equivalent | Status |
|---|---|---|
| `Concept` (GLOBAL vocabulary) | `:Catalog`-labeled node types (`Regulation`, `Control`, ...) | Already covered — same idea, native typed nodes instead of a generic `Entity` table |
| `Entity` (TENANT instance, `Tenant_ID` column) | `:Enterprise`-labeled nodes, isolated by **one Neo4j database per tenant** | Already covered, and stronger — physical isolation vs. row-level filtering. See `architecture.md`'s Context Map, `foundation.md`'s "isolation of data" non-negotiable |
| `SPO` (generic relationship + `PREDICATE_MASTER`) | Native typed Neo4j relationships (`COVERED_BY`, `IMPLEMENTS`, `HAS_ROLE`, ...), catalogued in `graph.md` Appendix B | **Partial gap** — see §3.3 below |
| `Event` / `Observation` (config vs. occurrence vs. fact) | Execution (`Task`/`Schedule`) → Operational (`Signal`) split, plus Intelligence/Assurance layered on top | Vyra covers this and goes further (Knowledge sourcing upstream, agentic reasoning downstream — outside CTN's scope entirely) |
| `Version` column, `Valid_From`/`Valid_To` | `catalogVersion` / `effectiveFrom` / `supersededBy` on `:Catalog` nodes | Already covered for catalog facts — see §3.2. **Not** covered for relationship-*instance* temporal validity — see §5 open item |
| `INTEGRITY_RULES` sheet + `NEGATIVE_TEST` corpus | `api/modules/*/spec.ts` predicates (2 write routes) + manual "verified live" notes in `track.md` | Gap, not addressed by this note — relevant to `track.md` gap #9 (anemic domain model), not scoped here |

## 3. Missing concepts — resolved

### 3.1 Tenant
**No gap.** CTN's `Tenant_ID` row-level model is what Vyra already replaced with something stronger: `:Enterprise` dual-labeling plus one physically isolated Neo4j database per tenant. CTN's own review notes (R14) flag its own tenant model as an open problem (circular bootstrap: a `Client` entity has to be its own tenant); Vyra's per-database isolation doesn't have that problem. Nothing to implement.

### 3.2 Versioning
**No gap.** CTN's `Version` column and the SCD2-vs-new-Entity-ID tension it leaves as an open decision (R15) is already resolved on Vyra's side: `catalogVersion` / `effectiveFrom` / `supersededBy` on `:Catalog` nodes, append-and-supersede, never mutate. Live since `track.md` gap #12 (`REG-001` → `REG-001-V2`, verified against the graph). Nothing to implement.

### 3.3 Predicate-as-data
**Real, narrow gap — governance, not schema flexibility.**

What CTN's `PREDICATE_MASTER` buys, concretely:
1. Adding a new relationship *kind* without a code deploy.
2. A self-service extension point for third parties to declare their own predicates.

Walking CTN's own onboarding-variance examples (site counts, role vocabularies, hybrid ownership, outsourced steps, regional deviations) shows (1) isn't actually needed: every case is variance in *node instances and property values* along a fixed, sector-stable relationship vocabulary, not variance in the *kind* of relationship — which is exactly what `foundation.md` already specifies ("shape differences are data on the blueprint... never per-tenant code branches"). Vyra's typed-edge model already absorbs this.

(2) is real but narrow: `foundation.md` §4 requires third-party catalog packs to extend Vyra "through declared extension points that survive re-sync" — a catalog pack defining a predicate Vyra core never anticipated is a legitimate case. It is **not scoped or scheduled today** (no work item in `track.md`).

A third possible case — an agent inventing a genuinely novel relationship mid-reasoning — was considered and rejected as a justification: any such proposal must go through the same Decision-gate ratification as any other agent action (`foundation.md` §2). A reviewed schema change (PR) *is* that ratification, arguably more auditable than a data row that becomes live and writable the instant it's inserted.

## 4. Design approach — decided

**Do not implement a generic relationship type (e.g. `:RELATES_TO {predicate: ...}`).** It would add a second relationship-write path, push validation from Neo4j's type system into application code, and buy flexibility CTN's own onboarding examples don't actually require once mapped onto Vyra's typed model.

**Do add `PredicateDefinition` as a global reference-data catalog *describing the existing typed edges*, not replacing them:**

- Fields: `predicateCode`, `subjectConcept`, `objectConcept`, `cardinality`, `allowMultiple`, `inverse`, `realizedAs` (`NATIVE_EDGE` for everything today).
- Scope: every relationship already in `graph.md` Appendix B gets a row. This makes the relationship vocabulary queryable/self-documenting instead of living only in doc prose.
- Enforcement: `api/modules/*/spec.ts` validates domain/range/cardinality against this catalog instead of (or in addition to) hardcoded inline checks — the same job CTN's formulas do, minus the generic-edge risk.
- Tenancy: global by default (predicates are vocabulary), with room to reuse the `:Catalog`/`:Enterprise` dual-label pattern later if a tenant-local, not-yet-promoted predicate is ever needed — not built now, no current requirement for it.
- Relationship to `track.md` gap #9 (anemic domain model): this closes part of it — a real, centrally-governed invariant a spec can check — without requiring the full Aggregate/Domain-Event machinery `domain.md` describes.

**This is a design decision, not yet implemented.** No `PredicateDefinition` node exists in `graph.md` or `cli/semantic-contract/contracts/v2.ts` today.

## 5. Open items surfaced but not addressed here

- **Relationship-instance temporal validity.** CTN's `SPO.Valid_From`/`Valid_To` (e.g., a vendor assignment that ends on a date) has no Vyra equivalent — `domain.md`'s open note on edge-attached VOs (`MappingProvenance` on `COVERED_BY`) is adjacent but doesn't cover time-bounding. Distinct from catalog versioning (§3.2). Not scoped; flag if it becomes relevant.
- **Third-party predicate extension (§4's case 2).** Revisit a narrow, catalog-pack-scoped version of predicate-as-data only if/when `foundation.md` §4's ecosystem-extension work actually gets scheduled — don't build it ahead of that need.
- **Integrity-rule/negative-test discipline.** CTN's `INTEGRITY_RULES` sheet + seeded negative-test corpus is a real gap in rigor relative to Vyra's current two-`spec.ts`-file validation surface, but it's part of `track.md` gap #9's broader scope, not this note's.

## 6. References

- `foundation.md` §0 (onboarding: "shape differences are data... never per-tenant code branches"), §2 (agent proposals ratified through the Decision gate), §4 (ecosystem extension points)
- `graph.md` Appendix B (relationship catalog — the typed edges `PredicateDefinition` would describe)
- `domain.md` — Operational subdomain's open note on edge-attached Value Objects
- `architecture.md` — Context Map (tenant-as-Bounded-Context, `:Catalog`/`:Enterprise` dual-label)
- `track.md` gap #9 (anemic domain model) — where `PredicateDefinition` enforcement would partially land

---

## 7. WINAIM Concept Tree — a second comparison

### 7.1 What it is

`WINAIM_Concept_Tree (1).html` (`/Users/krishnan/_ks/work/win-aim/documents/from-winaim/25-SEP-2026/`, not versioned in this repo): 535 concepts across ~35 thematic groups, spanning three verticals WINAIM white-labels Vyra for — **FM** (Facilities Management), **EHS**, **FS** (Food Safety). Each concept carries a group (`g`), a domain-ownership type (`t`: Shared/Cross-Domain/FM/EHS/Food Safety), domain-applicability flags (`d`), a definition, a parent (forming an IS-A hierarchy), synonyms, a section citation, and its own governance trail (`v`: RETAINED/RENAMED/MERGED_DUPLICATES/ABSORBED_TERMS/ADDED, plus numbered `GAP-XX` tags) — the same append/supersede-with-a-gap-ledger discipline this repo already uses in `graph.md`'s changelog and `track.md`.

### 7.2 Concept map (by Vyra graph domain)

| WINAIM group cluster | Vyra domain | Verdict |
|---|---|---|
| Documents and Governance; Compliance and Control | Knowledge (Catalog) | **Already covered** — see 7.3 |
| Risk and Exception; Event and Evidence (Decision/Approval/Finding) | Intelligence | **Already covered** — see 7.3 |
| Organization and Business; Commercial and Authorization | Operational (Enterprise) | **Partial gap** — see 7.4(c)(d)(e) |
| Location | Operational (Enterprise) | **Already covered by existing precedent** — see 7.3 |
| Asset and Infrastructure | Operational (Enterprise) | **Gap** — see 7.4(b) |
| People and Roles | Operational (Enterprise) | **Gap** — see 7.4(f) |
| Scheduling and Measurement | Execution | Not reviewed in depth this pass — see 7.5 |
| Permit to Work and Isolation; vertical-specific groups (Food Processes, HACCP, Chemical Safety, Fire and Life Safety, HVAC/Electrical/Plumbing) | Knowledge (as `Control` specializations) | Not reviewed in depth this pass — see 7.5 |

### 7.3 Already covered — no gap

- **Control taxonomy.** `Control.controlType` (Preventive/Detective/Corrective) already *is* WINAIM's `CONTROL → PREVENTIVE_CONTROL/DETECTIVE_CONTROL/CORRECTIVE_CONTROL`. `Control.docType` (policy/sop) already partially matches `DOCUMENT → POLICY/PROCEDURE`. Independently convergent design — nothing to change.
- **CAPA.** Vyra's `CAPA` node already *is* WINAIM's `CORRECTIVE_AND_PREVENTIVE_ACTION` (the combined parent concept). Minor note, not urgent: WINAIM also models `CORRECTIVE_ACTION`/`PREVENTIVE_ACTION` as separable children; Vyra's `CAPA` doesn't currently split them. Not a gap worth closing without a concrete need to track them independently.
- **Risk/Finding/RCA/Decision.** Already cover WINAIM's Risk-and-Exception group and the Decision/Approval part of Event-and-Evidence.
- **Location.** Vyra already made, independently, the exact design call WINAIM's Location hierarchy (Country/State/City → Site → Campus/Building/Block/Level/Zone/Area → Room) would otherwise force. `graph.md`'s `Facility` entry states it directly: *"finer-grained physical position (site/building/zone/room) is modeled as attributes on `Facility`/`Asset`, not as additional node types — geography alone has no regulatory standing, `Facility` does."* Building/Zone/Room are already live today as `Asset.buildingId`/`zoneId`/`roomId`. This closes most of WINAIM's Location group as *already covered by precedent*, not a gap — the one real gap is narrower, see 7.4(a).

### 7.4 Real gaps — decided

**(a) Country/State/City → `Jurisdiction` linkage.**
Gap: `Facility` has no relationship to `Jurisdiction` today — only `Regulation`/`Authority` do (`ISSUED_BY`/`OPERATES_IN`). `Facility.region` is a free string.
**Decided:** add `Facility -[:IN_JURISDICTION]-> Jurisdiction`, reusing the existing relationship name and node type `Regulation` already uses. Zero new node types, mechanical addition.
Not now: splitting `Jurisdiction` itself into Country/State/City granularity (`JUR-INDIA`-style ids suggest country-level only today) — flagged in 7.5, not decided.

**(b) Asset subtyping** (`Equipment`/`Machine`/`Device`/`Instrument`/`System`/`Subsystem`/`Utility`/`Infrastructure`/`Installation`).
Gap: `Asset.category` is a free string (`:Enterprise` rows only) used solely to derive `complianceAreaId`; no structured subtype, no parent-`Asset` relationship (`domain.md`: *"Asset (root)... No owned children"*).
**Decided:** mirror the exact precedent 7.3 just cited for `Facility` — add `Asset.assetType` as a controlled-vocabulary property (values taken directly from WINAIM's own vocabulary), **not** new node types. Defer `Asset -[:PART_OF]-> Asset` (subsystem/component composition) until a concrete feature needs to traverse it — same YAGNI reasoning §4 above already used to reject a generic predicate mechanism.

**(c) `Permit`, `License`** — new Operational-graph nodes, siblings to `Contract`.
**Decided:** add `Permit` and `License`, same append-and-supersede shape as `Contract` (never mutated; `supersededBy` on renewal), same Decision-gate write path (`permit-proposal`/`license-proposal` Decision types, mechanically reusing `proposeContractChange`'s exact shape). Relationships: `-[:ISSUED_BY]-> Authority` (**first reuse of `Authority` outside the Knowledge graph** — deliberate: same real-world regulatory body, not a new concept), `-[:APPLIES_TO]-> Facility`/`Asset`, `-[:HELD_BY]-> Organization`. WINAIM's `REGISTRATION`/`CONSENT` are the same shape, narrower — modeled as an `authorizationType` property on `Permit`/`License` rather than two more node types until real data proves otherwise (another YAGNI call, not a deferral of substance).

**(d) `Warranty`** — new Operational-graph node, sibling to `Contract`.
**Decided:** add `Warranty`, `-[:COVERS]-> Asset` (reuses `COVERS`, already safely overloaded across `Contract→Facility`/`AssuranceStatement→Regulation`), `-[:WITH_VENDOR]-> Vendor` (reuses `Contract`'s exact edge name for the same real-world relationship).

**(e) `InsurancePolicy`, `Coverage`, `Exclusion`, `Claim`** — not designed here; already decided elsewhere.
`graph.md`'s 2026-08-22 changelog entry already ruled `InsuranceClause` "belongs in the Assurance graph as a warranty/attestation instrument linked to `Risk`/`Control`" and was deliberately kept out of the `Contract` build. This doc doesn't re-litigate that — it confirms WINAIM's `INSURANCE_POLICY`/`COVERAGE`/`EXCLUSION`/`CLAIM` cluster is the same concept, already has a home, and is still unbuilt. Restated once for traceability: `InsurancePolicy` (Assurance graph) `-[:COVERS]-> Risk` and/or `-[:COVERS]-> Control`; `Coverage`/`Exclusion` as properties of `InsurancePolicy`, not separate nodes; `Claim` deferred entirely — no current data, no current feature (7.5).

**(f) Role enrichment: `Responsibility`, `Authority` (decision scope), `Competency`.**
Gap confirmed absent from `domain.md` today — verified directly, no existing open note covers this.
**Decided:** `Responsibility` and `Competency` → Value Objects attached to the `Person`↔`Role` assignment (the `HAS_ROLE` edge) or to `Role` itself — descriptive/qualifying data, not independently-identified entities with their own lifecycle, so no new node type.
`Authority` (WINAIM's Role-scoped decision-making power) needs an explicit **homonym warning**: it must *not* reuse the `Authority` node — that already means "regulatory body," Knowledge-graph only (verified: zero relationships into it from outside Knowledge today). `Role` already carries a crude `approvalAuthority: Y/N` flag; recommend deepening that into `Role.decisionAuthority` (string/enum — e.g. `"approve up to $X"`, `"site-level"`, `"none"`) as a **property**, not a graph relationship — avoiding exactly the kind of collision WINAIM's own governance trail already had to split out elsewhere (its `GAP-10` tag, e.g. `PLATFORM_TENANT` vs. `BuildingTenant`). This needs a new `domain.md` open note (Operational or Cross-cutting subdomain), styled like the existing `MappingProvenance` note: *"Flagged, not resolved."*

### 7.5 Open items surfaced but not addressed here

- `Jurisdiction`'s own internal granularity (Country/State/City) — WINAIM wants three levels; Vyra's is country-level only today.
- `InsurancePolicy`/`Claim`'s full Assurance-graph shape — location decided (7.4e), properties/edges not designed in depth; revisit when Assurance-graph work is next picked up.
- `Asset -[:PART_OF]-> Asset` composition edge — deferred until a concrete feature needs subsystem/component traversal.
- `Role.decisionAuthority` naming/shape — flagged, not fully specified; needs its own short design pass before `domain.md`/`graph.md` are actually edited.
- WINAIM's remaining groups not reviewed in this pass (Food Processes, HACCP, Chemical Safety, Fire and Life Safety Systems, HVAC/Electrical/Plumbing, Scheduling and Measurement's `Metric`/`Threshold`/`Target`) — these read as vertical-specific specializations of `Control`/`Asset`/`Event` already covered generically; worth a lighter follow-on pass if/when Vyra actually onboards Food-Safety or deep FM-systems content, not before.
- `track.md` gap #18 now tracks this section's Enterprise-graph items (7.4 a/b/c/d/f) as a single entry — split into per-item gaps later only if one starts moving independently of the others.

### 7.6 References

- `WINAIM_Concept_Tree (1).html` — source, not versioned in this repo
- `graph.md` — `Facility` entry (site/building/zone/room-as-attributes precedent), `Asset` entry (`category`/`buildingId`/`zoneId`/`roomId`), `Authority` entry, `Contract` entry incl. its 2026-08-22 changelog ruling on `InsuranceClause` → Assurance graph
- `domain.md` — Operational subdomain's `MappingProvenance` open note (the precedent this doc's new Role/Authority note should follow), `Asset` Aggregate note ("no owned children")
- `foundation.md` §1 (document/evidence provenance), §2 (agent proposals ratified through the Decision gate — the same gate `Permit`/`License` proposals would use)
- `track.md` gap #18 — WINAIM concept-tree content gaps (Enterprise graph)
