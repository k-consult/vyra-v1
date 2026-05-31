import { FastifyInstance } from 'fastify';
import { listAssets, listSignals, listIncidents, listFacilities, listVendors, getLifecycle } from './repo';

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

    fastify.get('/assets', async (_req, reply) => {
        reply.send({ assets: await listAssets() });
    });

    fastify.get('/signals', async (req: any, reply) => {
        const { assetId } = req.query;
        reply.send({ signals: await listSignals(assetId) });
    });

    fastify.get('/incidents/:id/lifecycle', async (req: any, reply) => {
        const data = await getLifecycle(req.params.id);
        if (!data) return reply.code(404).send({ error: 'Incident not found' });
        reply.send(data);
    });
};

operational.prefix = '/operational';
export default operational;
