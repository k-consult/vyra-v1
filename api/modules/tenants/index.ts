import { FastifyInstance } from 'fastify';
import { listTenants, provisionTenant } from './repo';
import * as spec from './spec';

const tenants: any = async (fastify: FastifyInstance) => {
    fastify.get('/', async (_req, reply) => {
        reply.send({ tenants: await listTenants() });
    });

    // Synchronous: creates the database, scaffolds its feeds folder, and replays
    // every catalog authority board into it before responding. No job queue exists
    // anywhere in this codebase today — this stays a single request/response rather
    // than introducing one for a first, simple provisioning step.
    fastify.post('/', async (req: any, reply) => {
        try {
            spec.isValidTenantProvisionRequest(req.body ?? {});
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        const tenant = await provisionTenant(req.body);
        reply.code(201).send({ tenant });
    });
};

tenants.prefix = '/tenants';
export default tenants;
