import { FastifyInstance } from 'fastify';
import { Module } from '../../types';
import { traceForward, traceReverse, listRegulations, listControls } from './repo';

const knowledge: any = async (fastify: FastifyInstance) => {
    fastify.get('/regulations', async (_req, reply) => {
        reply.send({ regulations: await listRegulations() });
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
};

knowledge.prefix = '/knowledge';
export default knowledge;
