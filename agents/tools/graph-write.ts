import { DB } from '../../lib/graph-db';
import { config } from '../../lib/config';

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
    // TODO: execute write
};

export const writeFinding = async (finding: { id: string; title: string; severity: string; controlId: string }): Promise<void> => {
    const cypher = `
        MERGE (f:Finding {id: $id})
        ON CREATE SET f += $props, f.detectedAt = datetime(), f.status = 'open'
        WITH f
        MATCH (ctl:Control {id: $controlId})
        MERGE (f)-[:AGAINST]->(ctl)
    `;
    // TODO: execute write
};
