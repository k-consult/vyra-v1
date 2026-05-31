import { FastifyInstance } from 'fastify';
import { listFindings, listRisks, listDecisions, listRcas, getReverseTrace } from './repo';

const intelligence: any = async (fastify: FastifyInstance) => {
    fastify.get('/findings', async (_req, reply) => {
        reply.send({ findings: await listFindings() });
    });

    fastify.get('/risks', async (_req, reply) => {
        reply.send({ risks: await listRisks() });
    });

    fastify.get('/decisions', async (_req, reply) => {
        reply.send({ decisions: await listDecisions() });
    });

    fastify.get('/rcas', async (_req, reply) => {
        reply.send({ rcas: await listRcas() });
    });

    fastify.get('/incidents/:id/reverse-trace', async (req: any, reply) => {
        const data = await getReverseTrace(req.params.id);
        if (!data) return reply.code(404).send({ error: 'Incident not found' });
        reply.send(data);
    });
};

intelligence.prefix = '/intelligence';
export default intelligence;
