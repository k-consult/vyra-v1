---
name: api-route-spine
description: Canonical API contract lookup and module structure for the agentic-grc platform's Fastify `api/` workspace — where routes live, how modules register, and where the UI's single client (`ui/src/lib/api.ts`) calls them. INVOKE for any `/api/<domain>` route lookup, adding a new endpoint, or "how do I call the X API" question.
---

# api-route-spine — API Module Standard

`api/` is a single Fastify app (port 4001, `api/index.ts` + `api/API.ts`), not a separate repo. Every route lives in one of eight domain modules under `api/modules/`. There is no Bruno collection, no `routes.txt`, no `.design/<resource>.md` contract file — the source of truth is the module's `index.ts` (routes) plus `ui/src/lib/api.ts` (the one and only UI client).

---

## 1. Module layout

```
api/
├── index.ts                        # imports every module, starts the Fastify app
├── API.ts                          # thin class: registers modules, starts listener
├── types.ts                        # Module = FastifyPluginAsync & { prefix: string }
└── modules/
    └── <domain>/
        ├── index.ts                # Fastify plugin — route definitions only
        └── repo.ts                 # Cypher queries — see `graph-spine`
```

Current domains (each is one module, one prefix): `knowledge`, `execution`, `operational`, `intelligence`, `assurance`, `dashboard`, `catalog`, `enterprise`.

---

## 2. Looking up a route

1. Open `api/modules/<domain>/index.ts` — every `fastify.get(...)` / `fastify.post(...)` call and the module's `.prefix` are right there, in full. There is no separate contract file to reconcile against.
2. The full path is `<module.prefix><route path>`. Example: `knowledge.prefix = '/knowledge'` + `fastify.get('/trace/:id', ...)` → `GET /knowledge/trace/:id`. No further mount prefix — `api/API.ts` registers each module directly, unprefixed by anything else.
3. For the response shape and query params actually in use from the UI today, read `ui/src/lib/api.ts` — it's a single flat file with one exported object per domain (`knowledge`, `execution`, `operational`, `intelligence`, ...), each a map of typed call functions. This is the authoritative, currently-exercised contract.
4. For what the route actually returns, read the corresponding function in `api/modules/<domain>/repo.ts`.

```ts
// api/modules/knowledge/index.ts — the whole contract, no paraphrase needed
const knowledge: any = async (fastify: FastifyInstance) => {
    fastify.get('/regulations', async (_req, reply) => {
        reply.send({ regulations: await listRegulations() });
    });
    fastify.get('/trace/:id', async (req: any, reply) => {
        const { id } = req.params;
        reply.send({ regulationId: id, chain: await traceForward(id) });
    });
};
knowledge.prefix = '/knowledge';
export default knowledge;
```

---

## 3. Adding a new route

1. **New domain?** Create `api/modules/<domain>/index.ts` + `repo.ts`, then add the import + entry to the `modules` array in `api/index.ts`. No other wiring exists — no master router, no auto-discovery.
2. **Existing domain, new route:** add a `fastify.get`/`fastify.post` call in that module's `index.ts`. Fixed-segment routes should still be registered before `:param` routes at the same depth (Fastify's router is trie-based and largely order-independent, but keep the convention for readability and to avoid ambiguous overlaps).
3. **Handler shape** — this codebase does not use the edge/core/factory/spec/repo split. A handler does exactly two things:
   - `await` one function imported from the sibling `repo.ts`
   - `reply.send({ <namedKey>: result })` — always a named top-level key (`{ regulations: [...] }`, not a bare array), so the UI never has to guess the shape
4. **No try/catch in the handler.** `repo.ts` functions already catch internally: reads return `[]` on failure (handler still replies 200 with an empty list), writes rethrow (Fastify's default error handler turns it into a 500). See `graph-spine` §8 for the repo-side pattern.
5. **Add the client function** to `ui/src/lib/api.ts` under the matching domain object, using the shared `get`/`post` helpers already defined at the top of that file. This is the only UI-side wiring needed — there's no generated client, no codegen step.
6. **Persistence** goes in `repo.ts` per `graph-spine`, not in the route handler.

```ts
// ui/src/lib/api.ts — add alongside the domain's existing entries
export const knowledge = {
    regulations: () => get<{ regulations: any[] }>('/knowledge/regulations'),
    newThing:    (id: string) => get<{ thing: any }>(`/knowledge/new-thing/${id}`),
};
```

---

## 4. Anti-patterns

- ❌ Inventing a Bruno collection, `routes.txt`, or `.design/<resource>.md` file — none of that machinery exists in this repo; don't create it speculatively.
- ❌ Assuming a sibling `api` repo or a `mounts-at` prefix beyond the module's own `.prefix` — `api/` is a workspace in this monorepo, registered directly.
- ❌ Guessing a route or body shape from training data on other API conventions (Koa, Express routers, REST scaffolds). Read `api/modules/<domain>/index.ts` and `ui/src/lib/api.ts` — they are the whole contract.
- ❌ Adding validation, auth checks, or business rules in the route handler — this app currently has no auth layer on these routes and no factory/spec split; don't introduce one speculatively as part of an unrelated route change.
- ❌ Calling `repo.ts` functions directly from `ui/` — always through the Fastify route, never bypass the API boundary (`lib/graph-db` is server-side only; the UI has no Neo4j credentials).
- ❌ Returning a bare array or unnamed value from a handler (`reply.send([...])`) — always a named key, matching the existing modules.

---

## What this skill does NOT do

- Modify Cypher or persistence logic — that's `graph-spine`.
- Cover Neo4j schema, node/relationship types — see `.design/graph.md`.
- Cover general TypeScript/functional-style conventions — that's `clean-code`.

## Paired skills

- `graph-spine` — the `repo.ts` half of every module (Cypher rules, `db()` call shape)
- `clean-code` — general dev conventions (naming, functional style, error handling) applied inside `index.ts`/`repo.ts`
