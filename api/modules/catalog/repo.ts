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

const LIST_JURISDICTIONS = `
    MATCH (n:Jurisdiction)
    RETURN properties(n) AS jurisdiction
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

// OPTIONAL on both Control and Report — CPCB's chain is the first real exercise of
// an Obligation with no Control, and separately of REQUIRES_FILING. Neither should
// hide an obligation from the chain view: a missing Control is "documented absence"
// (foundation.md §2), and a missing Report is correct for the 5 internal-NC-log-only
// CPCB obligations (see convert-cpcb-seed.ts) — both must render, not disappear.
const TRACE_FORWARD = `
    MATCH (reg:Regulation {id: $id})
                 <-[:BELONGS_TO]-(cls:Clause)
                 <-[:DEFINED_BY]-(obl:Obligation)
    OPTIONAL MATCH (obl)<-[:IMPLEMENTS]-(ctl:Control)
    OPTIONAL MATCH (obl)-[:REQUIRES_FILING]->(rpt:Report)
    RETURN
        properties(reg) AS regulation,
        properties(cls) AS clause,
        properties(obl) AS obligation,
        properties(ctl) AS control,
        properties(rpt) AS report
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

export const listJurisdictions = async () => {
    const raw: any = await db().fetch(LIST_JURISDICTIONS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.jurisdiction).filter(Boolean);
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

const REPORT_EXISTS = `MATCH (r:Report {id: $id}) RETURN count(r) > 0 AS reportExists`;
export const reportExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(REPORT_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.reportExists);
};

const AUTHORITY_EXISTS = `MATCH (a:Authority {id: $id}) RETURN count(a) > 0 AS authorityExists`;
export const authorityExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(AUTHORITY_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.authorityExists);
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

const LIST_REPORT_SUBMISSIONS = `
    MATCH (rs:ReportSubmission)
    RETURN properties(rs) AS reportSubmission
    ORDER BY rs.submittedAt DESC
`;

export const listReportSubmissions = async () => {
    const raw: any = await db().fetch(LIST_REPORT_SUBMISSIONS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.reportSubmission).map((r: any) => r.reportSubmission);
};

export interface ProposeReportSubmissionInput {
    proposedBy: string;
    reportId: string;
    authorityId: string;
    periodCovered: string;
    submittedAt?: string;
}

// Writes only a pending Decision — never a ReportSubmission directly, same
// discipline as Obligation/Contract/Hazard above. The real node is created on
// approval by intelligence/repo.ts's report-submission-proposal branch.
// authorityId is carried as a plain proposed value, not resolved here — it can
// legitimately differ from the Report's own obligation's ISSUED_BY authority
// (graph.md's ReportSubmission entry), so there is nothing to MATCH against on
// the Report side; spec.ts's authorityExists already confirms it's real.
const PROPOSE_REPORT_SUBMISSION = `
    MERGE (d:Decision {id: $id})
    ON CREATE SET
        d += $props,
        d.decidedAt = datetime(),
        d.status = 'pending',
        d.origin = 'human'
    WITH d
    MATCH (rpt:Report {id: d.reportId})
    MERGE (d)-[:ABOUT]->(rpt)
    RETURN properties(d) AS decision
`;

export const proposeReportSubmission = async (input: ProposeReportSubmissionInput) => {
    const id = `DEC-REPORTSUB-${Date.now()}`;
    const raw: any = await db().exec(PROPOSE_REPORT_SUBMISSION, {
        id,
        props: {
            type: 'report-submission-proposal',
            rationale: `Human-proposed filing of Report "${input.reportId}" for period "${input.periodCovered}"`,
            agentId: input.proposedBy,
            autonomyLevel: 0,
            confidence: 1,
            proposedBy: input.proposedBy,
            reportId: input.reportId,
            authorityId: input.authorityId,
            periodCovered: input.periodCovered,
            submittedAt: input.submittedAt ?? new Date().toISOString(),
        },
    });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return { decision: row?.decision };
};

// Direct write, no Decision gate — acknowledgment is an external fact received
// from the regulator, not an internal reasoning output to ratify. Same shape as
// execution/repo.ts's updateTaskStatus (PATCH /execution/tasks/:id): a factual
// state update on an already-real node, not a proposal.
const ACKNOWLEDGE_REPORT_SUBMISSION = `
    MATCH (rs:ReportSubmission {id: $id})
    SET rs.acknowledgedAt = datetime()
    RETURN properties(rs) AS reportSubmission
`;

export const acknowledgeReportSubmission = async (id: string) => {
    const raw: any = await db().exec(ACKNOWLEDGE_REPORT_SUBMISSION, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    if (!row?.reportSubmission) throw new Error(`ReportSubmission not found: ${id}`);
    return row.reportSubmission;
};
