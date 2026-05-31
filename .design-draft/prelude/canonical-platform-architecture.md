# Vyra Graph Schema v6
# Canonical Platform Architecture Specification

## Vyra
### Compliance. Handled.

AI agents that monitor your systems, understand regulations, and keep your organization continuously compliant.

---

# 1. Executive Summary

Vyra is an Agentic GRC platform built as an Autonomous Risk and Compliance Infrastructure.

Traditional GRC platforms manage documents, workflows, and audits.

Vyra manages:

- Regulations
- Controls
- Risks
- Operational Signals
- Compliance Work
- Evidence
- Remediation

through autonomous agents operating on a unified graph.

Core operating model:

Signals → Reasoning → Risk → Action

---

# 2. Architectural Principles

1. Graph-native architecture
2. Continuous compliance
3. Agent-first automation
4. Explicit Jobs-To-Be-Done execution model
5. Separation of knowledge and operations
6. Extensible dimensions and frameworks
7. Auditability by design

---

# 3. Layered Graph Architecture

## Layer 8 — Agentic Automation

Agent
Remediation
Playbook

## Layer 7 — Regulatory Knowledge

Jurisdiction
Framework
Act
Rule
Clause
Requirement

## Layer 6 — Controls

Control
Policy
ControlDomain

## Layer 5 — Execution (JTBD)

Program
Workflow
Task
Schedule

## Layer 4 — Risk & Compliance State

Risk
Incident
Audit
Checkpoint
Exception
Deviation

## Layer 3 — Evidence

Evidence
Document
Log
Report

## Layer 2 — Signals

Signal
Event
Measurement

## Layer 1 — Enterprise Infrastructure

Enterprise
Site
Asset
Vendor
Service
DataPoint

---

# 4. Three Interconnected Graphs

## Knowledge Graph

Framework → Requirement → Control

Purpose:
Defines what must be done.

## Execution Graph

Program → Workflow → Task → Schedule

Purpose:
Defines how compliance work is performed.

## Operational Graph

Asset → Signal → Evidence → Risk

Purpose:
Represents live operational state.

---

# 5. Core Node Inventory

## Regulatory

Framework
Requirement
Act
Rule
Clause
Jurisdiction

## Controls

Control
Policy
ControlDomain

## Execution

Program
Workflow
Task
Schedule

## Operational

Enterprise
Site
Asset
Vendor
Service

## Monitoring

Signal
Event
Measurement

## Assurance

Evidence
Audit
Checkpoint
Report

## Risk

Risk
Incident
Exception
Deviation

## Agentic

Agent
Remediation
Playbook

---

# 6. Canonical Reasoning Chain

Framework
→ Requirement
→ Control
→ Task
→ Evidence
→ Risk
→ Remediation

---

# 7. Jobs-To-Be-Done Model

Task is a first-class entity.

Examples:

- Quarterly Access Review
- Vendor Security Review
- Annual Risk Assessment
- Policy Attestation
- Vulnerability Review

Task Properties:

- id
- name
- owner
- frequency
- dueDate
- criticality
- status

Relationships:

Control → EXECUTED_BY → Task

Task → SCHEDULED_BY → Schedule

Task → PRODUCES → Evidence

---

# 8. Agent Model

## Regulation Intelligence Agent

Monitors regulations and creates requirements.

## Control Monitoring Agent

Evaluates control effectiveness.

## Risk Detection Agent

Detects risk from operational signals.

## Evidence Collection Agent

Collects compliance evidence.

## Vendor Risk Agent

Monitors third-party risk.

## Audit Preparation Agent

Prepares audit packages.

---

# 9. Relationship Matrix

Framework → CONTAINS → Requirement

Requirement → IMPLEMENTED_BY → Control

Control → EXECUTED_BY → Task

Task → PRODUCES → Evidence

Evidence → SUPPORTS → Control

Control → MITIGATES → Risk

Asset → GENERATES → Signal

Signal → INDICATES → Risk

Agent → MONITORS → Signal

Agent → EXECUTES → Remediation

---

# 10. Traversal Patterns

CHILD

Generic hierarchy traversal.

NEXT

Time navigation.

PREV

Reverse time navigation.

---

# 11. Time-Series Model

Measurement → NEXT → Measurement

Task → NEXT → Task

Audit → NEXT → Audit

Used for:

- trend analysis
- compliance drift
- risk evolution

---

# 12. Neo4j Constraints

```cypher
CREATE CONSTRAINT framework_id IF NOT EXISTS
FOR (f:Framework) REQUIRE f.id IS UNIQUE;

CREATE CONSTRAINT requirement_id IF NOT EXISTS
FOR (r:Requirement) REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT control_id IF NOT EXISTS
FOR (c:Control) REQUIRE c.id IS UNIQUE;
```
---

# 13. Neo4j Indexes

```cypher
CREATE INDEX signal_timestamp IF NOT EXISTS
FOR (s:Signal) ON (s.timestamp);

CREATE INDEX risk_score IF NOT EXISTS
FOR (r:Risk) ON (r.riskScore);

CREATE INDEX task_due_date IF NOT EXISTS
FOR (t:Task) ON (t.dueDate);
```

---

# 14. Agent Reasoning Queries

Detect impacted controls:

```cypher
MATCH (s:Signal)
<-[:GENERATES]-(a:Asset)
<-[:APPLIES_TO]-(c:Control)
RETURN c
```

Risk propagation:

```cypher
MATCH (c:Control {status:'FAIL'})
-[:MITIGATES]->(r:Risk)
SET r.status='INCREASED'
```

---

# 15. Extensibility Framework

Future dimensions can be inserted without schema redesign.

Examples:

- AI Governance
- ESG
- Data Sovereignty
- Industry Regulations
- Cybersecurity Frameworks

Pattern:

Dimension → Requirement → Control

---

# 16. Platform Services Ownership

Regulatory Service:
Frameworks, Requirements

Control Service:
Controls, Policies

Execution Service:
Programs, Workflows, Tasks

Risk Service:
Risks, Incidents

Evidence Service:
Evidence, Reports

Agent Service:
Agents, Remediation

---

# 17. Target Platform Vision

Vyra becomes the operational layer between:

Regulations
↕
Controls
↕
Systems
↕
Risk

Agents continuously:

Observe → Reason → Act → Verify

---

# 18. Final Architecture Statement

Vyra Graph Schema v6 defines a unified graph architecture connecting regulatory knowledge, compliance execution, operational telemetry, risk intelligence, and autonomous agents.

It serves as the canonical data model for the Vyra platform.
