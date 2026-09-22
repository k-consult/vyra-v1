import { FastifyInstance } from 'fastify';
import { Module } from '../../types';
import { listOrganizations, listRoles, listVendors, listContracts, traceOrgChart, proposeContractChange } from './repo';
import * as spec from './spec';

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

    // Never writes a Contract — creates a pending Decision only. Approving it via
    // POST /intelligence/decisions/:id/approve is what actually creates the Contract
    // (or its successor version, for an amendment) — see intelligence/repo.ts.
    fastify.post('/contracts', async (req: any, reply) => {
        try {
            await spec.isValid(req.body ?? {});
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        const result = await proposeContractChange(req.body);
        reply.code(201).send(result);
    });

    fastify.get('/org-chart/:id', async (req: any, reply) => {
        const { id } = req.params;
        const rows = await traceOrgChart(id);
        reply.send({ organizationId: id, chart: rows });
    });
};

enterprise.prefix = '/enterprise';
export default enterprise;
