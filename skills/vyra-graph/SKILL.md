---
name: vyra-graph
description: Vyra five-graph domain reference. Covers entity types per graph, canonical relationship types, Cypher traversal patterns, and alignment rules with the v7 blueprint. INVOKE before writing any graph schema, new node/relationship type, or cross-graph Cypher query.
---

# vyra-graph — Five-Graph Domain Reference

Load this skill before any graph schema decision or cross-domain Cypher traversal.
Pairs with `/neo4j-spine` (Cypher coding rules) and references `.design/blueprint.md` (architecture canon).

---

## The Five Graphs

### Knowledge Graph — "What must be done?"

Stores regulatory obligations and how they are satisfied by controls.

| Node | Label | Key properties |
|------|-------|----------------|
| Jurisdiction | `Jurisdiction` | id, name, region |
| Regulation | `Regulation` | id, name, version, referenceDoc |
| Clause | `Clause` | id, name, clauseRef, text |
| Requirement | `Requirement` | id, name, obligationType, version |
| Control | `Control` | id, name, controlType, owner |
| Policy | `Policy` | id, name, version, effectiveDate |
| Standard | `Standard` | id, name, version, body |

**Canonical traversal (forward):**
```cypher
MATCH path = (reg:Regulation)-[:CONTAINS]->(cls:Clause)
             -[:DEFINES]->(req:Requirement)
             -[:IMPLEMENTED_BY]->(ctl:Control)
RETURN path
```

---

### Execution Graph — "What are we doing?"

Stores compliance activities, workflows, and evidence production.

| Node | Label | Key properties |
|------|-------|----------------|
| Program | `Program` | id, name, owner, status |
| Workflow | `Workflow` | id, name, type, status |
| Task | `Task` | id, name, owner, frequency, dueDate |
| Schedule | `Schedule` | id, weekRef, quarter |
| Week | `Week` | id, value (1–52) |
| Approval | `Approval` | id, status, approver, approvedAt |
| CAPA | `CAPA` | id, name, dueDate, status, owner |
| Verification | `Verification` | id, outcome, verifiedAt, verifiedBy |

**Canonical traversal:**
```cypher
MATCH (prg:Program)-[:HAS_WORKFLOW]->(wfl:Workflow)
      -[:HAS_TASK]->(tsk:Task)
      -[:PRODUCES]->(ev:Evidence)
RETURN prg, wfl, tsk, ev
```

---

### Operational Graph — "What is happening?"

Stores the enterprise's infrastructure and live signals.

| Node | Label | Key properties |
|------|-------|----------------|
| Asset | `Asset` | id, name, assetType, owner |
| Vendor | `Vendor` | id, name, riskTier |
| System | `System` | id, name, platform |
| Application | `Application` | id, name, env |
| Identity | `Identity` | id, name, identityType |
| Signal | `Signal` | id, type, source, timestamp, payload |
| Event | `Event` | id, category, severity, timestamp |
| Evidence | `Evidence` | id, type, source, collectedAt |

**Canonical traversal:**
```cypher
MATCH (ast:Asset)-[:GENERATES]->(sig:Signal)
      -[:CREATES]->(ev:Evidence)
      -[:VALIDATES]->(req:Requirement)
RETURN ast, sig, ev, req
```

---

### Intelligence Graph — "What do we understand?"

Stores findings, decisions, and risk reasoning produced by agents and analysts.

| Node | Label | Key properties |
|------|-------|----------------|
| Finding | `Finding` | id, title, severity, status, detectedAt |
| Risk | `Risk` | id, name, inherentScore, residualScore, owner |
| Decision | `Decision` | id, type, rationale, decidedAt, agentId, autonomyLevel |
| Recommendation | `Recommendation` | id, text, priority |
| RCA | `RCA` | id, rootCause, analysedAt |
| Investigation | `Investigation` | id, status, assignee |
| Impact | `Impact` | id, domain, severity |
| Prediction | `Prediction` | id, horizon, confidence |

**Canonical traversal (reverse — incident to obligation):**
```cypher
MATCH path = (fnd:Finding)-[:RESULTS_IN]->(risk:Risk)
             <-[:MITIGATES]-(ctl:Control)
             <-[:IMPLEMENTED_BY]-(req:Requirement)
             <-[:DEFINES]-(cls:Clause)
RETURN path
```

---

### Assurance Graph — "What can we prove?"

Stores proof artifacts, attestations, and compliance posture.

| Node | Label | Key properties |
|------|-------|----------------|
| EvidencePackage | `EvidencePackage` | id, name, period, status |
| Attestation | `Attestation` | id, attestedBy, attestedAt |
| Certification | `Certification` | id, body, validFrom, validTo |
| Audit | `Audit` | id, type, period, auditor |
| AuditFinding | `AuditFinding` | id, severity, status |
| Exception | `Exception` | id, reason, approver, expiresAt |
| AssuranceStatement | `AssuranceStatement` | id, scope, posture, generatedAt |
| TrustArtifact | `TrustArtifact` | id, type, issuedAt |

**Canonical traversal:**
```cypher
MATCH (ev:Evidence)-[:SUPPORTS]->(ep:EvidencePackage)
      -[:BACKS]->(att:Attestation)
      -[:PRODUCES]->(stmt:AssuranceStatement)
      -[:COVERS]->(req:Requirement)
RETURN ev, ep, att, stmt, req
```

---

## Canonical Relationship Types

| Relationship | From → To | Graph | Meaning |
|---|---|---|---|
| `CONTAINS` | Regulation → Clause | Knowledge | Regulation text structure |
| `DEFINES` | Clause → Requirement | Knowledge | Clause mandates obligation |
| `IMPLEMENTED_BY` | Requirement → Control | Knowledge | Control satisfies requirement |
| `GOVERNED_BY` | Asset → Policy | Knowledge | Asset governed by policy |
| `HAS_WORKFLOW` | Program → Workflow | Execution | Program contains workflow |
| `HAS_TASK` | Workflow → Task | Execution | Workflow contains task |
| `REQUIRES_APPROVAL` | Task → Approval | Execution | Task needs approval gate |
| `REQUIRES_CAPA` | Finding → CAPA | Execution | Finding triggers remediation |
| `CLOSES` | Verification → CAPA | Execution | Verification closes CAPA |
| `APPLIES_TO` | Control → Asset | Operational | Control governs asset |
| `GENERATES` | Asset → Signal | Operational | Asset emits telemetry |
| `CREATES` | Signal → Evidence | Operational | Signal becomes evidence |
| `VALIDATES` | Evidence → Requirement | Operational | Evidence proves compliance |
| `HAS_FINDING` | Control → Finding | Intelligence | Finding raised against control |
| `RESULTS_IN` | Finding → Risk | Intelligence | Finding creates risk exposure |
| `MITIGATES` | Control → Risk | Intelligence | Control reduces risk |
| `PRODUCES` | Task → Evidence | Execution→Assurance | Task produces evidence |
| `SUPPORTS` | Evidence → EvidencePackage | Assurance | Evidence included in package |
| `BACKS` | EvidencePackage → Attestation | Assurance | Package backs attestation |

---

## Design Rules

1. **Labels are PascalCase** — `Regulation`, `AuditFinding`, not `regulation`, `audit_finding`
2. **Relationship types are UPPER_SNAKE_CASE** — `IMPLEMENTED_BY`, not `implementedBy`
3. **Properties are camelCase** — `inherentScore`, `validFrom`, not `inherent_score`
4. **Every node carries**: `id` (unique), `createdAt`, `version`
5. **Agent-generated nodes** carry: `agentId`, `autonomyLevel` (0–4), `confidence`
6. **Do not create new relationship types** without checking this list and the blueprint first
7. **Cross-graph edges are intentional** — Signal (Operational) → Evidence (Assurance) is correct; they represent the compliance loop closing

---

## Paired Skills

- `/neo4j-spine` — Cypher coding rules (parameterisation, MERGE, lazy handle, naming)
- `/clean-code` — Design principles behind the domain model choices

Refer to `.design/blueprint.md` for the authoritative narrative behind every graph domain.
