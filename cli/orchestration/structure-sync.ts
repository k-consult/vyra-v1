import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { v2 } from '../semantic-contract';
import { parseCSV } from '../parser';
import { buildIR, compile } from '../compiler';
import { GraphEdge, GraphNode } from '../compiler/types';
import { project } from '../projection';
import { run } from '../runtime';
import { dumpIR, spotCheck } from '../observability';
import { config } from '../../lib/config';
import { DB } from '../../lib/graph-db';
import log from '../../lib/log';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const dumpArg = args.find(a => a.startsWith('--dump-ir='));
const dumpIRPath = dumpArg ? dumpArg.split('=')[1] : null;

// The tenant's asset register — facilities and their assets, with location
// hierarchy (building/zone/room). This is the onboarding blueprint: "what the
// enterprise is," not document tracking — see document-catalog-sync.ts for that.
const fileArg = args.find(a => a.startsWith('--file='));
if (!fileArg) {
    log.error('[structure-sync] --file=<path> is required — the uploaded asset-register CSV.');
    process.exit(1);
}
const feedPath = fileArg.split('=')[1];
const summaryPath = `${feedPath}.summary.json`;

const slug = (s: string): string =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');

interface SummaryResult {
    facilitiesCreated: number;
    assetsCreated: number;
    rowsSkipped: number;
}

async function main() {
    log.info(`Vyra Structure Sync v${v2.version}`);
    log.info(`Database : ${config.db.twin.database} @ ${config.db.twin.uri}`);
    log.info(`File     : ${feedPath}`);
    log.info(`Mode     : ${isDryRun ? 'dry-run (no Neo4j writes)' : 'full'}`);

    const { rows, errors } = parseCSV(feedPath, false);
    if (errors.length) errors.forEach(e => log.warn(`[parser] ${path.basename(feedPath)}: ${e}`));
    if (!rows.length) {
        log.error(`[structure-sync] no rows parsed from ${feedPath}`);
        process.exit(1);
    }

    let rowsSkipped = 0;
    const facilityById = new Map<string, Record<string, any>>();
    const assetById = new Map<string, Record<string, any>>();

    for (const row of rows) {
        const siteCode = String(row['Site Code'] ?? '').trim();
        const assetCode = String(row['Asset Code'] ?? '').trim();
        if (!siteCode || !assetCode) { rowsSkipped++; continue; }

        if (!facilityById.has(siteCode)) {
            facilityById.set(siteCode, { id: siteCode, name: String(row['Site Name'] ?? siteCode).trim() });
        }

        // Asset id is facility-scoped, same discipline as document-catalog-sync.ts —
        // "DG-01" at two different sites is two different physical assets.
        const assetId = `${slug(siteCode)}-${slug(assetCode)}`;
        if (!assetById.has(assetId)) {
            assetById.set(assetId, {
                id: assetId,
                code: assetCode,
                name: String(row['Asset Name'] ?? assetCode).trim(),
                facilityId: siteCode,
                buildingId: String(row['Building'] ?? '').trim(),
                zoneId: String(row['Zone / Floor'] ?? '').trim(),
                roomId: String(row['Room'] ?? '').trim(),
                category: String(row['Asset Category'] ?? '').trim(),
                assetType: String(row['Asset Type'] ?? '').trim(),
            });
        }
    }

    if (rowsSkipped) log.warn(`[structure-sync] skipped ${rowsSkipped} row(s) missing Site Code or Asset Code`);

    const facilityRows = Array.from(facilityById.values());
    const assetRows = Array.from(assetById.values());
    const facilityCompiled = compile(v2, 'Facility', facilityRows, path.basename(feedPath));
    const assetCompiled = compile(v2, 'Asset', assetRows, path.basename(feedPath));

    const allNodes: GraphNode[] = [...facilityCompiled.nodes, ...assetCompiled.nodes];
    const allEdges: GraphEdge[] = [...facilityCompiled.edges, ...assetCompiled.edges];

    const ir = buildIR(v2.version, allNodes, allEdges);
    spotCheck(ir);

    if (dumpIRPath) {
        dumpIR(ir, dumpIRPath);
        log.info(`[observability] IR dumped → ${dumpIRPath}`);
    }

    const summary: SummaryResult = {
        facilitiesCreated: facilityRows.length,
        assetsCreated: assetRows.length,
        rowsSkipped,
    };

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
