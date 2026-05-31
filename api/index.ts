import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import API from './API';
import log from '../lib/log';

import knowledge from './modules/knowledge';
import execution from './modules/execution';
import operational from './modules/operational';
import intelligence from './modules/intelligence';
import assurance from './modules/assurance';
import dashboard from './modules/dashboard';

const modules = [knowledge, execution, operational, intelligence, assurance, dashboard];

async function start() {
    try {
        const api = new API();
        await api.register(modules);
        await api.start();

        process.on('SIGINT', () => { log.info('SIGINT received, aborting...'); api.abort(); process.exit(0); });
        process.on('SIGTERM', () => { log.info('SIGTERM received, aborting...'); api.abort(); process.exit(0); });
    } catch (error) {
        const err = error as Error;
        log.error(`failed to start API: ${error}`, err.message);
        process.exit(1);
    }
}

start();
