import Anthropic from '@anthropic-ai/sdk';
import log from '../../lib/log';

export const MODEL = 'claude-sonnet-4-6';

export const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface AgentContext {
    agentId: string;
    autonomyLevel: number;
    model: string;
}

export const defaultContext = (): AgentContext => ({
    agentId: `agent-${Date.now()}`,
    autonomyLevel: 1,
    model: MODEL,
});

export interface Reasoning {
    rationale: string;
    confidence: number;
}

export interface AgentLoopSteps<T> {
    observe: () => Promise<T[]>;
    reason: (item: T) => Promise<Reasoning>;
    act: (item: T, reasoning: Reasoning) => Promise<void>;
    verify: (item: T) => Promise<boolean>;
}

// Shared observe -> reason -> act -> verify primitive, per vyra-landscape.md's agent
// lifecycle. Any agent family plugs in its own observe/reason/act/verify; this loop
// just sequences them and logs each stage. Level 1 autonomy (recommend only) is
// enforced by what `act` writes (a Decision, not a graph mutation), not by this loop.
export const runAgentLoop = async <T>(agentId: string, steps: AgentLoopSteps<T>): Promise<void> => {
    const items = await steps.observe();
    log.info(`[${agentId}] observed ${items.length} item(s)`);

    for (const item of items) {
        const reasoning = await steps.reason(item);
        await steps.act(item, reasoning);
        const verified = await steps.verify(item);
        log.info(`[${agentId}] processed item — verified: ${verified}`);
    }
};

// Minimal reasoning call — one plain prompt instructing strict JSON output, not
// tool-use/function-calling. This is the first agent proving the loop end-to-end;
// multi-turn tool-calling is a natural follow-up once the primitive is proven.
export const reasonWithClaude = async (prompt: string): Promise<Reasoning> => {
    const response = await client.messages.create({
        model: MODEL,
        max_tokens: 512,
        messages: [{
            role: 'user',
            content: `${prompt}\n\nRespond with ONLY a JSON object of the form {"rationale": string, "confidence": number between 0 and 1}. No other text.`,
        }],
    });
    const block = response.content.find(b => b.type === 'text');
    const text = block && block.type === 'text' ? block.text : '';
    try {
        const parsed = JSON.parse(text);
        return {
            rationale: String(parsed.rationale ?? 'UNKNOWN'),
            confidence: Number(parsed.confidence ?? 0),
        };
    } catch {
        log.error('runtime: reasonWithClaude failed to parse Claude response as JSON', text);
        return { rationale: 'UNKNOWN', confidence: 0 };
    }
};
