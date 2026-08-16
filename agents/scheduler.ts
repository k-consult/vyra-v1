import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import log from '../lib/log';
import { DB } from '../lib/graph-db';
import { agents } from './registry';

const POLL_INTERVAL_MS = Number(process.env.AGENT_POLL_INTERVAL_MS) || 60000;

// Sequential, not Promise.all — one local Ollama model backs every agent, so
// concurrent reasoning calls would just contend for the same resource. One
// agent's failure is logged and skipped rather than killing the cycle, since
// runAgentLoop itself does not catch errors (a thrown Ollama/network error
// would otherwise take the whole scheduler down).
const runCycle = async (): Promise<void> => {
    log.info('scheduler: cycle start');
    for (const [name, run] of Object.entries(agents)) {
        try {
            log.info(`scheduler: running ${name}`);
            await run();
            log.info(`scheduler: ${name} done`);
        } catch (err: any) {
            log.error(`scheduler: ${name} failed`, err.message);
        }
    }
    log.info('scheduler: cycle complete');
};

// Recursive setTimeout, not setInterval — reasonWithLLM's fetch has no timeout,
// so a slow/hung Ollama call must not let cycles overlap.
const loop = async (): Promise<void> => {
    await runCycle();
    setTimeout(loop, POLL_INTERVAL_MS);
};

const shutdown = async (signal: string): Promise<void> => {
    log.info(`scheduler: ${signal} received, shutting down...`);
    await DB.closeAll();
    process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

log.info(`scheduler: starting, poll interval ${POLL_INTERVAL_MS}ms`);
loop().catch(err => {
    log.error('scheduler: fatal error', err.message);
    process.exit(1);
});
