import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import log from '../lib/log';
import * as types from './types';
const { config } = require('../lib/config');

class API {
    private fastify: FastifyInstance;

    constructor() {
        this.fastify = fastify({ logger: false });
    }

    async register(modules: types.Module[]) {
        await this.fastify.register(cors, { origin: true, methods: ['GET', 'POST', 'OPTIONS'] });
        log.info(`registering ${modules.length} modules...`);
        for (const module of modules) {
            try {
                await this.fastify.register(module, { prefix: module.prefix });
                log.debug(`registered route ${module.prefix}`);
            } catch (err) {
                log.error(`error registering module ${module.prefix}`, err);
            }
        }
    }

    async start() {
        this.fastify.listen({ port: config.app.port }, (err: any, address: any) => {
            if (err) { log.error('Failed to start API', err); process.exit(1); }
            log.info(`API running on ${address}`);
        });
    }

    async abort() { process.exit(0); }
}

export default API;
