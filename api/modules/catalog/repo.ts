import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';
import * as domain from './domain';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

// No :Catalog label filter — a Regulation/Control is real regardless of which feed
// wrote it (catalog-sync vs the legacy grc pipeline). Filtering on :Catalog was the
// bug that made this domain's read side silently drop data in local dev.
const LIST_REGULATIONS = `
    MATCH (n:Regulation)
    RETURN properties(n) AS regulation
    ORDER BY n.name
`;

const LIST_CLAUSES = `
    MATCH (n:Clause)
    RETURN properties(n) AS clause
    ORDER BY n.clauseRef
`;

const LIST_OBLIGATIONS = `
    MATCH (n:Obligation)
    RETURN properties(n) AS obligation
    ORDER BY n.name
`;

const LIST_CONTROLS = `
    MATCH (n:Control)
    RETURN properties(n) AS control
    ORDER BY n.name
`;

const LIST_AGENT_PROPOSED_CONTROLS = `
    MATCH (n:Control:AgentProposed)
    RETURN properties(n) AS control
    ORDER BY n.createdAt DESC
`;

const LIST_AUTHORITIES = `
    MATCH (n:Authority)
    RETURN properties(n) AS authority
    ORDER BY n.name
`;

const LIST_COMPLIANCE_AREAS = `
    MATCH (n:ComplianceArea)
    RETURN properties(n) AS complianceArea
    ORDER BY n.name
`;

const LAST_SYNCED_AT = `
    MATCH (n)
    WHERE n.syncedAt IS NOT NULL
    RETURN max(n.syncedAt) AS lastSyncedAt
`;

const REGULATION_HISTORY = `
    MATCH (target:Regulation {id: $id})
    MATCH (r:Regulation)
    WHERE r.id = target.id OR r.id = target.supersededBy OR r.supersededBy = target.id
    RETURN properties(r) AS regulation
    ORDER BY r.catalogVersion
`;

const TRACE_FORWARD = `
    MATCH (reg:Regulation {id: $id})
                 <-[:BELONGS_TO]-(cls:Clause)
                 <-[:DEFINED_BY]-(obl:Obligation)
                 <-[:IMPLEMENTS]-(ctl:Control)
    RETURN
        properties(reg) AS regulation,
        properties(cls) AS clause,
        properties(obl) AS obligation,
        properties(ctl) AS control
    LIMIT 200
`;

export const listRegulations = async (currentOnly = false) => {
    const raw: any = await db().fetch(LIST_REGULATIONS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    const regulations = rows.map((r: any) => r.regulation).filter(Boolean);
    return currentOnly ? regulations.filter(domain.isCurrent) : regulations;
};

export const listClauses = async () => {
    const raw: any = await db().fetch(LIST_CLAUSES, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.clause).filter(Boolean);
};

export const listObligations = async () => {
    const raw: any = await db().fetch(LIST_OBLIGATIONS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.obligation).filter(Boolean);
};

export const listObligationsWithoutControl = async () => {
    const [obligations, controls] = await Promise.all([listObligations(), listControls()]);
    return obligations.filter((obligation: any) => !domain.hasImplementingControl(obligation, controls));
};

export const listControls = async () => {
    const raw: any = await db().fetch(LIST_CONTROLS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.control).filter(Boolean);
};

export const listAgentProposedControls = async () => {
    const raw: any = await db().fetch(LIST_AGENT_PROPOSED_CONTROLS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.control).filter(Boolean);
};

export const listAuthorities = async () => {
    const raw: any = await db().fetch(LIST_AUTHORITIES, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.authority).filter(Boolean);
};

export const listComplianceAreas = async () => {
    const raw: any = await db().fetch(LIST_COMPLIANCE_AREAS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.complianceArea).filter(Boolean);
};

export const getLastSyncedAt = async () => {
    const raw: any = await db().fetch(LAST_SYNCED_AT, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows[0]?.lastSyncedAt ?? null;
};

export const getRegulationHistory = async (regulationId: string) => {
    const raw: any = await db().fetch(REGULATION_HISTORY, { id: regulationId });
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.regulation).filter(Boolean);
};

export const traceForward = async (regulationId: string) => {
    const raw: any = await db().fetch(TRACE_FORWARD, { id: regulationId });
    return Array.isArray(raw) ? raw : [raw];
};

const CLAUSE_EXISTS = `MATCH (c:Clause {id: $id}) RETURN count(c) > 0 AS clauseExists`;
export const clauseExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(CLAUSE_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.clauseExists);
};

export interface ProposeObligationInput {
    proposedBy: string;
    clauseId: string;
    proposedName: string;
    proposedObligationType?: string;
    proposedMandatory?: string;
}

// Writes only a pending Decision — never an Obligation directly, same append-and-
// supersede discipline as Regulation/Contract. The real Obligation node is created
// only on approval, via intelligence/repo.ts's catalog-obligation-proposal branch.
// This is the "Manual Entry" ingestion channel (foundation.md §1's channel-
// uniformity requirement) — document-upload/AI extraction is Phase 4, once a real
// regulatory-intelligence agent exists to interpret unstructured text.
const PROPOSE_OBLIGATION = `
    MERGE (d:Decision {id: $id})
    ON CREATE SET
        d += $props,
        d.decidedAt = datetime(),
        d.status = 'pending',
        d.origin = 'human'
    WITH d
    MATCH (cls:Clause {id: $clauseId})
    MERGE (d)-[:ABOUT]->(cls)
    RETURN properties(d) AS decision
`;

export const proposeObligation = async (input: ProposeObligationInput) => {
    const id = `DEC-OBLIGATION-${Date.now()}`;
    const raw: any = await db().exec(PROPOSE_OBLIGATION, {
        id,
        clauseId: input.clauseId,
        props: {
            type: 'catalog-obligation-proposal',
            rationale: `Human-proposed obligation under clause ${input.clauseId}`,
            agentId: input.proposedBy,
            autonomyLevel: 0,
            confidence: 1,
            proposedBy: input.proposedBy,
            proposedName: input.proposedName,
            proposedObligationType: input.proposedObligationType ?? 'UNKNOWN',
            proposedMandatory: input.proposedMandatory ?? 'N',
            clauseId: input.clauseId,
        },
    });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return { decision: row?.decision };
};
