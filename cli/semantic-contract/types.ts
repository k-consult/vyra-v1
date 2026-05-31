export enum Graph {
    Knowledge = 'Knowledge',
    Execution = 'Execution',
    Operational = 'Operational',
    Intelligence = 'Intelligence',
    Assurance = 'Assurance',
}

export enum Axis {
    Regulatory = 'Regulatory',
    Enterprise = 'Enterprise',
    Process = 'Process',
    Risk = 'Risk',
    Time = 'Time',
    Signal = 'Signal',
    Agent = 'Agent',
    Assurance = 'Assurance',
}

export type PropMap = string | { mapTo: string; resolveBy?: 'id' | 'name' };

export interface RelSpec {
    type: string;
    targetLabel: string;
    sourceField: string;
}

export interface TypeSpec {
    label: string;
    graph: Graph;
    props: Record<string, PropMap>;
    axes: Axis[];
    rels: RelSpec[];
}

export interface Contract {
    version: string;
    schemaId?: string;
    types: Record<string, TypeSpec>;
    hints: Record<string, any>;
}
