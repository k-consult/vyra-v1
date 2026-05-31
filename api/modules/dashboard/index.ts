import { FastifyInstance } from 'fastify';
import { getLandscape } from './repo';

const dashboard: any = async (fastify: FastifyInstance) => {
    fastify.get('/landscape', async (_req, reply) => {
        const data = await getLandscape();
        if (!data) return reply.code(500).send({ error: 'Failed to load landscape data' });
        reply.send(data);
    });
};

dashboard.prefix = '/dashboard';
export default dashboard;
