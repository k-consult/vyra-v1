# Vyra MVP Tracker

**Single source of current build status** — this doc now consolidates what used to be split across `track.md` and `track-platform.md` (merged 2026-11-15; `track-platform.md` retired). Organized by the **three pillars `foundation.md` §1–§3 name** (Catalog, Operational Context, Intelligence), each scaffolded onto the JTBD layers from `foundation.md`'s own operating-model table — not a separate taxonomy, `foundation.md:60` says this doc is exactly where that table's status belongs. Onboarding (§0) is tracked separately since it cuts across all three pillars rather than belonging to one. For the model/requirements themselves (no status) → `foundation.md`. For sequencing → `plan.md`.

---

## Pillar Map

| Pillar (`foundation.md` §) | JTBD Layers | Status |
|---|---|---|
| **1. Catalog** | L1 Knowledge | 🟢 Live |
| **2. Operational Context** | L2 Interpret · L3 Planning *(+ Execution domain)* | 🟡 Partial |
| **3. Intelligence** | L5 Oversight · L6 Assurance · L7 Risk *(+ Assurance domain)* | 🟡 Partial |
| *(shared substrate, not a pillar)* | L4 Graph Spine | 🟢 Live — the graph every pillar reads/writes through |

**Onboarding** (§0, the transition guarantee) is cross-cutting — tracked in its own section below, not folded into one pillar. **Value** (§4, monetization/entitlement) isn't tracked at all yet — no metering or entitlement code exists; out of scope until the three pillars are solid.

**2026-11-14 — legacy synthetic seed retired.** `cli/orchestration/index.ts`/`enterprise-sync.ts` and the feed folders they read (`cli/feeds/csv/{knowledge,execution,operational,intelligence,assurance,enterprise,edges}/`) — single-tenant synthetic seed data — moved to `cli/_bkup/`. This does **not** remove Execution or Assurance from scope — they're sub-domains *inside* Operational Context and Intelligence per the table above, not separate pillars to exclude. What it actually means: those sub-domains currently have **no live, tenant-sourced data** — no `Task`/`CAPA`/`Verification`, no `Finding`/`Risk`/`RCA` for any real tenant. Tracked as pending items below, not scoped out.

---

## 1. Catalog — 🟢 Live (L1 Knowledge)

Regulatory content (`Regulation`/`Clause`/`Obligation`/`Control`/`Authority`/`Jurisdiction`/`ComplianceArea`/`Report`/`Task`/`Schedule`), synced per authority board (`cli/orchestration/catalog-sync.ts`) and replayed into every tenant database on provisioning.

**Pending**
- [ ] Decide the Demography/`workerCategory` and Industry/Asset-Category controlled vocabularies — undecided catalog concepts, invented for the journey mockups with no decision behind them, that block the Obligation Cockpit (Intelligence, below). A candidate source surfaced 2026-11-15: WINAIM's `WINAIM-CPCB-Map.xlsx` (external reference, `win-aim/documents/from-winaim/08-OCT-2026/`) carries a real Topic→Sub-topic→Source→Activity→Asset→Aspect taxonomy — not yet evaluated as the actual vocabulary, just identified as a real candidate rather than inventing one from scratch.
- [ ] Central catalog-distribution service (a real `vyra-catalog` synced down into each tenant) — still designed, not built, as its own physically separate store. `catalog-sync.ts` still reads a local CSV into whichever database `DB_NAME` names — no diffing engine. Partially narrowed by 2026-11-15's on-demand tenant re-sync (below): the *propagation* gap is closed for now via an explicit action; the *separate master store* gap is not. Revisit once more than one or two real tenants exist (`plan.md`).

**Closed**
- `Control.docType` (policy/sop) split — 2026-09-22
- Catalog versioning exercised: `REG-001-V2`, `supersededBy`, `GET /knowledge/regulations/:id/history` — 2026-09-22
- Source-span retention: `sourceDocumentId`/`sourceAnchor` on `Clause`/`Obligation` — 2026-09-22
- Sync-run attribution: `syncedAt`/`sourceRevision` stamped on every synced node/edge, `GET /knowledge/sync-status` — 2026-09-22
- Catalog feeds restructured one-folder-per-authority (`bis`/`fire`/`factories`/`peso`/`hse`/`fra`/`ea` added alongside `cpcb`, each its own `authorities`/`jurisdictions`/`regulations.csv`); `catalog-sync.ts --authority` is now optional — omitted, it syncs every board except `ignore/` in one call, same convention `ingest.sh` now delegates to instead of looping itself. `ignore/`'s combined `AUTH-004` (CPCB/SPCB) and its two regulations deliberately left unmigrated, pending a decision to re-point them at the already-live `AUTH-009`/`AUTH-010` instead — 2026-11-15
- Global Catalog screen (`/catalog`) baselined as structurally pinned to Vyra Central: it previously inherited whichever tenant's `X-Tenant` header happened to be active in the browser (a real bug this restructuring surfaced), now forced off via a `central: true` request opt regardless of tenant selection. New tenant-scoped `/tenant/catalog` screen (sidebar item ahead of Structure/Documents/Obligations) reads a tenant's own database the normal `X-Tenant` way and can re-sync it against central on demand, both from its own Refresh button and a one-shot icon in the sidebar — `POST /tenants/:name/catalog/sync` — 2026-11-15

---

## 2. Operational Context — 🟡 Partial (L2 Interpret · L3 Planning + Execution domain)

*The hardest of the three — the catalog is the same for every enterprise in a sector, this is where they differ.* A tenant's real-world footprint: `Facility`→`Asset` structure, `Permit`/`Warranty`/`Contract`, `DocumentObligation` tracking, `Hazard`/`EmergencyPlan`, `ReportSubmission`.

**Pending**
- [ ] (#21) Fire/Hazard execution-capture layer — decide `Form`/`Question`/`InspectionEvent`/`Observation` as its own subdomain vs. folded into `Signal`, before building any of it (`domain-extension.md`'s Gaps section) — the largest, most architecturally consequential piece still undecided
- [ ] (#21) Drill-task generator off `EmergencyPlan.drillFrequency` — `Task -[:VERIFIES]-> EmergencyPlan` is schema-designed, nothing creates the recurring `Task` yet
- [ ] (#21) UI screen to propose/list `Hazard`/`EmergencyPlan`/`HazardAssessment` — same gap `Permit` had before its own screen landed
- [ ] No live Execution-domain data (`Task`/`CAPA`/`Verification`) for any tenant — legacy synthetic seed retired 2026-11-14, no tenant-sourced replacement decided
- [ ] Design what a confidence-scored Applicability proposal actually requires from an agent — new agent capability, not UI. Real Applicability Scoping is data-only via Landscape drill-down today. This is now also named in-product: the Onboarding wizard's Applicability and Ratification stages (below) render an honest "not yet built" placeholder citing this exact gap, rather than faking the mockup's flat enterprise-wide checklist or facility-bundle approve/reject

**Closed**
- 52-Week Calendar: task completion tracking (`PATCH /execution/tasks/:id`) + event/risk-triggered reactivation — 2026-09-22
- `HAS_ROLE` resolution via title→role mapping, 6 of 7 people — 2026-09-22
- `COVERED_BY` edge provenance (`origin`/`confidence`/`derivedAt`) — 2026-09-22
- `Signal.raisedBy` required, fails fast (400) if missing or unresolved — 2026-09-22
- `Contract` propose/approve write path, first onboarding-UI write channel — 2026-09-22
- WINAIM Enterprise-graph parity: `Facility -[:IN_JURISDICTION]->`, `Asset.assetType`, `Permit`, `Warranty` — 2026-10-04
- (#20) `ReportSubmission` write path + `PATCH .../acknowledge` — 2026-10-04
- (#21) Fire/Hazard decision pass + `Hazard`/`HazardAssessment`/`EmergencyPlan` live, Decision-gated write paths — 2026-10-04
- Applicability Scoping's 2 uncovered Security-area assets — ⚪ by-design documented absence, not a gap
- Tenant onboarding mechanics (provisioning, document ingestion, runtime switching) — see **Onboarding** section below

---

## 3. Intelligence — 🟡 Partial (L5 Oversight · L6 Assurance · L7 Risk + Assurance domain)

*Where the JTBD Principle becomes mechanism.* Agent reasoning over the twin — the human-in-the-loop `Decision` gate (every proposal path runs through it), `HazardAssessment`'s computed score, agreement-rate feedback.

**Pending**
- [ ] (#19) Obligation Cockpit foundations — `Obligation`/`Task` delegation-tree relationship; Autonomy Level as a real per-workflow-class aggregate (today only per-`Decision` instance); Loop-stage as a real state model on `Task`/`Decision` (today `Decision.status` is only pending/approved/rejected). Design reasoning in `.design/journey/concept-notes.md` (frozen, reference only) — `04-obligation-cockpit.html` already mocks the UI side of this (pivots, bounded window, per-item autonomy/loop-stage, tree rollup); none of it is backed by real graph schema yet. Blocked on Catalog's vocabulary decision above first. Now also the named placeholder behind the Onboarding wizard's fourth stage, "Obligation Blueprint" (below) — citing this gap number directly in-product rather than faking a finished view.
- [ ] Signal → Agent → Task → Decision loop (Involve/Inform) — how a floor signal or a `Schedule` firing actually resolves to a `Task` under the Obligation Cockpit's delegation tree. Deferred until the item above is real — reasoning about the loop before the tree it operates on exists would be premature.
- [ ] No live Intelligence-domain data (`Finding`/`Risk`/`RCA`) for any tenant — legacy synthetic seed retired 2026-11-14; needs a real design decision before Intelligence can move past Decision-gate approvals into actual risk/finding reasoning on tenant data
- [ ] (#7) Scenario Simulation (L7) — "what happens if this control fails," reasoning across risk/control/signal intelligence together over live graph state. Needs multiple agent families reasoning over shared state simultaneously; unscoped. ⏸️ On hold by request, 2026-10-04

**Closed**
- Escalation Paths: `ESCALATES_TO {order}` chain to seeded `Role` — partial by design, 2026-09-22
- Audit-Ready Export: honest `origin: agent-proposed | synthetic` tagging — ⚪ by-design, not a gap
- Multi-turn, tool-using reasoning (`reasonWithTools`) — `control-intelligence` only, 2026-09-22
- Learning-from-overrides feedback (`GET /intelligence/decisions/agreement-rates`) — `control-intelligence` only, 2026-09-22

---

## Onboarding (§0 — the transition guarantee, cross-cutting)

Not one pillar — the mechanism that exercises Catalog, Operational Context, and Intelligence together to bring one real tenant live end to end. (#8, #22)

**Built, in order:**
1. `CutoverCriterion` and `Blueprint` nodes — live, Decision-gated graph state for cutover tracking and org/role/asset ratification — 2026-09-25 / 2026-09-26
2. Tenant database provisioning — `POST /tenants` creates a dedicated `grc-tenant-<name>` Neo4j database, replays the full catalog, tracked in a `tenants` registry DB — 2026-10-04
3. Document-catalog ingestion — `cli/orchestration/document-catalog-sync.ts` + `POST /tenants/:name/document-catalog` ingest a customer's own tracking spreadsheet into real `Facility`/`Asset`/`DocumentObligation` nodes; verified against a real customer spreadsheet (93 rows / 3 sites) — 2026-10-25
4. Runtime tenant switching — `X-Tenant` header + `lib/tenant-context/`'s `AsyncLocalStorage`, no restart needed; `/tenant/structure`, `/tenant/documents`, `/tenant/obligations` read through it — 2026-10-25
5. Document upload reachable from the tenant's own workspace, not just the admin screen — `ToolbarMenu`/`UploadDocumentTrigger`, category-tile document grid — 2026-11-09
6. Tenant-admin dialog hardening — active tenant's `Delete` disabled; non-active delete refreshes in place instead of a full reload; `ConfirmDialog`-in-`<tr>` hydration fix via `createPortal`; sidebar shows `TENANT: <name>` when active — 2026-11-14
7. Tenant catalog management baselined — `POST /tenants/:name/catalog/sync` re-runs the board replay against an already-provisioned tenant (reuses provisioning's `runCatalogSync`, now authority-optional) and records `authoritiesLoaded`/`lastCatalogSyncAt` on its registry entry; exposed both as the tenant-scoped Catalog screen's Refresh action and a standalone sidebar icon — 2026-11-15
8. Enterprise Onboarding wizard — `/onboarding` relisted as the `Tenant` sidebar section's **first** item (previously delisted 2026-10-03), replacing the old flat `CutoverCriterion`/`Blueprint` propose/list page with four stages in operating order, **Structure → Applicability → Ratification → Obligation Blueprint** (deliberately reordered from `.design/journey/03-enterprise-onboarding.html`'s mockup, which did Applicability before Structure — applicability-per-entity needs the org tree to exist first). Stage 1 (**Structure**) is fully live — a new capability, not a relabel of the document-catalog upload, superseded by #9 below (originally a hardcoded CSV format onto `Facility`/`Asset` only; now blueprint-driven, see #9). Stages 2–4 render named, gap-referenced "not yet built" placeholders rather than faking the mockup's completeness — see Pending below — 2026-11-15
9. `TenantBlueprint`/`Level`/`Property` metadata model — replaces Stage 1's original hardcoded CSV shape with a generic, per-tenant, user-editable hierarchy (`TenantBlueprint -[:STARTS]-> Level -[:NEXT]-> Level`, each with one or more `Property`), seeded with the standard 7-level default (`Organisation → BusinessUnit → Facility(alias "Site") → Building → Floor → Area → Asset`) at provisioning (`seedDefaultBlueprint`, `api/modules/blueprint/`), editable via `/tenant/blueprint`. `cli/orchestration/structure-sync.ts` now reads the active blueprint to derive expected CSV columns and build the real node tree — `Facility`/`Asset` stay the reserved, already-live node types (every other module pointing at them keeps working untouched), but `Building`/`Floor`/`Area` (and `Organisation`/`BusinessUnit` above `Facility`) are now real nodes linked by `BELONGS_TO`, not flattened `Asset.buildingId`/`zoneId`/`roomId` properties (retired). See `.design/graph.md`'s "Tenant Blueprint Graph" section. Directly resolves the schema half of the Pending item below ("design what extending `Blueprint` to a full org tree requires") — the *ratification* half (ratifying this tree through a Decision gate, ratifying it per-entity rather than as one proposal) is a separate, still-open concern — 2026-11-15

**Pending, in order:**
- [ ] Stage 2 (**Applicability**) write path — enterprise-wide regulation scoping, e.g. a new Decision-gated `(Organization)-[:IN_SCOPE_OF]->(Regulation|Standard)` edge. Today this stage is a named placeholder in the wizard, not data-only-via-Landscape-drill-down surfaced as a step
- [ ] Stage 3 (**Ratification**) — the per-entity × per-regulation approve/reject grid; blocked on the new Applicability-proposal agent capability (Operational Context, above) and on extending `Blueprint` past one-facility-per-proposal (bullet below). `ProposeBlueprintForm`/`BlueprintCard` (the old `/onboarding` page's Blueprint propose/list) fold in here once built — not ported, not dropped
- [ ] Stage 4 (**Obligation Blueprint**) — Gap #19, the Obligation Cockpit (Intelligence, above). `ProposeCutoverCriterionForm`/`CutoverCriterionCard` (the old `/onboarding` page's cutover-criterion propose/list — real, live functionality) fold in here too once built; until then they have no home in the wizard, by explicit choice over keeping them on a separate URL
- [ ] Filename-convention parser to route a customer's *received document files* (the PDFs themselves) — distinct from the spreadsheet, already handled
- [ ] Route customer filing documents into the live `Permit`/`ReportSubmission` paths — `DocumentObligation` is a parallel tracking record today, not wired into either
- [ ] Document-evidence path for historic logs (lab reports, inspection logs)
- [ ] Propose-and-approve discipline for customer-submitted `Asset`/`Vendor` data — real nodes are created directly from the spreadsheet (both document-catalog and the new structure/asset-register path) today with no `Decision` gate
- [ ] Facet-intake step feeding a site's `Blueprint` proposal (site type, applicable regulations, asset landscape)
- [ ] `CutoverCriterion` per site, so "folder complete → live calendar" is a queryable exit condition
- [ ] Extending `Blueprint` (the onboarding ratification node, above) from one-facility-per-proposal to a full org tree — the *schema prerequisite* is now resolved by #9's `TenantBlueprint`/`Level`/`Property` model (a separate, new concept — not an extension of `Blueprint` itself), but `Blueprint`'s own proposal/ratification flow still only covers one `Facility` at a time. Still the direct blocker for Stage 3 Ratification above

**On hold by request (2026-10-04):** `ContinuityBaseline` + its feed, shadow-mode dual-tracking, decommissioning-as-a-Decision, a real `Workflow` node (`CutoverCriterion.workflowName` is still a plain string), an onboarding agent family to move `Blueprint` from human-authored to agent-inferred. Each its own future slice — deprioritized, not abandoned.

No path yet exists end-to-end from "customer sends a filled document catalog" to "that customer's compliance calendar goes live" — even though most individual pieces (`Contract`, `Permit`, `Blueprint`, the Decision gate, `CutoverCriterion`) already exist for other purposes. This would be the first real exercise of `foundation.md` §0's onboarding guarantees end to end, still untested against one real customer's full document set.

---

## Not MVP-gating

**Role enrichment** (`Responsibility`/`Competency`/decision `Authority`) — WINAIM-parity/white-label content (`foundation.md` §4), not an onboarding-transition requirement; neither `Blueprint` nor `CutoverCriterion` reads it. Needs its own short design pass (`domain-extension.md` §7.5) before any schema change — likely direction is `Role.decisionAuthority` as a property, not a new node (a new node would clash with the existing `Authority` = regulatory-body node).

**Domain model is anemic vs. `domain.md`** (#9) — `api/modules/*/repo.ts` are plain Cypher-running functions; none of `domain.md`'s Aggregates, Domain Events, or Factories exist in code. An architecture decision to make deliberately, not a side effect of another fix. ⏸️ On hold by request, 2026-10-04.

---

## Where to go next

- **Model, value and guarantees** (no status) → `foundation.md`
- **Phase sequencing** → `plan.md`
- **Schema, relationships, Cypher patterns** → `graph.md`
- **Software layers & components** → `architecture.md`
- **DDD model** → `domain.md`
