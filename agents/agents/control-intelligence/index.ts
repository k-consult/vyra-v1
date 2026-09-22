import * as R from 'ramda';
import { defaultContext, runAgentLoop, reasonWithTools, Reasoning } from '../../runtime';
import { fetchObligations, fetchAgreementRate, TOOL_REGISTRY } from '../../tools/graph-read';
import { writeDecision, DecisionPayload } from '../../tools/graph-write';
import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';

// Control Intelligence Agent
// Reads uncontrolled Obligations from the graph and proposes Controls via a local LLM.
// Autonomy Level 1: proposes only — writes Decision nodes, does not create Controls.

interface Obligation {
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

    // Fetched once per cycle, not per item — a family's agreement rate doesn't move
    // within a single run, and re-querying it per observed item would be wasted work.
    const { approved, rejected, agreementRate } = await fetchAgreementRate(ctx.agentId);
    const agreementContext = agreementRate === null
        ? 'You have no prior approved/rejected history yet.'
        : `Your historical agreement rate is ${Math.round(agreementRate * 100)}% (${approved} approved, ${rejected} rejected) — weight your confidence accordingly.`;

    await runAgentLoop<Obligation>(ctx.agentId, {
        observe: () => fetchObligations(regulationId) as Promise<Obligation[]>,

        // First (and so far only) family wired to reasonWithTools as a proof of
        // concept — the other three families keep using reasonWithLLM unchanged. Gives
        // the model an explicit escape hatch to check for partial existing coverage
        // before recommending a Control type, rather than reasoning blind off the
        // Obligation's name alone.
        reason: (req): Promise<Reasoning> => reasonWithTools(
            `A compliance obligation (id: "${req.id}") has no Control implementing it yet:\n` +
            `Obligation: "${req.name}" (mandatory: ${req.mandatory ?? 'UNKNOWN'}, type: ${req.obligationType ?? 'UNKNOWN'})\n` +
            `Recommend, in one or two sentences, what kind of Control (policy, SOP, or operational check) should implement this obligation, and state your recommended type explicitly.\n` +
            agreementContext,
            [{
                name: 'fetchControlsForObligation',
                description: 'Look up any Control nodes already linked to this Obligation, given { obligationId: string }. Use this to check for partial existing coverage before recommending a type.',
            }],
            TOOL_REGISTRY,
            `"recommendedControlType": one of "policy" | "sop" | "operational-check"`
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
                recommendedControlType: R.defaultTo('UNKNOWN', reasoning.recommendedControlType),
            };
            await writeDecision(decision);
        },

        verify: async (req) => {
            const raw: any = await db().fetch(
                `MATCH (d:Decision {id: $id}) RETURN properties(d) AS decision`,
                { id: `DEC-${req.id}` }
            );
            const row = Array.isArray(raw) ? raw[0] : raw;
            return row?.decision?.status === 'pending';
        },
    });
};
