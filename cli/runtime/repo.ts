import fs from 'fs';
import { DB } from '../../lib/graph-db';
import { config } from '../../lib/config';
import log from '../../lib/log';

const db = () => DB.get(config.db.twin.database, {
    uri:      config.db.twin.uri,
    user:     config.db.twin.user,
    password: config.db.twin.password,
});

// Execute a Cypher file with multiple semicolon-delimited statements
export const execCypherFile = async (cypherFile: string): Promise<void> => {
    const raw = fs.readFileSync(cypherFile, 'utf-8');
    const statements = raw
        .split(/;\s*\n/)
        .map(s => s.split('\n').filter(l => !l.trim().startsWith('//')).join('\n').trim())
        .filter(s => s.length > 0);

    for (const stmt of statements) {
        await db().exec(stmt);
    }
};

// Load nodes via UNWIND — no file I/O, parameterized
export const loadNodes = async (label: string, rows: Record<string, any>[]): Promise<number> => {
    if (!rows.length) return 0;

    const cypher = `
        UNWIND $args.rows AS row
        MERGE (n:\`${label}\` {id: row.id})
        ON CREATE SET n += row, n.createdAt = datetime()
        ON MATCH  SET n += row, n.updatedAt = datetime()
        RETURN count(n) AS total
    `;
    try {
        const result = await db().exec(cypher, { args: { rows } }) as any[];
        const raw = Array.isArray(result) ? result : [result];
        return Number(raw[0]?.total ?? rows.length);
    } catch (err: any) {
        log.error(`[runtime] loadNodes(${label}) failed: ${err.message}`);
        throw err;
    }
};

// Load edges via UNWIND — no file I/O, parameterized
export const loadEdges = async (
    relType: string,
    sourceLabel: string,
    targetLabel: string,
    pairs: { sourceId: string; targetId: string }[]
): Promise<number> => {
    if (!pairs.length) return 0;

    const cypher = `
        UNWIND $args.pairs AS pair
        MATCH (src:\`${sourceLabel}\` {id: pair.sourceId})
        MATCH (tgt:\`${targetLabel}\` {id: pair.targetId})
        MERGE (src)-[:\`${relType}\`]->(tgt)
        RETURN count(*) AS total
    `;
    try {
        const result = await db().exec(cypher, { args: { pairs } }) as any[];
        const raw = Array.isArray(result) ? result : [result];
        return Number(raw[0]?.total ?? pairs.length);
    } catch (err: any) {
        log.error(`[runtime] loadEdges(${relType}) failed: ${err.message}`);
        throw err;
    }
};
