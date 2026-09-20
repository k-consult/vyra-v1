---
name: graph-spine
description: Neo4j coding standard for the agentic-grc platform — Cypher patterns, parameterisation, MERGE vs CREATE idempotency, naming conventions, `lib/graph-db` call shape, banned-pattern gate. INVOKE before writing any Cypher, db call, or graph schema change. Pairs with `.design/graph.md` (schema ground truth) and `clean-code` (general dev conventions).
---

# graph-spine — Neo4j Coding Standard

Strict rules. Apply to every Cypher query and every database call in `api/`, `agents/`, and `cli/`.
If existing code violates a rule, apply the rule to new/changed code and surface the gap.

---

## 1. Driver handle — always lazy, always via `lib/graph-db`

Never capture the driver at module load time. Every `repo.ts` (or agent tool file) declares a lazy handle at the top, going through `DB.get` from `lib/graph-db` with credentials from `lib/config`:

```ts
import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});
```

```ts
// ❌ BAD — singleton captured at import time
const db = DB.get(config.db.twin.database, { uri, user, password });
```

`DB` itself is a singleton connection-pool manager (`lib/graph-db/index.ts`) — it caches drivers per database name internally. The lazy `db()` wrapper in each repo file is still required so nothing resolves credentials before `dotenv.config()` has run.

---

## 2. Call shape — `fetch`/`fetch2` for reads, `exec`/`exec2` for writes

`lib/graph-db`'s `db()` returns exactly four methods, each taking `(cypher: string, args?: any)` — **two arguments, nothing more**:

| Helper | Access mode | Use for |
|---|---|---|
| `db().fetch(cypher, args)` | READ session | Reads. `fetch2` is a plain alias for `fetch` today — prefer `fetch2` for new code since it's what the codebase already converges on. |
| `db().exec(cypher, args)` | WRITE session | Writes (CREATE/MERGE/SET/DELETE). |
| `db().exec2(cypher, args)` | WRITE session | Same as `exec` — alias. Prefer `exec2` for writes that return data. |

```ts
// ❌ BAD — third argument doesn't exist on this project's DB interface
await db().fetch(cypher, { id }, !verbose);

// ✅ GOOD — exactly two arguments
await db().fetch2(cypher, { id });
```

There is no `skipLog`/`verbose` flag on this interface — logging is handled internally by `graph-db` via `log.cypher(...)`. Don't invent a third parameter.

---

## 3. Parameterise everything

No caller value may be interpolated into a Cypher string with `${}`. Use named parameters exclusively.

```ts
// ❌ BAD — injection-prone; Neo4j plan cache is poisoned
const cypher = `MATCH (n:${label}) WHERE n.id = "${id}" RETURN n`;

// ✅ GOOD — value is a parameter; label from a module-level constant only
const cypher = `MATCH (n:Regulation) WHERE n.id = $id RETURN n`;
await db().fetch2(cypher, { id });
```

**The only exception:** node labels and relationship types sourced from **module-level constants** (not caller input) may be interpolated. Never interpolate a value that arrives from outside the module.

---

## 4. Name queries as UPPER_SNAKE constants

Pre-define every Cypher string as a named constant at module scope — never an anonymous inline template literal. This is the existing convention across every `api/modules/*/repo.ts` and `agents/tools/*.ts`.

```ts
// ❌ BAD — anonymous; cannot grep, cannot reuse
const rows = await db().fetch2(`MATCH (n:Regulation) RETURN properties(n) AS regulation`, {});

// ✅ GOOD — named constant at module scope
const LIST_REGULATIONS = `
    MATCH (n:Regulation)
    RETURN properties(n) AS regulation
    ORDER BY n.name
`;
const rows = await db().fetch2(LIST_REGULATIONS, {});
```

If a query is used in more than one function, hoist it to module scope (the norm). Multi-hop traversals used once are still declared as a named `const` above the function, not inline.

---

## 5. MERGE over CREATE for idempotent writes

Any node with a stable key (`id`) must be upserted with `MERGE`, not `CREATE`. `CREATE` always inserts; retrying it creates duplicates. This is the pattern used throughout `agents/tools/graph-write.ts`:

```ts
// ✅ GOOD — idempotent; safe to retry; relationship created in the same statement
const cypher = `
    MERGE (d:Decision {id: $id})
    ON CREATE SET
        d += $props,
        d.decidedAt = datetime(),
        d.status = 'pending'
    WITH d
    MATCH (src {id: $sourceId})
    MERGE (d)-[:ABOUT]->(src)
`;
```

Use `CREATE` only for nodes without a stable key (ephemeral log-style entries where duplicates are acceptable by design).

---

## 6. Naming conventions

### 6.1 Node labels — PascalCase

```cypher
// ✅
(:Regulation), (:Control), (:Finding), (:AssuranceStatement)

// ❌
(:regulation), (:CONTROL), (:audit_finding)
```

Catalog-synced reference data carries an extra `:Catalog` label (`(:Regulation:Catalog)`) — see `.design/graph.md`. Agent-written nodes may carry an `:AgentProposed` label. Never encode this as a boolean property.

### 6.2 Relationship types — UPPER_SNAKE_CASE

```cypher
// ✅
-[:IMPLEMENTS]->
-[:BELONGS_TO]->
-[:AGAINST]->

// ❌
-[:implements]->
-[:BelongsTo]->
```

Do not invent a new relationship type without checking `.design/graph.md`'s Canonical Relationship Types table and `cli/semantic-contract/contracts/v2.ts` first — that's the schema ground truth, not this file.

### 6.3 Properties — camelCase

```cypher
// ✅
n.createdAt, n.autonomyLevel, n.inherentScore

// ❌
n.created_at, n.CreatedAt
```

### 6.4 Query aliases — camelCase, intention-revealing

```cypher
// ✅
RETURN properties(n) AS regulation
RETURN properties(d) AS decision

// ❌
RETURN n
RETURN n AS x
```

---

## 7. Node identity and provenance fields

Per `.design/graph.md`'s Design Rules — there is **no soft-delete / `archived` convention** in this codebase. Don't add one from habit. Instead:

| Field | Applies to | Set on |
|---|---|---|
| `id` | every node | `MERGE` key, stamped by the writer (ingest pipeline or agent) |
| `createdAt` | every node | `ON CREATE SET`, via `datetime()` |
| `version` | every node | stamped by the writer where the schema tracks revisions |
| `agentId`, `autonomyLevel`, `confidence` | agent-generated nodes only (`Decision`, agent-proposed `Control`, etc.) | stamped by the agent tool at write time |

```ts
// ✅ GOOD — agent-write pattern from agents/tools/graph-write.ts
const cypher = `
    MERGE (f:Finding {id: $id})
    ON CREATE SET f += $props, f.detectedAt = datetime(), f.status = 'open'
    WITH f
    MATCH (ctl:Control {id: $controlId})
    MERGE (f)-[:AGAINST]->(ctl)
`;
```

---

## 8. Error handling

`async/await` + `try/catch`, matching every existing `repo.ts`. Writes always rethrow. Reads return a safe default (`[]`) so a list endpoint degrades instead of 500ing:

```ts
// Write — always rethrow
export const writeFinding = async (finding: Finding): Promise<void> => {
    try {
        await db().exec2(cypher, params);
    } catch (err: any) {
        log.error('graph-write: writeFinding failed', err.message);
        throw err;
    }
};

// Read — safe default
export const listRegulations = async () => {
    try {
        const raw: any = await db().fetch2(LIST_REGULATIONS, {});
        const rows = Array.isArray(raw) ? raw : [raw];
        return rows.map((r: any) => r.regulation).filter(Boolean);
    } catch (err: any) {
        log.error('knowledge.repo: listRegulations failed', err.message);
        return [];
    }
};
```

Never swallow errors from write operations. A failed write that returns silently is data loss.

**The `Array.isArray(raw) ? raw : [raw]` guard** is required after every `fetch2` call in this codebase — `getResult` in `lib/graph-db` flattens a single-row result to a bare object instead of a one-element array. Don't assume the result is always an array.

---

## 9. Cypher load order (bulk operations)

`cli/`'s ingestion pipeline enforces this order; never alter it, and never write ad-hoc migration Cypher that violates it:

1. **Indexes / constraints** (`cli/cypher/indexes.cypher`, `constraints.cypher`) — must exist before nodes are created
2. **Nodes** — all node CSVs loaded before any edge CSV
3. **Edges** — nodes at both ends must already exist

---

## 10. Banned patterns

| ❌ Bad | ✅ Fix |
|--------|--------|
| `const db = DB.get(...)` at module scope | `const db = () => DB.get(...)` |
| `db().fetch(cypher, args, skipLog)` — third argument | `db().fetch2(cypher, args)` — two arguments only |
| Template literal interpolation of caller values | Named `$param` in Cypher |
| Anonymous Cypher string as a direct argument | Named `const` before the call |
| `CREATE` on a node with a stable `id` | `MERGE ... ON CREATE SET` |
| Labels in camelCase or snake_case | PascalCase |
| Relationship types in camelCase | UPPER_SNAKE_CASE |
| `WHERE NOT n.archived` | Not a convention here — don't add a soft-delete filter that doesn't exist in the schema |
| Write error swallowed (catch returns `[]` or `{}`) | Rethrow; safe defaults for reads only |
| Assuming `fetch2` always returns an array | Guard with `Array.isArray(raw) ? raw : [raw]` |
| Inventing a new relationship type ad hoc | Check `.design/graph.md` + `v2.ts` first; raise as a schema decision |

---

## 11. Verification — run before commit

```bash
# Captured DB handle (must be a factory function)
grep -rnE 'const\s+db\s*=\s*DB\.get\(' api/ agents/ cli/

# Cypher template-literal interpolation of a non-constant value
grep -rnE '`[^`]*\$\{[a-z][^}]*\}[^`]*`' api/ agents/ cli/ | grep -iE 'MATCH|MERGE|CREATE|RETURN|WHERE'

# Third argument on fetch/exec calls (not part of this project's DB interface)
grep -rnE '\.(fetch2?|exec2?)\([^,]+,[^,]+,' api/ agents/ cli/

# CREATE on a node — flag for review (may need MERGE)
grep -rnE '\bCREATE\s+\(' api/ agents/ cli/ --include='*.ts' --include='*.cypher'
```

---

## Checklist

- [ ] DB handle is a lazy factory (`const db = () => DB.get(...)`)?
- [ ] All caller values are `$named` parameters — no `${}` interpolation?
- [ ] Every Cypher string is a named `UPPER_SNAKE` const?
- [ ] Calls to `fetch`/`fetch2`/`exec`/`exec2` take exactly two arguments?
- [ ] Idempotent nodes use `MERGE ... ON CREATE SET`?
- [ ] Node labels PascalCase, relationship types UPPER_SNAKE_CASE, properties camelCase?
- [ ] New relationship type checked against `.design/graph.md` + `v2.ts` before use?
- [ ] Write errors rethrow; reads return a safe default (`[]`) with `Array.isArray` guard on `fetch2` results?
- [ ] Bulk load order: indexes → nodes → edges?

---

## Paired skill and doc

- `.design/graph.md` — schema ground truth: node/relationship types, which are live vs. dormant vs. blueprint-only
- `clean-code` — general design/dev conventions this project layers on top of (module shape, naming, functional style)
