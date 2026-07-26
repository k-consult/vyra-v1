import { FastifyInstance } from 'fastify';
import { Module } from '../../types';
import { listRegulations, listAuthorities, listComplianceAreas, traceRequirements, computeWindow, fetchTaskCalendar, Cadence } from './repo';

const catalog: any = async (fastify: FastifyInstance) => {
    fastify.get('/regulations', async (_req, reply) => {
        reply.send({ regulations: await listRegulations() });
    });

    fastify.get('/authorities', async (_req, reply) => {
        reply.send({ authorities: await listAuthorities() });
    });

    fastify.get('/complianceAreas', async (_req, reply) => {
        reply.send({ complianceAreas: await listComplianceAreas() });
    });

    fastify.get('/trace/:id', async (req: any, reply) => {
        const { id } = req.params;
        const rows = await traceRequirements(id);
        reply.send({ regulationId: id, chain: rows });
    });

    fastify.get('/window', async (req: any, reply) => {
        const { unit, interval, anchor, horizonWeeks } = req.query;
        const cadence: Cadence = {
            cadenceUnit: unit,
            cadenceInterval: Number(interval),
            anchorDate: anchor,
        };
        reply.send({ occurrences: computeWindow(cadence, Number(horizonWeeks) || 52) });
    });

    fastify.get('/calendar', async (req: any, reply) => {
        const { horizonWeeks } = req.query;
        reply.send({ calendar: await fetchTaskCalendar(Number(horizonWeeks) || 52) });
    });
};

catalog.prefix = '/catalog';
export default catalog;
