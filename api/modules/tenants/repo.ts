import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';
import log from '../../../lib/log';

const credentials = () => ({
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

const systemDb = () => DB.get('system', credentials());

// The tenant registry — its own database, not an env-configurable value, since it's
// a fixed platform fixture rather than something that varies per deployment the way
// DB_NAME does. Same host/user/password as the catalog connection (config.db.twin) —
// only the database name differs. Holds `Tenant` nodes (name, database, connection
// details, status) as the source of truth for "what tenants has this app
// provisioned" — SHOW DATABASES stays reserved for verifying Neo4j-level database
// existence (tenantDatabaseExists below), a different and narrower question.
const TENANTS_REGISTRY_DB = 'tenants';

const registryDb = () => DB.get(TENANTS_REGISTRY_DB, credentials());

// Idempotent (CREATE DATABASE IF NOT EXISTS) — called before every registry read or
// write, not just at provision time, since a fresh environment has no tenants yet
// and GET /tenants must not 500 just because nothing has been provisioned.
const ensureRegistryDb = () => DB.createDB(credentials(), TENANTS_REGISTRY_DB);

const TENANT_DB_PREFIX = 'grc-tenant-';

const REPO_ROOT = path.resolve(__dirname, '../../../');
const CATALOG_FEEDS_DIR = path.join(REPO_ROOT, 'cli/feeds/csv/catalog');
const TENANT_FEEDS_ROOT = path.join(REPO_ROOT, 'cli/feeds/csv/tenants');
const CATALOG_SYNC_SCRIPT = path.join(REPO_ROOT, 'cli/orchestration/catalog-sync.ts');
const CLI_TSCONFIG = path.join(REPO_ROOT, 'cli/tsconfig.json');
const TS_NODE_BIN = path.join(REPO_ROOT, 'node_modules/.bin/ts-node');

const LIST_TENANTS = `
    MATCH (t:Tenant)
    RETURN properties(t) AS tenant
    ORDER BY t.name
`;

export const listTenants = async () => {
    await ensureRegistryDb();
    const raw: any = await registryDb().fetch(LIST_TENANTS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.tenant).filter(Boolean);
};

// Registers (or refreshes, on re-provision) the tenant's entry — never a password or
// any other credential, only what's needed to resolve which database a tenant's
// requests should hit. createdAt is stamped once via ON CREATE; every other field is
// safe to overwrite on re-provision (idempotent, same discipline as catalog sync's
// own MERGE ... ON CREATE/ON MATCH SET n += row).
const REGISTER_TENANT = `
    MERGE (t:Tenant {id: $id})
    ON CREATE SET t.createdAt = datetime()
    SET t += $props
    RETURN properties(t) AS tenant
`;

interface TenantRegistration {
    name: string;
    database: string;
    uri: string;
    host: string;
    port: number;
    status: string;
    authoritiesLoaded: string[];
}

const registerTenant = async (registration: TenantRegistration) => {
    const raw: any = await registryDb().exec(REGISTER_TENANT, { id: registration.name, props: registration });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return row?.tenant;
};

const SHOW_DATABASE_BY_NAME = `SHOW DATABASES YIELD name WHERE name = $name RETURN name`;
const tenantDatabaseExists = async (databaseName: string): Promise<boolean> => {
    const raw: any = await systemDb().fetch(SHOW_DATABASE_BY_NAME, { name: databaseName });
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.some((r: any) => r?.name === databaseName);
};

// Each authority board under cli/feeds/csv/catalog/<board>/ (e.g. cpcb/) is its own
// catalog-sync.ts invocation — mirrors ingest.sh's loop exactly, just targeting the
// new tenant's database via DB_NAME instead of the single dev database.
const listAuthorityBoards = (): string[] =>
    fs.readdirSync(CATALOG_FEEDS_DIR, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name !== 'ignore')
        .map(e => e.name);

// Spawns the existing, already-idempotent catalog-sync.ts untouched — provisioning
// reuses the proven ingestion path rather than re-implementing it in-process.
const runCatalogSync = (authority: string, databaseName: string): Promise<void> =>
    new Promise((resolve, reject) => {
        const child = spawn(TS_NODE_BIN, ['--project', CLI_TSCONFIG, CATALOG_SYNC_SCRIPT, `--authority=${authority}`], {
            cwd: REPO_ROOT,
            env: { ...process.env, DB_NAME: databaseName },
        });
        let stderr = '';
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`catalog-sync --authority=${authority} exited ${code}: ${stderr.slice(-2000)}`));
        });
    });

export interface ProvisionTenantInput {
    name: string;
}

// Four steps, same order every time: create the database, scaffold its feeds
// folder, replay every catalog authority board into it, register it in the tenant
// registry. Each step's failure propagates untouched — a partially-provisioned
// tenant (db created, catalog not yet loaded, not yet registered) is visible as a
// real thrown error, never masked as success.
export const provisionTenant = async (input: ProvisionTenantInput) => {
    const databaseName = `${TENANT_DB_PREFIX}${input.name}`;

    await ensureRegistryDb();
    await DB.createDB(credentials(), databaseName);
    // createDB silently no-ops on Community Edition (no multi-database support) —
    // verify the database actually exists rather than trusting a successful return.
    if (!(await tenantDatabaseExists(databaseName))) {
        throw new Error(`Tenant database '${databaseName}' was not created — this Neo4j edition may not support multiple databases (CREATE DATABASE requires Enterprise or Aura)`);
    }

    const tenantFeedsDir = path.join(TENANT_FEEDS_ROOT, input.name, 'enterprise');
    fs.mkdirSync(tenantFeedsDir, { recursive: true });

    const authoritiesLoaded: string[] = [];
    for (const authority of listAuthorityBoards()) {
        await runCatalogSync(authority, databaseName);
        authoritiesLoaded.push(authority);
    }

    const tenant = await registerTenant({
        name: input.name,
        database: databaseName,
        uri: config.db.twin.uri,
        host: config.db.twin.host,
        port: config.db.twin.port,
        status: 'active',
        authoritiesLoaded,
    });

    log.info(`tenants.repo: provisioned '${databaseName}', loaded authorities: ${authoritiesLoaded.join(', ') || 'none'}`);
    return tenant;
};
