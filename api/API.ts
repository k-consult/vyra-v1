import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import log from '../lib/log';
import * as types from './types';
import * as tenantContext from '../lib/tenant-context';
import { getTenant } from './modules/tenants/repo';
const { config } = require('../lib/config');

class API {
    private fastify: FastifyInstance;

    constructor() {
        this.fastify = fastify({ logger: false });
    }

    // Callback-style (not async) hook — AsyncLocalStorage only scopes code invoked
    // synchronously from within run()'s callback. Calling `done()` there makes
    // Fastify continue the rest of the request (remaining hooks, the route handler,
    // and every repo.ts db() call it triggers) as that same synchronous
    // continuation, so the override is visible for the whole request and isolated
    // from any other concurrent request. No header → no override; every existing
    // caller (and the default-tenant UI) is unaffected.
    private registerTenantContextHook() {
        this.fastify.addHook('onRequest', (request, reply, done) => {
            const tenantName = request.headers['x-tenant'] as string | undefined;
            if (!tenantName) return done();

            getTenant(tenantName)
                .then((tenant) => {
                    if (!tenant) {
                        reply.code(404).send({ error: `no tenant named "${tenantName}"` });
                        return;
                    }
                    tenantContext.run(tenant.database, () => done());
                })
                .catch(done);
        });
    }

    async register(modules: types.Module[]) {
        await this.fastify.register(cors, { origin: true, methods: ['GET', 'POST', 'PATCH', 'OPTIONS'] });
        this.registerTenantContextHook();
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
        this.fastify.listen({ port: config.app.port, host: '0.0.0.0' }, (err: any, address: any) => {
            if (err) { log.error('Failed to start API', err); process.exit(1); }
            log.info(`API running on ${address}`);
        });
    }

    async abort() { process.exit(0); }
}

export default API;
