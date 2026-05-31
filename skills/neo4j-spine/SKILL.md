---
name: neo4j-spine
description: Neo4j structural coding standard (neo4j-spine). Covers Cypher query patterns, parameterisation rules, lazy driver handles, MERGE vs CREATE idempotency, node/relationship naming conventions, read vs write helpers, and a banned-pattern gate. INVOKE before writing any Cypher, any db.fetch/exec call, or any graph schema change. Pairs with `node-spine` (module structure) and `clean-code` (design principles).
---

# neo4j-spine — Neo4j Coding Standard

Strict rules. Apply to every Cypher query and every database call.
If existing code violates a rule, apply the rule to new/changed code and surface the gap.

---

## 1. Driver handle — always lazy

Never capture the driver at module load time. Wrap it in a factory function so tests can swap it and the module does not hold a connection at require-time.

```js
// ❌ BAD — singleton captured at require; breaks test isolation
const db = driver.get('my-db');

// ✅ GOOD — factory; resolved on first call
const db = () => driver.get('my-db');
```

The lazy handle is the only form permitted. Every repo file must declare it at the top.

---

## 2. Parameterise everything

No caller value may be interpolated into a Cypher string with `${}`. Use named parameters exclusively.

```js
// ❌ BAD — injection-prone; Neo4j plan cache is poisoned
const cypher = `MATCH (n:${label}) WHERE n.id = "${id}" RETURN n`;

// ✅ GOOD — value is a parameter; label from a constant only
const LABEL = 'Recipe';
const cypher = `MATCH (n:${LABEL}) WHERE n.id = $id RETURN n`;
await db().fetch(cypher, { id }, !verbose);
```

**The only exception:** node labels and relationship types sourced from **module-level constants** (not caller input) may be interpolated. Never interpolate a value that arrives from outside the module.

---

## 3. Name queries as constants

Pre-define every Cypher string as a named constant. Anonymous inline strings make queries unsearchable and untestable.

```js
// ❌ BAD — anonymous; cannot grep, cannot reuse
const rows = await db().fetch(`MATCH (r:Recipe {uuid: $uuid}) RETURN r`, { uuid });

// ✅ GOOD — named constant at module scope (reused) or top of function (single use)
const GET = `
    MATCH (r:Recipe {uuid: $uuid})
    WHERE NOT r.archived
    RETURN properties(r) AS recipe
`;
const rows = await db().fetch(GET, { uuid }, !verbose);
```

If a query is used in more than one function, hoist it to module scope. If used once, declare it as a `const` at the top of that function — never as an anonymous argument.

---

## 4. Read vs write helpers

| Operation | Helper | Returns |
|-----------|--------|---------|
| Read (SELECT) | `db().fetch(q, params, skipLog)` or `db().fetch2(q, params)` | Array of row objects |
| Write (CREATE / MERGE / SET / DELETE) | `db().exec(q, params)` | void / status |
| Write returning data | `db().exec2(q, params)` | Result object |

Rules:
- `fetch2` is preferred for reads — `skipLog` defaults to `true`, reducing noise.
- `exec` for writes that return nothing; `exec2` for writes that return the created/updated node.
- Never use `fetch` for a write or `exec` for a read.

---

## 5. MERGE over CREATE for idempotent writes

Any node that has a unique key (uuid, id, code) must be upserted with `MERGE`, not `CREATE`. `CREATE` always inserts; retrying it creates duplicates.

```cypher
// ❌ BAD — duplicate on retry
CREATE (r:Recipe {uuid: $uuid}) SET r += $props

// ✅ GOOD — idempotent; safe to retry
MERGE (r:Recipe {uuid: $uuid})
ON CREATE SET r += $props, r.createdAt = datetime(), r.archived = false
ON MATCH  SET r.updatedAt = datetime()
```

Use `CREATE` only for nodes without a stable key (e.g. ephemeral log entries where duplicates are acceptable by design).

---

## 6. Naming conventions

### 6.1 Node labels — PascalCase

```cypher
// ✅
(:Recipe), (:User), (:CatalogItem), (:RiskControl)

// ❌
(:recipe), (:RECIPE), (:catalog_item)
```

### 6.2 Relationship types — UPPER_SNAKE_CASE

```cypher
// ✅
-[:BELONGS_TO]->
-[:CREATED_BY]->
-[:REFERENCES]->

// ❌
-[:belongsTo]->
-[:BelongsTo]->
```

### 6.3 Properties — camelCase

```cypher
// ✅
r.createdAt, r.archivedBy, r.catalogVersion

// ❌
r.created_at, r.CreatedAt, r.CREATED_AT
```

### 6.4 Query aliases — camelCase, intention-revealing

```cypher
// ✅
RETURN properties(r) AS recipe
RETURN r.uuid AS uuid, r.name AS name

// ❌
RETURN r
RETURN r AS x
```

---

## 7. Audit and soft-delete fields

Every node that has a lifecycle must carry audit fields. Stamp them in the repo — never expect the caller to supply them.

| Field | Type | Set on |
|-------|------|--------|
| `createdAt` | `datetime()` | `ON CREATE` |
| `createdBy` | string (user identifier) | `ON CREATE` |
| `updatedAt` | `datetime()` | `ON MATCH SET` / update queries |
| `updatedBy` | string | update queries |
| `archived` | boolean | `ON CREATE SET false`; set `true` on archive |
| `archivedAt` | `datetime()` | archive query |
| `archivedBy` | string | archive query |

Reads must filter `WHERE NOT r.archived` unless the caller explicitly requests archived records.

---

## 8. Error handling

Follow the same pattern as `node-spine`: `async/await` + `try/catch`. Log with context, then rethrow for writes; return a safe default for non-critical reads.

```js
// Write — always rethrow
exports.save = async (node, user) => {
    try {
        return await db().exec2(SAVE, { node, user });
    } catch (err) {
        log.error(`recipe: save failed ${node.uuid}`, err.message);
        throw err;
    }
};

// Non-critical read — safe default
exports.list = async () => {
    try {
        const rows = await db().fetch2(LIST, {});
        return R.pluck('recipe', rows);
    } catch (err) {
        log.error('recipe: list failed', err.message);
        return [];
    }
};
```

Never swallow errors from write operations. A failed write that returns silently is data loss.

---

## 9. Cypher load order (for bulk operations)

When loading a graph from scratch or running migrations, always apply in this order:

1. **Indexes / constraints** — must exist before nodes are created
2. **Nodes** — create all nodes before creating edges
3. **Edges / relationships** — nodes at both ends must already exist

Violating this order causes constraint errors or dangling relationships.

---

## 10. Banned patterns

| ❌ Bad | ✅ Fix |
|--------|--------|
| `const db = driver.get(...)` at module scope | `const db = () => driver.get(...)` |
| Template literal interpolation of caller values | Named `$param` in Cypher |
| Anonymous Cypher string as direct argument | Named `const` before the call |
| `CREATE` on a node with a unique key | `MERGE ... ON CREATE SET` |
| Labels in camelCase or snake_case | PascalCase |
| Relationship types in camelCase | UPPER_SNAKE_CASE |
| Reads without `WHERE NOT r.archived` | Add the filter unless archived records are intentional |
| Write error swallowed (catch returns `[]` or `{}`) | Rethrow; safe defaults for reads only |
| Audit fields supplied by caller | Stamp `createdAt`, `updatedAt`, etc. in the repo |

---

## 11. Verification — run before commit

```bash
# Captured driver handle (must be a factory function)
grep -rnE 'const\s+db\s*=\s*[a-zA-Z]+\.get\(' .

# Cypher template-literal interpolation of non-constant values
grep -rnE '`[^`]*\$\{[a-z][^}]*\}[^`]*`' . | grep -iE 'MATCH|MERGE|CREATE|RETURN|WHERE'

# Anonymous Cypher string (no named const before db() call)
# Manual review: every db().fetch/exec call should reference a named const, not a template literal

# CREATE on a node — flag for review (may need MERGE)
grep -rnE '\bCREATE\s+\(' . --include='*.cypher' --include='*.ts' --include='*.js'
```

---

## Checklist

- [ ] Driver handle is a factory function (`const db = () => ...`)?
- [ ] All caller values are `$named` parameters — no `${}` interpolation?
- [ ] Every Cypher string is a named `const` before the call?
- [ ] Idempotent nodes use `MERGE ... ON CREATE SET`?
- [ ] Node labels PascalCase, relationship types UPPER_SNAKE_CASE, properties camelCase?
- [ ] Audit fields (`createdAt`, `createdBy`, `updatedAt`, `updatedBy`) stamped in repo?
- [ ] `archived = false` set on create; reads filter `WHERE NOT r.archived`?
- [ ] Write errors rethrow; only non-critical reads return safe defaults?
- [ ] Bulk load order: indexes → nodes → edges?
