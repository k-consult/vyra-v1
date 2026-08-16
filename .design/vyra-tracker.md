# Vyra Build Tracker

**The current build status of Vyra, mapped to the 7-layer GRC operating model** — what's live, what's partial, what's still a gap, right now. This is the *tracking* view, deliberately kept out of `vyra-landscape.md` so that doc can stay a clean vision / operating-model read for stakeholders who don't need build-status noise.

> **Audience: internal** — engineering and product. For the operating model itself (personas, capabilities, the loop) with no status, read `vyra-landscape.md`. For *why* an item sits where it does and what unblocks it, follow the phase references into `vyra-implementation-plan.md`.

**Keep this in sync with the plan on every phase — it drifts otherwise.** When a phase changes a layer's status, update the matching row here *and* the "Net" summary below. `vyra-implementation-plan.md` is the authoritative source for phase completion; this doc is a layer-readiness lens over it, not a second source of truth.

---

## Phase rollup

**Phases 0, 0.5, 1, 2, 3, 3.5, 4a, 4b, 5, 6, 7, and 8 are ✅ done.** Phase 4b (Audit-Ready Export) shipped on **synthetic, script-generated seed data** for the original 7 incidents — Phase 8's `assurance-intelligence` agent now proposes the same chain live for new activity, so the synthetic batch is a historical snapshot rather than the only source. Phase 5 (`signal-intelligence` agent) closes the "nothing watches Signals for deviations" gap. Phase 6 feeds `Person` for the first time, from free-text names already in the data. Phase 7 (Human-in-the-Loop Decision Gate) makes the Autonomy Level 1 approval gate real — `POST /intelligence/decisions/:id/{approve,reject}` now writes a real `Control:AgentProposed` or `Finding:AgentProposed`, attributed to a real `Person`. Phase 8 (Complete the Agent Roster) brings all 4 agent families live — `risk-intelligence` proposes `Risk:AgentProposed` scores for previously-unscored Findings, `assurance-intelligence` proposes the full Audit-Ready Export chain live, both gated through the same approve/reject flow. **Phases 9–11 ("Agentic Completion Track") are 🔲 planned, not started** — agents still only run via manual CLI, not scheduled or event-triggered. Full sequencing, verification approach, and per-phase detail live in `vyra-implementation-plan.md`.

---

## JTBD Layer Status

One row per capability from `vyra-landscape.md`'s 7-layer operating model, scored on **whether the graph can actually feed it right now.** The layer/persona/capability definitions themselves live in the landscape doc — this table only adds the status lens.

Status key: **🟢 live** = real data, working queries · **🟡 partial** = modeled but incomplete or unstructured · **🔴 gap** = nothing built.

| L | Layer | Capability | Status | Backing / Blocker |
|---|---|---|---|---|
| L1 | **Knowledge** | Regulations | 🟢 live | `Regulation` (`:Catalog`, 11) + enterprise seed (16) |
| | | Standards | 🟢 live | `Standard` (`:Catalog`, 10) |
| | | Contracts | 🔴 gap | No `Contract` node type anywhere. Unscoped — not in any plan phase yet. |
| | | SOPs | 🟡 partial | Folded into `Control.controlType='policy-sop'`, not a distinct catalog item |
| L2 | **Interpret** | Applicability Scoping | 🟡 partial | Phase 2 delivered enterprise asset/site context (`Facility`/`Asset`/`Organization`/`Role`); Phase 3 added a real chain — `Asset -[:COVERED_BY]-> Control -[:IMPLEMENTS]-> Requirement` — resolved for 29 of 31 `:Enterprise` assets (the 2 `Security`-category assets are an open, documented gap, not a bug) |
| | | Obligation Linkage | 🟡 partial | `Requirement→Clause→Regulation/Standard` + `Control→Requirement` live; now also scoped per enterprise asset via the same `COVERED_BY` chain (Phase 3) |
| L3 | **Planning** | 52-Week Calendar | 🟡 partial | `Schedule -[:APPLIES_TO]-> Task -[:IMPLEMENTS]-> Control` live (Phase 3.5) — 50 real cadences from `13_Schedule_Rules`, `GET /catalog/calendar` + UI at `/calendar`. Partial because occurrences are planned/derived, not yet tied to actual task-completion tracking (a separate, larger piece of work), and 10 of 60 tasks are event-triggered, correctly excluded from the periodic view |
| | | Location + Role Assign | 🟡 partial | `Organization` (12), `Role` (16), `Person` (7) all live; `Facility` carries location as attributes, not a separate `Location` node (Phase 2 design decision). Phase 6 fed `Person` from free-text names already in the legacy dataset (no identity source needed) and wired `WORKS_AT` (many-valued) — still partial because `HAS_ROLE` never fires (the 7 people's real titles don't match any of the 16 seeded Roles, a different vertical's catalog — documented gap, not a bug) |
| L4 | **CTN Knowledge Graph Spine** — Capture • Review | *(the graph itself)* | 🟢 live (as infrastructure) | This layer *is* `vyra-graph-spine.md`. "Review" = the Autonomy Level 1 human-approval gate — a real mechanism as of Phase 7, not just a description: `POST /intelligence/decisions/:id/{approve,reject}` resolves a `Decision` into the `Control`/`Finding` it recommended, attributed to a real seeded `Person`. |
| L5 | **Oversight** | Deviation Alerts | 🟢 live | Phase 5 — `signal-intelligence` agent watches `Signal`s directly (`fetchUnassessedSignals`, filtered on no `Decision` yet), reasons via the same local Ollama LLM as `control-intelligence`, writes `Decision` nodes (`type: 'deviation-assessment'`). Verified live against both a covered-asset and a coverage-gap-asset signal; idempotent on re-run. |
| | | Escalation Paths | 🟡 partial | `Incident.escalationPath` is free text, not a graph-modeled chain to Role/Person |
| L6 | **Assurance** | Coverage Scoring | 🟢 live | Phase 4a — `GET /assurance/posture` returns Requirement coverage (30/34) + Asset coverage (29/31, 2 `Security`-category unmapped) + per-`ComplianceArea` breakdown; UI at `/assurance`. Catalog-origin data only (legacy per-incident Controls excluded by label filter) |
| | | Audit-Ready Export | 🟡 partial | Phase 4b seeded `Audit`/`AssuranceStatement`/`Attestation`/`EvidencePackage` for the original 7 Incidents with **synthetic, script-generated data** (`generate-assurance-seed.ts`), not a real audit-management source. Phase 8's `assurance-intelligence` agent now proposes the same chain **live** for any Incident with unbundled Evidence, gated through the Decision approve/reject flow — `GET /assurance/*` endpoints expose `origin: 'agent-proposed' \| 'synthetic'` so the two are distinguishable. Still partial: the original 7 remain synthetic (that historical batch is intentionally untouched), and a real audit-management *source system* (vs. a live-graph-derived proposal) still doesn't exist |
| L7 | **Risk** | Residual Risk Score | 🟡 partial | `Risk.residualScore` live per-Finding; Phase 4a added a portfolio rollup (`getRiskRollup()` — count + avg score per rating, count-weighted overall). Phase 8's `risk-intelligence` agent now proposes `Risk:AgentProposed` scores live for Findings the legacy pipeline never scored (12 real candidates found on first run), approved via the Decision gate and counted immediately in the rollup. Still partial: the Risk-taxonomy-vs-instance split (`entity-alignment.md`) remains unscoped, and the agent's likelihood×consequence convention is deliberately its own scoring model, not a fit to the legacy matrix |
| | | Scenario Simulation | 🔴 gap | Needs multiple agent families reasoning together over the same graph state — unscoped, no phase names this explicitly (see Phase 11) |

**Net**: Phases 0–8 are done. L1 (minus Contracts/SOPs), L2, L3 (including `Person`, Phase 6), **L4 Review** (now a real approve/reject mechanism, Phase 7), **L6 Coverage Scoring** (Phase 4a), **L6 Audit-Ready Export** (Phase 4b synthetic + Phase 8 live proposals), **L5 Deviation Alerts** (Phase 5), and **L7 Residual Risk Score** (Phase 4a rollup + Phase 8 live proposals) now have real data underneath them — several are still "partial" against the full capability described (full Applicability Scoping, `HAS_ROLE` unfired for the 7 seeded `Person` rows, task-completion tracking against the calendar, Escalation Paths still free text, and Audit-Ready Export's original-7-incidents-still-synthetic gap). The one remaining genuine gap is **L7 Scenario Simulation** — plus two items no phase currently claims: Contracts, and a real audit-management *source system* underneath Audit-Ready Export (as opposed to a live-graph-derived agent proposal, which now exists).

---

## Where to go next

- **Vision / operating model** (no status) → `vyra-landscape.md`
- **Phase sequencing, what's done, what's next, verification** → `vyra-implementation-plan.md`
- **Schema, relationships, live/dormant status, Cypher patterns** → `vyra-graph-spine.md`
- **Software layers & components** → `vyra-architecture.md`
