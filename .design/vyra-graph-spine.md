# Vyra Graph Spine

**Version:** 1.4  
**Status:** Canonical — reconciled against the running pipeline (`v2.ts` + `ingest-hints.json`) and API queries (`api/modules/*/repo.ts`) per `vyra-implementation-plan.md` Phase 0, 2026-07-21. Extended with the Global Compliance Catalog (Phase 0.5 + Phase 1), 2026-07-22. Relocated from `.design/graph.md` and renamed as part of the 3-doc consolidation (`vyra-landscape.md` / `vyra-graph-spine.md` / `vyra-implementation-plan.md`), 2026-07-23 — no content changed in the move. Extended with Enterprise Context (Phase 2), 2026-07-25. Extended with Live Operational Context + first real agent (Phase 3), 2026-07-26.  
**Source data:** `Enterprise_GRC_Incident_Graph_With_NodeIDs.xlsx` (7 incidents, enterprise seed) + `.design/__ref/synthetic-data/data.csv` (Industrial Parks/Warehouse/3PL vertical, catalog seed — `Authority`/`Jurisdiction`/`Regulation`/`Standard`/`Clause`/`Requirement`/`ComplianceArea`/`Control`, `:Catalog`-labeled; enterprise seed — `Organization`/`Role`/`Facility`/`Asset`, `:Enterprise`-labeled) + live API/agent writes (`Signal`, `Task`, `Decision` — no CSV involved)

## The `:Catalog` Label Convention

Every node written by `cli/orchestration/catalog-sync.ts` carries its domain label plus `:Catalog` (e.g. `(:Regulation:Catalog)`), per `vyra-implementation-plan.md` Phase 0.5. This scopes the catalog sync job's writes and lets callers distinguish centrally-synced reference data from enterprise-authored data of the same label — e.g. `MATCH (n:Regulation:Catalog)` returns only the 11 catalog-seeded regulations, not the 16 unlabeled ones the original enterprise pipeline (`cli/orchestration/index.ts`) seeded directly into `regulations.csv` before the catalog sync existed. The 16 legacy nodes are a known follow-up, not yet relabeled.

The same convention extends to `:Enterprise`, written by `cli/orchestration/enterprise-sync.ts` (Phase 2). `Facility` and `Asset` are dual-origin labels exactly like `Regulation`: the 7 `Facility`/`Asset` pairs from the original incident pipeline stay unlabeled, and the second-tenant `Facility`/`Asset` rows sourced from `11_Spatial_Mapping`/`19_Asset_Equipment_Master` are written `:Facility:Enterprise` / `:Asset:Enterprise`, coexisting without ID collisions (`FAC-*`/enterprise asset IDs vs. `LOC-*`/`AST-*`).

This is the primary graph model for Vyra's Compliance Digital Twin — the backbone `vyra-landscape.md` and `vyra-implementation-plan.md` both defer to. All schema, Cypher, and agent design decisions must align with this document.

---

## The Compliance Digital Twin

Vyra models an organization's compliance posture as a continuously evolving property graph across five interconnected domains. Every compliance event — a regulation change, an incident, a failed control, an audit finding — is a node with relationships that enable full forward and reverse traceability.

```
Regulation → Clause → Requirement → Control → Asset → Signal/Incident → Finding → Risk → CAPA → Verification → Assurance
```

---

## Graph Overlap Diagram

Five domains. Nodes at domain boundaries belong to both neighbours — that is the overlap.

```mermaid
graph TB
    classDef domain  fill:#f0f4ff,stroke:#4a6fa5,stroke-width:2px,rx:12,ry:12
    classDef bridge  fill:#fff8e1,stroke:#f59e0b,stroke-width:2px,font-weight:bold
    classDef central fill:#fce4ec,stroke:#e53935,stroke-width:2px,font-weight:bold

    subgraph KG["📘  Knowledge"]
        K1[Regulation]
        K2[Requirement]
        K3[Policy · Standard]
    end

    subgraph EG["⚙️  Execution"]
        E1[Program · Workflow]
        E2[Task]
        E3[Verification]
    end

    subgraph OG["🏭  Operational"]
        O1[Facility · Vendor]
        O2[Asset]
        O3[Signal · Event]
    end

    subgraph IG["🔍  Intelligence"]
        I1[Risk]
        I2[RCA]
        I3[Decision]
    end

    subgraph AG["✅  Assurance"]
        A1[EvidencePackage]
        A2[Attestation]
        A3[AssuranceStatement]
    end

    %% ── Bridge nodes at domain intersections ──────────────────────────────
    CTL(["Control\n⟵ Knowledge ∩ Operational"]):::bridge
    INC(["Incident\n⟵ Operational ∩ Intelligence"]):::bridge
    FND(["Finding\n⟵ Intelligence ∩ Execution"]):::bridge
    CAPA(["CAPA\n⟵ Execution ∩ Intelligence"]):::bridge
    EVD(["Evidence\n⟵ Execution ∩ Assurance"]):::bridge

    %% ── Compliance loop (clockwise) ───────────────────────────────────────
    K2 -->|"IMPLEMENTED_BY"| CTL
    CTL -->|"APPLIES_TO"| O2
    O2 -->|"GENERATES"| O3
    O3 -->|"becomes"| INC
    INC -->|"HAS_FINDING"| FND
    FND -->|"RESULTS_IN"| I1
    FND -->|"REQUIRES_CAPA"| CAPA
    CAPA -->|"closed by"| E3
    E2 -->|"PRODUCES"| EVD
    EVD -->|"SUPPORTS"| A1
    A2 -->|"COVERS"| K2

    %% ── Cross-domain shortcuts ────────────────────────────────────────────
    CTL -.->|"gap detected"| FND
    I1 -.->|"risk informs"| A3
```

**Reading the diagram:**
- **Subgraphs** = the five graph domains — each owns its core entities
- **Yellow nodes** = bridge entities that sit at the boundary of two domains
- **Solid arrows** = the primary compliance loop (clockwise: Knowledge → Operational → Intelligence → Execution → Assurance → Knowledge)
- **Dashed arrows** = cross-domain shortcuts (control gaps surface directly in Intelligence; risk posture feeds Assurance)

---

## Five Graph Domains

| Domain | Question | Anchor Node |
|---|---|---|
| Knowledge | What must be done? | `Regulation` |
| Execution | What are we doing? | `Task` |
| Operational | What is happening? | `Incident` |
| Intelligence | What do we understand? | `Finding` |
| Assurance | What can we prove? | `Evidence` |

---

## Node Reference

### Knowledge Graph

#### `Regulation`
Regulatory frameworks and standards that apply to the organization.

| Property | Type | Example |
|---|---|---|
| id | string | `REG-OSHA`, `REG-ISO_45001` |
| name | string | `OSHA`, `EU GMP Annex 1` |
| version | string | `1.0` |
| status | string | `active` |

**Seed data (16 regulations, enterprise pipeline, unlabeled):**  
OSHA, NBC India, ISO 45001, US FDA GMP, EU GMP Annex 1, ISO 13485, FSMA, HACCP, FSSAI Schedule 4, USP, FDA Water Systems Guidance, ISO 22000, ISO 17025, FSSAI Packaging Rules, IEC 62443, NIST CSF

**Plus 11 catalog regulations (`:Catalog` label, `cli/orchestration/catalog-sync.ts`)** — Industrial Parks/Warehouse/3PL vertical, India + UK. New props: `authorityId`, `catalogVersion`, `effectiveFrom`, `supersededBy` (self-referential — a repealed regulation is superseded, never deleted).

---

#### `Authority`
Regulatory body that issues or enforces a `Regulation` (Knowledge, `:Catalog`).

| Property | Type | Example |
|---|---|---|
| id | string | `AUTH-001` |
| name | string | `Bureau of Indian Standards` |
| abbreviation | string | `BIS` |
| authorityType | string | `National Standards Body` |
| jurisdictionId | string | `JUR-INDIA` |

**8 authorities**, seeded from `.design/__ref/synthetic-data/data.csv`'s `02_Regulatory_Authorities` worksheet.

---

#### `Standard`
Industry/international standard (Knowledge, `:Catalog`) — a `Clause`'s source document, alongside `Regulation`.

**10 standards** (ISO 45001, ISO 14001, NFPA 25, BS 9999, …), seeded from `04_Standards`. Props unchanged from the original `v2.ts` shape (`body`, `referenceDoc`, `version`).

---

#### `Clause` / `Requirement`
`Clause` (Knowledge, `:Catalog`) belongs to exactly one of `Regulation` or `Standard` (`regulationId` XOR `standardId` populated per row — never both, per `05_Clauses`' `Source Type`/`Source ID` columns). `Requirement` (Knowledge, `:Catalog`) is `06_Obligations` mapped 1:1 — `ObligationID → id`, `Mandatory (Y/N) → mandatory` — reusing the existing `Requirement` type rather than adding a second node type for the same concept.

**34 clauses, 34 requirements.**

---

#### `Control`
Policies, SOPs, and operational procedures that implement requirements.

| Property | Type | Example |
|---|---|---|
| id | string | `CTL-001-01`, `CTRL-004` |
| name | string | `Fire Safety SOP`, `Fire Hydrant System Pressure Test` |
| controlType | string | `policy-sop` (legacy), `Preventive`/`Detective` (`:Catalog` rows) |
| owner | string | `Facility & EHS` (legacy rows only) |
| requirementId | string | `REQ-XXX` (legacy) / `OBL-0004` (`:Catalog`) — FK to Requirement |
| complianceAreaId | string | `CA-002` (`:Catalog` rows only) — FK to ComplianceArea |
| riskId | string | `RSK-013` (`:Catalog` rows only, flat reference — no dedicated rel; the catalog `17_Risk_Register` taxonomy this points at is not yet ingested) |
| clauseId / standardId / regulationId / authorityId | string | (`:Catalog` rows only, flat reference — already reachable via `Requirement -> Clause -> Regulation/Standard`, no duplicate rel added) |
| status | string | `active` |

**15 controls** (legacy enterprise pipeline, unlabeled, per-incident numbering `CTL-{incident}-{seq}`, from the "Policies & SOPs" column) **+ 30 controls** (`CTRL-001`–`CTRL-030`, `:Catalog` label, Phase 3, from `08_Operational_Controls` — a reusable control catalog, not per-incident) — same dual-origin coexistence pattern as `Regulation`/`Regulation:Catalog`.

---

#### `ComplianceArea`
Compliance domain taxonomy (Knowledge, `:Catalog`) — the shared vocabulary that links `Control` and `Asset` (see `IN_COMPLIANCE_AREA`/`BELONGS_TO`/`COVERED_BY` below).

| Property | Type | Example |
|---|---|---|
| id | string | `CA-002` |
| name | string | `Fire Suppression Systems` |
| description | string | `Hydrants, sprinklers/ESFR, fire pump houses, and portable fire extinguishers.` |

**10 compliance areas**, 1:1 from `07_Compliance_Areas`.

---

### Execution Graph

#### `Task`
Compliance activities that must be performed to maintain or restore compliance.

| Property | Type | Example |
|---|---|---|
| id | string | `TSK-001-01`, `TSK-SIG-TEST-001` (signal-driven) |
| name | string | `Inspect detector` |
| owner | string | `Priya Nair - QA Executive` (legacy) / `'UNKNOWN'` (signal-driven, until `Person` is seeded) |
| frequency | string | `incident-driven`, `signal-driven` (Phase 3) |
| priority | string | `Critical` |
| dueDate | datetime | `2026-05-03 17:36` |
| workflowId | string | FK to Workflow |
| evidenceRequired | string | `yes` |
| controlIds / requirementIds | string[] | native array props, signal-driven Tasks only — every `Control`/`Requirement` the triggering `Asset` is covered by (via `COVERED_BY`), not a single FK, since one Asset can match multiple Controls under one ComplianceArea |
| status | string | `closed` / `open` |

**Signal-driven Tasks (Phase 3)** are created live by `api/modules/operational/repo.ts`'s `createSignal`, not the CLI pipeline — see "Live API/Agent Writes" below.

**24 tasks** across 7 incidents.

---

#### `CAPA`
Corrective and preventive actions triggered by findings.

| Property | Type | Example |
|---|---|---|
| id | string | `CAPA-001-01` |
| name | string | `Renew AMC` |
| owner | string | (person) |
| dueDate | datetime | |
| findingId | string | FK to Finding |
| status | string | `closed` |

**20 CAPAs** across 7 incidents.

---

#### `Verification`
Confirmation that a CAPA was executed and effective.

| Property | Type | Example |
|---|---|---|
| id | string | `VER-001-01` |
| name | string | `Detector tested successfully` |
| outcome | string | (description) |
| verifiedAt | datetime | |
| verifiedBy | string | (person) |
| capaId | string | FK to CAPA |
| status | string | `closed` |

**13 verifications** across 7 incidents.

---

#### `Schedule` — declared, not fed
Cadence for a `Requirement` (`Schedule -[:APPLIES_TO]-> Requirement`). Props: `cadenceUnit` (`day`/`week`/`month`), `cadenceInterval`, `anchorDate`, `requirementId`. No seed data — see "Declared, Not Yet Fed" below for why. `api/modules/catalog/repo.ts`'s `computeWindow({cadenceUnit, cadenceInterval, anchorDate}, horizonWeeks)` is a pure function computing occurrence dates directly from these fields, so the window projection is usable ahead of any `Schedule` node existing.

---

### Operational Graph

#### `Incident`
The central operational node. Represents an audit-triggered compliance incident, capturing the full context: what happened, where, which asset, which vendor, who responded.

| Property | Type | Example |
|---|---|---|
| id | string | `INC-001` |
| name | string | `Quarterly EHS Audit` |
| auditType | string | `Quarterly EHS Audit` |
| scheduleType | string | `Planned` / `Adhoc` |
| planningTime | datetime | `2026-05-03 12:00` |
| auditTime | datetime | `2026-05-03 17:00` |
| incidentTime | datetime | `2026-05-03 17:36` |
| scope | string | `Warehouse Zone B | Fire Safety | Insurance Compliance` |
| businessUnit | string | `Facility & EHS` |
| escalationPath | string | `Facility Engineer → EHS Head → ...` |
| capturedBy | string | `Priya Nair - QA Executive` |
| reviewedBy | string | `Karthik Iyer - Corporate EHS` |
| closure | string | `Closed after verification` |
| dashboardMetrics | string | `Fire Safety Compliance Score | Vendor Risk Score` |
| continuousMonitoring | string | `AI AMC expiry prediction | Fire sensor anomaly detection` |
| likelihood | int | `4` |
| severity | int | `5` |
| residualRisk | int | `18` |
| riskRating | string | `Critical` |
| facilityId | string | `FAC-1002` |
| assetId | string | `FSD-BLR-WH-B-447` |
| vendorId | string | `VND-2002` |
| status | string | `closed` |

**7 incidents** in seed data.

---

#### `Facility`
The compliance-bearing physical unit — the thing that gets inspected, audited, and licensed. Chosen over a separate `Location` node type (Phase 2 design decision): finer-grained physical position (site/building/zone/room) is modeled as attributes on `Facility`/`Asset`, not as additional node types — geography alone has no regulatory standing, `Facility` does.

| Property | Type | Example |
|---|---|---|
| id | string | `FAC-1002`, `LOC-001` |
| name | string | `FAC-1002`, `Bengaluru Industrial & Logistics Park` |
| businessUnit | string | `Facility & EHS` (enterprise-pipeline rows only) |
| region | string | |
| company | string | `Vantage Industrial Parks & Logistics REIT` (`:Enterprise` rows only) |
| status | string | `active` |

**7 facilities** (`FAC-1002`–`FAC-1008`, enterprise pipeline, unlabeled) **+ 20 facilities** (`LOC-001`–`LOC-020`, `:Enterprise` label, deduped to Site granularity from `11_Spatial_Mapping`'s 100 rows by `cli/scripts/convert-enterprise-seed.ts`).

---

#### `Asset`
Equipment, systems, or infrastructure involved in the incident.

| Property | Type | Example |
|---|---|---|
| id | string | `FSD-BLR-WH-B-447`, `AST-001` |
| name | string | `Honeywell NOTIFIER Smoke Detector` |
| assetType | string | `equipment` |
| owner | string | `Facility & EHS` (enterprise-pipeline rows only) |
| facilityId | string | `FAC-1002`, `LOC-001` — FK to Facility |
| vendorId | string | `VND-2002` (enterprise-pipeline rows only) |
| buildingId | string | `BLD-002` (`:Enterprise` rows only) |
| zoneId | string | `ZN-004` (`:Enterprise` rows only) |
| roomId | string | `RM-004` (`:Enterprise` rows only) |
| category | string | `Fire Suppression` (`:Enterprise` rows only) |
| complianceAreaId | string | `CA-002` (`:Enterprise` rows only) — FK to ComplianceArea, mapped from `category` via a manual, name/description-backed table in `convert-enterprise-seed.ts` (Phase 3). `Security`-category assets (2 of 31) have no mapping — no ComplianceArea in the source data corresponds to it; left blank on purpose, not guessed. |
| status | string | `active` |

**7 assets** (enterprise pipeline, unlabeled):
| ID | Name | Facility |
|---|---|---|
| FSD-BLR-WH-B-447 | Honeywell NOTIFIER Smoke Detector | FAC-1002 |
| BIO-RCT-2209 | Sartorius Biostat STR 2000L | FAC-1003 |
| CIP-MOGA-884 | GEA CIP Cleaning System | FAC-1004 |
| RO-HYD-1102 | Veolia RO Water Treatment System | FAC-1005 |
| DRN-PKG-221 | Drainage System - Packaging Hall | FAC-1006 |
| WT-ANAND-778 | Mettler Toledo ICS685 Scale | FAC-1007 |
| IOT-CHN-992 | Cisco Industrial IoT Gateway | FAC-1008 |

**Plus 31 assets** (`AST-001`–`AST-031`, `:Enterprise` label, from `19_Asset_Equipment_Master`) — a second, non-colliding ID space, each carrying a real `LOCATED_AT` edge to its `:Enterprise`-labeled `Facility`.

**Note:** `facilityId` existed in the enterprise pipeline's `assets.csv` since the original seed but was never wired to a relationship — `LOCATED_AT` was undeclared in `v2.ts` until Phase 2 added it, so the 7 original assets also start emitting `LOCATED_AT` edges to their (unlabeled) `Facility` on the next `./ingest.sh` run, no new data required.

---

#### `Organization`
Enterprise org unit (`:Enterprise`) — a Company/BusinessUnit/Department combination that a `Role` belongs to.

| Property | Type | Example |
|---|---|---|
| id | string | `ORG-VANTAGE_INDUSTRIAL_PARKS_LOGISTICS_REIT__EHS__SAFETY` |
| name | string | `EHS - Safety` |
| company | string | `Vantage Industrial Parks & Logistics REIT` |

**12 organizations**, deduped by Company/BusinessUnit/Department from `10_Organization_Mapping`'s 16 rows.

---

#### `Role`
A job function within an `Organization` (`:Enterprise`).

| Property | Type | Example |
|---|---|---|
| id | string | `ROLE-004` |
| name | string | `EHS Manager (Regional)` |
| businessUnit | string | `EHS` |
| department | string | `Safety` |
| approvalAuthority | string | `Y` / `N` |
| organizationId | string | FK to Organization |

**16 roles**, 1:1 from `18_Roles_Master`.

---

#### `Person` — declared, not fed
Named individual holding a `Role` and working at a `Facility` (`:Enterprise`). Props: `email`, `roleId`, `facilityId`. No seed data anywhere in either source dataset — `.design/__ref/entity-alignment.md` confirms the second dataset has role titles but no named individuals. `Incident.capturedBy`/`reviewedBy`/`Task.owner` stay free-text strings until an identity source exists. See "Declared, Not Yet Fed" below.

---

#### `Vendor`
Third-party suppliers of assets or services involved in incidents.

| Property | Type | Example |
|---|---|---|
| id | string | `VND-2002` |
| name | string | `VND-2002` |
| contactName | string | `Priya Nair - QA Executive` |
| riskTier | string | `medium` |
| status | string | `active` |

**7 vendors:** VND-2002 through VND-2008.

---

#### `Signal`
A live operational event against an `Asset` (Phase 3) — the first node type written entirely outside the CLI pipeline.

| Property | Type | Example |
|---|---|---|
| id | string | `SIG-TEST-001` (caller-supplied) |
| name | string | defaults to `id` if not supplied |
| type | string | `fire-alarm-trip` |
| source | string | `'UNKNOWN'` if not supplied |
| timestamp | string | ISO string, defaults to write-time |
| payload | string | free text, defaults to `''` |
| assetId | string | FK to Asset |
| status | string | `new` |

No CSV feed — written live via `POST /operational/signals`. See "Live API/Agent Writes" below.

---

### Intelligence Graph

#### `Finding`
Specific compliance gaps or failures identified during an audit.

| Property | Type | Example |
|---|---|---|
| id | string | `FND-001-01` |
| name | string | `Critical fire detector offline` |
| severity | string | `Critical` |
| detectedAt | datetime | `2026-05-03 17:36` |
| controlId | string | FK to Control |
| incidentId | string | FK to Incident |
| status | string | `closed` |

**15 findings** across 7 incidents.

---

#### `Risk`
Risk assessment derived from findings, with inherent and residual scores.

| Property | Type | Example |
|---|---|---|
| id | string | `RSK-001` |
| name | string | `Risk - Quarterly EHS Audit` |
| inherentRating | string | `Critical` |
| inherentScore | int | `18` |
| inherentLikelihood | int | `4` |
| inherentConsequence | int | `5` |
| residualRating | string | `Critical` |
| residualScore | int | `18` |
| findingId | string | FK to Finding |
| owner | string | (person) |
| status | string | `closed` |

**Risk score distribution across 7 incidents:**
| Incident | Likelihood | Severity | Residual Risk | Rating |
|---|---|---|---|---|
| INC-001 (Fire Detector) | 4 | 5 | 18 | Critical |
| INC-002 (Bioreactor) | 5 | 5 | 20 | Critical |
| INC-003 (CIP System) | 4 | 4 | 14 | High |
| INC-004 (RO Water) | 3 | 5 | 15 | High |
| INC-005 (Drainage) | 3 | 4 | 11 | Medium |
| INC-006 (Scale Calibration) | 4 | 3 | 10 | Medium |
| INC-007 (IoT Network) | 5 | 4 | 17 | High |

---

#### `RCA`
Root cause analysis entries linked to findings.

| Property | Type | Example |
|---|---|---|
| id | string | `RCA-001-01` |
| name | string | `AMC renewal missed` |
| rootCause | string | (description) |
| analysedAt | datetime | |
| findingId | string | FK to Finding |
| status | string | `completed` |

**15 RCAs** across 7 incidents.

---

#### `Decision`
An agent's recommendation (Phase 3, first real agent). Autonomy Level 1 — proposes only, never mutates the graph beyond writing this node.

| Property | Type | Example |
|---|---|---|
| id | string | `DEC-OBL-0012` |
| type | string | `control-recommendation` |
| rationale | string | Claude's one/two-sentence recommendation |
| agentId | string | `control-intelligence-agent` |
| autonomyLevel | int | `1` |
| confidence | float | `0`–`1`, Claude-reported |
| status | string | `pending` |
| decidedAt | datetime | |

No CSV feed — written live by `agents/tools/graph-write.ts`'s `writeDecision`. See "Live API/Agent Writes" below.

---

### Assurance Graph

#### `Evidence`
Artifacts collected during the incident/audit that prove compliance activities.

| Property | Type | Example |
|---|---|---|
| id | string | `EVD-001-01` |
| name | string | `Audit report` |
| type | string | `audit-artifact` |
| source | string | `INC-001` |
| collectedAt | datetime | |
| taskId | string | FK to Task |
| status | string | `collected` |

**30 evidence items** across 7 incidents.

---

## Relationship Reference

All relationships below are **live** — they are written by every `./ingest.sh` run (either via `ingest-hints.json`'s dedicated edge CSVs or a `sourceField` FK embedded in a node's own CSV row, see `cli/compiler/index.ts`) and are the relationships the API (`api/modules/*/repo.ts`) actually queries.

### Knowledge Graph
| Relationship | From → To | Meaning |
|---|---|---|
| `GOVERNED_BY` | Incident → Regulation | Incident is subject to this regulation |
| `IMPLEMENTS` | Control → Requirement | Control satisfies a requirement |
| `FAILED_AGAINST` | Incident → Control | Control failed during this incident |
| `IN_JURISDICTION` | Regulation → Jurisdiction | Regulation applies within this jurisdiction |
| `ISSUED_BY` | Regulation → Authority | Regulation is issued/enforced by this authority |
| `OPERATES_IN` | Authority → Jurisdiction | Authority's jurisdiction of operation |
| `BELONGS_TO` | Clause → Regulation **or** Clause → Standard | Clause's source document (polymorphic — a clause has exactly one parent, never both) |
| `DEFINED_BY` | Requirement → Clause | Requirement is defined by this clause |
| `BELONGS_TO` | Control → ComplianceArea | Control's compliance domain (Phase 3, `:Catalog` rows only — same name-reuse safety as Clause→Regulation/Standard above) |

### Execution Graph
| Relationship | From → To | Meaning |
|---|---|---|
| `HAS_TASK` | Incident → Task | Task assigned in response to incident |
| `REQUIRES_CAPA` | RCA → CAPA | Root cause analysis prescribes a corrective action |
| `ADDRESSES` | CAPA → Finding | Corrective action addresses the finding |
| `CLOSES` | Verification → CAPA | Verification closes the CAPA |

### Operational Graph
| Relationship | From → To | Meaning |
|---|---|---|
| `OCCURRED_AT` | Incident → Facility | Physical location of the incident |
| `INVOLVES` | Incident → Asset | Asset implicated in incident |
| `SUPPLIED_BY` | Asset → Vendor | Vendor responsible for asset |
| `MANAGED_BY` | Incident → Vendor | Vendor involved in incident |
| `LOCATED_AT` | Asset → Facility | Physical facility housing the asset (Phase 2) |
| `BELONGS_TO` | Role → Organization | Role's org unit (Phase 2 — reuses the `BELONGS_TO` name already used for Clause→Regulation/Standard; safe since `cli/projection/index.ts` groups edge batches by `(relType, sourceLabel, targetLabel)`, not `relType` alone) |
| `IN_COMPLIANCE_AREA` | Asset → ComplianceArea | Asset's compliance domain (Phase 3, mapped from `category`; `:Enterprise` rows only, 29 of 31 — `Security`-category assets have no mapping) |

### Intelligence Graph
| Relationship | From → To | Meaning |
|---|---|---|
| `HAS_FINDING` | Incident → Finding | Finding raised from this incident |
| `AGAINST` | Finding → Control | Finding raised against this control |
| `RAISED_BY` | Risk → Finding | Risk is scored from this finding |
| `ANALYSED_BY` | Finding → RCA | Finding's root cause is analysed by this RCA |

### Assurance Graph
| Relationship | From → To | Meaning |
|---|---|---|
| `PRODUCED_BY` | Evidence → Task | Evidence was generated by this task |

---

## Declared, Not Yet Fed

`v2.ts` declares 33 node types across the five graphs (27 original + `Authority`/`Schedule`, added with the Global Compliance Catalog, + `Organization`/`Role`/`Person`, added with Enterprise Context, + `ComplianceArea`, added with Phase 3). 23 now have a live CSV feed: the original 13 (`ingest-hints.json`'s `feedMap`) plus `Jurisdiction`, `Authority`, `Standard`, `Clause`, `Requirement`, `ComplianceArea` (`cli/domains/catalog/ingest-hints.json`, loaded by `cli/orchestration/catalog-sync.ts`) plus `Organization`, `Role` (`cli/domains/enterprise/ingest-hints.json`, loaded by `cli/orchestration/enterprise-sync.ts` — `Facility`/`Asset`/`Control` already had live feeds and just gained a second, dual-origin batch each). `Signal` and `Decision` are fed too, but never via CSV — see "Live API/Agent Writes" below. The rest — `Policy`, `Program`, `Workflow`, `EvidencePackage`, `Attestation`, `AssuranceStatement`, `Audit`, `Exception`, `Schedule`, `Person` — have no seed data yet. Their relationships are declared in `v2.ts` but never fire today, since `cli/runtime/repo.ts`'s edge loader does `MATCH` (not `MERGE`) on both endpoints — no target node, no edge:

| Relationship | From → To | Fed by |
|---|---|---|
| `PART_OF` | Task → Workflow, Workflow → Program | Phase 1/2 |
| `APPLIES_TO` | Schedule → Requirement | deferred — `13_Schedule_Rules` is keyed by `TaskID`, not `RequirementID`; seeding this would fabricate a link the source data doesn't support. `api/modules/catalog/repo.ts`'s `computeWindow` is a pure function taking `{cadenceUnit, cadenceInterval, anchorDate}` directly, usable ahead of any `Schedule` node existing. |
| `BACKED_BY` | Attestation → EvidencePackage | — |
| `DERIVED_FROM` | AssuranceStatement → Attestation | — |
| `WAIVES` | Exception → Requirement | — |
| `HAS_ROLE` | Person → Role | blocked on an identity source — no `Person` seed data exists in either dataset (`.design/__ref/entity-alignment.md` §4) |
| `WORKS_AT` | Person → Facility | same blocker as `HAS_ROLE` |

`api/modules/execution/repo.ts`'s `listTasks(workflowId)` is already written against `PART_OF` so it'll start returning data the moment Phase 2 seeds `Workflow` — no query rewrite needed then. `api/modules/knowledge/repo.ts`'s `traceForward`/`traceReverse` and `api/modules/catalog/repo.ts`'s `traceRequirements` are **live now** — `BELONGS_TO`/`DEFINED_BY`/`IN_JURISDICTION`/`ISSUED_BY`/`OPERATES_IN` moved out of this table once the catalog sync seeded their target types. `LOCATED_AT` (Asset → Facility) and `BELONGS_TO` (Role → Organization) moved out of this table with Phase 2. `EMITTED_BY` (Signal → Asset) moved out with Phase 3 — live now, but via the API write path, not CLI (see below).

**Note:** `CAPTURED_FROM` (Evidence → Incident), previously documented here, was never implemented anywhere (not in `v2.ts`, not in `ingest-hints.json`, not queried by any `repo.ts`) and has been removed from this doc.

---

## Live API/Agent Writes (Phase 3, not CLI-fed)

Three write paths exist entirely outside the CSV → compiler → projection → LOAD CSV pipeline. None of these are declared as `rels` in `v2.ts` (that field only drives CSV-embedded-FK compilation) — they're raw Cypher `MERGE`s executed directly via `lib/graph-db`.

| Relationship | From → To | Written by |
|---|---|---|
| `EMITTED_BY` | Signal → Asset | `api/modules/operational/repo.ts`'s `createSignal`, via `POST /operational/signals` |
| `HAS_TASK` | Signal → Task | same — reuses the `HAS_TASK` name already used for `Incident → Task`; safe since this is raw Cypher, not CLI-projected (the batching concern that motivated grouping by `(relType, sourceLabel, targetLabel)` in Phase 1 only applies to the CLI pipeline) |
| `COVERED_BY` | Asset → Control | `cli/scripts/backfill-asset-control.ts` — a one-time, idempotent (`MERGE`) derived join through the shared `ComplianceArea`, rerun manually after any `catalog-sync`/`enterprise-sync` |
| `ABOUT` | Decision → * (polymorphic, whatever `sourceId` resolves to) | `agents/tools/graph-write.ts`'s `writeDecision`, called by `agents/agents/control-intelligence/index.ts` — the first functioning agent, Autonomy Level 1 (recommend only) |

`createSignal` auto-creates a `Task` in the same round trip: it resolves `Control`/`Requirement` coverage via `Asset -[:COVERED_BY]-> Control -[:IMPLEMENTS]-> Requirement` (collected as `Task.controlIds`/`requirementIds` arrays — an Asset can match multiple Controls under one `ComplianceArea`), and the responsible person via `Facility <-[:WORKS_AT]- Person` (falls back to `'UNKNOWN'` since `Person` is still unfed).

---

## Graph Traversal Patterns

### Forward Traceability — Regulation to Evidence
*"Show me everything under OSHA"*
```cypher
MATCH (reg:Regulation {id: 'REG-OSHA'})
      <-[:GOVERNED_BY]-(inc:Incident)
      -[:INVOLVES]->(ast:Asset)
MATCH (inc)-[:OCCURRED_AT]->(fac:Facility)
OPTIONAL MATCH (inc)-[:HAS_FINDING]->(fnd:Finding)
OPTIONAL MATCH (fnd)-[:ANALYSED_BY]->(rca:RCA)
OPTIONAL MATCH (rca)-[:REQUIRES_CAPA]->(capa:CAPA)
RETURN reg, inc, ast, fac, collect(fnd) AS findings, collect(rca) AS rcas, collect(capa) AS capas
```

### Reverse Traceability — Finding to Regulation
*"Which regulations are implicated by this finding?"*
```cypher
MATCH (fnd:Finding {id: 'FND-001-01'})
      <-[:HAS_FINDING]-(inc:Incident)
      -[:GOVERNED_BY]->(reg:Regulation)
RETURN fnd, inc, collect(reg) AS regulations
```

### Incident Impact Analysis — Asset Risk Propagation
*"Which assets carry the highest residual risk?"*
```cypher
MATCH (inc:Incident)-[:INVOLVES]->(ast:Asset)
MATCH (inc)-[:OCCURRED_AT]->(fac:Facility)
RETURN ast.id, ast.name, fac.id, max(toInteger(inc.residualRisk)) AS maxRisk, inc.riskRating
ORDER BY maxRisk DESC
```

### Vendor Risk Exposure
*"Which vendors are linked to critical incidents?"*
```cypher
MATCH (inc:Incident {riskRating: 'Critical'})-[:MANAGED_BY]->(vnd:Vendor)
MATCH (inc)-[:INVOLVES]->(ast:Asset)
RETURN vnd.id, vnd.name, count(inc) AS incidentCount, collect(ast.name) AS assets
ORDER BY incidentCount DESC
```

### Compliance Posture — CAPA Closure Rate
*"What is the end-to-end CAPA resolution rate?"*
```cypher
MATCH (fnd:Finding)-[:ANALYSED_BY]->(rca:RCA)-[:REQUIRES_CAPA]->(capa:CAPA)
OPTIONAL MATCH (capa)<-[:CLOSES]-(ver:Verification)
RETURN
    count(DISTINCT capa) AS totalCAPAs,
    count(DISTINCT ver) AS verifiedCAPAs,
    round(100.0 * count(DISTINCT ver) / count(DISTINCT capa)) AS closureRatePercent
```

### Compliance Coverage — Which Controls Cover This Asset
*"What Controls and Requirements apply to this Asset?" (Phase 3)*
```cypher
MATCH (a:Asset {id: 'AST-001'})-[:COVERED_BY]->(ctl:Control)-[:IMPLEMENTS]->(req:Requirement)
RETURN a.name, a.category, collect(DISTINCT ctl.name) AS controls, collect(DISTINCT req.name) AS requirements
```

### Continuous Monitoring — Regulation Coverage
*"Which regulations are covered by continuous monitoring?"*
```cypher
MATCH (reg:Regulation)<-[:GOVERNED_BY]-(inc:Incident)
WHERE inc.continuousMonitoring IS NOT NULL AND inc.continuousMonitoring <> ''
RETURN reg.name, collect(DISTINCT inc.continuousMonitoring) AS monitoringCapabilities
```

---

## CSV Feed Files

All feeds live under `cli/feeds/csv/<domain>/`.

| Domain | File | Rows | Description |
|---|---|---|---|
| operational | incidents.csv | 7 | Central incident nodes |
| operational | facilities.csv | 7 | FAC-1002 to FAC-1008 |
| operational | assets.csv | 7 | Equipment involved in incidents |
| operational | vendors.csv | 7 | VND-2002 to VND-2008 |
| knowledge | regulations.csv | 16 | All regulatory frameworks |
| knowledge | controls.csv | 15 | Policies & SOPs per incident |
| execution | tasks.csv | 24 | Compliance tasks per incident |
| execution | capas.csv | 20 | Corrective actions |
| execution | verifications.csv | 13 | CAPA closure verification |
| intelligence | findings.csv | 15 | Audit findings |
| intelligence | risks.csv | 7 | Risk assessments |
| intelligence | rcas.csv | 15 | Root cause analyses |
| assurance | evidence.csv | 30 | Evidence artifacts |

**Catalog feeds** (`cli/feeds/csv/catalog/`, loaded by `cli/orchestration/catalog-sync.ts` via `cli/domains/catalog/ingest-hints.json`, generated by `cli/scripts/convert-catalog-seed.ts` from `.design/__ref/synthetic-data/data.csv`):

| Domain | File | Rows | Description |
|---|---|---|---|
| catalog | jurisdictions.csv | 2 | Derived distinct values (India, UK) |
| catalog | authorities.csv | 8 | Regulatory authorities |
| catalog | regulations.csv | 11 | `:Catalog`-labeled, distinct from the 16 above |
| catalog | standards.csv | 10 | Industry/ISO standards |
| catalog | clauses.csv | 34 | Polymorphic parent: `regulationId` XOR `standardId` |
| catalog | requirements.csv | 34 | `06_Obligations`, `Obligation → Requirement` mapping |
| catalog | complianceAreas.csv | 10 | `07_Compliance_Areas`, 1:1 (Phase 3) |
| catalog | controls.csv | 30 | `08_Operational_Controls`, `:Catalog`-labeled, distinct from the 15 legacy `controls.csv` above (Phase 3) |

No `edgeMap` for catalog feeds — every catalog relationship is an embedded FK (`v2.ts` `rels`), same mechanism `Regulation`/`Clause`/`Requirement`/`Control` already use.

**Enterprise feeds** (`cli/feeds/csv/enterprise/`, loaded by `cli/orchestration/enterprise-sync.ts` via `cli/domains/enterprise/ingest-hints.json`, generated by `cli/scripts/convert-enterprise-seed.ts` from the same `.design/__ref/synthetic-data/data.csv`):

| Domain | File | Rows | Description |
|---|---|---|---|
| enterprise | organizations.csv | 12 | Deduped Company/BusinessUnit/Department combos |
| enterprise | roles.csv | 16 | `18_Roles_Master`, 1:1 |
| enterprise | facilities.csv | 20 | Deduped to Site granularity from `11_Spatial_Mapping` |
| enterprise | assets.csv | 31 | `19_Asset_Equipment_Master`, carries `LOCATED_AT` FK to Facility + `complianceAreaId` (Phase 3, 29 of 31 rows — `Security` category unmapped) |

No `edgeMap` for enterprise feeds either — same embedded-FK mechanism.

**Edge files** (`cli/feeds/csv/edges/`):
| File | Rows | Relationship |
|---|---|---|
| incident_regulation.csv | 18 | Incident → GOVERNED_BY → Regulation |
| incident_control.csv | 15 | Incident → FAILED_AGAINST → Control |
| incident_asset.csv | 7 | Incident → INVOLVES → Asset |
| incident_vendor.csv | 7 | Incident → MANAGED_BY → Vendor |
| incident_finding.csv | 15 | Incident → HAS_FINDING → Finding |
| finding_rca.csv | 15 | Finding → ANALYSED_BY → RCA |
| rca_capa.csv | 20 | RCA → REQUIRES_CAPA → CAPA |
| capa_verification.csv | 13 | Verification → CLOSES → CAPA |
| incident_task.csv | 24 | Incident → HAS_TASK → Task |

**Enterprise pipeline total: 179 nodes, 141 edges** (134 original + 7 `LOCATED_AT` on the legacy `Asset` rows, live since Phase 2). **Catalog pipeline total: 139 nodes, 158 edges** (`:Catalog`-labeled, separate `catalog-sync.ts` run — 99 original + 10 `ComplianceArea` + 30 `Control`; 98 original edges + 30 `IMPLEMENTS` + 30 `BELONGS_TO`, Phase 3). **Enterprise Context (Phase 2) pipeline total: 79 nodes, 47 edges** (`:Enterprise`-labeled, separate `enterprise-sync.ts` run — 12 Organization, 16 Role, 20 Facility, 31 Asset; 16 `BELONGS_TO` + 31 `LOCATED_AT` — plus 29 `IN_COMPLIANCE_AREA` edges added in Phase 3). **Phase 3 derived/live-write total: 101 `COVERED_BY` edges** (`backfill-asset-control.ts`, one-time) **+ Signal/Task/Decision created ad hoc via the API and agent runtime** (no fixed count — driven by live events, not seed data).

---

## Neo4j Constraints

```cypher
CREATE CONSTRAINT inc_id FOR (n:Incident)   REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT reg_id FOR (n:Regulation)  REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT ctl_id FOR (n:Control)     REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT ast_id FOR (n:Asset)       REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT fac_id FOR (n:Facility)    REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT vnd_id FOR (n:Vendor)      REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT tsk_id FOR (n:Task)        REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT fnd_id FOR (n:Finding)     REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT rsk_id FOR (n:Risk)        REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT rca_id FOR (n:RCA)         REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT capa_id FOR (n:CAPA)       REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT ver_id FOR (n:Verification) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT evd_id FOR (n:Evidence)    REQUIRE n.id IS UNIQUE;
```

## Neo4j Indexes

```cypher
CREATE INDEX inc_risk    FOR (n:Incident)  ON (n.riskRating);
CREATE INDEX inc_status  FOR (n:Incident)  ON (n.status);
CREATE INDEX fnd_sev     FOR (n:Finding)   ON (n.severity);
CREATE INDEX fnd_status  FOR (n:Finding)   ON (n.status);
CREATE INDEX rsk_score   FOR (n:Risk)      ON (n.residualScore);
CREATE INDEX capa_status FOR (n:CAPA)      ON (n.status);
CREATE INDEX ast_fac     FOR (n:Asset)     ON (n.facilityId);
```

---

## Data Lineage

```
Enterprise_GRC_Incident_Graph_With_NodeIDs.xlsx
    1 sheet, 7 rows, 31 columns (denormalized)
    └─ convert_excel.py
        ├─ 13 node CSV files (179 nodes)
        └─ 9 edge CSV files (134 edges)

.design/__ref/synthetic-data/data.csv
    22-worksheet dump, Industrial Parks/Warehouse/3PL vertical
    ├─ cli/scripts/convert-catalog-seed.ts
    │   ├─ 6 catalog node CSV files (99 nodes)
    │   └─ 0 edge CSV files (all catalog rels are embedded FKs)
    └─ cli/scripts/convert-enterprise-seed.ts
        ├─ 4 enterprise node CSV files (79 nodes)
        └─ 0 edge CSV files (all enterprise rels are embedded FKs)
```

**Source column → Graph mapping (enterprise seed):**

| Excel Column | Interpretation | Graph Node |
|---|---|---|
| Audit | Incident name | Incident.name |
| Audit Schedule Type | Planned/Adhoc | Incident.scheduleType |
| Incident ID | Planning timestamp | Incident.planningTime |
| Planned Audit Time | Audit execution time | Incident.auditTime |
| Incident | Incident occurred time | Incident.incidentTime |
| Applicability & Scope | Incident scope | Incident.scope |
| Regulations | Pipe-separated regulations | → Regulation nodes |
| Facility | Facility code (FAC-*) | Facility.id |
| Business Unit | Org unit | Incident.businessUnit |
| Asset ID | Asset identifier | Asset.id |
| Asset | Asset name | Asset.name |
| Facility ID (mislabeled) | Vendor code (VND-*) | Vendor.id |
| Vendor (mislabeled) | Vendor contact person | Vendor.contactName |
| Failed Controls (mislabeled) | Reviewer name | Incident.reviewedBy |
| Policies & SOPs | Pipe-separated controls | → Control nodes |
| Compliance Tasks | Pipe-separated tasks | → Task nodes |
| Vendor ID | Empty in source | — |
| Evidence | Pipe-separated artifacts | → Evidence nodes |
| Captured By | Empty in source | — |
| Workflow Escalation Path | Arrow-separated chain | Incident.escalationPath |
| Reviewed By | Empty in source | — |
| Risk Scoring | Likelihood=N\|Severity=N\|... | Risk node |
| Audit Findings | Pipe-separated findings | → Finding nodes |
| RCA | Pipe-separated root causes | → RCA nodes |
| CAPA | Pipe-separated actions | → CAPA nodes |
| Verification | Pipe-separated results | → Verification nodes |
| Closure | Closure statement | Incident.closure |
| Dashboard Metrics Impacted | KPI names | Incident.dashboardMetrics |
| Continuous Monitoring | AI monitoring description | Incident.continuousMonitoring |
