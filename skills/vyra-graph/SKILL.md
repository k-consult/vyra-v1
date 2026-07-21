---
name: vyra-graph
description: Vyra five-graph domain reference. Covers entity types per graph, canonical relationship types, Cypher traversal patterns, and alignment rules with the v7 blueprint. INVOKE before writing any graph schema, new node/relationship type, or cross-graph Cypher query.
---

# vyra-graph — Five-Graph Domain Reference

Load this skill before any graph schema decision or cross-domain Cypher traversal.
Pairs with `/neo4j-spine` (Cypher coding rules) and references `.design/blueprint.md` (architecture canon).

**Relationship names/directions below are reconciled against the running pipeline** (`cli/semantic-contract/contracts/v2.ts` + `cli/domains/grc/ingest-hints.json`) **and `.design/graph.md`**, per `roadmap.md` Phase 0 (2026-07-21) — not invented independently. Node tables still include blueprint-only types with no relationship vocabulary defined yet (marked below); do not wire those up without picking a real name first and adding it to `v2.ts`.

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
MATCH path = (reg:Regulation)<-[:BELONGS_TO]-(cls:Clause)
             <-[:DEFINED_BY]-(req:Requirement)
             <-[:IMPLEMENTS]-(ctl:Control)
RETURN path
```
Matches `api/modules/knowledge/repo.ts`'s `TRACE_FORWARD`. `IMPLEMENTS`/`AGAINST` (Finding→Control) are live today; `BELONGS_TO`/`DEFINED_BY` are declared in `v2.ts` but dormant until Clause/Requirement get a CSV feed (roadmap Phase 1).

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
MATCH (prg:Program)<-[:PART_OF]-(wfl:Workflow)
      <-[:PART_OF]-(tsk:Task)
      <-[:PRODUCED_BY]-(ev:Evidence)
RETURN prg, wfl, tsk, ev
```
`PRODUCED_BY` (Evidence→Task) is live. `PART_OF` (Task→Workflow, Workflow→Program) is declared in `v2.ts` but dormant — Workflow/Program have no CSV feed yet. `Schedule`/`Week`/`Approval` are blueprint-only (Ch.18); no relationship type has been assigned to them in `v2.ts` — do not invent one ad hoc, raise it as a schema decision first.

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
MATCH (inc:Incident)-[:INVOLVES]->(ast:Asset)-[:SUPPLIED_BY]->(vnd:Vendor)
MATCH (inc)-[:OCCURRED_AT]->(fac:Facility)
RETURN inc, ast, vnd, fac
```
`INVOLVES`, `SUPPLIED_BY`, `OCCURRED_AT` are all live. `Signal -[:EMITTED_BY]-> Asset` is declared in `v2.ts` but dormant (no Signal feed yet, roadmap Phase 3). There is no Signal→Evidence or Evidence→Requirement edge anywhere in the codebase — `GENERATES`/`CREATES`/`VALIDATES` below were aspirational and have been removed; don't treat them as implemented.

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

**Canonical traversal (reverse — finding to obligation):**
```cypher
MATCH path = (fnd:Finding)-[:AGAINST]->(ctl:Control)
             -[:IMPLEMENTS]->(req:Requirement)
             -[:DEFINED_BY]->(cls:Clause)
             -[:BELONGS_TO]->(reg:Regulation)
RETURN path
```
Matches `api/modules/knowledge/repo.ts`'s `TRACE_REVERSE`. `AGAINST`/`IMPLEMENTS` are live; `DEFINED_BY`/`BELONGS_TO` are dormant (see Knowledge Graph note above). Separately, `Risk -[:RAISED_BY]-> Finding` is the live edge for Finding→Risk (reversed from how it reads) — there is no `RESULTS_IN` or `MITIGATES` relationship anywhere in the codebase; those have been removed from this doc.

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
MATCH path = (att:Attestation)-[:BACKED_BY]->(ep:EvidencePackage)
MATCH (stmt:AssuranceStatement)-[:DERIVED_FROM]->(att)
RETURN att, ep, stmt
```
`BACKED_BY` and `DERIVED_FROM` are declared in `v2.ts` but dormant — `Attestation`/`AssuranceStatement`/`EvidencePackage` have no CSV feed yet. There is no Evidence→EvidencePackage or AssuranceStatement→Requirement edge anywhere in the codebase — `SUPPORTS`/`BACKS`/`PRODUCES`/`COVERS` were aspirational and have been removed; `Certification`/`AuditFinding`/`TrustArtifact` below are blueprint-only with no relationship type assigned.

---

## Canonical Relationship Types

Ground truth is `cli/semantic-contract/contracts/v2.ts` (write path) cross-checked against `cli/domains/grc/ingest-hints.json` (dedicated edge CSVs) and every `api/modules/*/repo.ts` (read path) — see `.design/graph.md` for the full reconciliation. Three tiers:

**Live** — written by every `./ingest.sh` run and queried by the API today:

| Relationship | From → To | Graph | Meaning |
|---|---|---|---|
| `GOVERNED_BY` | Incident → Regulation | Knowledge | Incident is subject to this regulation |
| `IMPLEMENTS` | Control → Requirement | Knowledge | Control satisfies a requirement |
| `FAILED_AGAINST` | Incident → Control | Knowledge | Control failed during this incident |
| `HAS_TASK` | Incident → Task | Execution | Task assigned in response to incident |
| `REQUIRES_CAPA` | RCA → CAPA | Execution | Root cause analysis prescribes a corrective action |
| `ADDRESSES` | CAPA → Finding | Execution | Corrective action addresses the finding |
| `CLOSES` | Verification → CAPA | Execution | Verification closes the CAPA |
| `OCCURRED_AT` | Incident → Facility | Operational | Physical location of the incident |
| `INVOLVES` | Incident → Asset | Operational | Asset implicated in incident |
| `SUPPLIED_BY` | Asset → Vendor | Operational | Vendor responsible for asset |
| `MANAGED_BY` | Incident → Vendor | Operational | Vendor involved in incident |
| `HAS_FINDING` | Incident → Finding | Intelligence | Finding raised from this incident |
| `AGAINST` | Finding → Control | Intelligence | Finding raised against this control |
| `RAISED_BY` | Risk → Finding | Intelligence | Risk is scored from this finding |
| `ANALYSED_BY` | Finding → RCA | Intelligence | Finding's root cause is analysed by this RCA |
| `PRODUCED_BY` | Evidence → Task | Assurance | Evidence was generated by this task |

**Declared in `v2.ts`, not yet fed** — correct name/direction, but dormant until the target type gets a CSV feed (`roadmap.md` Phase 1–3):

| Relationship | From → To | Fed by |
|---|---|---|
| `IN_JURISDICTION` | Regulation → Jurisdiction | Phase 1 |
| `BELONGS_TO` | Clause → Regulation | Phase 1 |
| `DEFINED_BY` | Requirement → Clause | Phase 1 |
| `PART_OF` | Task → Workflow, Workflow → Program | Phase 1/2 |
| `EMITTED_BY` | Signal → Asset | Phase 3 |
| `BACKED_BY` | Attestation → EvidencePackage | — |
| `DERIVED_FROM` | AssuranceStatement → Attestation | — |
| `WAIVES` | Exception → Requirement | — |

**Named in blueprint only** — `Schedule`, `Week`, `Approval` (Execution), `System`, `Application`, `Identity`, `Event` (Operational), `Recommendation`, `Investigation`, `Impact`, `Prediction` (Intelligence), `Certification`, `AuditFinding`, `TrustArtifact` (Assurance) appear in `.design/blueprint.md` Ch.18 but have no node type in `v2.ts` and no relationship type assigned. Don't invent a relationship name for these ad hoc — that's a schema decision to raise explicitly (`roadmap.md` sequences most of them into Phase 3+).

---

## Design Rules

1. **Labels are PascalCase** — `Regulation`, `AuditFinding`, not `regulation`, `audit_finding`
2. **Relationship types are UPPER_SNAKE_CASE** — `IMPLEMENTS`, not `implements`
3. **Properties are camelCase** — `inherentScore`, `validFrom`, not `inherent_score`
4. **Every node carries**: `id` (unique), `createdAt`, `version`
5. **Agent-generated nodes** carry: `agentId`, `autonomyLevel` (0–4), `confidence`
6. **Do not create new relationship types** without checking this list and the blueprint first
7. **Cross-graph edges are intentional** — `CAPA (Execution) -[:ADDRESSES]-> Finding (Intelligence)` is correct; it's remediation closing the loop back to the originating finding

---

## Paired Skills

- `/neo4j-spine` — Cypher coding rules (parameterisation, MERGE, lazy handle, naming)
- `/clean-code` — Design principles behind the domain model choices

Refer to `.design/blueprint.md` for the authoritative narrative behind every graph domain.
