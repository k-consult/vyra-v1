import neo4j, { Driver } from 'neo4j-driver';
import R from 'ramda';
import log from '../log';

const options = {
    connectionTimeout: 30000,
    maxConnectionPoolSize: 400,
    maxConnectionLifetime: 6 * 60 * 60 * 1000,
    connectionAcquisitionTimeout: 10 * 60 * 1000,
    disableLosslessIntegers: true,
};

interface credentials {
    uri: string;
    user?: string;
    password?: string;
    token?: string;
}

interface result {
    [key: string]: any;
}

interface db {
    fetch(cypher: string, args?: any): Promise<result[]>;
    fetch2(cypher: string, args?: any): Promise<result[]>;
    exec(cypher: string, args?: any): Promise<void | result[]>;
    exec2(cypher: string, args?: any): Promise<result[]>;
}

function getShortID(): number {
    return Math.floor(Math.random() * 1000000);
}

function formatNumber(x: number): string {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function logStat(graph: string, reqID: number, cql: string, r: any) {
    const s = r.summary.counters._stats;
    const txt =
        `exec-cmd: ts:${formatNumber(r.summary.resultAvailableAfter.low || r.summary.resultAvailableAfter)}ms` +
        `, -stats:[nodes:+${s.nodesCreated},-${s.nodesDeleted} | props:+${s.propertiesSet} | edges:+${s.relationshipsCreated},-${s.relationshipsDeleted}]`;
    log.cypher(graph, reqID, txt, cql, 0, 0);
    return r;
}

const parseResult = (result: any) =>
    R.compose(R.map((r: any) => R.zipObj(r.keys, r._fields)), R.prop('records'))(result);

const flattenWhenScalar = R.when(R.compose(R.equals(1), R.length), R.head);
const getResult = R.compose(flattenWhenScalar, parseResult);

class DB {
    private static instance: DB;
    private drivers: Map<string, Driver> = new Map();
    private constructor() {}

    public static getInstance(): DB {
        if (!DB.instance) DB.instance = new DB();
        return DB.instance;
    }

    private createDriver(dbName: string, credentials: credentials): Driver {
        if (!credentials.uri) throw new Error('URI is required');
        log.debug(`graph-db: [${dbName}] Creating driver...`);
        return credentials.token
            ? neo4j.driver(credentials.uri, neo4j.auth.bearer(credentials.token), options)
            : neo4j.driver(credentials.uri, neo4j.auth.basic(credentials.user!, credentials.password!), options);
    }

    public get(name: string, credentials: credentials): db {
        if (!this.drivers.has(name)) {
            this.drivers.set(name, this.createDriver(name, credentials));
        }
        const driver = this.drivers.get(name)!;

        async function fetch(cypher: string, args: any = {}): Promise<result[]> {
            const reqID = getShortID();
            const session = driver.session({ database: name, defaultAccessMode: neo4j.session.READ });
            log.cypher(name, reqID, 'graph-db: db-prefetch', cypher, 0, 0);
            try {
                const startTime = Date.now();
                const result = await session.run(cypher, args);
                log.cypher(name, reqID, 'graph-db: db-fetch', cypher, result.records.length, Date.now() - startTime);
                return getResult(result) as result[];
            } catch (error) {
                log.error(`graph-db: [${name}] Fetch failed: ${error}`);
                throw new Error(`graph-db: Fetch failed for '${name}': ${error}`);
            } finally {
                await session.close();
            }
        }

        async function fetch2(cypher: string, args: any = {}): Promise<result[]> {
            return fetch(cypher, args);
        }

        async function exec(cypher: string, args: any = {}): Promise<void | result[]> {
            const reqID = getShortID();
            const session = driver.session({ database: name, defaultAccessMode: neo4j.session.WRITE });
            try {
                const startTime = Date.now();
                const result = await session.run(cypher, args);
                logStat(name, reqID, cypher, result);
                return getResult(result) as result[];
            } catch (error) {
                log.error(`graph-db: [${name}] Exec failed: ${error}`);
                throw new Error(`graph-db: Exec failed for '${name}': ${error}`);
            } finally {
                await session.close();
            }
        }

        async function exec2(cypher: string, args: any = {}): Promise<result[]> {
            return exec(cypher, args) as Promise<result[]>;
        }

        return { fetch, fetch2, exec, exec2 };
    }

    public async createDB(credentials: credentials, databaseName: string): Promise<void> {
        const sanitized = databaseName.replace(/[^a-zA-Z0-9_.-]/g, '');
        if (sanitized !== databaseName || !sanitized.length) throw new Error(`Invalid database name: ${databaseName}`);
        let driver: Driver | null = null;
        try {
            driver = credentials.token
                ? neo4j.driver(credentials.uri, neo4j.auth.bearer(credentials.token), options)
                : neo4j.driver(credentials.uri, neo4j.auth.basic(credentials.user!, credentials.password!), options);
            const session = driver.session({ database: 'system', defaultAccessMode: neo4j.session.WRITE });
            try {
                await session.run(`CREATE DATABASE \`${sanitized}\` IF NOT EXISTS`);
                log.debug(`graph-db: database '${sanitized}' ensured`);
            } finally {
                await session.close();
            }
        } catch (err: any) {
            const msg = err?.message ?? String(err);
            if (/Unsupported|community|multiple databases/i.test(msg)) {
                log.debug(`graph-db: create database skipped (community edition): ${msg}`);
            } else {
                log.error(`graph-db: createDB failed for '${sanitized}'`, err);
                throw err;
            }
        } finally {
            if (driver) await driver.close();
        }
    }

    public async closeAll(): Promise<void> {
        await Promise.all(Array.from(this.drivers.entries()).map(([, driver]) => driver.close()));
        this.drivers.clear();
    }
}

const dbInstance = DB.getInstance();
export { credentials, db, dbInstance as DB, result };
