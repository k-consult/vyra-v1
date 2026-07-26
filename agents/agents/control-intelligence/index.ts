import { defaultContext, runAgentLoop, reasonWithClaude, Reasoning } from '../../runtime';
import { fetchRequirements } from '../../tools/graph-read';
import { writeDecision, DecisionPayload } from '../../tools/graph-write';
import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';

// Control Intelligence Agent
// Reads uncontrolled Requirements from the graph and proposes Controls via Claude.
// Autonomy Level 1: proposes only — writes Decision nodes, does not create Controls.

interface Requirement {
    id: string;
    name: string;
    obligationType?: string;
    mandatory?: string;
}

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

export const run = async (regulationId?: string): Promise<void> => {
    const ctx = defaultContext();
    ctx.agentId = 'control-intelligence-agent';

    await runAgentLoop<Requirement>(ctx.agentId, {
        observe: () => fetchRequirements(regulationId) as Promise<Requirement[]>,

        reason: (req): Promise<Reasoning> => reasonWithClaude(
            `A compliance requirement has no Control implementing it yet:\n` +
            `Requirement: "${req.name}" (mandatory: ${req.mandatory ?? 'UNKNOWN'}, type: ${req.obligationType ?? 'UNKNOWN'})\n` +
            `Recommend, in one or two sentences, what kind of Control (policy, SOP, or operational check) should implement this requirement.`
        ),

        act: async (req, reasoning) => {
            const decision: DecisionPayload = {
                id: `DEC-${req.id}`,
                type: 'control-recommendation',
                rationale: reasoning.rationale,
                agentId: ctx.agentId,
                autonomyLevel: ctx.autonomyLevel,
                confidence: reasoning.confidence,
                sourceId: req.id,
            };
            await writeDecision(decision);
        },

        verify: async (req) => {
            const raw: any = await db().fetch2(
                `MATCH (d:Decision {id: $id}) RETURN properties(d) AS decision`,
                { id: `DEC-${req.id}` }
            );
            const row = Array.isArray(raw) ? raw[0] : raw;
            return row?.decision?.status === 'pending';
        },
    });
};
