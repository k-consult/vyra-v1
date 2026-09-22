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
    recommendedControlType?: string;
    proposedLikelihood?: number;
    proposedConsequence?: number;
    proposedRating?: string;
    proposedPosture?: string;
}

// (d)-[:ABOUT]->(src): written directly by agents, not the CLI pipeline — not in
// v2.ts's rels (that field only drives CSV-embedded-FK compilation). Documented
// under graph.md's derived/live-write relationships.
export const writeDecision = async (decision: DecisionPayload): Promise<void> => {
    const cypher = `
        MERGE (d:Decision {id: $id})
        ON CREATE SET
            d += $props,
            d.decidedAt = datetime(),
            d.status = 'pending',
            d.origin = 'agent'
        WITH d
        MATCH (src {id: $sourceId})
        MERGE (d)-[:ABOUT]->(src)
    `;
    const { id, sourceId, ...props } = decision;
    try {
        await db().exec(cypher, { id, sourceId, props });
    } catch (err: any) {
        log.error('graph-write: writeDecision failed', err.message);
        throw err;
    }
};

// Reactivates the 2 catalog Tasks whose 13_Schedule_Rules trigger has no live API
// write path of its own (Risk Triggered, AI Triggered) — the other 8 non-Fixed
// tasks (Sensor/Event/Condition-triggered) are reactivated by the live Signal
// ingress instead (see api/modules/operational/repo.ts's CREATE_SIGNAL_AND_TASK).
// Pure graph read/write, no Ollama call — safe to run every scheduler cycle
// without contending for the one shared reasoning model.
//
// Keyed on the Task's own Control via the real Task-[:IMPLEMENTS]->Control<-
// [:AGAINST]-Finding<-[:RAISED_BY]-Risk chain — not on any Risk anywhere in the
// graph — so "elevated entry in the Risk Register" (13_Schedule_Rules' actual
// trigger text) means a risk against the specific control this task implements.
const REACTIVATE_RISK_TRIGGERED = `
    MATCH (t:Task {frequency: 'Risk Triggered', status: 'closed'})-[:IMPLEMENTS]->(ctl:Control)
    MATCH (ctl)<-[:AGAINST]-(:Finding)<-[:RAISED_BY]-(r:Risk)
    WHERE r.residualRating IN ['Critical', 'High']
    WITH DISTINCT t
    SET t.status = 'open', t.lastTriggeredAt = datetime()
    RETURN count(t) AS reactivated
`;

// A new :AgentProposed node created since a task's last trigger is a reasonable,
// non-fabricated proxy for "AI/ML anomaly detection on the compliance knowledge
// graph" (13_Schedule_Rules' actual trigger text) — string-matching Signal types
// to that free text would be a fabricated correspondence between two vocabularies
// that were never designed together.
const REACTIVATE_AI_TRIGGERED = `
    MATCH (t:Task {frequency: 'AI Triggered', status: 'closed'})
    MATCH (proposed) WHERE proposed:AgentProposed
      AND (t.lastTriggeredAt IS NULL OR proposed.createdAt > t.lastTriggeredAt)
    WITH DISTINCT t
    SET t.status = 'open', t.lastTriggeredAt = datetime()
    RETURN count(t) AS reactivated
`;

export const reactivateRiskAndAiTriggeredTasks = async (): Promise<{ riskTriggered: number; aiTriggered: number }> => {
    const riskRaw: any = await db().exec(REACTIVATE_RISK_TRIGGERED, {});
    const aiRaw: any = await db().exec(REACTIVATE_AI_TRIGGERED, {});
    const riskRow = Array.isArray(riskRaw) ? riskRaw[0] : riskRaw;
    const aiRow = Array.isArray(aiRaw) ? aiRaw[0] : aiRaw;
    return { riskTriggered: Number(riskRow?.reactivated ?? 0), aiTriggered: Number(aiRow?.reactivated ?? 0) };
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
        await db().exec(cypher, { id, controlId, props });
    } catch (err: any) {
        log.error('graph-write: writeFinding failed', err.message);
        throw err;
    }
};
