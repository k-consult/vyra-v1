# Journey v1 — Implementation Plan

**Status: planning, not yet implemented.** This is the resume point for turning `.design/journey/`'s four mockups and their supporting design work into real Vyra features. Written so a fresh session can pick this up cold — read this doc, then `concept-notes.md`, then `domain-extension.md`, then skim the four HTML mockups (visual reference, not literal spec), then the current schema in `graph.md`/`domain.md`/`track.md`.

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
| `Facility -[:IN_JURISDICTION]-> Jurisdiction` | **Decided, not built** | `domain-extension.md` §7.4(a) | One relationship, reuses existing node types |
| `Asset.assetType` | **Decided, not built** | `domain-extension.md` §7.4(b) | One controlled-vocabulary property |
| `Permit`, `License` nodes | **Decided, not built** | `domain-extension.md` §7.4(c) | New nodes, mirror `Contract`'s Decision-gate pattern exactly |
| `Warranty` node | **Decided, not built** | `domain-extension.md` §7.4(d) | New node, mirror `Contract` |
| `Role.decisionAuthority`, `Responsibility`/`Competency` | **Decided in outline, shape not finalized** | `domain-extension.md` §7.4(f), §7.5 | Needs the short design pass that doc already flags before building |
| Demography (`workerCategory`) as a real property | **Undecided — invented for the mockups** | Stage 2/4 HTML | Needs a `domain-extension.md`-style decision first: is it an `Obligation` property, a `Control` property, something else? Not settled. |
| Industry / Asset-Category controlled vocabularies | **Undecided — invented for the mockups** | Stage 2 HTML | Same — needs a decision pass, not a build |
| NLP "Ask" search | **Explicitly illustrative in the mock** | Stage 2 HTML | Real semantic search is a distinct, much larger initiative — not scoped by this plan at all |
| Confidence-scored Applicability proposals | **Mocked, no agent behind it** | Stage 3 HTML | Real Applicability Scoping is data-only via Landscape drill-down today (`nav-shell.tsx`'s own gap note); needs the underlying agent reasoning before the UI can be real |
| Multi-facility Blueprint (full org/role/asset tree in one proposal) | **Mocked, narrower than reality** | Stage 3 HTML | Real `Blueprint` is scoped to one facility per proposal by design (`track.md` gap #8); extending to a full tree is new agent + schema work, not a UI change |
| Task delegation tree (`Obligation → sub-task → sub-task`) | **Does not exist at all** | `concept-notes.md` §3 | The single biggest gap — no relationship type for this today; nothing in Phase J5 is real until this is designed |
| Autonomy Level as a per-workflow-class aggregate | **Partially real** | `foundation.md` §3 — `Decision.autonomyLevel` exists per-Decision only | Needs a real "workflow class" concept before it can aggregate |
| Loop-stage (dormant/pending/reasoning/informed) | **Does not exist** | `concept-notes.md` §1.6 | `Decision.status` today is only pending/approved/rejected — this is a new state model layered on top |
| 52-week grid superimposed on real `Schedule`/`Task` | **Partially real** | `graph.md` Execution Graph (`Schedule`, `Task`, `APPLIES_TO` already live) | UI work once `Task` carries enough facility/role/executor linkage to compute the same rollups the mock shows |
| Signal → Agent → Task → Decision loop (Involve/Inform) | **Deferred, never designed** | `concept-notes.md` §1.9 (sketch only) | Out of scope here — see Phase J6 |

---

## 2. Principle governing the sequence below

**Never build an "undecided" row before it has a decision.** Two items in the triage above (Demography, Industry/Asset-Category vocab) look small but have no home in the graph yet — building them straight from mockup data would silently create schema this project didn't actually decide, the exact anti-pattern `domain-extension.md` exists to prevent. They get their own short decision pass (Phase J3) before any code.

---

## 3. Build sequence

### Phase J1 — Catalog UI parity (lowest risk: real data, UI-only)
- Add Control Mechanism (Preventive/Detective/Corrective) facet to the real `/knowledge` page, reusing the mockup's facet UI pattern.
- Confirm `/knowledge` has (or add) query-param filtering to match; check `api/modules/knowledge/index.ts` before assuming it's missing.

### Phase J2 — Enterprise-graph schema decided in `domain-extension.md` §7.4
Build (a)–(d) and the property-only part of (f) — all already decided, none need a design pass:
- (a) `Facility -[:IN_JURISDICTION]-> Jurisdiction`
- (b) `Asset.assetType` (controlled vocabulary)
- (c) `Permit`, `License` nodes + `permit-proposal`/`license-proposal` Decision types, mirroring `proposeContractChange` exactly
- (d) `Warranty` node, reusing `COVERS`/`WITH_VENDOR`
- (f, partial) `Role.decisionAuthority` property (the homonym-safe version of WINAIM's Role-scoped "Authority")
- Update `graph.md`/`domain.md` in the same pass, per this repo's own convention; close the relevant slice of `track.md` gap #18 as each lands.

### Phase J3 — Decide before building: journey-invented catalog concepts
Not a build phase — a design pass, output is a doc, same shape as `domain-extension.md`:
- Where does Demography (`workerCategory`) actually belong in the graph? Obligation? A new join concept? Decide, then schedule the build separately.
- Same question for Industry / Asset-Category controlled vocabularies.
- `Role.decisionAuthority`'s full shape/enum (flagged as unresolved in `domain-extension.md` §7.5) — finish this here too, it's the same kind of short pass.

### Phase J4 — Enterprise Onboarding real gaps
- Design (not yet build) what a confidence-scored Applicability proposal actually requires from an agent — this is new agent capability, not UI.
- Design what extending `Blueprint` from one-facility-per-proposal to a full org tree requires, schema and agent both.

### Phase J5 — Obligation Cockpit foundations (largest, most novel — needs its own design pass, not just implementation)
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

---

## 5. References

- `.design/journey/concept-notes.md` — the Obligation Cockpit's conceptual model (delegation tree, Autonomy Level vs. Loop-stage, bounded window)
- `.design/domain-extension.md` — the WINAIM/CTN comparison this plan's Phase J2/J3 build on
- `.design/track.md` gaps #8, #9, #18, #19
- `.design/journey/01-catalog-ingestion.html` … `04-obligation-cockpit.html` — visual reference for what each phase is aiming at (not a literal spec — the mockups use static sample data throughout)
- `foundation.md` §0, §2, §3 — onboarding, Actor/autonomy-as-assignment-property, the Decision gate and autonomy-level-earning discipline every phase above has to honor
