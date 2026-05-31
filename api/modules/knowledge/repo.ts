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
                 -[:CONTAINS]->(cls:Clause)
                 -[:DEFINES]->(req:Requirement)
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
                 <-[:DEFINES]-(cls:Clause)
                 <-[:CONTAINS]-(reg:Regulation)
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
