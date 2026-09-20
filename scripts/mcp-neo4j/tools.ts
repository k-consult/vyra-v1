import { DB } from '../../lib/graph-db';
import { config } from '../../lib/config';
import log from '../../lib/log';
import * as guard from './guard';

// Lazy handle, same pattern as every api/agents/cli caller of lib/graph-db.
// Database is pinned to config.db.twin.database — no caller input can retarget it.
const db = () => DB.get(config.db.twin.database, config.db.twin);

const MAX_ROWS = 500;

const asRows = (raw: unknown): any[] => (Array.isArray(raw) ? raw : [raw]);

const truncate = (rows: any[]) => ({
    rows: rows.slice(0, MAX_ROWS),
    totalRows: rows.length,
    truncated: rows.length > MAX_ROWS,
});

export const getSchema = async () => {
    try {
        const [labels, relTypes, propKeys] = await Promise.all([
            db().fetch2('CALL db.labels() YIELD label RETURN label ORDER BY label', {}),
            db().fetch2(
                'CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType ORDER BY relationshipType',
                {}
            ),
            db().fetch2('CALL db.propertyKeys() YIELD propertyKey RETURN propertyKey ORDER BY propertyKey', {}),
        ]);
        return {
            labels: asRows(labels).map((r) => r.label),
            relationshipTypes: asRows(relTypes).map((r) => r.relationshipType),
            propertyKeys: asRows(propKeys).map((r) => r.propertyKey),
        };
    } catch (err: any) {
        log.error('mcp-neo4j: getSchema failed', err.message);
        throw err;
    }
};

export const readCypher = async (cypher: string, params: Record<string, unknown> = {}) => {
    guard.assertReadOnly(cypher);
    guard.assertNoAdminCommands(cypher);
    try {
        const raw = await db().fetch2(cypher, params);
        return truncate(asRows(raw));
    } catch (err: any) {
        log.error('mcp-neo4j: readCypher failed', err.message);
        throw err;
    }
};

export const writeCypher = async (cypher: string, params: Record<string, unknown> = {}) => {
    guard.assertWriteAllowed();
    guard.assertNoAdminCommands(cypher);
    try {
        const raw = await db().exec2(cypher, params);
        return truncate(asRows(raw));
    } catch (err: any) {
        log.error('mcp-neo4j: writeCypher failed', err.message);
        throw err;
    }
};
