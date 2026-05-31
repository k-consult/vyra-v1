export interface GraphNode {
    id: string;
    label: string;
    graph: string;
    props: Record<string, any>;
    axes: string[];
}

export interface GraphEdge {
    sourceId: string;
    sourceLabel: string;
    relType: string;
    targetId: string;
    targetLabel: string;
}

export interface GraphIR {
    nodes: GraphNode[];
    edges: GraphEdge[];
    meta: {
        version: string;
        feedFile: string;
        compiledAt: string;
        nodeCount: number;
        edgeCount: number;
    };
}

export interface EdgeDef {
    relType: string;
    sourceCol: string;
    sourceLabel: string;
    targetCol: string;
    targetLabel: string;
}
