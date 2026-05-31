import { ProjectionResult } from '../projection';
import { execCypherFile, loadNodes, loadEdges } from './repo';
import log from '../../lib/log';

export const run = async (projection: ProjectionResult): Promise<void> => {
    const { cypherFiles, nodeBatches, edgeBatches } = projection;

    // ── 1. Constraints ────────────────────────────────────────────────────
    log.info(`[runtime] creating constraints...`);
    await execCypherFile(cypherFiles.constraints);

    // ── 2. Indexes ────────────────────────────────────────────────────────
    log.info(`[runtime] creating indexes...`);
    await execCypherFile(cypherFiles.indexes);

    // ── 3. Nodes via UNWIND (parameterized — no file I/O) ─────────────────
    log.info(`[runtime] loading ${nodeBatches.length} node types...`);
    for (const batch of nodeBatches) {
        const count = await loadNodes(batch.label, batch.rows);
        log.info(`[runtime]   ${batch.label}: +${count} nodes`);
    }

    // ── 4. Edges via UNWIND ───────────────────────────────────────────────
    log.info(`[runtime] loading ${edgeBatches.length} relationship types...`);
    for (const batch of edgeBatches) {
        const count = await loadEdges(batch.relType, batch.sourceLabel, batch.targetLabel, batch.pairs);
        log.info(`[runtime]   ${batch.relType}: +${count} edges`);
    }

    log.info(`[runtime] ingestion complete`);
};
