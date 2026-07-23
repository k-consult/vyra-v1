# Entity Alignment — Consolidated Compliance Data vs. Vyra Graph Model

**Source data:** `.design/consolidated-entities.md` (extracted from `.design/synthetic-data/data.csv`, 22 worksheets, Industrial Parks/Warehouse/3PL vertical — EHS, Fire, FM, Hazard, Waste, India+UK)
**Compared against:** `blueprint.md` (five-graph domain model), `graph.md` (current "canonical" implemented schema), `roadmap.md` (phased plan)

This is a drift analysis, not a schema decision — it identifies where the new dataset confirms, extends, or conflicts with the current model, and where it lands in the roadmap's phases. No schema or code changes made from this doc alone.

---

## 0. This isn't a refinement of the current seed — it's a second tenant

`graph.md`'s current seed is a pharma/manufacturing incident set (bioreactor, CIP cleaning, water treatment). The new CSV is a different vertical entirely — Industrial Parks/Warehouse/3PL — with no shared IDs or column vocabulary. Given roadmap.md's confirmed decision ("one Neo4j instance per enterprise, not shared multi-tenant"), treat this as **evidence the schema needs to be enterprise-agnostic**, not as data to merge node-for-node with the existing 7-incident graph.

---

## 1. Knowledge graph — biggest gap, and this dataset fills it

Current `graph.md` only implements `Regulation` (flat) and `Control` (incident-scoped, `CTL-{incident}-{seq}`). No `Authority`, `Standard`, `Clause`, `Requirement`, `Jurisdiction`, `Framework`/`Document`/`Section` — despite blueprint.md naming all of these under Knowledge. The new sheets (`02_Regulatory_Authorities`, `03_Regulations`, `04_Standards`, `05_Clauses`, `06_Obligations`) supply almost the full chain: `Authority -[issues]-> Regulation -[has_clause]-> Clause -> Obligation`, plus `Standard` as a parallel source. This is Phase 1 (Global Compliance Catalog) material, effectively pre-seeded.

**Naming collision to resolve before ingest:** blueprint/roadmap use `Requirement`; the new data uses `Obligation` for the same concept (`ObligationID, ClauseID, Description, Obligation Type, Mandatory Y/N`). Recommend mapping `Obligation → Requirement` at compile time rather than adding a second node type — otherwise this reproduces the exact relationship-vocabulary drift Phase 0 is already cleaning up.

`Authority` isn't in blueprint's Knowledge entity list (blueprint lists `Jurisdiction`, not `Authority`), but the CSV's `Authority.Jurisdiction` column shows they're distinct and related (`Authority -[:OPERATES_IN]-> Jurisdiction`). `Jurisdiction` also isn't implemented in current `graph.md` — another gap this dataset surfaces.

---

## 2. Execution graph — Control upgrades from instance to catalog entity

Current `Control` is a one-off, per-incident free-text row. `08_Operational_Controls` is a reusable catalog node (`ControlType`, links to `ComplianceArea`, `RiskID`, `ObligationID(s)`, `ClauseID`, `StandardID`, `RegulationID`, `AuthorityID`) — this is what Phase 1's `:Catalog`-labeled Control should look like.

`09_Task_Master` (39 columns) and `14_52Wk_Calendar` (56 columns, one per week) are a warning sign, not a schema to ingest literally. They re-denormalize everything — Control/Obligation/Clause/Regulation/Standard/Risk FKs *and* org/spatial/scheduling/evidence columns flattened onto one row — the same anti-pattern the roadmap's audit already found in the *current* seed. Roadmap Phase 1 explicitly says: compute the 52-week window at query time from a `Schedule{cadence, anchorDate}` node, don't materialize it. `14_52Wk_Calendar` is precisely the shadow dataset that guidance was written to prevent. `13_Schedule_Rules` maps cleanly to that `Schedule` node; `Task_Master` needs decomposing into a thin `Task` node plus edges, not imported as-is.

New entity with no blueprint home: `Checklist` (`12_Checklist_Template_Mapping`). Natural fit is Execution (`Checklist -[:USED_BY]-> Task`) with a forward link into Assurance as the template behind `Evidence`.

---

## 3. Operational graph — real hierarchy replaces a flat stub

Current `Facility` is flat (id, name, businessUnit) — roadmap Phase 2 already flagged this: *"`Facility` becomes a `Location` subtype or is migrated."* `11_Spatial_Mapping` (100 rows) supplies the actual hierarchy — Company → Site → Building → Floor → Zone → Room — and `19_Asset_Equipment_Master` ties assets to Site/Building/Zone/Room instead of a flat `facilityId`. This validates Phase 2's direction but at real scale, not a placeholder.

`Vendor`/`Asset` enrichment (`20_Vendor_Master`: AMC dates, SLA, contract ref, site coverage) is purely additive onto existing nodes — reinforces the `continuousMonitoring` / "AMC expiry prediction" concept already referenced (as free text) in current `Incident`.

---

## 4. Enterprise/Org (Phase 2) — half the picture

`10_Organization_Mapping` + `18_Roles_Master` match Phase 2's `Role -[:BELONGS_TO]-> Organization` plan directly. But there is **no Person/Identity data anywhere in this sheet** — only role titles, no named individuals. Current `graph.md`'s `Incident.capturedBy`, `reviewedBy`, `Task.owner` are still free-text names, and this dataset doesn't resolve that. Phase 2's `Person`/`Identity` gap stays open.

---

## 5. Intelligence graph — Risk needs to split into two concepts

Current `Risk` is an incident-bound scored instance (inherent/residual score, 1:1 with `Finding`). `17_Risk_Register` is a small reusable taxonomy (16 named risk *types* — Category/Likelihood/Impact/Level — referenced by `Control` and `InsuranceClause`, not by any single incident). These are different things sharing a name. Conflating them under one `:Risk` label also breaks the Phase 0.5 `:Catalog`/`:Enterprise` label-split decision — register rows are catalog data, per-finding scored risk is operational/enterprise data. Recommend splitting into a catalog `RiskType`/`RiskTaxonomy` node vs. the existing per-Finding `Risk` instance.

---

## 6. Assurance graph — one genuinely new domain concept

`21_Insurance_Risk_Clauses` has no home anywhere in blueprint.md's five graphs — "Insurance Risk Mitigation" is named only as a narrative cross-cutting pillar in the source workbook's business-scenario tab, never modeled. It reads like an external attestation instrument tied to `Risk` and `Control` (insurer requirement/warranty, premium impact if non-conformant), pointing toward Assurance (alongside `Attestation`/`Trust Artifact`) rather than Knowledge. This is a product/schema decision, not a mechanical mapping.

`ComplianceArea` is a similar open question: 10 fixed categories, referenced by both `Control` and `Task`. Could be a first-class Knowledge node (`Control -[:BELONGS_TO]-> ComplianceArea`) or just a tag/property — small enough taxonomy that it's a judgment call, not an obvious one.

---

## 7. Relationship vocabulary problem compounds, doesn't just add

`16_Relationship_Matrix` (778 rows) brings its own 20-verb relationship taxonomy (`contains`, `governs`, `hosts_asset`, `satisfied_by`, `mitigated_by`, etc.) across 4 categories (Operational/Organizational/Spatial/Traceability) — none of which match current `graph.md`/`v2.ts` relationship names (`GOVERNED_BY`, `IMPLEMENTS`, `FAILED_AGAINST`, etc.), which per roadmap Phase 0 are already internally inconsistent between `v2.ts` and the running code. Reconciling this new vocabulary should happen *together with* Phase 0's fix, not after — otherwise Phase 0 lands and is immediately stale once this second source gets ingested.

Also worth flagging upstream to the data source: the matrix's own `From_Type`/`To_Type` values include both `REG`/`Regulation` and `STD`/`Standard` as separate type tokens — possibly an inconsistency inside the source data itself.

---

## Net sequencing implication

This dataset is best read as **validation + real content for Phase 1 and (partially) Phase 2** — it doesn't change the roadmap's shape. Implications:

- Phase 0's relationship-vocabulary fix should account for this second vocabulary now, since it's already in hand.
- Phase 1's catalog schema (`Authority → Regulation → Clause → Requirement`, `Standard`, `Schedule{cadence}`) can be built and seeded directly against this source instead of staying speculative.
- Phase 2's Location/Role work has a real hierarchy to target, but Person/Identity is still an unfilled gap.
- `InsuranceClause` and `ComplianceArea` are net-new modeling decisions that don't fit any existing phase and need an explicit call before schema work starts on them.
