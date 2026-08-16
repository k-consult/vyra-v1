# Vyra Build Tracker

**The current build status of Vyra, mapped to the 7-layer GRC operating model** — what's live, what's partial, what's still a gap, right now. This is the *tracking* view, deliberately kept out of `vyra-landscape.md` so that doc can stay a clean vision / operating-model read for stakeholders who don't need build-status noise.

> **Audience: internal** — engineering and product. For the operating model itself (personas, capabilities, the loop) with no status, read `vyra-landscape.md`. For *why* an item sits where it does and what unblocks it, follow the phase references into `vyra-implementation-plan.md`.

**Keep this in sync with the plan on every phase — it drifts otherwise.** When a phase changes a layer's status, update the matching row here *and* the "Net" summary below. `vyra-implementation-plan.md` is the authoritative source for phase completion; this doc is a layer-readiness lens over it, not a second source of truth.

---

## Phase rollup

**Phases 0, 0.5, 1, 2, 3, 3.5, 4a, and 4b are ✅ done.** Phase 4b (Audit-Ready Export) shipped on **synthetic, script-generated seed data** — a real audit-trail source is still needed to replace it. Full sequencing, verification approach, and per-phase detail live in `vyra-implementation-plan.md`.

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
| | | Location + Role Assign | 🟡 partial | `Organization` (12), `Role` (16) live (Phase 2); `Facility` carries location as attributes, not a separate `Location` node (Phase 2 design decision). `Person` — the individual, not just the role — is still unfed; no identity data exists in either source dataset |
| L4 | **CTN Knowledge Graph Spine** — Capture • Review | *(the graph itself)* | 🟢 live (as infrastructure) | This layer *is* `vyra-graph-spine.md`. "Review" = the Autonomy Level 1 human-approval gate. |
| L5 | **Oversight** | Deviation Alerts | 🟡 partial | Both original blockers are gone: `Signal` is live (`POST /operational/signals`, Phase 3) and `agents/` is no longer 0% implemented (`control-intelligence` is wired end-to-end, verified against real graph data — pending only the user's `ANTHROPIC_API_KEY` for live Claude calls). Not fully live yet: no agent watches Signals directly for deviations — `control-intelligence` reasons over uncontrolled Requirements, and `signal-intelligence` itself is still a stub |
| | | Escalation Paths | 🟡 partial | `Incident.escalationPath` is free text, not a graph-modeled chain to Role/Person |
| L6 | **Assurance** | Coverage Scoring | 🟢 live | Phase 4a — `GET /assurance/posture` returns Requirement coverage (30/34) + Asset coverage (29/31, 2 `Security`-category unmapped) + per-`ComplianceArea` breakdown; UI at `/assurance`. Catalog-origin data only (legacy per-incident Controls excluded by label filter) |
| | | Audit-Ready Export | 🟡 partial | Phase 4b — `Audit`/`AssuranceStatement`/`Attestation`/`EvidencePackage` all live and queryable (`GET /assurance/{audits,assurance-statements,attestations,evidence-packages}`, UI at `/assurance`), but seeded with **synthetic, script-generated data** (`generate-assurance-seed.ts`, 1:1 off the 7 existing Incidents), not a real audit-management source |
| L7 | **Risk** | Residual Risk Score | 🟡 partial | `Risk.residualScore` live per-Finding; Phase 4a added a portfolio rollup (`getRiskRollup()` — count + avg score per rating, count-weighted overall). Still partial: the Risk-taxonomy-vs-instance split (`entity-alignment.md`) remains unscoped |
| | | Scenario Simulation | 🔴 gap | Needs working agents beyond `control-intelligence` — unscoped, no phase names this explicitly |

**Net**: Phases 0–4b are done. L1 (minus Contracts/SOPs), L2, L3, **L6 Coverage Scoring** (Phase 4a), **L6 Audit-Ready Export** (Phase 4b, synthetic), and half of L5/L7 now have real data underneath them — several are still "partial" against the full capability described (full Applicability Scoping, a named individual for `Person`, an agent that actually watches Signals for deviations, task-completion tracking against the calendar, and Audit-Ready Export's synthetic-vs-real data gap). The one remaining genuine gap is **L7 Scenario Simulation** — plus two items no phase currently claims: Contracts, and a real (non-synthetic) source for Audit-Ready Export.

---

## Where to go next

- **Vision / operating model** (no status) → `vyra-landscape.md`
- **Phase sequencing, what's done, what's next, verification** → `vyra-implementation-plan.md`
- **Schema, relationships, live/dormant status, Cypher patterns** → `vyra-graph-spine.md`
- **Software layers & components** → `vyra-architecture.md`
