import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';
import log from '../../../lib/log';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

const LIST_CAPAS = `
    MATCH (n:CAPA)
    RETURN properties(n) AS capa
    ORDER BY n.dueDate
`;

const LIST_VERIFICATIONS = `
    MATCH (n:Verification)
    RETURN properties(n) AS verification
    ORDER BY n.id
`;

export const listCapas = async () => {
    try {
        const raw: any = await db().fetch2(LIST_CAPAS, {});
        const rows = Array.isArray(raw) ? raw : [raw]; return rows.map((r: any) => r.capa).filter(Boolean);
    } catch (err: any) {
        log.error('execution.repo: listCapas failed', err.message);
        return [];
    }
};

export const listVerifications = async () => {
    try {
        const raw: any = await db().fetch2(LIST_VERIFICATIONS, {});
        const rows = Array.isArray(raw) ? raw : [raw]; return rows.map((r: any) => r.verification).filter(Boolean);
    } catch (err: any) {
        log.error('execution.repo: listVerifications failed', err.message);
        return [];
    }
};

export const listPrograms = async () => {
    try {
        const cypher = `MATCH (p:Program) RETURN properties(p) AS program ORDER BY p.name`;
        return await db().fetch2(cypher, {});
    } catch (err: any) {
        log.error('execution.repo: listPrograms failed', err.message);
        return [];
    }
};

export const listTasks = async (workflowId?: string) => {
    try {
        const cypher = workflowId
            ? `MATCH (t:Task)-[:PART_OF]->(w:Workflow {id: $id}) RETURN properties(t) AS task`
            : `MATCH (t:Task) RETURN properties(t) AS task LIMIT 200`;
        return await db().fetch2(cypher, { id: workflowId });
    } catch (err: any) {
        log.error('execution.repo: listTasks failed', err.message);
        return [];
    }
};
