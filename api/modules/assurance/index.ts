import { FastifyInstance } from 'fastify';
import { getPosture, listAttestations, listEvidence } from './repo';

const assurance: any = async (fastify: FastifyInstance) => {
    fastify.get('/posture', async (_req, reply) => {
        const posture = await getPosture();
        reply.send({ posture });
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
