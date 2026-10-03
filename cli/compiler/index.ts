import { Contract } from '../semantic-contract/types';
import { EdgeDef, GraphEdge, GraphIR, GraphNode } from './types';

export const compile = (
    contract: Contract,
    entityType: string,
    rows: Record<string, any>[],
    feedFile: string
): { nodes: GraphNode[]; edges: GraphEdge[] } => {
    const typeSpec = contract.types[entityType];
    if (!typeSpec) throw new Error(`[compiler] no TypeSpec for "${entityType}" in contract`);

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    for (const row of rows) {
        const id = String(row['id'] ?? '').trim();
        if (!id) continue;

        // Map CSV columns → node props via TypeSpec.props. The object form's
        // isArray splits a delimited CSV cell (default '|') into a real string[] —
        // e.g. tags: { mapTo: 'tags', isArray: true } turns "CPCB|SPCB|India" into
        // ['CPCB', 'SPCB', 'India']. resolveBy is declared but has no implementation
        // yet; a PropMap entry using only resolveBy is silently skipped, same as before.
        const props: Record<string, any> = {};
        for (const [propName, csvCol] of Object.entries(typeSpec.props)) {
            if (typeof csvCol === 'string') {
                const val = row[csvCol];
                if (val !== undefined && val !== null && String(val).trim() !== '') {
                    props[propName] = String(val).trim();
                }
            } else if (csvCol.isArray) {
                const val = row[csvCol.mapTo];
                if (val !== undefined && val !== null && String(val).trim() !== '') {
                    const delimiter = csvCol.delimiter ?? '|';
                    props[propName] = String(val).split(delimiter).map(s => s.trim()).filter(Boolean);
                }
            }
        }

        nodes.push({ id, label: typeSpec.label, graph: typeSpec.graph, props, axes: typeSpec.axes });

        // Generate edges from embedded FK fields in TypeSpec.rels
        for (const rel of typeSpec.rels) {
            const targetId = String(row[rel.sourceField] ?? '').trim();
            if (targetId) {
                edges.push({ sourceId: id, sourceLabel: typeSpec.label, relType: rel.type, targetId, targetLabel: rel.targetLabel });
            }
        }
    }

    return { nodes, edges };
};

export const compileEdges = (edgeDef: EdgeDef, rows: Record<string, any>[]): GraphEdge[] =>
    rows
        .filter(r => r[edgeDef.sourceCol] && r[edgeDef.targetCol])
        .map(r => {
            const props: Record<string, any> = {};
            for (const [propName, csvCol] of Object.entries(edgeDef.propCols ?? {})) {
                const val = r[csvCol];
                if (val !== undefined && val !== null && String(val).trim() !== '') {
                    props[propName] = String(val).trim();
                }
            }
            return {
                sourceId:    String(r[edgeDef.sourceCol]).trim(),
                sourceLabel: edgeDef.sourceLabel,
                relType:     edgeDef.relType,
                targetId:    String(r[edgeDef.targetCol]).trim(),
                targetLabel: edgeDef.targetLabel,
                ...(Object.keys(props).length ? { props } : {}),
            };
        });

export const buildIR = (version: string, nodes: GraphNode[], edges: GraphEdge[]): GraphIR => ({
    nodes,
    edges,
    meta: { version, feedFile: 'combined', compiledAt: new Date().toISOString(), nodeCount: nodes.length, edgeCount: edges.length },
});
