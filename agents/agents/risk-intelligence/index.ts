import * as R from 'ramda';
import { defaultContext, runAgentLoop, reasonWithLLM, Reasoning } from '../../runtime';
import { fetchUnscoredFindings } from '../../tools/graph-read';
import { writeDecision, DecisionPayload } from '../../tools/graph-write';
import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';

// Risk Intelligence Agent
// Reads Findings with no Risk scoring them yet and proposes likelihood/consequence via a
// local LLM. Autonomy Level 1: proposes only — writes Decision nodes, does not create Risks.

interface UnscoredFinding {
    id: string;
    name: string;
    severity?: string;
    control: { id: string; name?: string } | null;
}

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

export const run = async (): Promise<void> => {
    const ctx = defaultContext();
    ctx.agentId = 'risk-intelligence-agent';

    await runAgentLoop<UnscoredFinding>(ctx.agentId, {
        observe: () => fetchUnscoredFindings() as Promise<UnscoredFinding[]>,

        reason: (fnd): Promise<Reasoning> => reasonWithLLM(
            `A compliance finding has not been scored into a Risk yet:\n` +
            `Finding: "${fnd.name}" (severity: ${fnd.severity ?? 'UNKNOWN'})\n` +
            `Control: ${fnd.control ? `"${fnd.control.name ?? fnd.control.id}"` : 'UNKNOWN — no control linked'}\n` +
            `Propose, in one or two sentences, the risk this finding represents, and state your recommended likelihood and consequence explicitly.`,
            `"proposedLikelihood": integer 1-5, "proposedConsequence": integer 1-5, "proposedRating": one of "Low" | "Medium" | "High" | "Critical"`
        ),

        act: async (fnd, reasoning) => {
            const decision: DecisionPayload = {
                id: `DEC-${fnd.id}`,
                type: 'risk-assessment',
                rationale: reasoning.rationale,
                agentId: ctx.agentId,
                autonomyLevel: ctx.autonomyLevel,
                confidence: reasoning.confidence,
                sourceId: fnd.id,
                proposedLikelihood: R.defaultTo(0, reasoning.proposedLikelihood),
                proposedConsequence: R.defaultTo(0, reasoning.proposedConsequence),
                proposedRating: R.defaultTo('UNKNOWN', reasoning.proposedRating),
            };
            await writeDecision(decision);
        },

        verify: async (fnd) => {
            const raw: any = await db().fetch2(
                `MATCH (d:Decision {id: $id}) RETURN properties(d) AS decision`,
                { id: `DEC-${fnd.id}` }
            );
            const row = Array.isArray(raw) ? raw[0] : raw;
            return row?.decision?.status === 'pending';
        },
    });
};
