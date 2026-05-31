import Anthropic from '@anthropic-ai/sdk';

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

// TODO: implement agent loop infrastructure
// - observe: read graph state
// - reason: call Claude with tools
// - act: write decisions/findings back to graph (level 1 = propose only)
// - verify: confirm graph state after write
