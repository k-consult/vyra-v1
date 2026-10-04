import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

// 'cutover-overdue' is never stored — derived live from dueBy vs now(), the same
// discipline Coverage Scoring already uses (a live Cypher CASE, not a stamped
// field). foundation.md §0: "a first-class, queryable cutover-overdue state."
const LIST_CUTOVER_CRITERIA = `
    MATCH (c:CutoverCriterion)
    RETURN properties(c) AS criterion,
           CASE WHEN c.status = 'proving' AND c.dueBy < datetime() THEN 'cutover-overdue' ELSE c.status END AS effectiveStatus
    ORDER BY c.dueBy
`;

export const listCutoverCriteria = async () => {
    const raw: any = await db().fetch(LIST_CUTOVER_CRITERIA, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.criterion).map((r: any) => ({
        ...r.criterion,
        effectiveStatus: r.effectiveStatus,
    }));
};

export interface ProposeCutoverCriterionInput {
    proposedBy: string;
    workflowName: string;
    criterionDescription: string;
    systemOfRecord: 'legacy' | 'vyra';
    agreementRateTarget: number;
    dueBy: string;
}

// Writes only a pending Decision — never a CutoverCriterion directly. The real node
// is created on approval by intelligence/repo.ts's cutover-criterion-proposal
// branch (same discipline as enterprise/repo.ts's proposeContractChange). No ABOUT
// edge: no real Workflow node exists yet to point at (graph.md's CutoverCriterion
// entry) — every other Decision-write path in this codebase merges one against a
// real source node; this is a deliberate, documented exception, not an oversight.
const PROPOSE_CUTOVER_CRITERION = `
    MERGE (d:Decision {id: $id})
    ON CREATE SET
        d += $props,
        d.decidedAt = datetime(),
        d.status = 'pending',
        d.origin = 'human'
    RETURN properties(d) AS decision
`;

export const proposeCutoverCriterion = async (input: ProposeCutoverCriterionInput) => {
    const id = `DEC-CUTOVER-${Date.now()}`;
    const raw: any = await db().exec(PROPOSE_CUTOVER_CRITERION, {
        id,
        props: {
            type: 'cutover-criterion-proposal',
            rationale: `Human-proposed cutover criterion for "${input.workflowName}"`,
            agentId: input.proposedBy,
            autonomyLevel: 0,
            confidence: 1,
            proposedBy: input.proposedBy,
            workflowName: input.workflowName,
            criterionDescription: input.criterionDescription,
            systemOfRecord: input.systemOfRecord,
            agreementRateTarget: input.agreementRateTarget,
            dueBy: input.dueBy,
        },
    });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return { decision: row?.decision };
};

const FACILITY_EXISTS = `MATCH (f:Facility {id: $id}) RETURN count(f) > 0 AS facilityExists`;
export const facilityExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(FACILITY_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.facilityExists);
};

const ROLE_EXISTS = `MATCH (r:Role {id: $id}) RETURN count(r) > 0 AS roleExists`;
export const roleExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(ROLE_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.roleExists);
};

const ASSET_EXISTS = `MATCH (a:Asset {id: $id}) RETURN count(a) > 0 AS assetExists`;
export const assetExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(ASSET_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.assetExists);
};

const HAZARD_EXISTS = `MATCH (h:Hazard {id: $id}) RETURN count(h) > 0 AS hazardExists`;
export const hazardExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(HAZARD_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.hazardExists);
};

const LIST_BLUEPRINTS = `
    MATCH (bp:Blueprint)
    OPTIONAL MATCH (bp)-[:ABOUT]->(f:Facility)
    OPTIONAL MATCH (bp)-[:COVERS]->(r:Role)
    OPTIONAL MATCH (bp)-[:COVERS]->(a:Asset)
    RETURN properties(bp) AS blueprint,
           f.name AS facilityName,
           collect(DISTINCT r.id) AS roleIds,
           collect(DISTINCT a.id) AS assetIds,
           bp.createdAt AS createdAt
    ORDER BY createdAt DESC
`;

export const listBlueprints = async () => {
    const raw: any = await db().fetch(LIST_BLUEPRINTS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.blueprint).map((r: any) => ({
        ...r.blueprint,
        facilityName: r.facilityName,
        roleIds: (r.roleIds ?? []).filter(Boolean),
        assetIds: (r.assetIds ?? []).filter(Boolean),
    }));
};

export interface ProposeBlueprintInput {
    proposedBy: string;
    facilityId: string;
    scopeDescription: string;
    roleIds: string[];
    assetIds: string[];
}

// Writes only a pending Decision — never a Blueprint directly. The real node is
// created on approval by intelligence/repo.ts's blueprint-proposal branch (same
// discipline as CutoverCriterion/Contract above). Unlike CutoverCriterion, a
// Blueprint references real, already-live nodes (Facility/Role/Asset), so it gets
// a real ABOUT edge — foundation.md §2's "the blueprint is inferred and proposed,
// never self-asserted," ratified through this same Decision gate. facilityId is
// read back off d (not passed as a second top-level param) so the Facility this
// proposal is ABOUT is always the one just stored in props — one source of truth.
const PROPOSE_BLUEPRINT = `
    MERGE (d:Decision {id: $id})
    ON CREATE SET
        d += $props,
        d.decidedAt = datetime(),
        d.status = 'pending',
        d.origin = 'human'
    WITH d
    MATCH (f:Facility {id: d.facilityId})
    MERGE (d)-[:ABOUT]->(f)
    RETURN properties(d) AS decision
`;

export const proposeBlueprint = async (input: ProposeBlueprintInput) => {
    const id = `DEC-BLUEPRINT-${Date.now()}`;
    const raw: any = await db().exec(PROPOSE_BLUEPRINT, {
        id,
        props: {
            type: 'blueprint-proposal',
            rationale: `Human-proposed enterprise blueprint for facility "${input.facilityId}"`,
            agentId: input.proposedBy,
            autonomyLevel: 0,
            confidence: 1,
            proposedBy: input.proposedBy,
            facilityId: input.facilityId,
            scopeDescription: input.scopeDescription,
            roleIds: input.roleIds,
            assetIds: input.assetIds,
        },
    });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return { decision: row?.decision };
};

const LIST_HAZARDS = `
    MATCH (h:Hazard)
    RETURN properties(h) AS hazard
    ORDER BY h.createdAt DESC
`;

export const listHazards = async () => {
    const raw: any = await db().fetch(LIST_HAZARDS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.hazard).map((r: any) => r.hazard);
};

export interface ProposeHazardInput {
    proposedBy: string;
    name: string;
    hazardType: string;
    description: string;
    facilityId: string;
    assetId?: string;
}

// Writes only a pending Decision — never a Hazard directly. The real node is
// created on approval by intelligence/repo.ts's hazard-proposal branch (same
// discipline as Blueprint/Contract above). Scoped to Facility like Blueprint,
// since every Hazard is at minimum site-located even when it also names a
// specific Asset (domain-extension.md §8.4(a)).
const PROPOSE_HAZARD = `
    MERGE (d:Decision {id: $id})
    ON CREATE SET
        d += $props,
        d.decidedAt = datetime(),
        d.status = 'pending',
        d.origin = 'human'
    WITH d
    MATCH (f:Facility {id: d.facilityId})
    MERGE (d)-[:ABOUT]->(f)
    RETURN properties(d) AS decision
`;

export const proposeHazard = async (input: ProposeHazardInput) => {
    const id = `DEC-HAZARD-${Date.now()}`;
    const raw: any = await db().exec(PROPOSE_HAZARD, {
        id,
        props: {
            type: 'hazard-proposal',
            rationale: `Human-proposed hazard "${input.name}" at facility "${input.facilityId}"`,
            agentId: input.proposedBy,
            autonomyLevel: 0,
            confidence: 1,
            proposedBy: input.proposedBy,
            name: input.name,
            hazardType: input.hazardType,
            description: input.description,
            facilityId: input.facilityId,
            assetId: input.assetId ?? '',
        },
    });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return { decision: row?.decision };
};

const LIST_HAZARD_ASSESSMENTS = `
    MATCH (hsa:HazardAssessment)
    RETURN properties(hsa) AS assessment
    ORDER BY hsa.assessedAt DESC
`;

export const listHazardAssessments = async () => {
    const raw: any = await db().fetch(LIST_HAZARD_ASSESSMENTS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.assessment).map((r: any) => r.assessment);
};

export interface ProposeHazardAssessmentInput {
    proposedBy: string;
    hazardId: string;
    name?: string;
    likelihood: number;
    severity: number;
    rating: string;
}

// Writes only a pending Decision — never a HazardAssessment directly. The real
// node is created on approval by intelligence/repo.ts's hazard-assessment-proposal
// branch. likelihood/severity are carried as proposed values; score is computed
// in Cypher at approval time (likelihood x severity), never trusted as arithmetic
// from the proposer — same discipline Risk already uses for proposedLikelihood/
// proposedConsequence.
const PROPOSE_HAZARD_ASSESSMENT = `
    MERGE (d:Decision {id: $id})
    ON CREATE SET
        d += $props,
        d.decidedAt = datetime(),
        d.status = 'pending',
        d.origin = 'human'
    WITH d
    MATCH (h:Hazard {id: d.hazardId})
    MERGE (d)-[:ABOUT]->(h)
    RETURN properties(d) AS decision
`;

export const proposeHazardAssessment = async (input: ProposeHazardAssessmentInput) => {
    const id = `DEC-HAZASSESS-${Date.now()}`;
    const raw: any = await db().exec(PROPOSE_HAZARD_ASSESSMENT, {
        id,
        props: {
            type: 'hazard-assessment-proposal',
            rationale: `Human-proposed hazard assessment for hazard "${input.hazardId}"`,
            agentId: input.proposedBy,
            autonomyLevel: 0,
            confidence: 1,
            proposedBy: input.proposedBy,
            hazardId: input.hazardId,
            name: input.name ?? '',
            proposedLikelihood: input.likelihood,
            proposedSeverity: input.severity,
            proposedRating: input.rating,
        },
    });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return { decision: row?.decision };
};

const LIST_EMERGENCY_PLANS = `
    MATCH (ep:EmergencyPlan)
    RETURN properties(ep) AS plan
    ORDER BY ep.createdAt DESC
`;

export const listEmergencyPlans = async () => {
    const raw: any = await db().fetch(LIST_EMERGENCY_PLANS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.plan).map((r: any) => r.plan);
};

export interface ProposeEmergencyPlanInput {
    proposedBy: string;
    facilityId: string;
    name?: string;
    drillFrequency: string;
}

// Writes only a pending Decision — never an EmergencyPlan directly. The real
// node is created on approval by intelligence/repo.ts's emergency-plan-proposal
// branch (same discipline as Blueprint above, which this mirrors exactly: scoped
// to one Facility, real ABOUT edge since Facility already exists live).
const PROPOSE_EMERGENCY_PLAN = `
    MERGE (d:Decision {id: $id})
    ON CREATE SET
        d += $props,
        d.decidedAt = datetime(),
        d.status = 'pending',
        d.origin = 'human'
    WITH d
    MATCH (f:Facility {id: d.facilityId})
    MERGE (d)-[:ABOUT]->(f)
    RETURN properties(d) AS decision
`;

export const proposeEmergencyPlan = async (input: ProposeEmergencyPlanInput) => {
    const id = `DEC-EMERGENCYPLAN-${Date.now()}`;
    const raw: any = await db().exec(PROPOSE_EMERGENCY_PLAN, {
        id,
        props: {
            type: 'emergency-plan-proposal',
            rationale: `Human-proposed emergency plan for facility "${input.facilityId}"`,
            agentId: input.proposedBy,
            autonomyLevel: 0,
            confidence: 1,
            proposedBy: input.proposedBy,
            facilityId: input.facilityId,
            name: input.name ?? '',
            drillFrequency: input.drillFrequency,
        },
    });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return { decision: row?.decision };
};
