import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

const TRACE_FORWARD = `
    MATCH path = (reg:Regulation {id: $id})
                 <-[:BELONGS_TO]-(cls:Clause)
                 <-[:DEFINED_BY]-(req:Obligation)
                 <-[:IMPLEMENTS]-(ctl:Control)
    RETURN
        properties(reg) AS regulation,
        properties(cls) AS clause,
        properties(req) AS obligation,
        properties(ctl) AS control
    LIMIT 200
`;

const TRACE_REVERSE = `
    MATCH path = (fnd:Finding {id: $id})
                 -[:AGAINST]->(ctl:Control)
                 -[:IMPLEMENTS]->(req:Obligation)
                 -[:DEFINED_BY]->(cls:Clause)
                 -[:BELONGS_TO]->(reg:Regulation)
    RETURN
        properties(fnd) AS finding,
        properties(ctl) AS control,
        properties(req) AS obligation,
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

const LAST_SYNCED_AT = `
    MATCH (n)
    WHERE n.syncedAt IS NOT NULL
    RETURN max(n.syncedAt) AS lastSyncedAt
`;

export const getLastSyncedAt = async () => {
    const raw: any = await db().fetch(LAST_SYNCED_AT, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows[0]?.lastSyncedAt ?? null;
};

export const listRegulations = async () => {
    const raw: any = await db().fetch(LIST_REGULATIONS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.regulation).filter(Boolean);
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

const REGULATION_HISTORY = `
    MATCH (target:Regulation {id: $id})
    MATCH (r:Regulation)
    WHERE r.id = target.id OR r.id = target.supersededBy OR r.supersededBy = target.id
    RETURN properties(r) AS regulation
    ORDER BY r.catalogVersion
`;

export const getRegulationHistory = async (regulationId: string) => {
    const raw: any = await db().fetch(REGULATION_HISTORY, { id: regulationId });
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.regulation).filter(Boolean);
};

export const traceForward = async (regulationId: string) => db().fetch(TRACE_FORWARD, { id: regulationId });

export const traceReverse = async (findingId: string) => db().fetch(TRACE_REVERSE, { id: findingId });
