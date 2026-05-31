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

        // Map CSV columns → node props via TypeSpec.props
        const props: Record<string, any> = {};
        for (const [propName, csvCol] of Object.entries(typeSpec.props)) {
            if (typeof csvCol === 'string') {
                const val = row[csvCol];
                if (val !== undefined && val !== null && String(val).trim() !== '') {
                    props[propName] = String(val).trim();
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
        .map(r => ({
            sourceId:    String(r[edgeDef.sourceCol]).trim(),
            sourceLabel: edgeDef.sourceLabel,
            relType:     edgeDef.relType,
            targetId:    String(r[edgeDef.targetCol]).trim(),
            targetLabel: edgeDef.targetLabel,
        }));

export const buildIR = (version: string, nodes: GraphNode[], edges: GraphEdge[]): GraphIR => ({
    nodes,
    edges,
    meta: { version, feedFile: 'combined', compiledAt: new Date().toISOString(), nodeCount: nodes.length, edgeCount: edges.length },
});
