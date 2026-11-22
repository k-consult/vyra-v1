import { FastifyInstance } from 'fastify';
import { addLevel, addProperty, exportBlueprint, getBlueprint, getStructureTree, removeLevel, removeProperty, reorderLevels, restoreBlueprint, updateLevel, updateProperty } from './repo';
import * as spec from './spec';

const blueprint: any = async (fastify: FastifyInstance) => {
    fastify.get('/', async (_req, reply) => {
        reply.send({ blueprint: await getBlueprint() });
    });

    fastify.get('/structure-tree', async (_req, reply) => {
        reply.send({ tree: await getStructureTree() });
    });

    fastify.get('/export', async (_req, reply) => {
        reply.send(await exportBlueprint());
    });

    // Full destructive restore — see repo.ts's restoreBlueprint for exactly
    // what gets wiped (org structure, Permit/Contract/Warranty/Signal/Vendor,
    // tenant-instance Task/Schedule) and what's protected (Catalog data,
    // catalog-labeled Task/Schedule templates).
    fastify.post('/restore', async (req: any, reply) => {
        try {
            spec.isValidBlueprintRestore(req.body ?? {});
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        reply.send({ blueprint: await restoreBlueprint(req.body.levels) });
    });

    // Direct CRUD, no Decision gate — TenantBlueprint is editable config describing
    // the enterprise's structure shape, not a ratified assertion about enterprise
    // reality the way the (unrelated) onboarding Blueprint node is.
    fastify.post('/levels', async (req: any, reply) => {
        try {
            spec.isValidLevelInput(req.body ?? {});
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        reply.code(201).send({ blueprint: await addLevel(req.body) });
    });

    fastify.delete('/levels/:id', async (req: any, reply) => {
        const current: any = await getBlueprint();
        const existing = current.levels.find((l: any) => l.id === req.params.id);
        try {
            if (existing) spec.isValidLevelRemoval(existing.name);
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        reply.send({ blueprint: await removeLevel(req.params.id) });
    });

    fastify.patch('/levels/reorder', async (req: any, reply) => {
        try {
            spec.isValidReorderRequest(req.body ?? {});
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        reply.send({ blueprint: await reorderLevels(req.body.orderedIds) });
    });

    fastify.patch('/levels/:id', async (req: any, reply) => {
        try {
            spec.isValidLevelUpdateInput(req.body ?? {});
            if (req.body?.name !== undefined) {
                const current: any = await getBlueprint();
                const existing = current.levels.find((l: any) => l.id === req.params.id);
                if (existing) spec.isValidLevelNameChange(existing.name, req.body.name);
            }
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        reply.send({ blueprint: await updateLevel(req.params.id, req.body ?? {}) });
    });

    fastify.post('/levels/:id/properties', async (req: any, reply) => {
        try {
            spec.isValidPropertyInput(req.body ?? {});
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        reply.code(201).send({ blueprint: await addProperty(req.params.id, req.body) });
    });

    // Fully editable, including ingestKey — no reserved-property guard.
    // structure-sync.ts resolves Facility/Asset's code/name by a `role` stamp
    // on the Property node (see lib/blueprint/reserved.ts), not by matching a
    // literal ingestKey, so renaming is always safe.
    fastify.patch('/properties/:id', async (req: any, reply) => {
        try {
            spec.isValidPropertyUpdateInput(req.body ?? {});
        } catch (err: any) {
            return reply.code(400).send({ error: err.message });
        }
        reply.send({ blueprint: await updateProperty(req.params.id, req.body ?? {}) });
    });

    fastify.delete('/properties/:id', async (req: any, reply) => {
        reply.send({ blueprint: await removeProperty(req.params.id) });
    });
};

blueprint.prefix = '/blueprint';
export default blueprint;
