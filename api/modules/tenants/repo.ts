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
const DOCUMENT_CATALOG_SYNC_SCRIPT = path.join(REPO_ROOT, 'cli/orchestration/document-catalog-sync.ts');
const STRUCTURE_SYNC_SCRIPT = path.join(REPO_ROOT, 'cli/orchestration/structure-sync.ts');
const CLI_TSCONFIG = path.join(REPO_ROOT, 'cli/tsconfig.json');
// Agents are a separate workspace with their own tsconfig (architecture.md:59 —
// agents never called in-process by the API, only spawned as their own process,
// same arm's-length precedent as the CLI scripts below).
const AGENTS_TSCONFIG = path.join(REPO_ROOT, 'agents/tsconfig.json');
const AGENTS_ENTRYPOINT = path.join(REPO_ROOT, 'agents/index.ts');
const TS_NODE_BIN = path.join(REPO_ROOT, 'node_modules/.bin/ts-node');

 
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
const stripAnsi = (s: string): string => s.replace(ANSI_PATTERN, '');

// Shared by every runXSync below. lib/log's Console transport has no
// `stderrLevels` configured, so winston (including log.error) writes to
// stdout, not stderr — capturing only child.stderr (the previous behaviour)
// meant every clean validation failure (missing CSV column, required-field
// violation, ...) surfaced to the API caller as an empty-message 500. Capture
// both streams and report whichever one actually has content.
const runScript = (scriptPath: string, args: string[], databaseName: string, label: string, tsconfigPath: string = CLI_TSCONFIG): Promise<void> =>
    new Promise((resolve, reject) => {
        const child = spawn(TS_NODE_BIN, ['--project', tsconfigPath, scriptPath, ...args], {
            cwd: REPO_ROOT,
            env: { ...process.env, DB_NAME: databaseName },
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) return resolve();
            const output = stripAnsi(`${stdout}\n${stderr}`).trim();
            reject(new Error(`${label} exited ${code}: ${output.slice(-2000)}`));
        });
    });

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

const GET_TENANT_BY_NAME = `
    MATCH (t:Tenant {id: $name})
    RETURN properties(t) AS tenant
`;

export const getTenant = async (name: string) => {
    await ensureRegistryDb();
    const raw: any = await registryDb().fetch(GET_TENANT_BY_NAME, { name });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return row?.tenant ?? null;
};

export const tenantExists = async (name: string): Promise<boolean> => !!(await getTenant(name));

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
    description: string;
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
// authority omitted (null) syncs every board except ignore/, same as ingest.sh.
const runCatalogSync = (authority: string | null, databaseName: string): Promise<void> =>
    runScript(
        CATALOG_SYNC_SCRIPT,
        authority ? [`--authority=${authority}`] : [],
        databaseName,
        `catalog-sync${authority ? ` --authority=${authority}` : ''}`,
    );

export interface ProvisionTenantInput {
    name: string;
    description?: string;
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

    // One call, every board — catalog-sync.ts loops internally when --authority is
    // omitted, so provisioning no longer drives that loop itself.
    await runCatalogSync(null, databaseName);
    const authoritiesLoaded = listAuthorityBoards();

    // Deliberately no blueprint seeding here — a new tenant's org/location/asset
    // hierarchy starts empty (api/modules/blueprint/repo.ts's getBlueprint
    // returns `levels: []` for it), surfaced as the Onboarding wizard's first,
    // empty-state Blueprint stage. The admin either builds it via Add Level or
    // restores one from an exported JSON (POST /blueprint/restore) — never an
    // implicit copy of a standard template they didn't ask for.
    const tenant = await registerTenant({
        name: input.name,
        description: input.description ?? '',
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

const RECORD_CATALOG_SYNC = `
    MATCH (t:Tenant {id: $name})
    SET t.authoritiesLoaded = $authoritiesLoaded, t.lastCatalogSyncAt = datetime()
    RETURN properties(t) AS tenant
`;

// Re-runs the same catalog replay provisioning does, against an already-active
// tenant — the central board set can grow after a tenant is provisioned (e.g. a new
// authority folder landing under cli/feeds/csv/catalog/), and nothing re-propagates
// that into existing tenant databases on its own.
export const syncTenantCatalog = async (name: string) => {
    const tenant = await getTenant(name);
    if (!tenant) throw new Error(`no tenant registered as '${name}'`);

    await runCatalogSync(null, tenant.database);
    const authoritiesLoaded = listAuthorityBoards();

    const raw: any = await registryDb().exec(RECORD_CATALOG_SYNC, { name, authoritiesLoaded });
    const row = Array.isArray(raw) ? raw[0] : raw;
    log.info(`tenants.repo: synced '${tenant.database}' with central catalog, authorities: ${authoritiesLoaded.join(', ') || 'none'}`);
    return row?.tenant;
};

const RECORD_CLASSIFICATION_RUN = `
    MATCH (t:Tenant {id: $name})
    SET t.lastClassificationRunAt = datetime()
    RETURN properties(t) AS tenant
`;

// On-demand re-run of the applicability-intelligence agent against an
// already-active tenant — backs the Onboarding Annotate stage's "Run
// classification" toolbar action and the auto-trigger after a structure
// upload. Spawned, not imported — architecture.md:59's agents-never-called-
// in-process-by-the-API rule, same arm's-length precedent as runCatalogSync
// above, just pointed at the agents/ workspace's own tsconfig and entrypoint
// instead of a cli/ script. The agent's own idempotency guard
// (fetchUnclassifiedAssets' no-Decision filter) makes this safe to call even
// when nothing new needs classifying — it just observes 0.
export const runClassification = async (name: string) => {
    const tenant = await getTenant(name);
    if (!tenant) throw new Error(`no tenant registered as '${name}'`);

    await runScript(AGENTS_ENTRYPOINT, ['applicability-intelligence'], tenant.database, 'applicability-intelligence', AGENTS_TSCONFIG);

    const raw: any = await registryDb().exec(RECORD_CLASSIFICATION_RUN, { name });
    const row = Array.isArray(raw) ? raw[0] : raw;
    log.info(`tenants.repo: ran applicability-intelligence against '${tenant.database}'`);
    return row?.tenant;
};

// Spawns document-catalog-sync.ts the same way runCatalogSync spawns catalog-sync.ts
// above — same ts-node child-process pattern, DB_NAME still the only thing that
// changes per tenant. --file replaces --authority since this feed is one customer's
// own upload, not a standard board under cli/feeds/csv/catalog/.
const runDocumentCatalogSync = (filePath: string, databaseName: string): Promise<void> =>
    runScript(DOCUMENT_CATALOG_SYNC_SCRIPT, [`--file=${filePath}`], databaseName, `document-catalog-sync --file=${filePath}`);

// Spawns structure-sync.ts the same way runDocumentCatalogSync spawns
// document-catalog-sync.ts above — same ts-node child-process pattern.
const runStructureSync = (filePath: string, databaseName: string): Promise<void> =>
    runScript(STRUCTURE_SYNC_SCRIPT, [`--file=${filePath}`], databaseName, `structure-sync --file=${filePath}`);

export interface IngestStructureInput {
    name: string;
    originalFilename: string;
    content: Buffer;
}

// Same shape as ingestDocumentCatalog above: write the uploaded CSV under the
// tenant's feeds folder, hand it to structure-sync.ts, read back its summary
// sidecar. This is the onboarding blueprint upload — facilities/assets with
// their location hierarchy — not the document-tracking catalog.
export const ingestStructure = async (input: IngestStructureInput) => {
    const tenant = await getTenant(input.name);
    if (!tenant) throw new Error(`no tenant named "${input.name}" — provision it first via POST /tenants`);

    const uploadsDir = path.join(TENANT_FEEDS_ROOT, input.name, 'structure');
    fs.mkdirSync(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, `${Date.now()}-${path.basename(input.originalFilename)}`);
    fs.writeFileSync(filePath, input.content);

    await runStructureSync(filePath, tenant.database);

    const summary = JSON.parse(fs.readFileSync(`${filePath}.summary.json`, 'utf-8'));
    const byLevel = Object.entries(summary.nodesCreatedByLevel ?? {}).map(([k, v]) => `${k}:${v}`).join(', ');
    log.info(`tenants.repo: ingested structure for '${tenant.database}' — ${byLevel || 'no nodes created'}`);
    return summary;
};

const DELETE_TENANT_REGISTRATION = `MATCH (t:Tenant {id: $name}) DETACH DELETE t`;

// Hard delete, the true inverse of provisionTenant: drops the tenant's Neo4j
// database, then removes its registry node. Registry removal always runs — even
// when the drop itself silently no-ops (Community Edition, same caveat createDB
// already documents) — so a tenant a human asked to delete never lingers as
// selectable in the UI; databaseDropped tells the caller whether the underlying
// data is actually gone or just unregistered.
export const deleteTenant = async (name: string) => {
    const tenant = await getTenant(name);
    if (!tenant) throw new Error(`no tenant named "${name}"`);

    await DB.dropDB(credentials(), tenant.database);
    const databaseDropped = !(await tenantDatabaseExists(tenant.database));

    await registryDb().exec(DELETE_TENANT_REGISTRATION, { name });

    log.info(`tenants.repo: deleted '${name}' (database ${databaseDropped ? 'dropped' : 'still present — Community Edition?'})`);
    return { databaseDropped };
};

export interface IngestDocumentCatalogInput {
    name: string;
    originalFilename: string;
    content: Buffer;
}

// Owns the whole upload: write the customer's CSV under its tenant's feeds folder
// (same TENANT_FEEDS_ROOT scaffold provisionTenant already creates), hand it to
// document-catalog-sync.ts, then read back the sync script's JSON summary sidecar
// so the caller sees what landed (counts, unmapped agencies) without scraping logs.
export const ingestDocumentCatalog = async (input: IngestDocumentCatalogInput) => {
    const tenant = await getTenant(input.name);
    if (!tenant) throw new Error(`no tenant named "${input.name}" — provision it first via POST /tenants`);

    const uploadsDir = path.join(TENANT_FEEDS_ROOT, input.name, 'document-catalog');
    fs.mkdirSync(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, `${Date.now()}-${path.basename(input.originalFilename)}`);
    fs.writeFileSync(filePath, input.content);

    await runDocumentCatalogSync(filePath, tenant.database);

    const summary = JSON.parse(fs.readFileSync(`${filePath}.summary.json`, 'utf-8'));
    log.info(`tenants.repo: ingested document catalog for '${tenant.database}' — ${summary.facilitiesCreated} facilities, ${summary.documentObligationsCreated} document obligations`);
    return summary;
};
