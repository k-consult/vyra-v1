import { defaultContext, runAgentLoop, reasonWithLLM, Reasoning } from '../../runtime';
import { fetchUnassessedSignals } from '../../tools/graph-read';
import { writeDecision, DecisionPayload } from '../../tools/graph-write';
import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';

// Signal Intelligence Agent
// Watches live operational Signals for compliance deviations and flags them via the LLM.
// Autonomy Level 1: proposes only — writes Decision nodes, never a Finding or graph mutation.

interface AssessedSignal {
    id: string;
    name?: string;
    type?: string;
    source?: string;
    payload?: string;
    timestamp?: string;
    assetId?: string;
    asset: { id: string; name?: string; category?: string; complianceAreaId?: string } | null;
    taskIds: string[];
}

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

export const run = async (): Promise<void> => {
    const ctx = defaultContext();
    ctx.agentId = 'signal-intelligence-agent';

    await runAgentLoop<AssessedSignal>(ctx.agentId, {
        observe: () => fetchUnassessedSignals() as Promise<AssessedSignal[]>,

        reason: (sig): Promise<Reasoning> => reasonWithLLM(
            `A live operational signal was emitted:\n` +
            `Signal: type="${sig.type ?? 'UNKNOWN'}", source="${sig.source ?? 'UNKNOWN'}", payload="${sig.payload ?? ''}"\n` +
            `Asset: ${sig.asset ? `"${sig.asset.name ?? sig.asset.id}" (category: ${sig.asset.category ?? 'UNKNOWN'})` : 'UNKNOWN — no asset linked'}\n` +
            `Follow-up: ${sig.taskIds.length > 0 ? `${sig.taskIds.length} task(s) already auto-scheduled` : 'no task was auto-scheduled — this asset may have no matching Control coverage'}\n` +
            `Assess, in one or two sentences, whether this represents a compliance deviation requiring escalation, and recommend the next step.`
        ),

        act: async (sig, reasoning) => {
            const decision: DecisionPayload = {
                id: `DEC-${sig.id}`,
                type: 'deviation-assessment',
                rationale: reasoning.rationale,
                agentId: ctx.agentId,
                autonomyLevel: ctx.autonomyLevel,
                confidence: reasoning.confidence,
                sourceId: sig.id,
            };
            await writeDecision(decision);
        },

        verify: async (sig) => {
            const raw: any = await db().fetch2(
                `MATCH (d:Decision {id: $id}) RETURN properties(d) AS decision`,
                { id: `DEC-${sig.id}` }
            );
            const row = Array.isArray(raw) ? raw[0] : raw;
            return row?.decision?.status === 'pending';
        },
    });
};
