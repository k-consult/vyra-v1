# Validation UI Plan

**Source documents:**
- `grc-ontology-validationusecase.docx` — 11-stage Incident Lifecycle use case
- `grc-reverse-traceability-matrix.docx` — 5-layer Reverse Traceability Matrix (INC-2024-FSC-0047)

**Purpose:** Build two UI pages that validate the use cases against live graph data in `agentic-grc`.

---

## Graph Coverage Assessment

### Use Case 1 — Incident Lifecycle (11 stages)

| Stage | Description | Graph Traversal | Seed Data |
|---|---|---|---|
| 1 | Applicability & Scoping | `Incident → OCCURRED_AT → Facility`, `Incident → GOVERNED_BY → Regulation` | ✓ |
| 2 | Control Framework Mapping | `Incident → FAILED_AGAINST → Control` | ✓ |
| 3 | Policy & SOP Activation | `Control.name`, `Control.controlType` | ✓ (as properties) |
| 4 | Compliance Task Management | `Incident → HAS_TASK → Task` | ✓ |
| 5 | Evidence Management | `Evidence` nodes linked to incident source | ✓ |
| 6 | Workflow & Escalation | `Incident.escalationPath` | ✓ (as property) |
| 7 | Risk-Based Compliance | `Incident → HAS_FINDING → Finding → RAISED_BY ← Risk` | ✓ |
| 8 | Audit Management | `Incident → HAS_FINDING → Finding` | ✓ |
| 9 | CAPA & Remediation | `Finding → ANALYSED_BY → RCA → REQUIRES_CAPA → CAPA → CLOSES ← Verification` | ✓ |
| 10 | Dashboards & Reporting | `Incident.dashboardMetrics`, `Incident.riskRating` | ✓ (as properties) |
| 11 | Continuous Monitoring & AI | `Incident.continuousMonitoring` | ✓ (as property) |

### Use Case 2 — Reverse Traceability (5 layers)

| Layer | Description | Graph Traversal | Status |
|---|---|---|---|
| L1 | Incident | `Incident` node | ✓ Full |
| L2 | Risk & Hazard | `Incident → HAS_FINDING → Finding → RAISED_BY ← Risk` | ✓ Full |
| L3 | Control & Asset | `Finding → AGAINST → Control`, `Incident → INVOLVES → Asset`, `Asset → SUPPLIED_BY → Vendor` | ✓ Full |
| L4 | Obligation | `Control ← (no Requirement link yet)` | ⚠ Partial — Requirement nodes not in seed data |
| L5 | Source Document | `Incident → GOVERNED_BY → Regulation` (no clause/section ref) | ⚠ Partial — no page/clause data |

**Gap summary:** L4 and L5 require `Requirement` and `Clause` nodes with source references. These are Phase 2 data additions. The UI displays the gap explicitly rather than hiding it.

---

## Pages to Build

### Page 1 — `/validation/lifecycle`
**Incident Lifecycle Validator**

Validates Use Case 1: 11-stage incident flow from detection to continuous monitoring.

**Layout:**
```
[ Incident selector dropdown ]

┌──────────────────────────────────────────────────────────────┐
│  Stage pipeline — 11 steps, each as a clickable tile        │
│  ✓ green = data found  ⚠ amber = partial  ✗ red = missing  │
└──────────────────────────────────────────────────────────────┘

[ Selected stage detail panel ]
  Shows all linked nodes for that stage with their IDs and key props
```

**Stages shown:**
1. Applicability — Facility + Regulations
2. Controls — Failed controls list
3. Policies/SOPs — Control names / types
4. Tasks — Task list with owner + SLA
5. Evidence — Evidence artifact list
6. Escalation — Escalation path chain
7. Risk — Likelihood × Severity = Score (Rating)
8. Findings — Audit finding list with severity
9. RCA → CAPA — Root causes + corrective actions
10. Verification & Closure — Verification outcomes + closure status
11. Monitoring & KPIs — Dashboard metrics + AI monitoring description

**API endpoint:** `GET /operational/incidents/:id/lifecycle`

Single Cypher pulling all nodes across all 11 stages:
```cypher
MATCH (inc:Incident {id: $id})
OPTIONAL MATCH (inc)-[:OCCURRED_AT]->(fac:Facility)
OPTIONAL MATCH (inc)-[:GOVERNED_BY]->(reg:Regulation)
OPTIONAL MATCH (inc)-[:FAILED_AGAINST]->(ctl:Control)
OPTIONAL MATCH (inc)-[:HAS_TASK]->(tsk:Task)
OPTIONAL MATCH (inc)-[:INVOLVES]->(ast:Asset)-[:SUPPLIED_BY]->(vnd:Vendor)
OPTIONAL MATCH (inc)-[:HAS_FINDING]->(fnd:Finding)
OPTIONAL MATCH (fnd)-[:AGAINST]->(fctl:Control)
OPTIONAL MATCH (fnd)<-[:ANALYSES]-(rca:RCA)
OPTIONAL MATCH (rca)-[:REQUIRES_CAPA]->(capa:CAPA)
OPTIONAL MATCH (capa)<-[:CLOSES]-(ver:Verification)
OPTIONAL MATCH (fnd)<-[:RAISED_BY]-(rsk:Risk)
RETURN inc,
    collect(DISTINCT fac)  AS facilities,
    collect(DISTINCT reg)  AS regulations,
    collect(DISTINCT ctl)  AS controls,
    collect(DISTINCT tsk)  AS tasks,
    collect(DISTINCT ast)  AS assets,
    collect(DISTINCT vnd)  AS vendors,
    collect(DISTINCT fnd)  AS findings,
    collect(DISTINCT rca)  AS rcas,
    collect(DISTINCT capa) AS capas,
    collect(DISTINCT ver)  AS verifications,
    collect(DISTINCT rsk)  AS risks
```

---

### Page 2 — `/validation/traceability`
**Reverse Traceability Matrix**

Validates Use Case 2: 5-layer backward trace from incident to source documents.

**Layout:**
```
[ Incident selector dropdown ]

L1  INCIDENT ─────────────────────────────────── ● FOUND
    Incident details

L2  RISK & HAZARD ────────────────────────────── ● FOUND
    Risk scores + Finding list

L3  CONTROL & ASSET ──────────────────────────── ● FOUND
    Assets + Vendors + Failed Controls

L4  OBLIGATION ───────────────────────────────── ◐ PARTIAL
    RCA root causes + CAPA actions
    ⚠ Requirement nodes not loaded — forward obligation trace unavailable

L5  SOURCE DOCUMENT ──────────────────────────── ◐ PARTIAL
    Regulations listed
    ⚠ No clause/section/page references in current graph
```

Each layer is an expandable accordion row. Status indicator: ● full / ◐ partial / ○ missing.

**API endpoint:** `GET /intelligence/incidents/:id/reverse-trace`

Returns a structured object with each layer's data and a `status` field per layer (`full` / `partial` / `missing`).

---

## Sprint Plan

| Sprint | Work | Output |
|---|---|---|
| S1 | API: add `/operational/incidents/:id/lifecycle` to operational module | Endpoint returning all 11-stage data |
| S1 | API: add `/intelligence/incidents/:id/reverse-trace` to intelligence module | Endpoint returning 5-layer structured object |
| S2 | UI: `/validation/lifecycle` — incident selector + 11-tile pipeline + detail panel | Working lifecycle validator |
| S3 | UI: `/validation/traceability` — 5-layer accordion + status indicators | Working reverse traceability view |
| S4 | Both: gap indicators, compliance status badges, stage counts | Polished validation views |

**Estimated effort:** 3–4 days (startup mode, no new dependencies).

---

## Data Gaps — Phase 2 Additions

To fully satisfy L4 and L5 of the reverse traceability use case, add to the graph:

1. **`Requirement` nodes** — the atomic obligation between Regulation and Control
   - Feed: `cli/feeds/csv/knowledge/requirements.csv`
   - Relationship: `Regulation → CONTAINS → Clause → DEFINES → Requirement → IMPLEMENTED_BY → Control`

2. **Clause-level detail** — `Clause` nodes with `clauseRef`, `section`, `text`
   - Enables "Source Document" layer navigation to exact page/clause

3. **Compliance status** on relationships
   - `IMPLEMENTED_BY` edge property: `complianceStatus: compliant | non-compliant | partial | under-review`
   - Enables the compliance status column in the reverse traceability matrix

These are additive — they do not change the current graph schema, only extend it.

---

## File References

| File | Role |
|---|---|
| `api/modules/operational/index.ts` | Add `/incidents/:id/lifecycle` route |
| `api/modules/operational/repo.ts` | Add `getLifecycle(id)` query |
| `api/modules/intelligence/index.ts` | Add `/incidents/:id/reverse-trace` route |
| `api/modules/intelligence/repo.ts` | Add `getReverseTrace(id)` query |
| `ui/src/app/validation/lifecycle/page.tsx` | Page 1 |
| `ui/src/app/validation/traceability/page.tsx` | Page 2 |
| `ui/src/features/validation/lifecycle-view.tsx` | Lifecycle view component |
| `ui/src/features/validation/traceability-view.tsx` | Traceability view component |
| `ui/src/lib/api.ts` | Add `validation` client methods |
