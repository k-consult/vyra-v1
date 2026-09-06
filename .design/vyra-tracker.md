# Vyra Build Tracker

**The current build status of Vyra, mapped to the 7-layer GRC operating model** — what's live, what's partial, what's still a gap, right now. This is the *tracking* view, deliberately kept out of `vyra-landscape.md` so that doc can stay a clean vision / operating-model read for stakeholders who don't need build-status noise.

> **Audience: internal** — engineering and product. For the operating model itself (personas, capabilities, the loop) with no status, read `vyra-landscape.md`. For *why* an item sits where it does and what unblocks it, follow the phase references into `vyra-implementation-plan.md`.

**Keep this in sync with the plan on every phase — it drifts otherwise.** When a phase changes a layer's status, update the matching row here *and* the "Net" summary below. `vyra-implementation-plan.md` is the authoritative source for phase completion; this doc is a layer-readiness lens over it, not a second source of truth.

---

## Phase rollup

**Phases 0–9 are ✅ done**, plus three standalone closures: the L1 Contract entity, a Gap Review (Escalation Paths / `HAS_ROLE` / SOPs — all confirmed to have no real closure path), and an Intelligence-UI usability pass. **Phases 10–11 ("Agentic Completion Track") are 🔲 planned, not started.** Sequencing and open decisions → `vyra-implementation-plan.md`. Full per-phase narrative and verification evidence → `.design/__ref/implementation-history.md`.

---

## JTBD Layer Status

One row per capability from `vyra-landscape.md`'s 7-layer operating model, scored on **whether the graph can actually feed it right now.** The layer/persona/capability definitions themselves live in the landscape doc — this table only adds the status lens. Full investigation detail behind any 🟡/🔴 row → `.design/__ref/implementation-history.md`.

Status key: **🟢 live** = real data, working queries · **🟡 partial** = modeled but incomplete or unstructured · **🔴 gap** = nothing built.

| L | Layer | Capability | Status | Backing / Blocker |
|---|---|---|---|---|
| L1 | **Knowledge** | Regulations | 🟢 live | `Regulation` (`:Catalog`, 11) + enterprise seed (16) |
| | | Standards | 🟢 live | `Standard` (`:Catalog`, 10) |
| | | Contracts | 🟢 live | `Contract` (12) + second `Vendor` batch (12) — real `WITH_VENDOR`/`COORDINATED_BY`/`COVERS` edges; UI at `/enterprise/contracts`. No `Contract -> Control` link (no clean FK) |
| | | SOPs | 🟡 partial | Folded into `Control.controlType='policy-sop'` — no real Policy-vs-SOP discriminator in either source (investigated, closed by decision) |
| L2 | **Interpret** | Applicability Scoping | 🟡 partial | `Asset -[:COVERED_BY]-> Control -[:IMPLEMENTS]-> Requirement` resolved for 29/31 `:Enterprise` assets (2 `Security`-category assets unmapped, documented gap) |
| | | Obligation Linkage | 🟡 partial | `Requirement→Clause→Regulation/Standard` + `Control→Requirement` live, scoped per asset via `COVERED_BY` |
| L3 | **Planning** | 52-Week Calendar | 🟡 partial | `Schedule -> Task -> Control` live, 50 cadences, `/calendar` UI (full `Task→Regulation` traversal in `vyra-graph-spine.md` Part IV). Partial: no task-completion tracking yet; 10/60 tasks are event-triggered (correctly excluded) |
| | | Location + Role Assign | 🟡 partial | `Organization` (12) / `Role` (16) / `Person` (7) live, `WORKS_AT` many-valued. `HAS_ROLE` never fires — no real title match to the 16 seeded Roles, different vertical (investigated, documented gap) |
| L4 | **CTN Knowledge Graph Spine** — Capture • Review | *(the graph itself)* | 🟢 live (as infrastructure) | This layer *is* `vyra-graph-spine.md`. "Review" = a real Autonomy Level 1 approve/reject gate (Phase 7) |
| L5 | **Oversight** | Deviation Alerts | 🟢 live | `signal-intelligence` watches Signals directly, writes `Decision`s, idempotent on re-run; polled continuously via `agents/scheduler.ts` (Phase 9) |
| | | Escalation Paths | 🟡 partial | `Incident.escalationPath` is free text — zero title matches to seeded Roles, no hierarchy property to hang a chain on (investigated, documented gap) |
| L6 | **Assurance** | Coverage Scoring | 🟢 live | `GET /assurance/posture` — Requirement coverage 30/34, Asset coverage 29/31; UI at `/assurance`. Catalog-origin data only |
| | | Audit-Ready Export | 🟡 partial | Original 7 Incidents synthetic (`generate-assurance-seed.ts`); `assurance-intelligence` now proposes the same chain live for new activity, gated via Decision approve/reject. `origin: 'agent-proposed' \| 'synthetic'` on all endpoints |
| L7 | **Risk** | Residual Risk Score | 🟡 partial | Per-Finding score + portfolio rollup live; `risk-intelligence` proposes scores live for previously-unscored Findings, counted immediately in the rollup |
| | | Scenario Simulation | 🔴 gap | Needs multiple agent families reasoning together over shared graph state — unscoped (Phase 11) |

**Net**: Phases 0–9 + the L1 Contracts addition are live. The remaining partial/gap items — SOPs, full Applicability Scoping, `HAS_ROLE`, task-completion tracking, Escalation Paths, Audit-Ready Export's synthetic original 7 — were each investigated and confirmed to have no real, non-fabricated closure path today, not left by oversight. **L7 Scenario Simulation** is the one genuine open gap. Full evidence for every investigated item → `.design/__ref/implementation-history.md`'s Gap Review.

---

## Where to go next

- **Why this must be agentic at all** (no status) → `vyra-foundation.md`
- **Vision / operating model** (no status) → `vyra-landscape.md`
- **Phase sequencing, what's done, what's next, verification** → `vyra-implementation-plan.md`
- **Schema, relationships, live/dormant status, Cypher patterns** → `vyra-graph-spine.md`
- **Software layers & components** → `vyra-architecture.md`
