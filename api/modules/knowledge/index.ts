import { FastifyInstance } from 'fastify';
import { Module } from '../../types';
import { traceForward, traceReverse, listRegulations, listControls, listAgentProposedControls, getLastSyncedAt, getRegulationHistory } from './repo';

const knowledge: any = async (fastify: FastifyInstance) => {
    fastify.get('/sync-status', async (_req, reply) => {
        reply.send({ lastSyncedAt: await getLastSyncedAt() });
    });

    fastify.get('/regulations', async (_req, reply) => {
        reply.send({ regulations: await listRegulations() });
    });

    fastify.get('/controls/agent-proposed', async (_req, reply) => {
        reply.send({ controls: await listAgentProposedControls() });
    });

    fastify.get('/controls', async (_req, reply) => {
        reply.send({ controls: await listControls() });
    });

    fastify.get('/trace/:id', async (req: any, reply) => {
        const { id } = req.params;
        const rows = await traceForward(id);
        reply.send({ regulationId: id, chain: rows });
    });

    fastify.get('/reverse/:id', async (req: any, reply) => {
        const { id } = req.params;
        const rows = await traceReverse(id);
        reply.send({ findingId: id, lineage: rows });
    });

    fastify.get('/regulations/:id/history', async (req: any, reply) => {
        const { id } = req.params;
        reply.send({ regulationId: id, history: await getRegulationHistory(id) });
    });
};

knowledge.prefix = '/knowledge';
export default knowledge;
