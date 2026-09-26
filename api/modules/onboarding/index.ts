import { FastifyInstance } from 'fastify';
import { listCutoverCriteria, proposeCutoverCriterion, listBlueprints, proposeBlueprint } from './repo';
import * as spec from './spec';

const onboarding: any = async (fastify: FastifyInstance) => {
    fastify.get('/cutover-criteria', async (_req, reply) => {
        reply.send({ cutoverCriteria: await listCutoverCriteria() });
    });

    // Never writes a CutoverCriterion — creates a pending Decision only. Approving
    // it via POST /intelligence/decisions/:id/approve is what actually creates the
    // CutoverCriterion — see intelligence/repo.ts's cutover-criterion-proposal branch.
    fastify.post('/cutover-criteria', async (req: any, reply) => {
        try {
            spec.isValid(req.body ?? {});
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        const result = await proposeCutoverCriterion(req.body);
        reply.code(201).send(result);
    });

    fastify.get('/blueprints', async (_req, reply) => {
        reply.send({ blueprints: await listBlueprints() });
    });

    // Never writes a Blueprint — creates a pending Decision only. Approving it via
    // POST /intelligence/decisions/:id/approve is what actually creates the
    // Blueprint — see intelligence/repo.ts's blueprint-proposal branch.
    fastify.post('/blueprints', async (req: any, reply) => {
        try {
            await spec.isValidBlueprintProposal(req.body ?? {});
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        const result = await proposeBlueprint(req.body);
        reply.code(201).send(result);
    });
};

onboarding.prefix = '/onboarding';
export default onboarding;
