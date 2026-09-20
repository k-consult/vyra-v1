import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';

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
    const raw: any = await db().fetch(LIST_CAPAS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.capa).filter(Boolean);
};

export const listVerifications = async () => {
    const raw: any = await db().fetch(LIST_VERIFICATIONS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.verification).filter(Boolean);
};

export const listPrograms = async () => {
    const cypher = `MATCH (p:Program) RETURN properties(p) AS program ORDER BY p.name`;
    return db().fetch(cypher, {});
};

export const listTasks = async (workflowId?: string) => {
    const cypher = workflowId
        ? `MATCH (t:Task)-[:PART_OF]->(w:Workflow {id: $id}) RETURN properties(t) AS task`
        : `MATCH (t:Task) RETURN properties(t) AS task LIMIT 200`;
    return db().fetch(cypher, { id: workflowId });
};
