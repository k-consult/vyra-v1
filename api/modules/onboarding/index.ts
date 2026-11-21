import { FastifyInstance } from 'fastify';
import {
    listCutoverCriteria, proposeCutoverCriterion, listBlueprints, proposeBlueprint,
    listHazards, proposeHazard, listHazardAssessments, proposeHazardAssessment,
    listEmergencyPlans, proposeEmergencyPlan, listObligationMappings, reclassifyAsset,
    suggestClassification,
} from './repo';
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

    fastify.get('/hazards', async (_req, reply) => {
        reply.send({ hazards: await listHazards() });
    });

    // Never writes a Hazard — creates a pending Decision only. Approving it via
    // POST /intelligence/decisions/:id/approve is what actually creates the
    // Hazard — see intelligence/repo.ts's hazard-proposal branch.
    fastify.post('/hazards', async (req: any, reply) => {
        try {
            await spec.isValidHazardProposal(req.body ?? {});
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        const result = await proposeHazard(req.body);
        reply.code(201).send(result);
    });

    fastify.get('/hazard-assessments', async (_req, reply) => {
        reply.send({ hazardAssessments: await listHazardAssessments() });
    });

    // Never writes a HazardAssessment — creates a pending Decision only. Approving
    // it via POST /intelligence/decisions/:id/approve is what actually creates the
    // HazardAssessment — see intelligence/repo.ts's hazard-assessment-proposal branch.
    fastify.post('/hazard-assessments', async (req: any, reply) => {
        try {
            await spec.isValidHazardAssessmentProposal(req.body ?? {});
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        const result = await proposeHazardAssessment(req.body);
        reply.code(201).send(result);
    });

    fastify.get('/emergency-plans', async (_req, reply) => {
        reply.send({ emergencyPlans: await listEmergencyPlans() });
    });

    // Never writes an EmergencyPlan — creates a pending Decision only. Approving it
    // via POST /intelligence/decisions/:id/approve is what actually creates the
    // EmergencyPlan — see intelligence/repo.ts's emergency-plan-proposal branch.
    fastify.post('/emergency-plans', async (req: any, reply) => {
        try {
            await spec.isValidEmergencyPlanProposal(req.body ?? {});
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        const result = await proposeEmergencyPlan(req.body);
        reply.code(201).send(result);
    });

    fastify.get('/obligation-mapping', async (_req, reply) => {
        reply.send({ mappings: await listObligationMappings() });
    });

    // Corrects an already-resolved classification — unlike approve/reject above,
    // this targets the Asset directly (not a specific pending Decision id), since
    // the point is to act regardless of the current Decision's status. See
    // repo.ts's reclassifyAsset for the supersede discipline.
    fastify.post('/obligation-mapping/:assetId/reclassify', async (req: any, reply) => {
        try {
            spec.isValidReclassifyInput(req.body ?? {});
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        const result = await reclassifyAsset({ assetId: req.params.assetId, ...req.body });
        reply.send(result);
    });

    // Writes nothing — a synchronous model preview the reviewer can accept
    // (Save), tweak, or discard (Cancel) before anything hits the graph.
    fastify.post('/obligation-mapping/:assetId/suggest', async (req: any, reply) => {
        const result = await suggestClassification(req.params.assetId);
        reply.send(result);
    });
};

onboarding.prefix = '/onboarding';
export default onboarding;
