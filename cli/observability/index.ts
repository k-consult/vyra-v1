import { GraphIR } from '../compiler/types';
import fs from 'fs';
import path from 'path';

export const dumpIR = (ir: GraphIR, outPath: string): void => {
    fs.writeFileSync(outPath, JSON.stringify(ir, null, 2));
};

export const spotCheck = (ir: GraphIR): void => {
    console.log('─'.repeat(60));
    console.log(`IR Spot-check — ${ir.meta.compiledAt}`);
    console.log(`  Feed:   ${ir.meta.feedFile}`);
    console.log(`  Nodes:  ${ir.meta.nodeCount}`);
    console.log(`  Edges:  ${ir.meta.edgeCount}`);

    const byLabel = ir.nodes.reduce<Record<string, number>>((acc, n) => {
        acc[n.label] = (acc[n.label] || 0) + 1;
        return acc;
    }, {});
    Object.entries(byLabel).forEach(([label, count]) => console.log(`    ${label}: ${count}`));
    console.log('─'.repeat(60));
};
