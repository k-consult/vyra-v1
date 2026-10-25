import { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { ingestDocumentCatalog, listTenants, provisionTenant } from './repo';
import * as spec from './spec';

const tenants: any = async (fastify: FastifyInstance) => {
    await fastify.register(multipart);

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

    // Separate step from provisioning (upload against an already-active tenant) —
    // a customer's document catalog, not the standard catalog boards. Synchronous
    // for the same reason POST / is: no job queue exists in this codebase yet.
    fastify.post('/:name/document-catalog', async (req: any, reply) => {
        const file = await req.file();
        if (!file) return reply.code(400).send({ error: 'no file uploaded — expected multipart field with a CSV file' });

        const content = await file.toBuffer();
        const summary = await ingestDocumentCatalog({
            name: req.params.name,
            originalFilename: file.filename,
            content,
        });
        reply.code(201).send({ summary });
    });
};

tenants.prefix = '/tenants';
export default tenants;
