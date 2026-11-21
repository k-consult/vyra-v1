import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';
import { labelFromName } from '../../../lib/blueprint/ingest-key';
import { PropertyRole } from '../../../lib/blueprint/reserved';

// Same lazy-factory shape as every other repo.ts — but this one also backs
// seedDefaultBlueprint, called from tenants/repo.ts's provisionTenant *before* any
// request (and therefore any tenant-context override) exists, so it takes an
// explicit database name for that one caller. Every ambient, request-scoped
// function below calls it with no argument, same as onboarding/operational.
const db = (databaseName?: string) => DB.get(databaseName ?? config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

const BLUEPRINT_ID = 'default';

const ENSURE_BLUEPRINT = `
    MERGE (tb:TenantBlueprint {id: $id})
    ON CREATE SET tb.createdAt = datetime()
    RETURN properties(tb) AS blueprint
`;

const GET_BLUEPRINT_LEVELS = `
    MATCH (tb:TenantBlueprint {id: $id})
    OPTIONAL MATCH (tb)-[:STARTS]->(first:Level)
    OPTIONAL MATCH (first)-[:NEXT*0..]->(level:Level)
    OPTIONAL MATCH (level)-[:HAS_PROPERTY]->(prop:Property)
    RETURN properties(level) AS level, collect(properties(prop)) AS properties
    ORDER BY level.order
`;

interface LevelRow {
    level: Record<string, any>;
    properties: Record<string, any>[];
}

// Fetches the tenant's singleton blueprint as an ordered Level[] tree, each
// carrying its Property[]. Ensures the singleton exists first — a tenant
// provisioned before this feature landed would otherwise 404 on first read.
// If it has no Levels at all (same "provisioned before this landed" case,
// structure-sync.ts's "no TenantBlueprint found" error), self-heals by
// seeding the standard default hierarchy rather than leaving it an empty
// tree a human has to notice and rebuild by hand.
export const getBlueprint = async (databaseName?: string) => {
    await db(databaseName).exec(ENSURE_BLUEPRINT, { id: BLUEPRINT_ID });
    let raw: any = await db(databaseName).fetch(GET_BLUEPRINT_LEVELS, { id: BLUEPRINT_ID });
    let rows: LevelRow[] = Array.isArray(raw) ? raw : [raw];
    if (!rows.some(r => r?.level)) {
        await seedDefaultBlueprint(databaseName);
        raw = await db(databaseName).fetch(GET_BLUEPRINT_LEVELS, { id: BLUEPRINT_ID });
        rows = Array.isArray(raw) ? raw : [raw];
    }
    const levels = rows
        .filter(r => r?.level)
        .map(r => ({ ...r.level, properties: (r.properties ?? []).filter(Boolean) }));
    return { id: BLUEPRINT_ID, levels };
};

const UPSERT_LEVEL = `
    MERGE (l:Level {id: $id})
    ON CREATE SET l.createdAt = datetime()
    SET l += $props
    RETURN properties(l) AS level
`;

// Clears every STARTS/NEXT edge and restamps each Level.order to match its new
// index — "recompute fresh" rather than patch-in-place, same discipline the rest
// of this codebase uses for derived structure.
const CLEAR_AND_REORDER = `
    MATCH (tb:TenantBlueprint {id: $id})
    OPTIONAL MATCH (tb)-[s:STARTS]->()
    DELETE s
    WITH tb
    OPTIONAL MATCH ()-[n:NEXT]->()
    DELETE n
    WITH tb
    UNWIND range(0, size($orderedIds) - 1) AS idx
    MATCH (l:Level {id: $orderedIds[idx]})
    SET l.order = idx
`;

// Cypher has no way to index into a list *inside* a MERGE pattern (`(levels[i])`
// is a parse error, not a runtime one) — each STARTS/NEXT edge is rebuilt as its
// own simple, parameterized statement instead. Low-frequency admin operation
// (reordering a handful of levels), not a hot path, so N small round trips is
// the right trade against a single clever-but-invalid query.
const SET_STARTS = `
    MATCH (tb:TenantBlueprint {id: $id})
    MATCH (l:Level {id: $firstId})
    MERGE (tb)-[:STARTS]->(l)
`;

const SET_NEXT = `
    MATCH (a:Level {id: $aId})
    MATCH (b:Level {id: $bId})
    MERGE (a)-[:NEXT]->(b)
`;

const rebuildChain = async (orderedIds: string[], databaseName?: string): Promise<void> => {
    await db(databaseName).exec(CLEAR_AND_REORDER, { id: BLUEPRINT_ID, orderedIds });
    if (!orderedIds.length) return;
    await db(databaseName).exec(SET_STARTS, { id: BLUEPRINT_ID, firstId: orderedIds[0] });
    for (let i = 0; i < orderedIds.length - 1; i++) {
        await db(databaseName).exec(SET_NEXT, { aId: orderedIds[i], bId: orderedIds[i + 1] });
    }
};

const currentLevelIds = async (databaseName?: string): Promise<string[]> => {
    const { levels } = await getBlueprint(databaseName);
    return levels.map((l: any) => l.id);
};

export interface AddLevelInput {
    name: string;
    alias?: string;
    description?: string;
    // Insert immediately after this Level id instead of appending at the end —
    // the tree editor's "add child" action on a given node.
    afterLevelId?: string;
}

// Appends a new Level at the end of the chain, or inserts it right after
// afterLevelId when given — reordering otherwise is a separate, explicit call
// (reorderLevels), not implied by add. The Level has no ingestKey of its own —
// its id (and therefore the Neo4j label the Ingester creates at this depth)
// is derived straight from `name` via labelFromName.
export const addLevel = async (input: AddLevelInput, databaseName?: string) => {
    const id = `LVL-${labelFromName(input.name)}`;
    await db(databaseName).exec(UPSERT_LEVEL, {
        id,
        props: { name: input.name, alias: input.alias ?? '', description: input.description ?? '' },
    });
    const ids = (await currentLevelIds(databaseName)).filter(existing => existing !== id);
    const insertAt = input.afterLevelId ? ids.indexOf(input.afterLevelId) : -1;
    const newIds = insertAt === -1 ? [...ids, id] : [...ids.slice(0, insertAt + 1), id, ...ids.slice(insertAt + 1)];
    await rebuildChain(newIds, databaseName);
    return getBlueprint(databaseName);
};

const UPDATE_LEVEL = `
    MATCH (l:Level {id: $id})
    SET l += $props
    RETURN properties(l) AS level
`;

const FIND_LEVEL_PROPERTY_IDS = `MATCH (:Level {id: $id})-[:HAS_PROPERTY]->(p:Property) RETURN p.id AS propId`;
const REATTACH_PROPERTY_TO_LEVEL = `
    MATCH (l:Level {id: $levelId})
    MATCH (p:Property {id: $propId})
    MERGE (l)-[:HAS_PROPERTY]->(p)
`;
// Removes only the Level node's own edges/identity — its Properties are
// re-attached to the renamed node *before* this runs (see renameLevel), so
// they survive untouched. Distinct from DELETE_LEVEL below, which is a real
// removal and deliberately takes the Properties down with it.
const DETACH_DELETE_LEVEL_NODE_ONLY = `MATCH (l:Level {id: $id}) DETACH DELETE l`;

// A Level's id (and therefore the label the Ingester creates at this depth)
// is derived from `name` via labelFromName, not a separate ingestKey — so a
// `name` edit that changes the resolved label means a new node: create it,
// move every existing Property's HAS_PROPERTY edge onto it, splice it into
// the chain at the old node's exact position, then drop the stale node.
// Renames that would move a currently-reserved label (Facility/Asset) off of
// it never reach here — blocked by spec.ts's isValidLevelNameChange first.
const renameLevel = async (id: string, newName: string, newId: string, databaseName?: string) => {
    const { levels } = await getBlueprint(databaseName);
    const position = levels.findIndex((l: any) => l.id === id);
    if (position === -1) return getBlueprint(databaseName);
    const level: any = levels[position];

    await db(databaseName).exec(UPSERT_LEVEL, {
        id: newId,
        props: { name: newName, alias: level.alias ?? '', description: level.description ?? '' },
    });

    const propsRaw: any = await db(databaseName).fetch(FIND_LEVEL_PROPERTY_IDS, { id });
    const propRows = Array.isArray(propsRaw) ? propsRaw : [propsRaw];
    for (const row of propRows.filter((r: any) => r?.propId)) {
        await db(databaseName).exec(REATTACH_PROPERTY_TO_LEVEL, { levelId: newId, propId: row.propId });
    }

    const orderedIds = levels.map((l: any) => (l.id === id ? newId : l.id));
    await rebuildChain(orderedIds, databaseName);
    await db(databaseName).exec(DETACH_DELETE_LEVEL_NODE_ONLY, { id });
    return getBlueprint(databaseName);
};

// alias/description update in place always; a `name` edit updates in place
// too *unless* it changes the resolved label (labelFromName), in which case
// it's a rename (new node id) via renameLevel above. Explicit allow-list, not
// a filter over the caller's object — req.body is `any` at runtime, so a TS
// `Pick<...>` on the parameter type does nothing to stop some other field
// riding along in the request body from reaching `SET l += $props`.
export const updateLevel = async (id: string, input: Partial<Pick<AddLevelInput, 'name' | 'alias' | 'description'>>, databaseName?: string) => {
    if (input.name !== undefined) {
        const newId = `LVL-${labelFromName(input.name)}`;
        if (newId !== id) {
            const renamed = await renameLevel(id, input.name, newId, databaseName);
            if (input.alias !== undefined || input.description !== undefined) {
                const props: Record<string, any> = {};
                if (input.alias !== undefined) props.alias = input.alias;
                if (input.description !== undefined) props.description = input.description;
                await db(databaseName).exec(UPDATE_LEVEL, { id: newId, props });
                return getBlueprint(databaseName);
            }
            return renamed;
        }
    }

    const props: Record<string, any> = {};
    if (input.name !== undefined) props.name = input.name;
    if (input.alias !== undefined) props.alias = input.alias;
    if (input.description !== undefined) props.description = input.description;
    if (Object.keys(props).length) await db(databaseName).exec(UPDATE_LEVEL, { id, props });
    return getBlueprint(databaseName);
};

const DELETE_LEVEL = `
    MATCH (l:Level {id: $id})
    OPTIONAL MATCH (l)-[:HAS_PROPERTY]->(p:Property)
    DETACH DELETE l, p
`;

export const removeLevel = async (id: string, databaseName?: string) => {
    const ids = (await currentLevelIds(databaseName)).filter(existing => existing !== id);
    await db(databaseName).exec(DELETE_LEVEL, { id });
    await rebuildChain(ids, databaseName);
    return getBlueprint(databaseName);
};

export const reorderLevels = async (orderedIds: string[], databaseName?: string) => {
    await rebuildChain(orderedIds, databaseName);
    return getBlueprint(databaseName);
};

const UPSERT_PROPERTY = `
    MERGE (p:Property {id: $id})
    ON CREATE SET p.createdAt = datetime()
    SET p += $props
    WITH p
    MATCH (l:Level {id: $levelId})
    MERGE (l)-[:HAS_PROPERTY]->(p)
    RETURN properties(p) AS property
`;

export type PropertyDataType = 'STRING' | 'NUMBER' | 'DECIMAL';

export interface AddPropertyInput {
    name: string;
    ingestKey: string;
    description?: string;
    dataType?: PropertyDataType;
    defaultValue?: string;
    required?: boolean;
}

export const addProperty = async (levelId: string, input: AddPropertyInput, databaseName?: string) => {
    const id = `PROP-${input.ingestKey}`;
    await db(databaseName).exec(UPSERT_PROPERTY, {
        id,
        levelId,
        props: {
            name: input.name,
            ingestKey: input.ingestKey,
            description: input.description ?? '',
            dataType: input.dataType ?? 'STRING',
            defaultValue: input.defaultValue ?? '',
            required: input.required ?? false,
        },
    });
    return getBlueprint(databaseName);
};

const UPDATE_PROPERTY = `
    MATCH (p:Property {id: $id})
    SET p += $props
    RETURN properties(p) AS property
`;

const FIND_PROPERTY_OWNER = `MATCH (l:Level)-[:HAS_PROPERTY]->(p:Property {id: $id}) RETURN l.id AS levelId`;

const DELETE_PROPERTY = `MATCH (p:Property {id: $id}) DETACH DELETE p`;

// Same reasoning as renameLevel above — a Property's id is derived from its
// ingestKey, so renaming it means creating a new node (carrying over its
// current values, including `role` if it has one), re-attaching it to the
// same owning Level, then dropping the stale one. Properties are fully
// editable — including on Organisation/Facility/Asset — there's no reserved
// guard here; structure-sync.ts resolves Facility/Asset's code/name by the
// carried-over `role`, not by matching a literal ingestKey.
const renameProperty = async (id: string, newIngestKey: string, databaseName?: string) => {
    const newId = `PROP-${newIngestKey}`;
    if (newId === id) return getBlueprint(databaseName);

    const ownerRaw: any = await db(databaseName).fetch(FIND_PROPERTY_OWNER, { id });
    const ownerRow = Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw;
    if (!ownerRow?.levelId) return getBlueprint(databaseName);

    const { levels } = await getBlueprint(databaseName);
    const level: any = levels.find((l: any) => l.id === ownerRow.levelId);
    const property: any = level?.properties.find((p: any) => p.id === id);
    if (!property) return getBlueprint(databaseName);

    await db(databaseName).exec(UPSERT_PROPERTY, {
        id: newId,
        levelId: ownerRow.levelId,
        props: {
            name: property.name,
            ingestKey: newIngestKey,
            description: property.description ?? '',
            dataType: property.dataType ?? 'STRING',
            defaultValue: property.defaultValue ?? '',
            required: property.required ?? false,
            role: property.role ?? '',
        },
    });
    await db(databaseName).exec(DELETE_PROPERTY, { id });
    return getBlueprint(databaseName);
};

// name/description/dataType/defaultValue/required update in place; an
// `ingestKey` change is a rename (new node id) handled by renameProperty
// above. Explicit allow-list — same reasoning as updateLevel: req.body is
// `any` at runtime, so this must not just spread/filter the caller's object.
export const updateProperty = async (id: string, input: Partial<AddPropertyInput>, databaseName?: string) => {
    const props: Record<string, any> = {};
    if (input.name !== undefined) props.name = input.name;
    if (input.description !== undefined) props.description = input.description;
    if (input.dataType !== undefined) props.dataType = input.dataType;
    if (input.defaultValue !== undefined) props.defaultValue = input.defaultValue;
    if (input.required !== undefined) props.required = input.required;
    if (Object.keys(props).length) await db(databaseName).exec(UPDATE_PROPERTY, { id, props });
    if (input.ingestKey !== undefined) return renameProperty(id, input.ingestKey, databaseName);
    return getBlueprint(databaseName);
};

export const removeProperty = async (id: string, databaseName?: string) => {
    await db(databaseName).exec(DELETE_PROPERTY, { id });
    return getBlueprint(databaseName);
};

interface StructureNodeRow {
    nodeLabels: string[];
    node: Record<string, any>;
    parentId: string | null;
    subjectTypeName: string | null;
}

// Label names here are derived (labelFromName) from Level.name already
// persisted in this tenant's own graph, not from the current request — the
// same "resolved metadata, not raw caller input" shape cli/runtime/repo.ts's
// loadNodes already interpolates labels from.
// Cypher has no way to parameterise a label name.
const buildStructureQuery = (labels: string[]): string => {
    const predicate = labels.map(label => `n:\`${label}\``).join(' OR ');
    return `
        MATCH (n)
        WHERE ${predicate}
        OPTIONAL MATCH (n)-[:BELONGS_TO]->(parent)
        OPTIONAL MATCH (n)-[:OF_TYPE]->(st:SubjectType)
        RETURN labels(n) AS nodeLabels, properties(n) AS node, parent.id AS parentId, st.name AS subjectTypeName
    `;
};

interface TreeNode {
    label: string;
    node: Record<string, any>;
    children: TreeNode[];
}

// Flat fetch + in-JS tree assembly — no APOC in this codebase, and this mirrors
// the existing "resolve joins in Cypher, nest in JS" style operational/repo.ts's
// person/facility queries already use.
export const getStructureTree = async (databaseName?: string): Promise<TreeNode[]> => {
    const { levels } = await getBlueprint(databaseName);
    if (!levels.length) return [];

    const labels = levels.map((l: any) => labelFromName(l.name));
    const raw: any = await db(databaseName).fetch(buildStructureQuery(labels), {});
    const rows: StructureNodeRow[] = Array.isArray(raw) ? raw : [raw];

    const byId = new Map<string, TreeNode>();
    for (const row of rows.filter(r => r?.node)) {
        const label = (row.nodeLabels ?? []).find(l => labels.includes(l)) ?? row.nodeLabels?.[0] ?? 'Unknown';
        const node = row.subjectTypeName ? { ...row.node, subjectType: row.subjectTypeName } : row.node;
        byId.set(row.node.id, { label, node, children: [] });
    }
    const roots: TreeNode[] = [];
    for (const row of rows.filter(r => r?.node)) {
        const entry = byId.get(row.node.id)!;
        const parent = row.parentId ? byId.get(row.parentId) : undefined;
        if (parent) parent.children.push(entry);
        else roots.push(entry);
    }
    return roots;
};

// The standard 7-level hierarchy every tenant is seeded with at provisioning —
// Facility/Asset are reserved aliases onto the two already-live node types (see
// graph.md's Tenant Blueprint Graph section), every other module keeps working
// against them untouched.
const DEFAULT_HIERARCHY: Array<{ name: string; alias?: string; properties: Array<{ ingestKey: string; name: string; role?: PropertyRole }> }> = [
    { name: 'Organisation', properties: [{ ingestKey: 'ORGANISATION_NAME', name: 'Organisation Name' }] },
    { name: 'Business Unit', properties: [{ ingestKey: 'BUSINESS_UNIT_NAME', name: 'Business Unit Name' }] },
    {
        name: 'Facility', alias: 'Site',
        properties: [
            { ingestKey: 'SITE_CODE', name: 'Site Code', role: 'code' },
            { ingestKey: 'SITE_NAME', name: 'Site Name', role: 'name' },
        ],
    },
    { name: 'Building', properties: [{ ingestKey: 'BUILDING_NAME', name: 'Building Name' }] },
    { name: 'Floor', properties: [{ ingestKey: 'FLOOR_NAME', name: 'Floor Name' }] },
    { name: 'Area', properties: [{ ingestKey: 'AREA_NAME', name: 'Area Name' }] },
    {
        name: 'Asset',
        properties: [
            { ingestKey: 'ASSET_CODE', name: 'Asset Code', role: 'code' },
            { ingestKey: 'ASSET_NAME', name: 'Asset Name', role: 'name' },
            { ingestKey: 'ASSET_CATEGORY', name: 'Asset Category', role: 'category' },
            { ingestKey: 'ASSET_TYPE', name: 'Asset Type', role: 'assetType' },
        ],
    },
];

// Called from tenants/repo.ts's provisionTenant against the freshly-created
// tenant database (explicit databaseName, no ambient tenant-context yet), and
// from getBlueprint above as a self-heal for a tenant provisioned before this
// feature existed (ambient databaseName, possibly undefined) — idempotent
// (MERGE throughout) either way, so calling it against an already-seeded
// tenant is harmless.
export const seedDefaultBlueprint = async (databaseName?: string): Promise<void> => {
    await db(databaseName).exec(ENSURE_BLUEPRINT, { id: BLUEPRINT_ID });
    const orderedIds: string[] = [];
    for (const level of DEFAULT_HIERARCHY) {
        const id = `LVL-${labelFromName(level.name)}`;
        orderedIds.push(id);
        await db(databaseName).exec(UPSERT_LEVEL, {
            id,
            props: { name: level.name, alias: level.alias ?? '', description: '' },
        });
        for (const prop of level.properties) {
            await db(databaseName).exec(UPSERT_PROPERTY, {
                id: `PROP-${prop.ingestKey}`,
                levelId: id,
                // `role` only ever stamped here, at seed time — not part of
                // AddPropertyInput/updateProperty's public surface, so a user
                // can freely rename/edit the property without ever touching it.
                props: { name: prop.name, ingestKey: prop.ingestKey, description: '', dataType: 'STRING', defaultValue: '', required: false, role: prop.role ?? '' },
            });
        }
    }
    await rebuildChain(orderedIds, databaseName);
};
