# Journey v1 — Implementation Plan

**Status: J1 and J2(a)/(b) done; J0 Sub-phase 1 (Master Catalog) done 2026-10-03; J0 Sub-phase 2 (Client Onboarding) next; J2(c)/(d)/(f), J3, J4, J5 open; J6 deferred.** This is the resume point for turning `.design/journey/`'s four mockups and their supporting design work into real Vyra features. Written so a fresh session can pick this up cold — read this doc, then `concept-notes.md`, then `domain-extension.md`, then skim the four HTML mockups (visual reference, not literal spec), then the current schema in `graph.md`/`domain.md`/`track.md`.

**2026-10-03 realignment — a go-live customer (Royal Orchid Hotels, CPCB/India compliance) reprioritized this plan.** A new **Phase J0 — Go-Live Customer Track** is inserted ahead of everything else, in two sequential sub-phases: **(1) Master Catalog (CPCB)** — set up the schema, ingest the catalog, view it — then **(2) Client Onboarding** — set up document ingestion, onboard the client, view compliance posture. It pulls J2(c) `Permit`/`License` forward, scoped to the customer's real instrument types rather than the generic WINAIM list. **J3/J4/J5 are paused** until J0 ships — none of them block the go-live, and splitting attention across both risks neither landing. J6 remains deferred as before.

**Explicitly out of scope here:** Signal/Event flow. Flagged as deferred in every mockup's sidebar since Day 2 of this exercise and never given its own design pass — it needs a `concept-notes.md`-style exploration before it can even be sequenced, not attempted in this plan (see §5, Phase J6).

---

## 1. Triage — what's real, what's decided-not-built, what's still undecided

Precision matters here: some of what the mockups show is already live in the real graph and just needs UI; some is a decided design (`domain-extension.md` §7.4) waiting to be built; some was invented for the mockups and has **no decision behind it yet** — building it before deciding it would repeat the exact mistake `domain-extension.md` was written to avoid.

| Item | Status | Source | What's actually needed |
|---|---|---|---|
| `Control.controlType` (Preventive/Detective/Corrective) | **Real, live** | `domain-extension.md` §7.3 | UI facet only — real `/knowledge` page has none today |
| `Control.docType` (policy/sop) | **Real, live** | `graph.md` | UI facet only |
| Regulation/Standard versioning, source-span, sync-run attribution | **Real, live** | `track.md` gaps #12–14 | Already surfaced in `knowledge.tsx` |
| `CutoverCriterion`, `Blueprint` (single-facility) | **Real, live** | `track.md` gap #8 | Already has UI at `/onboarding` |
| `Contract` (Decision-gated) | **Real, live** | `graph.md` | Already has UI at `/enterprise/contracts` |
| `Facility -[:IN_JURISDICTION]-> Jurisdiction` | **Real, live** (found already built 2026-10-02) | `domain-extension.md` §7.4(a) | None — `v2.ts`'s `IN_JURISDICTION`, fed from `cli/feeds/csv/catalog/jurisdictions.csv` |
| `Asset.assetType` | **Real, live** (found already built 2026-10-02) | `domain-extension.md` §7.4(b) | None — `v2.ts`'s `assetType` prop, fed from `convert-enterprise-seed.ts` |
| `Permit`, `License` nodes | **Decided, not built — pulled into Phase J0** | `domain-extension.md` §7.4(c) | New nodes, mirror `Contract`'s Decision-gate pattern; scope instrument types to the customer's real set (CTE/CTO/HWM Authorization/Fire NOC/CGWA NOC), not the generic WINAIM list |
| `Warranty` node | **Decided, not built — paused (J2)** | `domain-extension.md` §7.4(d) | New node, mirror `Contract`; no customer document maps to it, not urgent |
| `Role.decisionAuthority`, `Responsibility`/`Competency` | **Decided in outline, shape not finalized — paused (J3)** | `domain-extension.md` §7.4(f), §7.5 | Needs the short design pass that doc already flags before building |
| Demography (`workerCategory`) as a real property | **Undecided — invented for the mockups — paused (J3)** | Stage 2/4 HTML | Needs a `domain-extension.md`-style decision first: is it an `Obligation` property, a `Control` property, something else? Not settled. |
| Industry / Asset-Category controlled vocabularies | **Undecided — invented for the mockups — paused (J3)** | Stage 2 HTML | Same — needs a decision pass, not a build |
| NLP "Ask" search | **Explicitly illustrative in the mock** | Stage 2 HTML | Real semantic search is a distinct, much larger initiative — not scoped by this plan at all |
| Confidence-scored Applicability proposals | **Mocked, no agent behind it — paused (J4)** | Stage 3 HTML | Real Applicability Scoping is data-only via Landscape drill-down today (`nav-shell.tsx`'s own gap note); needs the underlying agent reasoning before the UI can be real |
| Multi-facility Blueprint (full org/role/asset tree in one proposal) | **Mocked, narrower than reality — paused (J4)** | Stage 3 HTML | Real `Blueprint` is scoped to one facility per proposal by design (`track.md` gap #8); extending to a full tree is new agent + schema work, not a UI change |
| Task delegation tree (`Obligation → sub-task → sub-task`) | **Does not exist at all — paused (J5)** | `concept-notes.md` §3 | The single biggest gap — no relationship type for this today; nothing in Phase J5 is real until this is designed |
| Autonomy Level as a per-workflow-class aggregate | **Partially real — paused (J5)** | `foundation.md` §3 — `Decision.autonomyLevel` exists per-Decision only | Needs a real "workflow class" concept before it can aggregate |
| Loop-stage (dormant/pending/reasoning/informed) | **Does not exist — paused (J5)** | `concept-notes.md` §1.6 | `Decision.status` today is only pending/approved/rejected — this is a new state model layered on top |
| 52-week grid superimposed on real `Schedule`/`Task` | **Partially real — paused (J5)** | `graph.md` Execution Graph (`Schedule`, `Task`, `APPLIES_TO` already live) | UI work once `Task` carries enough facility/role/executor linkage to compute the same rollups the mock shows |
| Signal → Agent → Task → Decision loop (Involve/Inform) | **Deferred, never designed** | `concept-notes.md` §1.9 (sketch only) | Out of scope here — see Phase J6 |
| `Document`/`DocumentVersion` node + upload ingestion | **New — customer-driven, not in the original mockups** | Royal Orchid onboarding guide, `predicate_master.json` | New Phase J0, see below |

---

## 2. Principle governing the sequence below

**Never build an "undecided" row before it has a decision.** Two items in the triage above (Demography, Industry/Asset-Category vocab) look small but have no home in the graph yet — building them straight from mockup data would silently create schema this project didn't actually decide, the exact anti-pattern `domain-extension.md` exists to prevent. They get their own short decision pass (Phase J3) before any code.

**A go-live customer reprioritizes over a vision-track phase.** Phase J0 (Document Ingestion) exists because a real customer's onboarding requirement arrived, not because it was next in the original sequence — it jumps ahead of J2(d)/(f) and pauses J3–J5 outright. None of J3–J5 block J0, so this is a priority call, not a dependency: resume them once J0 ships, don't interleave.

---

## 3. Build sequence

### Phase J0 — Go-Live Customer Track (priority — added 2026-10-03)
Driven by a real onboarding customer (Royal Orchid Hotels, CPCB/India compliance) whose source material arrives as scanned documents organized by site, not CSV rows. Source: `.design/journey/` (this plan's own conventions) plus three external references read for this phase — the customer's `Royal_Orchid_Document_Organization_Guide.txt` (six document categories per site: Consents/NOCs, Filings, Asset register, Vendor AMC, Historic logs, Tickets & CAPA; filename convention `SiteCode_Category_Agency_Asset_DocumentType_Year.pdf`), WINAIM's `predicate_master.json`/`cpcb_spo_map.json` (confirms `Permit`/`License`/`Document` as the missing shapes, supplies the real CPCB instrument/obligation vocabulary to scope them against), and `grc_registry_model_explorer.html` (the meta-model one level up — 48 concepts, refines the instrument shape and surfaces the Asset↔Consent binding below as an explicit customer requirement, "item 5 of the brief"). Laid out as two sequential sub-phases — the catalog has to exist before a client's documents can be mapped against it.

**Sub-phase 1 — Master Catalog (CPCB)**
1. **Set up master catalog for CPCB** — ✅ schema done 2026-10-03 (`graph.md`, `domain.md`, `cli/semantic-contract/contracts/v2.ts`; `tsc --noEmit` clean). No data yet — that's Step 2:
   - `Permit`/`License` node with an `instrumentType` discriminator (`consent`/`authorization`/`noc`/`registration`/`permit`/`license` — same pattern as `Control.controlType`, not six node labels), scoped to the customer's real set (CTE/CTO-Water, CTO-Air, HW Authorization, Fire NOC, CGWA NOC) + `Permit.expiryDate`/renewal window
   - `Asset -[:COVERED_BY_CONSENT]-> Permit` — **required, not optional**: without it, a Permit renewal/amendment can't identify which Assets it covers (the registry doc's explicit justification)
   - `Report`/`ReportSubmission` nodes (not flat properties — "Filings" needs a real Received/acknowledged status) with `Obligation -[:REQUIRES_FILING]-> Report` and `ReportSubmission -[:SUBMITTED_TO]-> Authority` (filing recipient can differ from the regulation's own `ISSUED_BY` authority, e.g. CGWA vs SPCB)
   - `Task/Schedule -[:ASSIGNED_TO]-> Vendor` (vendor-executed checks, e.g. AMC-performed stack monitoring)
   - Properties: `CAPA.triggerCondition`, `CAPA.deviationApprovedBy`, `Task.evidenceMethod`, `Facility.facilityType`
   - Update `graph.md`/`domain.md`/`v2.ts` in the same pass
2. **Ingest catalog** — ✅ done 2026-10-03, revised same day. `cli/scripts/convert-cpcb-seed.ts` converts the vendored `.design/__ref/synthetic-data/cpcb_spo_map.json` into `cli/feeds/csv/catalog/cpcb/{authorities,jurisdictions,complianceAreas,regulations,clauses,obligations,reports,controls}.csv` — 5 Authorities (CPCB/SPCB/MoEFCC/CGWA/ULB), 1 Jurisdiction (India), 2 ComplianceAreas (reused from the prior catalog), 11 Regulations, 11 synthetic Clauses (one per act — CPCB has no clause-level granularity), 29 Obligations, 29 Controls, 19 `Report` rows (deduped on the full report_type+authority+cadence tuple). 24 of 29 Obligations carry `REQUIRES_FILING`; the other 5 are internal-NC-log-only and left without a `reportId`.

   **Revision same day — per-authority ingestion, `tags` + full-text search, `Report` cadence split.** Prompted by moving the pre-existing Fire Safety demo catalog out of the ingest path (to `cli/feeds/csv/catalog/ignore/`) and the DB being cleaned:
   - `cli/orchestration/catalog-sync.ts` now requires `--authority=<folder>` and auto-discovers files by name within `cli/feeds/csv/catalog/<authority>/` — no more static `ingest-hints.json` feedMap (deleted); a new board needs only a folder, zero code edits. `./ingest.sh` loops over every board folder except `ignore/`.
   - `v2.ts`'s `PropMap` gained `isArray`/`delimiter`, letting a CSV cell compile to a real `string[]` (`cli/compiler/index.ts`). `Regulation`/`Clause`/`Obligation`/`Control`/`Report` all gained a `tags` property (e.g. an Obligation's tags: `['CPCB', <spo.subject>, <spo.predicate>, 'Mandatory']`) — the authority/board name ("CPCB") lives here as one tag value, not a separate structural label. Backs a new `catalog_search` full-text index (`cli/projection/index.ts`) over `[name, text, description, tags]` across all five types — verified live via `db.index.fulltext.queryNodes`.
   - `Report.cadence` (flat free text) was wrong — CPCB's cadence strings conflate a periodic schedule and an event trigger (e.g. "Quarterly / at NOC renewal" is both). Split into `cadenceUnit`/`cadenceInterval` (reusing `Schedule`'s shape), `triggerCondition`, and `cadenceRaw` (original text preserved); `parseCadence()` derives the split, handling pure-periodic, pure-event, and hybrid cases.

   Verified live post-revision: full `Regulation → Clause → Obligation → Control` chain, `Obligation -[:REQUIRES_FILING]-> Report`, `tags` arrays, split cadence fields, and full-text search all resolve correctly via direct Cypher. **Current live DB is CPCB-only** — the original Fire Safety catalog (`REG-001`–`REG-011`, 34 clauses/obligations, 30 controls) is parked under `ignore/`, not loaded; `graph.md`'s counts for that dataset describe `ignore/`'s content, not the current live graph.
3. **View catalog** — ✅ done 2026-10-03. Verified live: the existing `/catalog` UI already rendered CPCB data correctly (facet rail + list + chain-card layout already matched the journey mock's visual language — dark zinc/emerald palette, three-pane structure). Two real gaps found and closed against `02-catalog-browsing.html`'s facet set: (1) **Jurisdiction facet** — real, live data (`Regulation.jurisdictionId`) that the mock lists as its #1 facet but the UI never exposed; added `GET /catalog/jurisdictions` and wired it in, same pattern as the existing Authority facet. (2) **Chain view showed nothing for `REQUIRES_FILING`** — extended `TRACE_FORWARD` to `OPTIONAL MATCH` the linked `Report` (also switched `Control` to `OPTIONAL MATCH`, fixing a latent bug where an obligation with no control vanished from the chain instead of showing as a documented gap) and added a "Requires filing" block to `ChainRow`, with an explicit "no distinct external filing" line for the 5 internal-only obligations — same documented-absence discipline used elsewhere. Screenshotted via Playwright against the live app: Jurisdiction facet shows India 18 / UK 5, CPCB authorities appear correctly, `AA-01`/`AA-02`'s filing info renders, `HW-03`/`REG-004`'s no-filing case renders. `Permit` isn't live yet (Phase J0 Sub-phase 2), so the chain view doesn't show it — correctly deferred, not a gap in this step.

**Sub-phase 2 — Client Onboarding (Royal Orchid)**
1. **Set up document ingestion** — `Document`/`DocumentVersion` node; `POST /enterprise/documents` upload endpoint (file → blob storage); parser for the customer's filename convention (`SiteCode_Category_Agency_Asset_DocumentType_Year`); map their 6 folders to Vyra shapes (Consents/NOCs→Permit/License + `COVERED_BY_CONSENT`, Filings→Report/ReportSubmission, Asset register→Asset, Vendor AMC→Contract, Historic logs→Evidence, Tickets&CAPA→Incident/CAPA); extraction landing low-confidence as `pending-interpretation`; every proposed node through the existing Decision-gate, same discipline as `Contract`/`Blueprint`/`Obligation`; upload UI (drag-drop per category, confirm parsed Site/Agency/Asset before submit)
2. **Onboard client** — upload Royal Orchid's actual documents for one pilot property, review/approve extracted Permits/Assets/Contracts/Evidence/Reports via the Decision queue
3. **View compliance posture** — extend the coverage-score query to roll in `Permit` validity (via `COVERED_BY_CONSENT`) alongside Obligation/Control coverage; per-Facility posture view (obligations met, permits valid, filings on time, open CAPAs), reusing the `/assurance` pattern

**Deferred from this phase** (real concepts in `grc_registry_model_explorer.html`, not needed for the pilot): Fire/Hazard domain (`Hazard`, `HazardAssessment`, `SafetyDataSheet`, `EmergencyPlan`, `Drill`, `FireSafetySystem`, `HazardousMaterialStore` — Royal Orchid's folders only need Fire NOC, already a Permit `instrumentType`); `Form`/`Question`/`InspectionEvent`/`Observation` checklist-execution layer (belongs with J6, Signal/Event flow); the registry's onboarding **Facets** tab — a lighter-weight version of paused J4's Applicability work, revisit then.

### Phase J1 — Catalog UI parity (lowest risk: real data, UI-only) — ✅ done 2026-09-27
- ~~Add Control Mechanism (Preventive/Detective/Corrective) facet to the real `/knowledge` page~~ — done, plus more: see `track.md`'s 2026-10-02 rollup entry (module renamed `knowledge`→`catalog`, `docType` facet, Obligation manual-entry channel).

### Phase J2 — Enterprise-graph schema decided in `domain-extension.md` §7.4
- (a) `Facility -[:IN_JURISDICTION]-> Jurisdiction` — ✅ done (found already built 2026-10-02, landed in `36325e7`)
- (b) `Asset.assetType` (controlled vocabulary) — ✅ done (same commit)
- (c) `Permit`, `License` nodes — **moved to Phase J0**, scoped to the go-live customer's real instrument set
- (d) `Warranty` node, reusing `COVERS`/`WITH_VENDOR` — **paused**, no customer document maps to it yet
- (f, partial) `Role.decisionAuthority` property — **paused**, folds into J3's design pass
- Update `graph.md`/`domain.md` in the same pass, per this repo's own convention; close the relevant slice of `track.md` gap #18 as each lands.

### Phase J3 — Decide before building: journey-invented catalog concepts — **paused until J0 ships**
Not a build phase — a design pass, output is a doc, same shape as `domain-extension.md`:
- Where does Demography (`workerCategory`) actually belong in the graph? Obligation? A new join concept? Decide, then schedule the build separately.
- Same question for Industry / Asset-Category controlled vocabularies.
- `Role.decisionAuthority`'s full shape/enum (flagged as unresolved in `domain-extension.md` §7.5) — finish this here too, it's the same kind of short pass.

### Phase J4 — Enterprise Onboarding real gaps — **paused until J0 ships**
- Design (not yet build) what a confidence-scored Applicability proposal actually requires from an agent — this is new agent capability, not UI.
- Design what extending `Blueprint` from one-facility-per-proposal to a full org tree requires, schema and agent both.

### Phase J5 — Obligation Cockpit foundations (largest, most novel — needs its own design pass, not just implementation) — **paused until J0 ships**
Nothing here is buildable until the schema exists:
- Design the delegation-tree relationship (`Obligation`/`Task` → sub-task) — the one thing every other Cockpit feature depends on.
- Design Autonomy Level as a per-workflow-class aggregate (today it's per-`Decision` only).
- Design Loop-stage as a real state model on `Task`/`Decision`.
- Only after those three land: build WHO/WHERE/WHEN/Demography as real pivots, and the 52-week grid, over real `Task` data instead of the mock's static classes.

### Phase J6 — Signal/Event flow
Out of scope for this plan. Needs its own `concept-notes.md`-style exploration first: how does a floor signal or a `Schedule` firing actually resolve to a `Task` under the Phase J5 delegation tree, and when does the platform decide Involve vs. Inform. Revisit after J5's foundations exist — reasoning about the loop before the tree it operates on is real would be premature.

---

## 4. Track.md integration

`track.md` gap #19 added alongside this plan, covering the Phase J3/J5 items specifically (the two genuinely undecided/nonexistent clusters) — mirrors how the WINAIM comparison earned gap #18. Phase J1/J2/J4 don't need new gap numbers; J2 closes part of the existing gap #18.

**Phase J0 is not yet in `track.md`** — it's a new, customer-driven workstream with no corresponding gap number today. Give it one (`track.md` gap #20, Document Ingestion) once J0's schema lands, same convention as #18/#19.

---

## 5. References

- `.design/journey/concept-notes.md` — the Obligation Cockpit's conceptual model (delegation tree, Autonomy Level vs. Loop-stage, bounded window)
- `.design/domain-extension.md` — the WINAIM/CTN comparison this plan's Phase J2/J3 build on
- `.design/track.md` gaps #8, #9, #18, #19 (#20 pending for J0)
- `.design/journey/01-catalog-ingestion.html` … `04-obligation-cockpit.html` — visual reference for what each phase is aiming at (not a literal spec — the mockups use static sample data throughout)
- `foundation.md` §0, §2, §3 — onboarding, Actor/autonomy-as-assignment-property, the Decision gate and autonomy-level-earning discipline every phase above has to honor
- `/Users/krishnan/_ks/work/win-aim/documents/from-winaim/28-SEP-2026/Royal_Orchid_Document_Organization_Guide.txt` — the go-live customer's actual onboarding document shape, driving Phase J0
- `/Users/krishnan/_ks/work/win-aim/documents/from-winaim/28-SEP-2026/cpcb_spo_map.json`, `predicate_master.json` — CPCB regulatory vocabulary and WINAIM's general SPO predicate set, cross-checked against Vyra's object model for Phase J0's schema scope
- `/Users/krishnan/_ks/work/win-aim/documents/from-winaim/28-SEP-2026/grc_registry_model_explorer.html` — the registry meta-model above both (48 concepts, facets, 36 predicates); source of J0's `COVERED_BY_CONSENT` requirement, the `instrumentType` discriminator, and the `Report`/`ReportSubmission` nodes
