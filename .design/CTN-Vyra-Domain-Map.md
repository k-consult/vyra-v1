# CTN-SPO ↔ Vyra Domain Map

**A comparison note, not a canonical doc.** Working analysis from a 2026-09-25 session reviewing an external proposed GRC semantic model (`CTN-SPO-Model.xlsx`, from a win-aim document drop, not versioned in this repo) against Vyra's own domain model. Captures what's structurally comparable, what Vyra was found to be missing, and the design decision on how to close it — so the reasoning doesn't have to be redone if this is revisited. Status: **decided, not yet implemented.**

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
