import { client, defaultContext, MODEL } from '../../runtime';
import { fetchRequirements } from '../../tools/graph-read';
import { writeDecision } from '../../tools/graph-write';

// Control Intelligence Agent
// Reads uncontrolled Requirements from the graph and proposes Controls via Claude.
// Autonomy Level 1: proposes only — writes Decision nodes, does not create Controls.

export const run = async (regulationId?: string): Promise<void> => {
    const ctx = defaultContext();
    ctx.agentId = 'control-intelligence-agent';

    const requirements = await fetchRequirements(regulationId);
    if (!requirements.length) {
        console.log('[control-intelligence] No requirements found.');
        return;
    }

    // TODO: for each uncontrolled requirement, call Claude to suggest a control,
    // then write a Decision node with autonomyLevel=1 (recommend only).
    console.log(`[control-intelligence] Found ${requirements.length} requirements. Logic TBD.`);
};
