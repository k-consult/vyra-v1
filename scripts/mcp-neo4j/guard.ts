// Guardrails for the neo4j-local MCP server. Every check here is a fast, readable
// rejection with a clear message — defense-in-depth, not the only line of defense.
// The structural backstop for read_cypher is that it only ever runs through
// lib/graph-db's fetch2(), which opens a Neo4j READ-mode session: the server itself
// refuses to execute a write inside it, regardless of what slips past the regex below.

const WRITE_KEYWORDS =
    /\b(CREATE|MERGE|DELETE|REMOVE|SET|DROP|LOAD\s+CSV|FOREACH)\b/i;

const ADMIN_COMMANDS =
    /\b(CREATE|DROP|ALTER)\s+(DATABASE|USER|ROLE)\b|\bGRANT\b|\bDENY\b|\bREVOKE\b|\bCALL\s+dbms\./i;

export const assertReadOnly = (cypher: string): void => {
    const match = cypher.match(WRITE_KEYWORDS);
    if (match) {
        throw new Error(
            `read_cypher rejected: query contains a write operation ("${match[0]}"). Use write_cypher instead.`
        );
    }
};

export const assertNoAdminCommands = (cypher: string): void => {
    const match = cypher.match(ADMIN_COMMANDS);
    if (match) {
        throw new Error(
            `Rejected: instance-level admin command ("${match[0]}") is never allowed through this server, write-enabled or not.`
        );
    }
};

export const assertWriteAllowed = (): void => {
    if (process.env.NEO4J_MCP_ALLOW_WRITE !== 'true') {
        throw new Error(
            'write_cypher is disabled. Set NEO4J_MCP_ALLOW_WRITE=true in .env and restart the session to enable it.'
        );
    }
};
