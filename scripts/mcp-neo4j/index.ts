import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import log from '../../lib/log';
import * as tools from './tools';

// The MCP stdio transport uses stdout exclusively for the JSON-RPC protocol — any
// stray write there (including lib/log's default Console transport) corrupts the
// stream and breaks the client. Strip console transports; file transports (logs/)
// are unaffected and still capture everything.
log.transports.slice().forEach((t: any) => {
    if (t.name === 'console') log.remove(t);
});

const server = new McpServer({ name: 'neo4j-local', version: '0.1.0' });

const asToolResult = (data: unknown) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

server.registerTool(
    'get_schema',
    {
        title: 'Get Schema',
        description: 'Introspect the graph: labels, relationship types, and property keys. Read-only.',
        inputSchema: {},
    },
    async () => asToolResult(await tools.getSchema())
);

server.registerTool(
    'read_cypher',
    {
        title: 'Read Cypher',
        description:
            'Run a read-only Cypher query against the local agentic-grc database. ' +
            'Write operations are rejected — use write_cypher for those. Results capped at 500 rows.',
        inputSchema: {
            cypher: z.string().describe('Cypher query — must not contain CREATE/MERGE/DELETE/SET/REMOVE/DROP/etc.'),
            params: z.record(z.any()).optional().describe('Named parameters referenced as $name in the query'),
        },
    },
    async ({ cypher, params }) => asToolResult(await tools.readCypher(cypher, params ?? {}))
);

server.registerTool(
    'write_cypher',
    {
        title: 'Write Cypher',
        description:
            'Run a write Cypher query against the local agentic-grc database. ' +
            'Disabled unless NEO4J_MCP_ALLOW_WRITE=true is set in .env. Instance-level admin commands are always rejected.',
        inputSchema: {
            cypher: z.string().describe('Cypher query'),
            params: z.record(z.any()).optional().describe('Named parameters referenced as $name in the query'),
        },
    },
    async ({ cypher, params }) => asToolResult(await tools.writeCypher(cypher, params ?? {}))
);

const main = async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
};

main().catch((err) => {
    process.stderr.write(`mcp-neo4j: fatal startup error: ${err.message}\n`);
    process.exit(1);
});
