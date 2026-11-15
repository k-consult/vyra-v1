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

const catalogDir = path.resolve(__dirname, '..', 'feeds', 'csv', 'catalog');

// Each regulatory board/authority lives in its own cli/feeds/csv/catalog/<authority>/
// folder (e.g. cpcb/) rather than one flat catalog/ directory shared by every board.
// --authority=<folder> syncs just that board; omitted, every board folder except
// `ignore/` is synced in turn. Boards are never mixed within a run either way — each
// pass compiles/projects/loads exactly one board's files before moving to the next.
const authorityArg = args.find(a => a.startsWith('--authority='));

function discoverBoards(): string[] {
    return fs.readdirSync(catalogDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== 'ignore')
        .map(d => d.name)
        .sort();
}

// Filename → entity type, by convention, not by a per-board registration list — drop
// a correctly-named file into any authority folder and it's ingested automatically.
// A new board needs zero edits here; it only needs a folder and these filenames.
const FILENAME_TO_ENTITY_TYPE: Record<string, string> = {
    'jurisdictions.csv': 'Jurisdiction',
    'authorities.csv': 'Authority',
    'regulations.csv': 'Regulation',
    'standards.csv': 'Standard',
    'clauses.csv': 'Clause',
    'obligations.csv': 'Obligation',
    'complianceAreas.csv': 'ComplianceArea',
    'controls.csv': 'Control',
    'reports.csv': 'Report',
    'tasks.csv': 'Task',
    'schedules.csv': 'Schedule',
};

async function syncAuthority(authority: string, dumpPath: string | null): Promise<void> {
    const feedsDir = path.join(catalogDir, authority);
    log.info(`Authority : ${authority}`);

    if (!fs.existsSync(feedsDir)) {
        log.error(`[catalog-sync] no feed folder at ${feedsDir}`);
        process.exit(1);
    }

    const allNodes: GraphNode[] = [];
    const allEdges: GraphEdge[] = [];
    let skipCount = 0;
    let errorCount = 0;

    for (const fileName of fs.readdirSync(feedsDir).sort()) {
        const entityType = FILENAME_TO_ENTITY_TYPE[fileName];
        if (!entityType) {
            log.warn(`[catalog-sync] ${authority}/${fileName} has no known entity-type mapping; skipping`);
            continue;
        }

        const feedPath = path.join(feedsDir, fileName);
        const { rows, errors } = parseCSV(feedPath);

        if (errors.length) {
            errors.forEach(e => log.warn(`[parser] ${fileName}: ${e}`));
            if (!rows.length) { skipCount++; continue; }
            errorCount += errors.length;
        }
        if (!rows.length) { skipCount++; continue; }

        const { nodes, edges } = compile(v2, entityType, rows, fileName);
        allNodes.push(...nodes);
        allEdges.push(...edges);
        log.debug(`[compiler] ${authority}/${fileName} → ${nodes.length} nodes, ${edges.length} rel-edges`);
    }

    const ir = buildIR(v2.version, allNodes, allEdges);
    spotCheck(ir);

    if (dumpPath) {
        dumpIR(ir, dumpPath);
        log.info(`[observability] IR dumped → ${dumpPath}`);
    }

    if (skipCount) log.warn(`[catalog-sync] ${authority}: skipped ${skipCount} feeds (empty)`);
    if (errorCount) log.warn(`[catalog-sync] ${authority}: ${errorCount} validation error(s) in parsed feeds`);

    if (isDryRun) {
        log.info(`[catalog-sync] ${authority}: dry-run complete — no Neo4j writes`);
        return;
    }

    const projection = project(ir);
    log.info(`[projection] ${authority}: ${projection.nodeBatches.length} node batches, ${projection.edgeBatches.length} edge batches (CSVs in cli/out/ for debug)`);

    // Loaded with the :Catalog origin label, same as every board — which authority a
    // node came from is recorded in its `tags` property (e.g. "CPCB"), not a second
    // structural label; tags is what backs full-text search across boards.
    await run(projection, { originLabel: 'Catalog', sourceRevision: v2.version });
}

async function main() {
    log.info(`Vyra Catalog Sync v${v2.version}`);
    log.info(`Database  : ${config.db.twin.database} @ ${config.db.twin.uri}`);
    log.info(`Mode      : ${isDryRun ? 'dry-run (no Neo4j writes)' : 'full'}`);

    const authorities = authorityArg ? [authorityArg.split('=')[1]] : discoverBoards();
    if (!authorityArg) {
        log.info(`Authority : <all boards> (${authorities.join(', ')}) — ignore/ excluded`);
    }

    if (dumpIRPath && authorities.length > 1) {
        log.warn(`[catalog-sync] --dump-ir is only supported for a single --authority; ignoring for this multi-board run`);
    }

    for (const authority of authorities) {
        await syncAuthority(authority, authorities.length === 1 ? dumpIRPath : null);
    }

    await DB.closeAll();
}

main().catch(err => {
    log.error(`[catalog-sync] pipeline failed: ${err.message}`);
    process.exit(1);
});
