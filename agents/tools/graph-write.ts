import { DB } from '../../lib/graph-db';
import { config } from '../../lib/config';
import log from '../../lib/log';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

export interface DecisionPayload {
    id: string;
    type: string;
    rationale: string;
    agentId: string;
    autonomyLevel: number;
    confidence: number;
    sourceId: string;
    targetId?: string;
}

// (d)-[:ABOUT]->(src): written directly by agents, not the CLI pipeline — not in
// v2.ts's rels (that field only drives CSV-embedded-FK compilation). Documented
// under vyra-graph-spine.md's derived/live-write relationships.
export const writeDecision = async (decision: DecisionPayload): Promise<void> => {
    const cypher = `
        MERGE (d:Decision {id: $id})
        ON CREATE SET
            d += $props,
            d.decidedAt = datetime(),
            d.status = 'pending'
        WITH d
        MATCH (src {id: $sourceId})
        MERGE (d)-[:ABOUT]->(src)
    `;
    const { id, sourceId, ...props } = decision;
    try {
        await db().exec2(cypher, { id, sourceId, props });
    } catch (err: any) {
        log.error('graph-write: writeDecision failed', err.message);
        throw err;
    }
};

export const writeFinding = async (finding: { id: string; title: string; severity: string; controlId: string }): Promise<void> => {
    const cypher = `
        MERGE (f:Finding {id: $id})
        ON CREATE SET f += $props, f.detectedAt = datetime(), f.status = 'open'
        WITH f
        MATCH (ctl:Control {id: $controlId})
        MERGE (f)-[:AGAINST]->(ctl)
    `;
    const { id, controlId, ...props } = finding;
    try {
        await db().exec2(cypher, { id, controlId, props });
    } catch (err: any) {
        log.error('graph-write: writeFinding failed', err.message);
        throw err;
    }
};
