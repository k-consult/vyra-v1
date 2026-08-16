import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import log from '../lib/log';
import { DB } from '../lib/graph-db';
import { run as runControlIntelligence } from './agents/control-intelligence';
import { run as runSignalIntelligence } from './agents/signal-intelligence';
import { run as runRiskIntelligence } from './agents/risk-intelligence';
import { run as runAssuranceIntelligence } from './agents/assurance';

const agents: Record<string, (arg?: string) => Promise<void>> = {
    'control-intelligence': runControlIntelligence,
    'signal-intelligence': runSignalIntelligence,
    'risk-intelligence': runRiskIntelligence,
    'assurance-intelligence': runAssuranceIntelligence,
};

async function main() {
    const [agentName, arg] = process.argv.slice(2);
    const name = agentName ?? 'control-intelligence';
    const run = agents[name];

    if (!run) {
        log.error(`agents: unknown agent "${name}". Available: ${Object.keys(agents).join(', ')}`);
        process.exit(1);
    }

    await run(arg);
    await DB.closeAll();
}

main().catch(err => {
    log.error('agents: run failed', err.message);
    process.exit(1);
});
