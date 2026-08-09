# Vyra Landscape

The front door to Vyra's canonical docs, and a stakeholder-facing read on its own: the vision, the operating model, and how a regulation becomes provable assurance. It carries **no build-status** — for what's live vs. planned, see `vyra-tracker.md`. Also: `vyra-graph-spine.md` for the ground-truth schema, `vyra-architecture.md` for the software layers, `vyra-implementation-plan.md` for phase sequencing.

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

Sourced from the GRC Operating Model bow-tie diagram. Each layer names a **persona** (who does the job today, and which agent family eventually automates it) and its **capabilities** — the jobs-to-be-done Vyra exists to serve.

> This table is the operating model, not a status report. For where each capability stands today (live / partial / gap) and what backs or blocks it, see **`vyra-tracker.md`**.

| L | Layer | Persona → Agent Family | Capabilities |
|---|---|---|---|
| L1 | **Knowledge** | Catalog Admin → Regulatory Intelligence Agents | Regulations · Standards · Contracts · SOPs |
| L2 | **Interpret** | Ops Admin → Applicability Intelligence Agents | Applicability Scoping · Obligation Linkage |
| L3 | **Planning** | Planner → Control Intelligence Agents | 52-Week Calendar · Location + Role Assignment |
| L4 | **CTN Knowledge Graph Spine** — Capture • Review | *(the graph itself — every agent's shared memory)* | The shared substrate all other layers read and write; "Review" = the Autonomy Level 1 human-approval gate |
| L5 | **Oversight** | Ops Supervisor → Signal Intelligence Agents | Deviation Alerts · Escalation Paths |
| L6 | **Assurance** | Compliance Mgmt → Assurance Agents | Coverage Scoring · Audit-Ready Export |
| L7 | **Risk** | Risk Manager → Risk Intelligence Agents | Residual Risk Score · Scenario Simulation |

---

## Where to go next

- **Current build status** (what's live vs. partial vs. gap, per JTBD layer) → `vyra-tracker.md`
- **Schema, relationships, live/dormant status, Cypher patterns** → `vyra-graph-spine.md`
- **Software layers & components** (how the API, agents, ingestion, and UI wrap the graph) → `vyra-architecture.md`
- **Sequencing, what's done, what's next, verification approach** → `vyra-implementation-plan.md`
- **Historical material** (original blueprint narrative, superseded graph/roadmap docs, drift-analysis working notes, synthetic seed data) → `__ref/`
