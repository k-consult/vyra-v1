import * as tenantContext from '../tenant-context';

export interface Neo4jConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    uri: string;
    importDir?: string;
}

export interface AppConfig {
    port: number;
    env: string;
}

export interface Config {
    db: {
        twin: Neo4jConfig;
    };
    app: AppConfig;
}

const host = process.env.DB_HOST || 'localhost';
const port = parseInt(process.env.DB_PORT || '7687');

export const config: Config = {
    db: {
        twin: {
            host,
            port,
            user: process.env.DB_USER || 'neo4j',
            password: process.env.DB_PASSWORD || 'vyra-ai@2025',
            // A getter, not a plain value: api/API.ts's onRequest hook sets a
            // per-request override (lib/tenant-context) when a request names a
            // tenant, scoped to that request's async call graph only — every
            // existing `config.db.twin.database` read (every repo.ts's db()) picks
            // it up automatically, with no caller-side change, and falls back to
            // the env default otherwise.
            get database(): string { return tenantContext.getOverride() ?? (process.env.DB_NAME || 'agentic-grc'); },
            uri: process.env.DB_URI || `bolt://${host}:${port}`,
            importDir: process.env.NEO4J_IMPORT_DIR,
        },
    },
    app: {
        port: parseInt(process.env.API_PORT || '4001'),
        env: process.env.NODE_ENV || 'development',
    },
};
