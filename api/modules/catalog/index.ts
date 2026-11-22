import { FastifyInstance } from 'fastify';
import {
    listRegulations,
    getRegulationHistory,
    traceForward,
    listClauses,
    listObligations,
    listObligationsWithoutControl,
    proposeObligation,
    listControls,
    listAgentProposedControls,
    listAuthorities,
    listJurisdictions,
    listComplianceAreas,
    listSubjectTypes,
    addSubjectType,
    updateSubjectType,
    retireSubjectType,
    getSubjectTypeUsage,
    getLastSyncedAt,
    listReportSubmissions,
    proposeReportSubmission,
    acknowledgeReportSubmission,
} from './repo';
import * as spec from './spec';

const catalog: any = async (fastify: FastifyInstance) => {
    fastify.get('/sync-status', async (_req, reply) => {
        reply.send({ lastSyncedAt: await getLastSyncedAt() });
    });

    fastify.get('/regulations', async (req: any, reply) => {
        const currentOnly = req.query?.current === 'true';
        reply.send({ regulations: await listRegulations(currentOnly) });
    });

    fastify.get('/regulations/:id/history', async (req: any, reply) => {
        const { id } = req.params;
        reply.send({ regulationId: id, history: await getRegulationHistory(id) });
    });

    fastify.get('/regulations/:id/trace', async (req: any, reply) => {
        const { id } = req.params;
        reply.send({ regulationId: id, chain: await traceForward(id) });
    });

    fastify.get('/clauses', async (_req, reply) => {
        reply.send({ clauses: await listClauses() });
    });

    fastify.get('/obligations', async (_req, reply) => {
        reply.send({ obligations: await listObligations() });
    });

    // "Documented absence" (foundation.md §2) — an Obligation with no implementing
    // Control, surfaced as a queryable gap rather than silently missing.
    fastify.get('/obligations/uncontrolled', async (_req, reply) => {
        reply.send({ obligations: await listObligationsWithoutControl() });
    });

    // Manual Entry channel only — see repo.ts's proposeObligation for why this never
    // writes an Obligation directly.
    fastify.post('/obligations', async (req: any, reply) => {
        try {
            await spec.isValid(req.body ?? {});
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        const result = await proposeObligation(req.body);
        reply.code(201).send(result);
    });

    fastify.get('/controls', async (_req, reply) => {
        reply.send({ controls: await listControls() });
    });

    fastify.get('/controls/agent-proposed', async (_req, reply) => {
        reply.send({ controls: await listAgentProposedControls() });
    });

    fastify.get('/authorities', async (_req, reply) => {
        reply.send({ authorities: await listAuthorities() });
    });

    fastify.get('/jurisdictions', async (_req, reply) => {
        reply.send({ jurisdictions: await listJurisdictions() });
    });

    fastify.get('/compliance-areas', async (_req, reply) => {
        reply.send({ complianceAreas: await listComplianceAreas() });
    });

    fastify.get('/subject-types', async (req: any, reply) => {
        const includeRetired = req.query?.includeRetired === 'true';
        reply.send({ subjectTypes: await listSubjectTypes(includeRetired) });
    });

    // Direct admin write, no Decision gate (subtype-registry-plan.md's scoped-down
    // 2026-11-22 decision) — central-catalog-scoped only, not reachable from any
    // tenant route.
    fastify.post('/subject-types', async (req: any, reply) => {
        try {
            await spec.isValidNewSubjectType(req.body ?? {});
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        const subjectType = await addSubjectType(req.body);
        reply.code(201).send({ subjectType });
    });

    fastify.get('/subject-types/:id/usage', async (req: any, reply) => {
        const { id } = req.params;
        reply.send({ subjectTypeId: id, usage: await getSubjectTypeUsage(id) });
    });

    fastify.patch('/subject-types/:id', async (req: any, reply) => {
        try {
            await spec.isValidSubjectTypeUpdate(req.params.id, req.body ?? {});
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        try {
            const subjectType = await updateSubjectType(req.params.id, req.body);
            reply.send({ subjectType });
        } catch (err: any) {
            reply.code(404).send({ error: err.message });
        }
    });

    fastify.post('/subject-types/:id/retire', async (req: any, reply) => {
        try {
            const subjectType = await retireSubjectType(req.params.id);
            reply.send({ subjectType });
        } catch (err: any) {
            reply.code(404).send({ error: err.message });
        }
    });

    fastify.get('/report-submissions', async (_req, reply) => {
        reply.send({ reportSubmissions: await listReportSubmissions() });
    });

    // Never writes a ReportSubmission — creates a pending Decision only. Approving
    // it via POST /intelligence/decisions/:id/approve is what actually creates the
    // ReportSubmission — see intelligence/repo.ts's report-submission-proposal branch.
    fastify.post('/report-submissions', async (req: any, reply) => {
        try {
            await spec.isValidReportSubmissionProposal(req.body ?? {});
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        const result = await proposeReportSubmission(req.body);
        reply.code(201).send(result);
    });

    // Direct write, no Decision gate — recording the regulator's acknowledgment of
    // an already-real ReportSubmission, same shape as PATCH /execution/tasks/:id.
    fastify.patch('/report-submissions/:id/acknowledge', async (req: any, reply) => {
        try {
            const reportSubmission = await acknowledgeReportSubmission(req.params.id);
            reply.send({ reportSubmission });
        } catch (err: any) {
            reply.code(404).send({ error: err.message });
        }
    });
};

catalog.prefix = '/catalog';
export default catalog;
