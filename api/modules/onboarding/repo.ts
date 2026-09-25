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
