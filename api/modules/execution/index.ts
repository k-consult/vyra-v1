import { FastifyInstance } from 'fastify';
import { listPrograms, listTasks, listCapas, listVerifications, updateTaskStatus, computeWindow, fetchTaskCalendar, Cadence } from './repo';
import * as spec from './spec';

const execution: any = async (fastify: FastifyInstance) => {
    fastify.get('/programs', async (_req, reply) => {
        reply.send({ programs: await listPrograms() });
    });

    fastify.get('/calendar', async (req: any, reply) => {
        const { horizonWeeks } = req.query;
        reply.send({ calendar: await fetchTaskCalendar(Number(horizonWeeks) || 52) });
    });

    fastify.get('/window', async (req: any, reply) => {
        const { unit, interval, anchor, horizonWeeks } = req.query;
        const cadence: Cadence = { cadenceUnit: unit, cadenceInterval: Number(interval), anchorDate: anchor };
        reply.send({ occurrences: computeWindow(cadence, Number(horizonWeeks) || 52) });
    });

    fastify.get('/tasks', async (req: any, reply) => {
        const { workflowId } = req.query;
        reply.send({ tasks: await listTasks(workflowId) });
    });

    fastify.patch('/tasks/:id', async (req: any, reply) => {
        try {
            spec.isValid(req.body?.status);
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        try {
            const task = await updateTaskStatus(req.params.id, req.body.status);
            reply.send({ task });
        } catch (err: any) {
            reply.code(404).send({ error: err.message });
        }
    });

    fastify.get('/capas', async (_req, reply) => {
        reply.send({ capas: await listCapas() });
    });

    fastify.get('/verifications', async (_req, reply) => {
        reply.send({ verifications: await listVerifications() });
    });
};

execution.prefix = '/execution';
export default execution;
