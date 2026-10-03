import { Axis, Contract, Graph } from '../types';

const baseProps = {
    id: 'id',
    name: 'name',
    description: 'description',
    version: 'version',
    status: 'status',
    createdAt: 'createdAt',
};

export const v2: Contract = {
    version: '2.0.0',
    schemaId: 'vyra.semantic-contract.v2',
    hints: {
        linkedProps: [],
        idColumn: 'id',
        nameColumn: 'name',
    },
    types: {

        // ── Knowledge Graph ──────────────────────────────────────────────
        Jurisdiction: {
            label: 'Jurisdiction',
            graph: Graph.Knowledge,
            props: { ...baseProps, region: 'region', code: 'code' },
            axes: [Axis.Regulatory, Axis.Enterprise],
            rels: [],
        },

        Authority: {
            label: 'Authority',
            graph: Graph.Knowledge,
            props: { ...baseProps, abbreviation: 'abbreviation', authorityType: 'authorityType', jurisdictionId: 'jurisdictionId' },
            axes: [Axis.Regulatory],
            rels: [{ type: 'OPERATES_IN', targetLabel: 'Jurisdiction', sourceField: 'jurisdictionId' }],
        },

        Regulation: {
            label: 'Regulation',
            graph: Graph.Knowledge,
            props: {
                ...baseProps,
                referenceDoc: 'referenceDoc',
                effectiveDate: 'effectiveDate',
                jurisdictionId: 'jurisdictionId',
                authorityId: 'authorityId',
                catalogVersion: 'catalogVersion',
                effectiveFrom: 'effectiveFrom',
                supersededBy: 'supersededBy',
                tags: { mapTo: 'tags', isArray: true },
            },
            axes: [Axis.Regulatory],
            rels: [
                { type: 'IN_JURISDICTION', targetLabel: 'Jurisdiction', sourceField: 'jurisdictionId' },
                { type: 'ISSUED_BY', targetLabel: 'Authority', sourceField: 'authorityId' },
            ],
        },

        Clause: {
            label: 'Clause',
            graph: Graph.Knowledge,
            props: {
                ...baseProps,
                clauseRef: 'clauseRef',
                text: 'text',
                regulationId: 'regulationId',
                standardId: 'standardId',
                catalogVersion: 'catalogVersion',
                effectiveFrom: 'effectiveFrom',
                supersededBy: 'supersededBy',
                sourceDocumentId: 'sourceDocumentId',
                sourceAnchor: 'sourceAnchor',
                tags: { mapTo: 'tags', isArray: true },
            },
            axes: [Axis.Regulatory],
            rels: [
                { type: 'BELONGS_TO', targetLabel: 'Regulation', sourceField: 'regulationId' },
                { type: 'BELONGS_TO', targetLabel: 'Standard', sourceField: 'standardId' },
            ],
        },

        Obligation: {
            label: 'Obligation',
            graph: Graph.Knowledge,
            props: {
                ...baseProps,
                obligationType: 'obligationType',
                clauseId: 'clauseId',
                mandatory: 'mandatory',
                catalogVersion: 'catalogVersion',
                effectiveFrom: 'effectiveFrom',
                supersededBy: 'supersededBy',
                sourceDocumentId: 'sourceDocumentId',
                sourceAnchor: 'sourceAnchor',
                reportId: 'reportId',
                tags: { mapTo: 'tags', isArray: true },
            },
            axes: [Axis.Regulatory],
            rels: [
                { type: 'DEFINED_BY', targetLabel: 'Clause', sourceField: 'clauseId' },
                { type: 'REQUIRES_FILING', targetLabel: 'Report', sourceField: 'reportId' },
            ],
        },

        Control: {
            label: 'Control',
            graph: Graph.Knowledge,
            props: {
                ...baseProps,
                controlType: 'controlType',
                docType: 'docType',
                owner: 'owner',
                obligationId: 'obligationId',
                complianceAreaId: 'complianceAreaId',
                riskId: 'riskId',
                clauseId: 'clauseId',
                standardId: 'standardId',
                regulationId: 'regulationId',
                authorityId: 'authorityId',
                tags: { mapTo: 'tags', isArray: true },
            },
            axes: [Axis.Regulatory, Axis.Process],
            rels: [
                { type: 'IMPLEMENTS', targetLabel: 'Obligation', sourceField: 'obligationId' },
                { type: 'BELONGS_TO', targetLabel: 'ComplianceArea', sourceField: 'complianceAreaId' },
            ],
        },

        ComplianceArea: {
            label: 'ComplianceArea',
            graph: Graph.Knowledge,
            props: { ...baseProps },
            axes: [Axis.Regulatory],
            rels: [],
        },

        // A recurring statutory filing requirement an Obligation names (e.g. CPCB's
        // Form V Annual Environmental Statement) — catalog data, same amortized-once
        // shape as Obligation/Control, not tenant-specific. Distinct from
        // ReportSubmission (Assurance Graph, below), which is the tenant's actual
        // per-period filing event against this requirement. Journey v1-plan.md Phase
        // J0 Sub-phase 1 — schema only this pass; seeded by Sub-phase 1 Step 2's CPCB
        // catalog ingest, not yet in the live graph.
        Report: {
            label: 'Report',
            graph: Graph.Knowledge,
            // authorityId is a flat reference (same convention as Control's riskId/
            // clauseId for :Catalog rows) — the traversable edge to Authority belongs
            // on ReportSubmission (SUBMITTED_TO, Assurance Graph), the actual filing
            // event; Report itself is the recurring requirement, not a per-filing fact.
            //
            // Cadence is split, not a single free-text field (2026-10-03 correction —
            // the original single `cadence` string conflated two different things: a
            // periodic schedule and an event trigger, e.g. "Quarterly / at NOC renewal"
            // is both). cadenceUnit/cadenceInterval reuse Schedule's exact shape for the
            // periodic half; triggerCondition names the event half (e.g. "90-120 days
            // pre-expiry", "at consent renewal") when there is one — a Report can have
            // either, both (hybrid), or just one. cadenceRaw keeps the original source
            // text verbatim, same "raw text beside the structured chain" discipline
            // Incident.escalationPath already uses — convert-cpcb-seed.ts's
            // parseCadence() derives the structured fields from it, not the other way.
            props: {
                ...baseProps,
                reportType: 'reportType',
                authorityId: 'authorityId',
                cadenceUnit: 'cadenceUnit',
                cadenceInterval: 'cadenceInterval',
                triggerCondition: 'triggerCondition',
                cadenceRaw: 'cadenceRaw',
                tags: { mapTo: 'tags', isArray: true },
            },
            axes: [Axis.Regulatory, Axis.Assurance],
            rels: [],
        },

        Policy: {
            label: 'Policy',
            graph: Graph.Knowledge,
            props: { ...baseProps, effectiveDate: 'effectiveDate', owner: 'owner' },
            axes: [Axis.Regulatory],
            rels: [],
        },

        Standard: {
            label: 'Standard',
            graph: Graph.Knowledge,
            props: { ...baseProps, body: 'body', referenceDoc: 'referenceDoc' },
            axes: [Axis.Regulatory],
            rels: [],
        },

        // ── Execution Graph ──────────────────────────────────────────────
        Program: {
            label: 'Program',
            graph: Graph.Execution,
            props: { ...baseProps, owner: 'owner' },
            axes: [Axis.Process],
            rels: [],
        },

        Workflow: {
            label: 'Workflow',
            graph: Graph.Execution,
            props: { ...baseProps, type: 'type', programId: 'programId' },
            axes: [Axis.Process],
            rels: [{ type: 'PART_OF', targetLabel: 'Program', sourceField: 'programId' }],
        },

        Task: {
            label: 'Task',
            graph: Graph.Execution,
            // vendorId/ASSIGNED_TO: designed, not yet active — populated once Phase J0
            // Sub-phase 2 wires vendor-executed Task assignment (e.g. AMC-performed
            // stack monitoring); reuses ASSIGNED_TO, already used for Assignment →
            // Actor, safe under the same (relType, sourceLabel, targetLabel) grouping.
            // evidenceMethod: how evidence is captured (Lab/Manual Log/Mobile/IoT/
            // Document) — schema only this pass, no data yet.
            props: { ...baseProps, owner: 'owner', frequency: 'frequency', priority: 'priority', dueDate: 'dueDate', workflowId: 'workflowId', evidenceRequired: 'evidenceRequired', controlId: 'controlId', evidenceMethod: 'evidenceMethod', vendorId: 'vendorId' },
            axes: [Axis.Process, Axis.Time],
            rels: [
                { type: 'PART_OF', targetLabel: 'Workflow', sourceField: 'workflowId' },
                { type: 'IMPLEMENTS', targetLabel: 'Control', sourceField: 'controlId' },
                { type: 'ASSIGNED_TO', targetLabel: 'Vendor', sourceField: 'vendorId' },
            ],
        },

        CAPA: {
            label: 'CAPA',
            graph: Graph.Execution,
            // triggerCondition/deviationApprovedBy: schema only this pass, no data yet
            // on the existing 20 CAPAs — same precedent as docType on Control.
            props: { ...baseProps, owner: 'owner', dueDate: 'dueDate', findingId: 'findingId', triggerCondition: 'triggerCondition', deviationApprovedBy: 'deviationApprovedBy' },
            axes: [Axis.Process, Axis.Risk],
            rels: [{ type: 'ADDRESSES', targetLabel: 'Finding', sourceField: 'findingId' }],
        },

        Verification: {
            label: 'Verification',
            graph: Graph.Execution,
            props: { ...baseProps, outcome: 'outcome', verifiedAt: 'verifiedAt', verifiedBy: 'verifiedBy', capaId: 'capaId' },
            axes: [Axis.Process],
            rels: [],
        },

        Schedule: {
            label: 'Schedule',
            graph: Graph.Execution,
            props: { ...baseProps, cadenceUnit: 'cadenceUnit', cadenceInterval: 'cadenceInterval', anchorDate: 'anchorDate', taskId: 'taskId' },
            axes: [Axis.Process, Axis.Time],
            rels: [{ type: 'APPLIES_TO', targetLabel: 'Task', sourceField: 'taskId' }],
        },

        // ── Operational Graph ────────────────────────────────────────────
        Facility: {
            label: 'Facility',
            graph: Graph.Operational,
            // facilityType: hospital/hospitality/commercial/industrial — drives which
            // CPCB obligation set applies (e.g. BMW_RULES_2016 for hospital only).
            // Schema only this pass, no data yet.
            props: { ...baseProps, businessUnit: 'businessUnit', region: 'region', company: 'company', facilityType: 'facilityType' },
            axes: [Axis.Enterprise],
            rels: [],
        },

        Incident: {
            label: 'Incident',
            graph: Graph.Operational,
            props: {
                ...baseProps,
                auditType: 'auditType',
                scheduleType: 'scheduleType',
                planningTime: 'planningTime',
                auditTime: 'auditTime',
                incidentTime: 'incidentTime',
                scope: 'scope',
                businessUnit: 'businessUnit',
                escalationPath: 'escalationPath',
                capturedBy: 'capturedBy',
                reviewedBy: 'reviewedBy',
                closure: 'closure',
                dashboardMetrics: 'dashboardMetrics',
                continuousMonitoring: 'continuousMonitoring',
                likelihood: 'likelihood',
                severity: 'severity',
                residualRisk: 'residualRisk',
                riskRating: 'riskRating',
                facilityId: 'facilityId',
                assetId: 'assetId',
                vendorId: 'vendorId',
            },
            axes: [Axis.Enterprise, Axis.Risk],
            rels: [
                { type: 'OCCURRED_AT', targetLabel: 'Facility', sourceField: 'facilityId' },
            ],
        },

        Asset: {
            label: 'Asset',
            graph: Graph.Operational,
            props: {
                ...baseProps,
                assetType: 'assetType',
                owner: 'owner',
                vendorId: 'vendorId',
                facilityId: 'facilityId',
                buildingId: 'buildingId',
                zoneId: 'zoneId',
                roomId: 'roomId',
                category: 'category',
                complianceAreaId: 'complianceAreaId',
            },
            axes: [Axis.Enterprise],
            rels: [
                { type: 'SUPPLIED_BY', targetLabel: 'Vendor', sourceField: 'vendorId' },
                { type: 'LOCATED_AT', targetLabel: 'Facility', sourceField: 'facilityId' },
                { type: 'IN_COMPLIANCE_AREA', targetLabel: 'ComplianceArea', sourceField: 'complianceAreaId' },
            ],
        },

        Vendor: {
            label: 'Vendor',
            graph: Graph.Operational,
            props: { ...baseProps, riskTier: 'riskTier', contactEmail: 'contactEmail' },
            axes: [Axis.Enterprise],
            rels: [],
        },

        // Vendor service agreement (AMC/SLA) — its own node, not fields on Vendor,
        // since AMC start/expiry and SLA are contract-lifecycle facts (a vendor can
        // have multiple contracts/renewals over time), not vendor-identity facts.
        // Append-and-supersede, same discipline as Regulation (foundation.md: "nothing is
        // deleted, only superseded") — a Contract's terms are never mutated in place. A
        // renewal/amendment is always a new Contract node, linked back via supersededBy;
        // see api/modules/enterprise/repo.ts's proposeContractChange and
        // api/modules/intelligence/repo.ts's contract-proposal resolution branch.
        Contract: {
            label: 'Contract',
            graph: Graph.Operational,
            props: {
                ...baseProps,
                serviceType: 'serviceType',
                slaResponseTime: 'slaResponseTime',
                amcStartDate: 'amcStartDate',
                amcExpiryDate: 'amcExpiryDate',
                vendorId: 'vendorId',
                coordinatorRoleId: 'coordinatorRoleId',
                effectiveFrom: 'effectiveFrom',
                supersededBy: 'supersededBy',
            },
            axes: [Axis.Enterprise],
            rels: [
                { type: 'WITH_VENDOR', targetLabel: 'Vendor', sourceField: 'vendorId' },
                { type: 'COORDINATED_BY', targetLabel: 'Role', sourceField: 'coordinatorRoleId' },
            ],
        },

        // Regulatory instrument held by the enterprise (consent/authorization/NOC/
        // registration/license) — one node type with an instrumentType discriminator,
        // same pattern as Control.controlType, not six node labels. No CSV feed —
        // designed, not yet active; the write path (Decision-gated, mirroring
        // proposeContractChange) lands in journey/v1-plan.md Phase J0 Sub-phase 2.
        // Asset-level coverage (which Assets this instrument covers, required for
        // renewal/amendment impact analysis) is the live-only COVERED_BY_CONSENT edge —
        // not compiler-driven, see graph.md's Operational Graph relationship catalog.
        Permit: {
            label: 'Permit',
            graph: Graph.Operational,
            props: {
                ...baseProps,
                instrumentType: 'instrumentType',
                authorityId: 'authorityId',
                facilityId: 'facilityId',
                issuedDate: 'issuedDate',
                expiryDate: 'expiryDate',
                renewalWindowDays: 'renewalWindowDays',
            },
            axes: [Axis.Regulatory, Axis.Enterprise],
            rels: [
                { type: 'ISSUED_BY', targetLabel: 'Authority', sourceField: 'authorityId' },
                { type: 'COVERS', targetLabel: 'Facility', sourceField: 'facilityId' },
            ],
        },

        Organization: {
            label: 'Organization',
            graph: Graph.Operational,
            props: { ...baseProps, company: 'company' },
            axes: [Axis.Enterprise],
            rels: [],
        },

        Role: {
            label: 'Role',
            graph: Graph.Operational,
            props: {
                ...baseProps,
                businessUnit: 'businessUnit',
                department: 'department',
                approvalAuthority: 'approvalAuthority',
                organizationId: 'organizationId',
            },
            axes: [Axis.Enterprise],
            rels: [{ type: 'BELONGS_TO', targetLabel: 'Organization', sourceField: 'organizationId' }],
        },

        Person: {
            label: 'Person',
            graph: Graph.Operational,
            props: { ...baseProps, email: 'email', roleId: 'roleId', roleTitle: 'roleTitle', facilityId: 'facilityId' },
            axes: [Axis.Enterprise],
            rels: [
                { type: 'HAS_ROLE', targetLabel: 'Role', sourceField: 'roleId' },
                { type: 'WORKS_AT', targetLabel: 'Facility', sourceField: 'facilityId' },
            ],
        },

        // Signal has no CSV feed — it's written live by the operational API
        // (api/modules/operational/repo.ts), not by the ingestion pipeline. rels below
        // documents the shape that live write path creates; it's not compiler-driven.
        Signal: {
            label: 'Signal',
            graph: Graph.Operational,
            props: { ...baseProps, type: 'type', source: 'source', timestamp: 'timestamp', payload: 'payload', assetId: 'assetId', raisedBy: 'raisedBy' },
            axes: [Axis.Signal],
            rels: [
                { type: 'EMITTED_BY', targetLabel: 'Asset', sourceField: 'assetId' },
                { type: 'RAISED_BY', targetLabel: 'Person', sourceField: 'raisedBy' },
            ],
        },

        Evidence: {
            label: 'Evidence',
            graph: Graph.Operational,
            props: { ...baseProps, type: 'type', source: 'source', collectedAt: 'collectedAt', taskId: 'taskId', packageId: 'packageId' },
            axes: [Axis.Process, Axis.Assurance],
            rels: [
                { type: 'PRODUCED_BY', targetLabel: 'Task', sourceField: 'taskId' },
                { type: 'PART_OF', targetLabel: 'EvidencePackage', sourceField: 'packageId' },
            ],
        },

        // ── Intelligence Graph ───────────────────────────────────────────
        Finding: {
            label: 'Finding',
            graph: Graph.Intelligence,
            props: { ...baseProps, severity: 'severity', detectedAt: 'detectedAt', controlId: 'controlId' },
            axes: [Axis.Risk],
            rels: [{ type: 'AGAINST', targetLabel: 'Control', sourceField: 'controlId' }],
        },

        Risk: {
            label: 'Risk',
            graph: Graph.Intelligence,
            props: { ...baseProps, owner: 'owner', inherentScore: 'inherentScore', inherentRating: 'inherentRating', residualScore: 'residualScore', residualRating: 'residualRating', findingId: 'findingId' },
            axes: [Axis.Risk],
            rels: [{ type: 'RAISED_BY', targetLabel: 'Finding', sourceField: 'findingId' }],
        },

        // Decision has no CSV feed — written live by agents/tools/graph-write.ts (origin:
        // 'agent') or api/modules/enterprise/repo.ts's proposeContractChange (origin:
        // 'human'), never by the ingestion pipeline. Documentation only, like Signal above.
        Decision: {
            label: 'Decision',
            graph: Graph.Intelligence,
            props: { ...baseProps, type: 'type', rationale: 'rationale', decidedAt: 'decidedAt', agentId: 'agentId', autonomyLevel: 'autonomyLevel', confidence: 'confidence', origin: 'origin', proposedBy: 'proposedBy' },
            axes: [Axis.Agent],
            rels: [],
        },

        RCA: {
            label: 'RCA',
            graph: Graph.Intelligence,
            props: { ...baseProps, rootCause: 'rootCause', analysedAt: 'analysedAt', findingId: 'findingId' },
            axes: [Axis.Risk],
            rels: [],
        },

        // ── Assurance Graph ──────────────────────────────────────────────
        EvidencePackage: {
            label: 'EvidencePackage',
            graph: Graph.Assurance,
            props: { ...baseProps, period: 'period' },
            axes: [Axis.Assurance],
            rels: [],
        },

        Attestation: {
            label: 'Attestation',
            graph: Graph.Assurance,
            props: { ...baseProps, attestedBy: 'attestedBy', attestedAt: 'attestedAt', packageId: 'packageId' },
            axes: [Axis.Assurance],
            rels: [{ type: 'BACKED_BY', targetLabel: 'EvidencePackage', sourceField: 'packageId' }],
        },

        AssuranceStatement: {
            label: 'AssuranceStatement',
            graph: Graph.Assurance,
            props: { ...baseProps, scope: 'scope', posture: 'posture', generatedAt: 'generatedAt', attestationId: 'attestationId' },
            axes: [Axis.Assurance],
            rels: [{ type: 'DERIVED_FROM', targetLabel: 'Attestation', sourceField: 'attestationId' }],
        },

        Audit: {
            label: 'Audit',
            graph: Graph.Assurance,
            props: { ...baseProps, type: 'type', period: 'period', auditor: 'auditor' },
            axes: [Axis.Assurance],
            rels: [],
        },

        // The tenant's actual per-period filing event against a Report requirement —
        // distinct from Report itself (Knowledge Graph, above), which is the recurring
        // catalog-defined requirement. No CSV feed — designed, not yet active; the
        // write path lands in journey/v1-plan.md Phase J0 Sub-phase 2 (document
        // extraction from the customer's "Filings" folder).
        ReportSubmission: {
            label: 'ReportSubmission',
            graph: Graph.Assurance,
            props: { ...baseProps, reportId: 'reportId', authorityId: 'authorityId', periodCovered: 'periodCovered', submittedAt: 'submittedAt', acknowledgedAt: 'acknowledgedAt' },
            axes: [Axis.Assurance],
            rels: [
                { type: 'FILED_AGAINST', targetLabel: 'Report', sourceField: 'reportId' },
                { type: 'SUBMITTED_TO', targetLabel: 'Authority', sourceField: 'authorityId' },
            ],
        },

        Exception: {
            label: 'Exception',
            graph: Graph.Assurance,
            props: { ...baseProps, reason: 'reason', approver: 'approver', expiresAt: 'expiresAt', obligationId: 'obligationId' },
            axes: [Axis.Assurance, Axis.Risk],
            rels: [{ type: 'WAIVES', targetLabel: 'Obligation', sourceField: 'obligationId' }],
        },
    },
};
