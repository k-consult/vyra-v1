import { FastifyInstance } from 'fastify';
import { Module } from '../../types';
import { listOrganizations, listRoles, listVendors, listContracts, traceOrgChart } from './repo';

const enterprise: any = async (fastify: FastifyInstance) => {
    fastify.get('/organizations', async (_req, reply) => {
        reply.send({ organizations: await listOrganizations() });
    });

    fastify.get('/roles', async (_req, reply) => {
        reply.send({ roles: await listRoles() });
    });

    fastify.get('/vendors', async (_req, reply) => {
        reply.send({ vendors: await listVendors() });
    });

    fastify.get('/contracts', async (_req, reply) => {
        reply.send({ contracts: await listContracts() });
    });

    fastify.get('/org-chart/:id', async (req: any, reply) => {
        const { id } = req.params;
        const rows = await traceOrgChart(id);
        reply.send({ organizationId: id, chart: rows });
    });
};

enterprise.prefix = '/enterprise';
export default enterprise;
