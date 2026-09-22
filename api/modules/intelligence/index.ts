import { FastifyInstance } from 'fastify';
import { listFindings, listRisks, listDecisions, listRcas, getReverseTrace, getDecision, resolveDecision, getAgreementRates } from './repo';
import * as spec from './spec';

const resolve = (action: 'approve' | 'reject') => async (req: any, reply: any) => {
    try {
        spec.isValid(req.body ?? {});
    } catch (err: any) {
        return reply.code(400).send({ error: err.message });
    }
    const decision = await getDecision(req.params.id);
    if (!decision) return reply.code(404).send({ error: 'Decision not found' });
    const isAllowed = action === 'approve' ? spec.isApprovable(decision) : spec.isRejectable(decision);
    if (!isAllowed) return reply.code(400).send({ error: `Decision already ${decision.status}` });
    const result = await resolveDecision(req.params.id, decision.type, action, req.body?.reviewedBy, req.body?.reviewNote);
    reply.send(result);
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

    fastify.get('/decisions/agreement-rates', async (_req, reply) => {
        reply.send({ agreementRates: await getAgreementRates() });
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
