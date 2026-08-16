import { FastifyInstance } from 'fastify';
import {
    getCoverageScore, getRiskRollup, listAttestations, listEvidence,
    listEvidencePackages, listAssuranceStatements, listAudits,
} from './repo';

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

    fastify.get('/evidence-packages', async (_req, reply) => {
        reply.send({ evidencePackages: await listEvidencePackages() });
    });

    fastify.get('/assurance-statements', async (_req, reply) => {
        reply.send({ assuranceStatements: await listAssuranceStatements() });
    });

    fastify.get('/audits', async (_req, reply) => {
        reply.send({ audits: await listAudits() });
    });
};

assurance.prefix = '/assurance';
export default assurance;
