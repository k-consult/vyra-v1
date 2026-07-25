import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { v2 } from '../semantic-contract';
import hints from '../domains/enterprise/ingest-hints.json';
import { parseCSV } from '../parser';
import { buildIR, compile } from '../compiler';
import { GraphEdge, GraphNode } from '../compiler/types';
import { project } from '../projection';
import { run } from '../runtime';
import { dumpIR, spotCheck } from '../observability';
import { config } from '../../lib/config';
import { DB } from '../../lib/graph-db';
import log from '../../lib/log';

const args       = process.argv.slice(2);
const isDryRun   = args.includes('--dry-run');
const dumpArg    = args.find(a => a.startsWith('--dump-ir='));
const dumpIRPath = dumpArg ? dumpArg.split('=')[1] : null;

const feedsDir = path.resolve(__dirname, '..', 'feeds', 'csv');

async function main() {
    log.info(`Vyra Enterprise Sync v${v2.version}`);
    log.info(`Database : ${config.db.twin.database} @ ${config.db.twin.uri}`);
    log.info(`Mode     : ${isDryRun ? 'dry-run (no Neo4j writes)' : 'full'}`);

    const allNodes: GraphNode[] = [];
    const allEdges: GraphEdge[] = [];
    let   skipCount  = 0;
    let   errorCount = 0;

    // ── 1. Compile enterprise node feeds ────────────────────────────────────
    for (const [feedFile, entityType] of Object.entries(hints.feedMap)) {
        const feedPath = path.join(feedsDir, feedFile);
        const { rows, errors } = parseCSV(feedPath);

        if (errors.length) {
            errors.forEach(e => log.warn(`[parser] ${feedFile}: ${e}`));
            if (!rows.length) { skipCount++; continue; }
            errorCount += errors.length;
        }

        if (!rows.length) { skipCount++; continue; }

        const { nodes, edges } = compile(v2, entityType, rows, feedFile);
        allNodes.push(...nodes);
        allEdges.push(...edges);
        log.debug(`[compiler] ${feedFile} → ${nodes.length} nodes, ${edges.length} rel-edges`);
    }

    // ── 2. Build combined IR ──────────────────────────────────────────────
    const ir = buildIR(v2.version, allNodes, allEdges);
    spotCheck(ir);

    if (dumpIRPath) {
        dumpIR(ir, dumpIRPath);
        log.info(`[observability] IR dumped → ${dumpIRPath}`);
    }

    if (skipCount) log.warn(`[orchestration] skipped ${skipCount} feeds (file not found or empty)`);
    if (errorCount) log.warn(`[orchestration] ${errorCount} validation error(s) in parsed feeds`);

    if (isDryRun) {
        log.info(`[orchestration] dry-run complete — no Neo4j writes`);
        return;
    }

    // ── 3. Project ────────────────────────────────────────────────────────
    const projection = project(ir);
    log.info(`[projection] ${projection.nodeBatches.length} node batches, ${projection.edgeBatches.length} edge batches (CSVs in cli/out/ for debug)`);

    // ── 4. Load into Neo4j, stamped with the :Enterprise origin label ──────
    await run(projection, { originLabel: 'Enterprise' });
    await DB.closeAll();
}

main().catch(err => {
    log.error(`[enterprise-sync] pipeline failed: ${err.message}`);
    process.exit(1);
});
