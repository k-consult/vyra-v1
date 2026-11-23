import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { v2 } from '../semantic-contract';
import { Axis, Graph } from '../semantic-contract/types';
import { parseCSV } from '../parser';
import { buildIR, compile } from '../compiler';
import { GraphEdge, GraphNode } from '../compiler/types';
import { project } from '../projection';
import { run } from '../runtime';
import { dumpIR, spotCheck } from '../observability';
import { config } from '../../lib/config';
import { DB } from '../../lib/graph-db';
import log from '../../lib/log';
import { camelFromIngestKey, labelFromName } from '../../lib/blueprint/ingest-key';
import { ROLE_PROPERTY_NAME } from '../../lib/blueprint/reserved';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const dumpArg = args.find(a => a.startsWith('--dump-ir='));
const dumpIRPath = dumpArg ? dumpArg.split('=')[1] : null;

// The tenant's asset register — org/location/asset structure, shaped by that
// tenant's own TenantBlueprint (Level/Property metadata), not a hardcoded column
// set. See .design/graph.md's "Tenant Blueprint Graph" section.
const fileArg = args.find(a => a.startsWith('--file='));
if (!fileArg) {
    log.error('[structure-sync] --file=<path> is required — the uploaded asset-register CSV.');
    process.exit(1);
}
const feedPath = fileArg.split('=')[1];
const summaryPath = `${feedPath}.summary.json`;

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

const slug = (s: string): string =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');

const BLUEPRINT_ID = 'default';

// Duplicated from api/modules/blueprint/repo.ts's GET_BLUEPRINT_LEVELS — cli/ never
// imports from api/ (separate workspace), same discipline document-catalog-sync.ts
// already uses for its own FETCH_AUTHORITY_ABBREVIATIONS query.
const GET_BLUEPRINT_LEVELS = `
    MATCH (tb:TenantBlueprint {id: $id})
    OPTIONAL MATCH (tb)-[:STARTS]->(first:Level)
    OPTIONAL MATCH (first)-[:NEXT*0..]->(level:Level)
    OPTIONAL MATCH (level)-[:HAS_PROPERTY]->(prop:Property)
    RETURN properties(level) AS level, collect(properties(prop)) AS properties
    ORDER BY level.order
`;

interface BlueprintLevel {
    id: string;
    name: string;
    alias?: string;
    order: number;
    properties: Array<{ id: string; name: string; ingestKey: string; dataType?: string; defaultValue?: string; required?: boolean; role?: string }>;
}

// Resolves "which property is this Level's code/name" by the `role` stamp
// on it (api/modules/blueprint/repo.ts's restoreBlueprint is the only path
// that writes one — never exposed through the public add/update-property API),
// not by matching a literal ingestKey string — so renaming SITE_CODE/SITE_NAME/
// ASSET_CODE/ASSET_NAME (fully editable, same as any other property) never
// breaks ingestion. Only Facility/Asset's reserved identity properties carry
// a role; every other property returns undefined here and is never excluded.
const findByRole = (level: BlueprintLevel, role: 'code' | 'name') =>
    level.properties.find(p => p.role === role);

const fetchBlueprintLevels = async (): Promise<BlueprintLevel[]> => {
    const raw: any = await db().fetch(GET_BLUEPRINT_LEVELS, { id: BLUEPRINT_ID });
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows
        .filter((r: any) => r?.level)
        .map((r: any) => ({ ...r.level, properties: (r.properties ?? []).filter(Boolean) }));
};

interface SummaryResult {
    nodesCreatedByLevel: Record<string, number>;
    rowsSkipped: number;
}

async function main() {
    log.info(`Vyra Structure Sync v${v2.version}`);
    log.info(`Database : ${config.db.twin.database} @ ${config.db.twin.uri}`);
    log.info(`File     : ${feedPath}`);
    log.info(`Mode     : ${isDryRun ? 'dry-run (no Neo4j writes)' : 'full'}`);

    const levels = await fetchBlueprintLevels();
    if (!levels.length) {
        log.error('[structure-sync] this tenant has no blueprint levels yet — define one via the Onboarding wizard\'s Blueprint stage, or restore one from an exported JSON, before uploading structure');
        process.exit(1);
    }
    // Each Level's Neo4j label is derived from its `name` (no ingestKey of its
    // own) — computed once per level, up front, since nothing else here should
    // re-derive it independently and risk drifting.
    const labelByLevelId = new Map<string, string>(levels.map(l => [l.id, labelFromName(l.name)]));
    const facilityLevel = levels.find(l => labelByLevelId.get(l.id) === 'Facility');
    const assetLevel = levels.find(l => labelByLevelId.get(l.id) === 'Asset');
    if (!facilityLevel || !assetLevel) {
        log.error('[structure-sync] the active TenantBlueprint has no Facility/Asset level — these two are reserved and required');
        process.exit(1);
    }
    const facilityCodeProp = findByRole(facilityLevel!, 'code');
    const facilityNameProp = findByRole(facilityLevel!, 'name');
    const assetCodeProp = findByRole(assetLevel!, 'code');
    const assetNameProp = findByRole(assetLevel!, 'name');
    if (!facilityCodeProp || !assetCodeProp) {
        log.error('[structure-sync] the Facility/Asset level is missing its "code" property (the one originally seeded as SITE_CODE/ASSET_CODE) — removed it without adding a replacement?');
        process.exit(1);
    }

    const { rows, errors } = parseCSV(feedPath, false);
    if (errors.length) errors.forEach(e => log.warn(`[parser] ${path.basename(feedPath)}: ${e}`));
    if (!rows.length) {
        log.error(`[structure-sync] no rows parsed from ${feedPath}`);
        process.exit(1);
    }

    const expectedColumns = levels.flatMap(l => l.properties.map(p => p.ingestKey));
    const header = Object.keys(rows[0]);
    const missingColumns = expectedColumns.filter(col => !header.includes(col));
    if (missingColumns.length) {
        log.error(`[structure-sync] uploaded CSV is missing required column(s): ${missingColumns.join(', ')}`);
        process.exit(1);
    }

    const SITE_CODE = facilityCodeProp.ingestKey;
    const ASSET_CODE = assetCodeProp.ingestKey;

    // Every property's value not already consumed as this level's code/name
    // (excludeKeys) — the fix for "only the first property of a level ever
    // reached the node" (dynamic levels used to fold every property into
    // `name` alone, and Facility/Asset's static contract silently drops
    // anything it doesn't already know about). A roled property (category/
    // assetType) writes to its fixed ROLE_PROPERTY_NAME regardless of its
    // current ingestKey, so a rename never changes the graph property other
    // code depends on; anything else uses the generic camelCase of its
    // ingestKey.
    const buildExtraProps = (level: BlueprintLevel, values: Record<string, string>, excludeKeys: Set<string>): Record<string, string> => {
        const extra: Record<string, string> = {};
        for (const p of level.properties) {
            if (excludeKeys.has(p.ingestKey)) continue;
            if (values[p.ingestKey] === '') continue;
            // `||`, not `??` — a property with no role is stored with
            // `role: ''` (empty string, not undefined/absent; see
            // seedDefaultBlueprint's `role: prop.role ?? ''`), and `??` only
            // falls through on null/undefined, not on an empty string.
            const propName = (p.role && ROLE_PROPERTY_NAME[p.role]) || camelFromIngestKey(p.ingestKey);
            extra[propName] = values[p.ingestKey];
        }
        return extra;
    };

    let rowsSkipped = 0;
    const nodeRowsByLevelId = new Map<string, Map<string, Record<string, any>>>();
    for (const level of levels) nodeRowsByLevelId.set(level.id, new Map());

    // Facility/Asset nodes go through compile()'s static contract (below), which
    // only copies properties v2.ts already knows about — any custom property
    // added to one of these two reserved levels has to be merged back in after
    // compile() runs, keyed by the node id it belongs to.
    const extraPropsByNodeId = new Map<string, Record<string, string>>();

    // childId -> its immediate BELONGS_TO target (nearest *present* ancestor in that
    // row — a row may skip Building/Floor, in which case the edge jumps straight to
    // whichever level above it was actually populated).
    const parentOf = new Map<string, { parentId: string; parentLabel: string; childLabel: string }>();

    // Collected across every row before any Neo4j write — a required-property
    // violation fails the whole upload with one clear report, not a partial write
    // that silently stopped partway through the file.
    const requiredViolations: string[] = [];

    rows.forEach((row, rowIndex) => {
        const siteCode = String(row[SITE_CODE] ?? '').trim();
        const assetCode = String(row[ASSET_CODE] ?? '').trim();
        if (!siteCode || !assetCode) { rowsSkipped++; return; }

        let parent: { id: string; label: string } | null = null;
        let facilityId: string | null = null;

        for (const level of levels) {
            const label = labelByLevelId.get(level.id)!;
            const raw: Record<string, string> = {};
            for (const p of level.properties) raw[p.ingestKey] = String(row[p.ingestKey] ?? '').trim();
            const present = Object.values(raw).some(v => v !== '');
            if (!present) continue;

            // Level is present for this row — resolve each property's value,
            // falling back to its configured defaultValue when blank, and
            // recording a violation (not throwing yet) when a required property
            // has neither a supplied value nor a default.
            const values: Record<string, string> = {};
            for (const p of level.properties) {
                const cell = raw[p.ingestKey];
                if (cell !== '') { values[p.ingestKey] = cell; continue; }
                if (p.defaultValue) { values[p.ingestKey] = p.defaultValue; continue; }
                if (p.required) {
                    requiredViolations.push(`row ${rowIndex + 1}: "${level.name}" is missing required column "${p.ingestKey}"`);
                }
                values[p.ingestKey] = '';
            }

            let id: string;
            let nodeRow: Record<string, any>;
            let identityKeys = new Set<string>();

            if (label === 'Facility') {
                id = values[SITE_CODE] || siteCode;
                nodeRow = { id, name: (facilityNameProp && values[facilityNameProp.ingestKey]) || id };
                identityKeys = new Set([facilityCodeProp.ingestKey, facilityNameProp?.ingestKey].filter(Boolean) as string[]);
            } else if (label === 'Asset') {
                const code = values[ASSET_CODE] || assetCode;
                // Asset id stays scoped to its nearest Facility ancestor specifically
                // (not its immediate BELONGS_TO parent) — "DG-01" at two different
                // sites is two different physical assets, same discipline as before.
                id = `${slug(facilityId ?? '')}-${slug(code)}`;
                nodeRow = {
                    id,
                    code,
                    name: (assetNameProp && values[assetNameProp.ingestKey]) || code,
                    facilityId: facilityId ?? '',
                };
                identityKeys = new Set([assetCodeProp.ingestKey, assetNameProp?.ingestKey].filter(Boolean) as string[]);
            } else {
                const extra = buildExtraProps(level, values, identityKeys);
                const ownValues = Object.values(values).filter(Boolean);
                id = slug(parent ? `${parent.id}-${ownValues.join('-')}` : ownValues.join('-'));
                nodeRow = { id, name: ownValues[0] ?? level.name, ...extra };
            }

            if (label === 'Facility' || label === 'Asset') {
                // category/type and any other custom property on these two
                // reserved levels flow through generically now — only the
                // code/name identity keys are excluded from the merge.
                const extra = buildExtraProps(level, values, identityKeys);
                if (Object.keys(extra).length && !extraPropsByNodeId.has(id)) extraPropsByNodeId.set(id, extra);
            }

            if (!nodeRowsByLevelId.get(level.id)!.has(id)) {
                nodeRowsByLevelId.get(level.id)!.set(id, nodeRow);
            }
            if (parent && !parentOf.has(id)) {
                parentOf.set(id, { parentId: parent.id, parentLabel: parent.label, childLabel: label });
            }

            parent = { id, label };
            if (label === 'Facility') facilityId = id;
        }
    });

    if (requiredViolations.length) {
        log.error(`[structure-sync] required column(s) missing with no default value configured:\n${requiredViolations.join('\n')}`);
        process.exit(1);
    }

    if (rowsSkipped) log.warn(`[structure-sync] skipped ${rowsSkipped} row(s) missing ${SITE_CODE} or ${ASSET_CODE}`);

    const allNodes: GraphNode[] = [];
    const allEdges: GraphEdge[] = [];
    const nodesCreatedByLevel: Record<string, number> = {};

    for (const level of levels) {
        const label = labelByLevelId.get(level.id)!;
        const rowsForLevel: Record<string, any>[] = Array.from(nodeRowsByLevelId.get(level.id)!.values());
        nodesCreatedByLevel[label] = rowsForLevel.length;
        if (!rowsForLevel.length) continue;

        if (label === 'Facility' || label === 'Asset') {
            // Reserved levels — keep feeding the existing static contract so every
            // other module already reading Facility/Asset (Permit/Contract/Signal,
            // Asset's own LOCATED_AT->Facility edge) keeps working untouched.
            const compiled = compile(v2, label, rowsForLevel, path.basename(feedPath));
            // v2.ts's static contract only copies properties it already declares —
            // merge back in any custom property added to this reserved level that
            // the contract doesn't know about.
            for (const node of compiled.nodes) {
                const extra = extraPropsByNodeId.get(node.id);
                if (extra) node.props = { ...node.props, ...extra };
            }
            allNodes.push(...compiled.nodes);
            allEdges.push(...compiled.edges);
        } else {
            // Dynamic levels have no static TypeSpec — the blueprint *is* their
            // contract, so GraphNode is built directly rather than through compile().
            for (const row of rowsForLevel) {
                allNodes.push({ id: row.id, label, graph: Graph.Operational, props: row, axes: [Axis.Enterprise] });
            }
        }
    }

    for (const [childId, { parentId, parentLabel, childLabel }] of parentOf.entries()) {
        allEdges.push({ sourceId: childId, sourceLabel: childLabel, relType: 'BELONGS_TO', targetId: parentId, targetLabel: parentLabel });
    }

    const ir = buildIR(v2.version, allNodes, allEdges);
    spotCheck(ir);

    if (dumpIRPath) {
        dumpIR(ir, dumpIRPath);
        log.info(`[observability] IR dumped → ${dumpIRPath}`);
    }

    const summary: SummaryResult = { nodesCreatedByLevel, rowsSkipped };

    if (isDryRun) {
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
        log.info(`[structure-sync] dry-run complete — no Neo4j writes`);
        return;
    }

    const projection = project(ir);
    log.info(`[projection] ${projection.nodeBatches.length} node batches, ${projection.edgeBatches.length} edge batches (CSVs in cli/out/ for debug)`);

    await run(projection, { originLabel: 'Tenant', sourceRevision: v2.version });
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    await DB.closeAll();
}

main().catch(err => {
    log.error(`[structure-sync] pipeline failed: ${err.message}`);
    process.exit(1);
});
