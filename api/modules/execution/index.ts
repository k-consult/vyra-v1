import { FastifyInstance } from 'fastify';
import { listPrograms, listTasks, listCapas, listVerifications } from './repo';

const execution: any = async (fastify: FastifyInstance) => {
    fastify.get('/programs', async (_req, reply) => {
        reply.send({ programs: await listPrograms() });
    });

    fastify.get('/tasks', async (req: any, reply) => {
        const { workflowId } = req.query;
        reply.send({ tasks: await listTasks(workflowId) });
    });

    fastify.get('/capas', async (_req, reply) => {
        reply.send({ capas: await listCapas() });
    });

    fastify.get('/verifications', async (_req, reply) => {
        reply.send({ verifications: await listVerifications() });
    });
};

execution.prefix = '/execution';
export default execution;
