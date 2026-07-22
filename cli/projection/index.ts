import fs from 'fs';
import path from 'path';
import * as R from 'ramda';
import { GraphEdge, GraphIR, GraphNode } from '../compiler/types';

const outDir    = path.resolve(__dirname, '..', 'out');
const cypherDir = path.resolve(__dirname, '..', 'cypher');

export interface NodeBatch  { label: string; rows: Record<string, any>[] }
export interface EdgeBatch  { relType: string; sourceLabel: string; targetLabel: string; pairs: { sourceId: string; targetId: string }[] }

export interface ProjectionResult {
    nodeBatches: NodeBatch[];
    edgeBatches: EdgeBatch[];
    cypherFiles: { constraints: string; indexes: string };
    // debug: node/edge CSVs written to out/ for inspection
    nodeCSVs: string[];
    edgeCSVs: string[];
}

// ── CSV writer (for debug output only) ─────────────────────────────────────
const writeCSV = (filePath: string, rows: Record<string, any>[]): void => {
    if (!rows.length) return;
    const cols = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
    const esc  = (v: any) => { const s = v == null ? '' : String(v); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s; };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n') + '\n');
};

// ── main ────────────────────────────────────────────────────────────────────
export const project = (ir: GraphIR): ProjectionResult => {
    fs.mkdirSync(outDir,    { recursive: true });
    fs.mkdirSync(cypherDir, { recursive: true });

    // ── Group by label / relType ──────────────────────────────────────────
    const nodesByLabel: Record<string, GraphNode[]> = {};
    for (const n of ir.nodes) (nodesByLabel[n.label] ??= []).push(n);

    // Group by relType + sourceLabel + targetLabel — a relType alone isn't a unique batch key
    // when the same name is legitimately reused across different node-type pairs (e.g. Clause
    // -[:BELONGS_TO]-> Regulation and Clause -[:BELONGS_TO]-> Standard).
    const batchKey = (e: GraphEdge) => `${e.relType}::${e.sourceLabel}::${e.targetLabel}`;
    const edgesByRel: Record<string, GraphEdge[]> = {};
    for (const e of ir.edges) (edgesByRel[batchKey(e)] ??= []).push(e);
    for (const key of Object.keys(edgesByRel)) {
        edgesByRel[key] = R.uniqWith(
            (a: GraphEdge, b: GraphEdge) => a.sourceId === b.sourceId && a.targetId === b.targetId,
            edgesByRel[key]
        );
    }

    const nodeBatches: NodeBatch[] = [];
    const edgeBatches: EdgeBatch[] = [];
    const nodeCSVs: string[] = [];
    const edgeCSVs: string[] = [];
    const allLabels = Object.keys(nodesByLabel);

    // ── Node batches + debug CSVs ─────────────────────────────────────────
    for (const [label, nodes] of Object.entries(nodesByLabel)) {
        const rows = nodes.map(n => ({ id: n.id, ...n.props }));
        nodeBatches.push({ label, rows });

        const csvPath = path.join(outDir, `nodes-${label}.csv`);
        writeCSV(csvPath, rows);
        nodeCSVs.push(csvPath);
    }

    // ── Edge batches + debug CSVs ─────────────────────────────────────────
    for (const edges of Object.values(edgesByRel)) {
        const pairs = edges.map(e => ({ sourceId: e.sourceId, targetId: e.targetId }));
        const { relType, sourceLabel, targetLabel } = edges[0];
        edgeBatches.push({ relType, sourceLabel, targetLabel, pairs });

        const csvPath = path.join(outDir, `edges-${relType}-${sourceLabel}-${targetLabel}.csv`);
        writeCSV(csvPath, pairs);
        edgeCSVs.push(csvPath);
    }

    // ── constraints.cypher ────────────────────────────────────────────────
    const constraintsCypher = allLabels
        .map(l => `CREATE CONSTRAINT ${l.toLowerCase()}_id IF NOT EXISTS FOR (n:${l}) REQUIRE n.id IS UNIQUE;`)
        .join('\n');
    const constraintsPath = path.join(cypherDir, 'constraints.cypher');
    fs.writeFileSync(constraintsPath, constraintsCypher + '\n');

    // ── indexes.cypher ────────────────────────────────────────────────────
    const indexesCypher = [
        `CREATE INDEX inc_risk    IF NOT EXISTS FOR (n:Incident)  ON (n.riskRating);`,
        `CREATE INDEX inc_status  IF NOT EXISTS FOR (n:Incident)  ON (n.status);`,
        `CREATE INDEX fnd_sev     IF NOT EXISTS FOR (n:Finding)   ON (n.severity);`,
        `CREATE INDEX fnd_status  IF NOT EXISTS FOR (n:Finding)   ON (n.status);`,
        `CREATE INDEX rsk_score   IF NOT EXISTS FOR (n:Risk)      ON (n.residualScore);`,
        `CREATE INDEX capa_status IF NOT EXISTS FOR (n:CAPA)      ON (n.status);`,
        `CREATE INDEX ast_fac     IF NOT EXISTS FOR (n:Asset)     ON (n.facilityId);`,
    ].join('\n');
    const indexesPath = path.join(cypherDir, 'indexes.cypher');
    fs.writeFileSync(indexesPath, indexesCypher + '\n');

    return { nodeBatches, edgeBatches, cypherFiles: { constraints: constraintsPath, indexes: indexesPath }, nodeCSVs, edgeCSVs };
};
