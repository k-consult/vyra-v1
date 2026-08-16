import { FastifyInstance } from 'fastify';
import { listFindings, listRisks, listDecisions, listRcas, getReverseTrace, getDecision, resolveDecision } from './repo';

const resolve = (action: 'approve' | 'reject') => async (req: any, reply: any) => {
    const decision = await getDecision(req.params.id);
    if (!decision) return reply.code(404).send({ error: 'Decision not found' });
    if (decision.status !== 'pending') return reply.code(400).send({ error: `Decision already ${decision.status}` });
    try {
        const result = await resolveDecision(req.params.id, decision.type, action, req.body?.reviewedBy, req.body?.reviewNote);
        reply.send(result);
    } catch (err: any) {
        reply.code(400).send({ error: err.message });
    }
};

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

    fastify.post('/decisions/:id/approve', resolve('approve'));

    fastify.post('/decisions/:id/reject', resolve('reject'));

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
