import { FastifyInstance } from 'fastify';
import { Module } from '../../types';
import { listOrganizations, listRoles, traceOrgChart } from './repo';

const enterprise: any = async (fastify: FastifyInstance) => {
    fastify.get('/organizations', async (_req, reply) => {
        reply.send({ organizations: await listOrganizations() });
    });

    fastify.get('/roles', async (_req, reply) => {
        reply.send({ roles: await listRoles() });
    });

    fastify.get('/org-chart/:id', async (req: any, reply) => {
        const { id } = req.params;
        const rows = await traceOrgChart(id);
        reply.send({ organizationId: id, chart: rows });
    });
};

enterprise.prefix = '/enterprise';
export default enterprise;
