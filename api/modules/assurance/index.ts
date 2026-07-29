import { FastifyInstance } from 'fastify';
import { getCoverageScore, getRiskRollup, listAttestations, listEvidence } from './repo';

const assurance: any = async (fastify: FastifyInstance) => {
    fastify.get('/posture', async (_req, reply) => {
        const [coverage, riskRollup] = await Promise.all([getCoverageScore(), getRiskRollup()]);
        if (!coverage || !riskRollup) return reply.code(500).send({ error: 'Failed to load posture data' });
        reply.send({ coverage, riskRollup });
    });

    fastify.get('/attestations', async (_req, reply) => {
        reply.send({ attestations: await listAttestations() });
    });

    fastify.get('/evidence', async (_req, reply) => {
        reply.send({ evidence: await listEvidence() });
    });
};

assurance.prefix = '/assurance';
export default assurance;
