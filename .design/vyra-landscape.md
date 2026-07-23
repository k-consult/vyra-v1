# Vyra Landscape

The front door to Vyra's three canonical docs. Read this first; go to `vyra-graph-spine.md` for the ground-truth schema, `vyra-implementation-plan.md` for sequencing and status.

---

## What Vyra Is

Vyra is an Agentic Risk & Compliance Infrastructure platform. AI agents continuously transform regulations into operational assurance by reasoning over a shared enterprise graph — the **Compliance Digital Twin**.

The operating loop, end to end:

```
Regulations → Requirements → Execution → Operations → Signals → Reasoning → Risk → Remediation → Assurance → Trust
```

That loop runs across five graph domains (full detail in `vyra-graph-spine.md`):

| Graph | Question |
|---|---|
| Knowledge | What must be done? |
| Execution | What are we doing? |
| Operational | What is happening? |
| Intelligence | What do we understand? |
| Assurance | What can we prove? |

**Operating principles** (the subset that governs day-to-day design decisions, not the full pitch):
- Agents collaborate through the graph, not through messaging — the graph is the operating system, not the product.
- Every compliance outcome must be traceable, forward and reverse (mechanics: `vyra-graph-spine.md`'s Graph Traversal Patterns).
- Every agent follows the same lifecycle: **Observe → Interpret → Reason → Act → Verify → Learn.**
- Not every action gets full autonomy. **Autonomy Levels 0–4** — Human Driven → Agent Recommends → Agent Assisted → Agent Executed → Fully Autonomous. Default is **Level 1 (Agent Recommends, Human Approves)** unless a specific workflow is explicitly elevated.

**Vyra — Compliance. Handled.**

---

## The Operating Model — 7-Layer JTBD

Sourced from the GRC Operating Model bow-tie diagram supplied for this exercise. Each layer names a persona (who does the job today, and which agent family eventually automates it), its capabilities, and — the part the original diagram doesn't carry — **whether the graph can actually feed it right now.**

Status key: **live** = real data, working queries · **partial** = modeled but incomplete or unstructured · **gap** = nothing built.

| L | Layer | Persona → Agent Family | Capability | Status | Backing / Blocker |
|---|---|---|---|---|---|
| L1 | **Knowledge** | Catalog Admin → Regulatory Intelligence Agents | Regulations | 🟢 live | `Regulation` (`:Catalog`, 11) + enterprise seed (16) |
| | | | Standards | 🟢 live | `Standard` (`:Catalog`, 10) |
| | | | Contracts | 🔴 gap | No `Contract` node type anywhere. Unscoped — not in any plan phase yet. |
| | | | SOPs | 🟡 partial | Folded into `Control.controlType='policy-sop'`, not a distinct catalog item |
| L2 | **Interpret** | Ops Admin → Applicability Intelligence Agents | Applicability Scoping | 🔴 gap | Needs enterprise asset/site context — Plan Phase 2 |
| | | | Obligation Linkage | 🟡 partial | `Requirement→Clause→Regulation/Standard` + `Control→Requirement` live; not yet scoped per enterprise asset |
| L3 | **Planning** | Planner → Control Intelligence Agents | 52-Week Calendar | 🔴 gap | `Schedule` type exists, deliberately unseeded (source data is Task-keyed) — `computeWindow()` pure fn ready; real cadence data is Plan Phase 3 |
| | | | Location + Role Assign | 🔴 gap | No `Organization`/`Location`/`Role`/`Person` nodes — Plan Phase 2, not started |
| L4 | **CTN Knowledge Graph Spine** — Capture • Review | *(the graph itself — every agent's shared memory)* | — | 🟢 live (as infrastructure) | This layer *is* `vyra-graph-spine.md`. "Review" = the Autonomy Level 1 human-approval gate. |
| L5 | **Oversight** | Ops Supervisor → Signal Intelligence Agents | Deviation Alerts | 🔴 gap | Needs live `Signal` data (unfed) + working agents (`agents/` is 0% implemented) — Plan Phase 3 |
| | | | Escalation Paths | 🟡 partial | `Incident.escalationPath` is free text, not a graph-modeled chain to Role/Person |
| L6 | **Assurance** | Compliance Mgmt → Assurance Agents | Coverage Scoring | 🔴 gap | Computable from existing edges, not implemented — Plan Phase 4 |
| | | | Audit-Ready Export | 🔴 gap | `Audit`/`AssuranceStatement`/`Attestation`/`EvidencePackage` entirely dormant. **Not actually covered by Phase 4 as written** — Phase 4 assumes Assurance-graph data already exists; nothing in Phases 1–3 seeds it. Open sequencing gap. |
| L7 | **Risk** | Risk Manager → Risk Intelligence Agents | Residual Risk Score | 🟡 partial | `Risk.residualScore` live, but per-Finding instance only — the Risk-taxonomy-vs-instance split (`entity-alignment.md`) is still unscoped |
| | | Scenario Simulation | 🔴 gap | Needs working agents — unscoped, no phase names this explicitly |

**Net**: L1 (minus Contracts/SOPs) and half of L2/L7 have real data underneath them. L3's Location+Role, all of L5, and all of L6 need Plan Phase 2–3 work — plus two items above (Contracts, Audit-Ready Export's data layer, Scenario Simulation) that no phase currently claims. Raise those as an explicit scoping decision before assuming Phase 4 will "just" cover them.

---

## Where to go next

- **Schema, relationships, live/dormant status, Cypher patterns** → `vyra-graph-spine.md`
- **Sequencing, what's done, what's next, verification approach** → `vyra-implementation-plan.md`
- **Historical material** (original blueprint narrative, superseded graph/roadmap docs, drift-analysis working notes, synthetic seed data) → `__ref/`
