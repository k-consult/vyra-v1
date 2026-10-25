import { AsyncLocalStorage } from 'async_hooks';

// Per-request override of which Neo4j database a request targets — isolated per
// async call graph via Node's AsyncLocalStorage, not a shared mutable global.
// Mutating a shared `config.db.twin.database` directly would race across concurrent
// requests in the same process (request A could read/write request B's database
// mid-flight); AsyncLocalStorage scopes the override to exactly the call graph
// rooted at the run() invocation, so concurrent requests never see each other's
// override. See api/API.ts's onRequest hook for where this is set.
const storage = new AsyncLocalStorage<string>();

export const run = <T>(databaseName: string, fn: () => T): T => storage.run(databaseName, fn);

export const getOverride = (): string | undefined => storage.getStore();
