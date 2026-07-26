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
            },
            axes: [Axis.Regulatory],
            rels: [
                { type: 'BELONGS_TO', targetLabel: 'Regulation', sourceField: 'regulationId' },
                { type: 'BELONGS_TO', targetLabel: 'Standard', sourceField: 'standardId' },
            ],
        },

        Requirement: {
            label: 'Requirement',
            graph: Graph.Knowledge,
            props: {
                ...baseProps,
                obligationType: 'obligationType',
                clauseId: 'clauseId',
                mandatory: 'mandatory',
                catalogVersion: 'catalogVersion',
                effectiveFrom: 'effectiveFrom',
                supersededBy: 'supersededBy',
            },
            axes: [Axis.Regulatory],
            rels: [{ type: 'DEFINED_BY', targetLabel: 'Clause', sourceField: 'clauseId' }],
        },

        Control: {
            label: 'Control',
            graph: Graph.Knowledge,
            props: {
                ...baseProps,
                controlType: 'controlType',
                owner: 'owner',
                requirementId: 'requirementId',
                complianceAreaId: 'complianceAreaId',
                riskId: 'riskId',
                clauseId: 'clauseId',
                standardId: 'standardId',
                regulationId: 'regulationId',
                authorityId: 'authorityId',
            },
            axes: [Axis.Regulatory, Axis.Process],
            rels: [
                { type: 'IMPLEMENTS', targetLabel: 'Requirement', sourceField: 'requirementId' },
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
            props: { ...baseProps, owner: 'owner', frequency: 'frequency', priority: 'priority', dueDate: 'dueDate', workflowId: 'workflowId', evidenceRequired: 'evidenceRequired' },
            axes: [Axis.Process, Axis.Time],
            rels: [{ type: 'PART_OF', targetLabel: 'Workflow', sourceField: 'workflowId' }],
        },

        CAPA: {
            label: 'CAPA',
            graph: Graph.Execution,
            props: { ...baseProps, owner: 'owner', dueDate: 'dueDate', findingId: 'findingId' },
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
            props: { ...baseProps, cadenceUnit: 'cadenceUnit', cadenceInterval: 'cadenceInterval', anchorDate: 'anchorDate', requirementId: 'requirementId' },
            axes: [Axis.Process, Axis.Time],
            rels: [{ type: 'APPLIES_TO', targetLabel: 'Requirement', sourceField: 'requirementId' }],
        },

        // ── Operational Graph ────────────────────────────────────────────
        Facility: {
            label: 'Facility',
            graph: Graph.Operational,
            props: { ...baseProps, businessUnit: 'businessUnit', region: 'region', company: 'company' },
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
            props: { ...baseProps, email: 'email', roleId: 'roleId', facilityId: 'facilityId' },
            axes: [Axis.Enterprise],
            rels: [
                { type: 'HAS_ROLE', targetLabel: 'Role', sourceField: 'roleId' },
                { type: 'WORKS_AT', targetLabel: 'Facility', sourceField: 'facilityId' },
            ],
        },

        Signal: {
            label: 'Signal',
            graph: Graph.Operational,
            props: { ...baseProps, type: 'type', source: 'source', timestamp: 'timestamp', payload: 'payload', assetId: 'assetId' },
            axes: [Axis.Signal],
            rels: [{ type: 'EMITTED_BY', targetLabel: 'Asset', sourceField: 'assetId' }],
        },

        Evidence: {
            label: 'Evidence',
            graph: Graph.Operational,
            props: { ...baseProps, type: 'type', source: 'source', collectedAt: 'collectedAt', taskId: 'taskId' },
            axes: [Axis.Process, Axis.Assurance],
            rels: [{ type: 'PRODUCED_BY', targetLabel: 'Task', sourceField: 'taskId' }],
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

        Decision: {
            label: 'Decision',
            graph: Graph.Intelligence,
            props: { ...baseProps, type: 'type', rationale: 'rationale', decidedAt: 'decidedAt', agentId: 'agentId', autonomyLevel: 'autonomyLevel', confidence: 'confidence' },
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

        Exception: {
            label: 'Exception',
            graph: Graph.Assurance,
            props: { ...baseProps, reason: 'reason', approver: 'approver', expiresAt: 'expiresAt', requirementId: 'requirementId' },
            axes: [Axis.Assurance, Axis.Risk],
            rels: [{ type: 'WAIVES', targetLabel: 'Requirement', sourceField: 'requirementId' }],
        },
    },
};
