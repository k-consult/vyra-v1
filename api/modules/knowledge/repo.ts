import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';
import log from '../../../lib/log';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

const TRACE_FORWARD = `
    MATCH path = (reg:Regulation {id: $id})
                 <-[:BELONGS_TO]-(cls:Clause)
                 <-[:DEFINED_BY]-(req:Requirement)
                 <-[:IMPLEMENTS]-(ctl:Control)
    RETURN
        properties(reg) AS regulation,
        properties(cls) AS clause,
        properties(req) AS requirement,
        properties(ctl) AS control
    LIMIT 200
`;

const TRACE_REVERSE = `
    MATCH path = (fnd:Finding {id: $id})
                 -[:AGAINST]->(ctl:Control)
                 -[:IMPLEMENTS]->(req:Requirement)
                 -[:DEFINED_BY]->(cls:Clause)
                 -[:BELONGS_TO]->(reg:Regulation)
    RETURN
        properties(fnd) AS finding,
        properties(ctl) AS control,
        properties(req) AS requirement,
        properties(cls) AS clause,
        properties(reg) AS regulation
`;

const LIST_REGULATIONS = `
    MATCH (n:Regulation)
    RETURN properties(n) AS regulation
    ORDER BY n.name
`;

const LIST_CONTROLS = `
    MATCH (n:Control)
    RETURN properties(n) AS control
    ORDER BY n.name
`;

// Surfaces what a Phase 7 control-recommendation approval actually created — the
// Landscape page's "Controls" drill-down includes these too (no label filter there),
// but sorted alphabetically by name they land wherever "Proposed Control - ..." falls,
// easy to miss. This is the "what did approving that Decision just do" view instead.
const LIST_AGENT_PROPOSED_CONTROLS = `
    MATCH (n:Control:AgentProposed)
    RETURN properties(n) AS control
    ORDER BY n.createdAt DESC
`;

export const listRegulations = async () => {
    try {
        const raw: any = await db().fetch2(LIST_REGULATIONS, {});
        const rows = Array.isArray(raw) ? raw : [raw]; return rows.map((r: any) => r.regulation).filter(Boolean);
    } catch (err: any) {
        log.error('knowledge.repo: listRegulations failed', err.message);
        return [];
    }
};

export const listControls = async () => {
    try {
        const raw: any = await db().fetch2(LIST_CONTROLS, {});
        const rows = Array.isArray(raw) ? raw : [raw]; return rows.map((r: any) => r.control).filter(Boolean);
    } catch (err: any) {
        log.error('knowledge.repo: listControls failed', err.message);
        return [];
    }
};

export const listAgentProposedControls = async () => {
    try {
        const raw: any = await db().fetch2(LIST_AGENT_PROPOSED_CONTROLS, {});
        const rows = Array.isArray(raw) ? raw : [raw]; return rows.map((r: any) => r.control).filter(Boolean);
    } catch (err: any) {
        log.error('knowledge.repo: listAgentProposedControls failed', err.message);
        return [];
    }
};

export const traceForward = async (regulationId: string) => {
    try {
        return await db().fetch2(TRACE_FORWARD, { id: regulationId });
    } catch (err: any) {
        log.error('knowledge.repo: traceForward failed', err.message);
        return [];
    }
};

export const traceReverse = async (findingId: string) => {
    try {
        return await db().fetch2(TRACE_REVERSE, { id: findingId });
    } catch (err: any) {
        log.error('knowledge.repo: traceReverse failed', err.message);
        return [];
    }
};
