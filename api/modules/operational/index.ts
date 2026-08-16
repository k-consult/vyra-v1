import { FastifyInstance } from 'fastify';
import { listAssets, listSignals, listIncidents, listFacilities, listVendors, listPeople, getLifecycle, createSignal } from './repo';

const operational: any = async (fastify: FastifyInstance) => {
    fastify.get('/incidents', async (_req, reply) => {
        reply.send({ incidents: await listIncidents() });
    });

    fastify.get('/facilities', async (_req, reply) => {
        reply.send({ facilities: await listFacilities() });
    });

    fastify.get('/vendors', async (_req, reply) => {
        reply.send({ vendors: await listVendors() });
    });

    fastify.get('/people', async (_req, reply) => {
        reply.send({ people: await listPeople() });
    });

    fastify.get('/assets', async (_req, reply) => {
        reply.send({ assets: await listAssets() });
    });

    fastify.get('/signals', async (req: any, reply) => {
        const { assetId } = req.query;
        reply.send({ signals: await listSignals(assetId) });
    });

    fastify.post('/signals', async (req: any, reply) => {
        try {
            const result = await createSignal(req.body ?? {});
            reply.code(201).send(result);
        } catch (err: any) {
            reply.code(400).send({ error: err.message });
        }
    });

    fastify.get('/incidents/:id/lifecycle', async (req: any, reply) => {
        const data = await getLifecycle(req.params.id);
        if (!data) return reply.code(404).send({ error: 'Incident not found' });
        reply.send(data);
    });
};

operational.prefix = '/operational';
export default operational;
