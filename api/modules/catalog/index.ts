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
    getLastSyncedAt,
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
};

catalog.prefix = '/catalog';
export default catalog;
