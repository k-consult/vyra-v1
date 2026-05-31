---
name: node-spine
description: Node.js structural coding standard (node-spine). Mandates the module spine (edge → core → repo) with per-resource folders, factory.js + spec.js + repo.js per entity, file=noun / method=verb naming (no Async/Sync/Promise suffixes), async/await with try-catch, lazy db handles, parameterised Cypher, Boom for HTTP errors, and a banned-pattern + grep verification gate. INVOKE BEFORE every Edit/Write under app/, scripts/, index-*.js, test/. If the request can't be mapped onto edge → core/index → factory + spec + repo, redesign before coding.
---

# node-spine — Node.js Coding Standard

Strict rules. Follow on every code change.
If existing code violates a rule, follow the rule for new/changed code and call out the inconsistency in your reply — don't silently propagate violations.

---

## 0. When to invoke

This skill is the gate for any code change in the repo.

- **Required** before any Edit/Write tool call under `app/`, `src/`, `scripts/`, `index-*.js`, `test/`.
- If you can't map the request onto **edge → core/index → factory + spec + repo** (Section 2), redesign before coding.
- If a rule conflicts with existing code, apply the rule to the new lines and surface the gap.

Skip only for: vendored code under `node_modules/`, generated artifacts, `dist/`, third-party plugin source.

---

## 1. The Spine — Module Layout

**This is the load-bearing rule. Everything else is detail.**

The structure below is the canonical seed. New modules MUST follow this spine; existing modules MUST move toward it on touch.

```
app/module/<module>/
├── index.js                      # module entry — exports init()
├── edge/                         # I/O surface (HTTP & CLI)
│   ├── api/
│   │   ├── index.js              # mounts the master router into a Koa app and exports it
│   │   ├── router.js             # master router — composes per-resource routers
│   │   ├── <resource>/           # one folder per resource (recipes, catalog, …)
│   │   │   ├── index.js          # exports { router, … } for this resource
│   │   │   ├── router.js         # resource sub-router; fixed paths before :param paths
│   │   │   ├── <resource>.js     # handlers (one file; split only when truly large)
│   │   │   └── test/
│   │   │       └── routes-collection.json   # Bruno/Postman import for the resource
│   │   └── ...
│   └── cli/
│       └── index.js              # CLI command surface
├── core/                         # business logic (no I/O for factory & spec)
│   └── <entity>/                 # one folder per bounded resource
│       ├── index.js              # orchestrator — public verbs the edge calls
│       ├── factory.js            # entity factory — static `create` + builders/normalisers (pure)
│       ├── spec.js               # validation rules — sync checks + async db-aware checks
│       └── repo.js               # persistence (Cypher, db.fetch / exec*)
└── lib/                          # cross-cutting helpers private to this module
```

**One spec.js per entity, one factory.js per entity, one repo.js per entity.** All methods for a given concern live in that single file — do not split into `recipe-name-spec.js`, `recipe-tags-spec.js`, etc.

Existing modules may use older naming conventions (`<r>-spec.js`, `domain-entity.js`) or merge domain rules into `core/<r>/index.js`. **Treat these as legacy, not the target.** New modules use the spine above. When touching a legacy file, prefer moving it toward the spine in the same change.

---

## 2. Layer Boundaries — strict, single-direction

Each arrow is a hard wall. Cross it and the module is broken.

```
edge ──► core/<entity>/index ──► core/<entity>/factory    (pure shape; static create)
                            ├─► core/<entity>/spec        (rules; sync + async; throws meaningful errors)
                            └─► core/<entity>/repo        (db + log only)
```

| Layer                                | May import                                                          | MUST NOT contain                                                       |
|--------------------------------------|---------------------------------------------------------------------|------------------------------------------------------------------------|
| `edge/api/router.js` (master)        | per-resource routers (`<resource>/index`)                           | Cypher, db calls, business rules, handler logic                        |
| `edge/api/<resource>/router.js`      | own handler module, boom                                            | Cypher, db calls, business rules                                       |
| `edge/api/<resource>/<resource>.js`  | core/<entity>/index only                                            | Cypher, db, peer-resource repos, try/catch around core calls           |
| `edge/cli/index.js`                  | core/<entity>/index only                                            | Cypher, db                                                             |
| `core/<entity>/index.js`             | own `factory`, own `spec`, own `repo`, peer `core/<other>/index`    | Cypher, raw db handles, peer-resource `repo.js` or `spec.js`           |
| `core/<entity>/factory.js`           | ramda / util only                                                   | db, log, fs, network — pure                                            |
| `core/<entity>/spec.js`              | own `repo` (for async checks), ramda, boom                          | route handlers, persistence writes, peer-resource imports              |
| `core/<entity>/repo.js`              | `@lib/db`, `@lib/log`, ramda                                | route handlers, business rules, peer cores                             |

**Violations to flag immediately:** edge → repo, repo → repo, core/index containing Cypher, factory importing log/db, spec writing to db, spec throwing generic `Error('invalid')` without context.

---

## 3. The Edge Layer

### 3.1 `edge/api/index.js`

Single responsibility: mount the master `router.js` into a Koa app and export it.

```js
const Koa = require('koa');
const convert = require('koa-convert');
const router = require('./router');

module.exports = new Koa()
    .use(router.routes())
    .use(convert(router.allowedMethods()));
```

### 3.2 `edge/api/router.js` — the master router

- **Exactly one master router per module.** It exposes the module's HTTP surface; sub-routes are owned by per-resource routers and composed in here. Studio has one; new modules follow suit.
- The master router does not know about handlers or Cypher. Its only job is to mount each resource's router.
- Build with `koa-router`. Compose by `.use(resource.router.routes())`.

```js
const Router = require('koa-router');
const recipes = require('./recipes');   // resource folder
const catalog = require('./catalog');   // resource folder

module.exports = new Router()
    .use(recipes.router.routes())
    .use(catalog.router.routes());
```

### 3.3 `edge/api/<resource>/` — per-resource folder

Each resource (recipes, catalog, favorites, …) owns its own folder. Layout:

```
edge/api/<resource>/
├── index.js              # exports { router } (and any helpers the master needs)
├── router.js             # resource sub-router; fixed paths before :param paths
├── <resource>.js         # handler functions (split only when truly large)
└── test/
    └── routes-collection.json   # importable into Bruno / Postman
```

**`<resource>/router.js` rules:**
- **Fixed paths before parameterised paths.** `.get('/recipes/sources', …)` MUST come before `.get('/recipes/:uuid', …)`.
- Routes for this resource only. No cross-resource routing in here — that's what the master router is for.
- Update `edge/api/routes.txt` (when present) in the same change. Drift between the two is a defect.

```js
// edge/api/recipes/router.js
const Router = require('koa-router');
const recipe = require('./recipes');     // sibling handler file

module.exports = new Router()
    // fixed paths first
    .post('/recipes', recipe.create)
    .get('/recipes/:recipeType/schema', recipe.getSchema)
    // then parameterised paths
    .get('/recipes/:uuid', recipe.get)
    .get('/recipes', recipe.list);
```

```js
// edge/api/recipes/index.js
exports.router = require('./router');
```

**`<resource>/test/routes-collection.json` rules:**
- One file per resource, importable into Bruno or Postman.
- Keep it in sync with `router.js` — when you add/rename/remove a route, update the collection in the same change.
- Include sample request bodies, headers, and an `auth` placeholder for the local dev token.

### 3.4 `edge/api/<resource>/<resource>.js` — handlers

A handler does **only four things, in order**:

1. Identity check: `const user = ctx.getState(_const.state.user); if (R.isNil(user)) throw boom.unauthorized();`
2. Unpack `ctx.params`, `ctx.body`, `ctx.query`.
3. `await` exactly **one** core call.
4. Set `ctx.body` and `ctx.status` (`200` on data, `204` on empty success).

**No try/catch.** Errors bubble; the framework + repo logging handle them.

**Auth vs validation split:** the handler does identity check only — "is there a user?". Payload shape, allowed values, business validity — all in `factory.js` + `spec.js`. If you find yourself writing `if (!body.name) throw …` in a handler, move it into the factory or spec.

```js
const R = require('ramda');
const boom = require('boom');
const _const = require('../../../../app-constants');   // intra-module: relative is correct
const recipe = require('../../../core/recipe');        // intra-module: relative is correct

exports.get = async (ctx) => {
    const user = ctx.getState(_const.state.user);
    if (R.isNil(user)) throw boom.unauthorized();
    ctx.body = await recipe.get(ctx.params.uuid, user);
    ctx.status = 200;
};

exports.archive = async (ctx) => {
    const user = ctx.getState(_const.state.user);
    if (R.isNil(user)) throw boom.unauthorized();
    await recipe.archive(ctx.params.uuid, user);
    ctx.status = 204;
};
```

### 3.5 `edge/cli/index.js`

CLI commands are a parallel edge — same rule: parse args, call **one** core verb, print result. No business logic in CLI.

---

## 4. The Core Layer

### 4.1 `core/<entity>/index.js` — orchestrator

- Public exports = the verbs the edge calls: `create`, `get`, `update`, `archive`, `list`, …
- Each verb composes three peers: `factory` (shape) → `spec` (rules) → `repo` (persist).
- **Order matters**: build via factory first (so the spec sees the canonical shape), then sync rules, then async rules (db hits), then persist.
- **Never** imports a peer resource's `repo.js`. Cross-resource access goes through that resource's `core/<other>/index.js`.
- Strategy/plugin registries live as sibling folders (e.g. `core/<entity>/providers/<type>/`); add a new strategy by adding a new folder, never by editing existing ones (OCP).

```js
const repo = require('./repo');
const factory = require('./factory');
const spec = require('./spec');

exports.create = async (input, user) => {
    const recipe = factory.create(input);          // pure build via factory
    spec.isValid(recipe);                          // sync rules; throws on bad
    await spec.isAllowed(recipe, { user });        // db rules (uniqueness, references)
    return repo.save(recipe, user);
};

exports.update = async (uuid, input, user) => {
    const patch = factory.update(input);
    spec.isValidPatch(patch);
    await spec.isPatchAllowed(uuid, patch, { user });
    return repo.update(uuid, patch, user);
};

exports.archive = async (uuid, user) => {
    return repo.archive(uuid, user);
};
```

### 4.2 `core/<entity>/factory.js` — entity factory

- **Factory creates entities — nothing else.** No constants, no enums, no allowed-value lists. If a constant is only consumed by validation, it lives in `spec.js`. If it's shared across layers, hoist it to a sibling `constants.js` (or `<entity>-constants.js`). Factory doesn't export them.
- **Pure functions only.** No `db`, no `log`, no `fs`, no network, no `boom` — this file is a builder, not a validator.
- **Static factory method:** every entity exposes `factory.create(input)` that returns a fully-formed, normalised entity ready for the spec to validate.
- Owns: defaults, normalisation, derived fields, immutable-field stripping, builder helpers (`update`, `fromRow`, …).
- Doesn't decide *valid vs invalid* — that's `spec.js`. Doesn't speak HTTP — that's `boom`'s job in the spec.
- File-internal layout: low-level builders → public factory methods (`create`, `update`, …) at the bottom.

```js
const R = require('ramda');

const trimOr = (fallback, s) => R.trim(s || fallback);

// Static factory method — builds a fully-formed entity from caller input.
exports.create = (input) => ({
    name: trimOr('Untitled', input.name),
    description: input.description || `${input.type} recipe`,
    type: input.type,
    tags: R.uniq(input.tags || []),
    value: input.value,
});

// Patch builder — strips immutable fields.
exports.update = (input) =>
    R.pick(['name', 'description', 'tags', 'value'], input);
```

### 4.3 `core/<entity>/spec.js` — validation rules

**One spec.js per entity. All validation methods live here.** Do not split into `recipe-name-spec.js`, `recipe-tags-spec.js`, etc.

The spec answers a single question for a built entity: **is this allowed to land in the system?** Two surfaces:

- **`isValid(entity)`** — synchronous, pure-input checks. Returns `true` on success, **throws a meaningful exception** on failure.
- **`isAllowed(entity, ctx)`** — asynchronous, db-aware checks (uniqueness, foreign-key existence, quota, conflict). Returns `true` on success, throws on failure.

> **Naming — spec methods are predicates.** Every spec method name MUST start with `is` or `has`. Verb-first names (`verify`, `validate`, `check`, `ensure`) are **forbidden in `spec.js`**. The method still throws on failure; only the *name* must be interrogative.
>
> | ❌ Forbidden        | ✅ Use                                 |
> |---------------------|----------------------------------------|
> | `verify(...)`       | `isAllowed(...)` / `isUnique(...)` / `isAvailable(...)` |
> | `validate(...)`     | `isValid(...)`                         |
> | `check(...)`        | `hasNoConflicts(...)` / `isAllowed(...)` |
> | `ensureUnique(...)` | `isUnique(...)`                        |
>
> **And no language-construct suffixes** (`Async`, `Sync`, `Promise`, `Callback`). `isValidAsync` → `isAllowed`.

Rules:

- **Throw with context, not vibes.** Every error message names the field, the rule that failed, and the actual offending value. `boom.badRequest('name is required')` is too thin; prefer `boom.badRequest(\`name must be 1–200 chars; got "" (length 0)\`)`.
- **Throw `boom.*` directly** — that's the contract the edge already understands. The api edge surfaces them as 4xx; the cli edge can format them for stderr. No custom error class needed.
- **The spec MAY read from its own `repo.js`** for async checks. It MUST NOT write, and MUST NOT touch peer modules' repos.
- **Sync first, async second** in the orchestrator — never burn a db round-trip when a cheap predicate would have rejected.
- **No silent normalisation in the spec.** If something needs trimming/lowercasing, that's `factory.js` work. Spec only validates.
- **Spec methods are predicates.** Names start with `is` or `has` (`isValid`, `isAllowed`, `isUnique`, `hasNoConflicts`). No imperative verbs (`verify`, `validate`, `check`, `ensure`).
- **No language-construct suffixes on method names** (`Async`, `Sync`, `Promise`, …). The signature is already async — the name doesn't need to repeat it.

```js
const R = require('ramda');
const boom = require('boom');
const repo = require('./repo');

const NAME_MIN = 1;
const NAME_MAX = 200;
const TAG_MAX = 32;
const VALID_TYPES = ['query', 'pipeline'];

// ---- predicates ----------------------------------------------------------
const isBlank = (s) => R.isNil(s) || R.trim(s) === '';
const isLengthOK = (min, max, s) => s.length >= min && s.length <= max;

// ---- public sync surface -------------------------------------------------
exports.isValid = (recipe) => {
    if (isBlank(recipe.name)) {
        throw boom.badRequest(
            `name must be ${NAME_MIN}–${NAME_MAX} chars; got "" (length 0)`
        );
    }
    if (!isLengthOK(NAME_MIN, NAME_MAX, recipe.name)) {
        throw boom.badRequest(
            `name must be ${NAME_MIN}–${NAME_MAX} chars; got "${recipe.name}" (length ${recipe.name.length})`
        );
    }
    if (!R.includes(recipe.type, VALID_TYPES)) {
        throw boom.badRequest(
            `type must be one of [${VALID_TYPES.join(', ')}]; got "${recipe.type}"`
        );
    }
    if (R.any((t) => t.length > TAG_MAX, recipe.tags)) {
        const offender = R.find((t) => t.length > TAG_MAX, recipe.tags);
        throw boom.badRequest(`tag exceeds ${TAG_MAX} chars: "${offender}"`);
    }
    return true;
};

exports.isValidPatch = (patch) => {
    if (R.has('type', patch)) {
        throw boom.badRequest('type is immutable after creation');
    }
    if (R.has('name', patch)) exports.isValid({ ...patch, type: 'query' });
    return true;
};

// ---- public async surface (predicate names; no Async suffix) ------------
exports.isAllowed = async (recipe, { user }) => {
    if (await repo.existsByName(recipe.name, user)) {
        throw boom.conflict(`a recipe named "${recipe.name}" already exists`);
    }
    return true;
};

exports.isPatchAllowed = async (uuid, patch, { user }) => {
    if (R.has('name', patch)) {
        const clash = await repo.findByName(patch.name, user);
        if (clash && clash.uuid !== uuid) {
            throw boom.conflict(`a recipe named "${patch.name}" already exists`);
        }
    }
    return true;
};
```

**Why this split is worth it:**
- `factory` stays trivially unit-testable (pure inputs/outputs).
- `spec` reads as a checklist of *rules*, not a hairball of `if (!x) throw …`.
- Async db rules (uniqueness, references) live next to the sync ones in the same `spec.js`, so reviewers see all invariants in one file.
- The edge stays untouched — spec throws boom; the api edge ships it as a 4xx, the cli edge prints a clean message.

### 4.4 `core/<entity>/repo.js` — persistence

- **Lazy db handle:** `const db = () => dbClient.get('<dbName>');` — never a captured singleton. Tests can swap; modules don't fight over connection state.
- **Verbose flag at the top:** `const verbose = process.env.VERBOSE === 'ON';` then pass `!verbose` as the `skipLog` argument.
- **Parameterise everything.** No template-literal interpolation of caller values into Cypher, ever.
- **Cypher placement:** if the query is reused, hoist to a module-level `const`. If used once, define it inline as `const cypher = …` at the top of the function. Either way, the query is a named constant — never an anonymous arg.
- **Standard error tail** (always async/await + try/catch — never `.then().catch()`):

  ```js
  try {
      const rows = await db().fetch(cypher, params, !verbose);
      return R.pluck('recipe', rows);
  } catch (err) {
      log.error('recipe: list failed', err.message);
      throw err;                          // or return [] for a non-critical read
  }
  ```

```js
const R = require('ramda');
const log = require('@lib/log');
const dbClient = require('@lib/db');
const uuid = require('uuid').v4;

const db = () => dbClient.get('<db-name>');
const verbose = process.env.VERBOSE === 'ON';

exports.save = async (recipe, user) => {
    const cypher = `
        MERGE (r:Recipe {uuid: $recipe.uuid})
        ON CREATE SET
            r += $recipe,
            r.createdAt = datetime(),
            r.createdBy = $user.name,
            r.archived = false
        RETURN r.uuid AS uuid
    `;
    const payload = R.assoc('uuid', uuid(), recipe);
    try {
        return await db().exec2(cypher, { recipe: payload, user }, !verbose);
    } catch (err) {
        log.error(`recipe: save failed ${recipe.name}`, err.message);
        throw err;
    }
};

exports.list = async () => {
    const cypher = `
        MATCH (r:Recipe) WHERE NOT r.archived
        RETURN properties(r) AS recipe
    `;
    try {
        const rows = await db().fetch(cypher, {}, !verbose);
        return R.pluck('recipe', rows);
    } catch (err) {
        log.error('recipe: list failed', err.message);
        return [];                          // safe default — non-critical read
    }
};
```

---

## 5. Cross-cutting Rules

### 5.1 Naming

- **Files = nouns.** `recipe.js`, `catalog.js`, `factory.js`, `spec.js`, `repo.js`, `router.js`. Folders too: `core/recipe/`, `core/favorite/`. Singular preferred; plural only for genuinely list-shaped utilities.
- **Methods = verbs** — *except* in `spec.js`. `create`, `save`, `find`, `archive`, `normalize`. Verb-first, always.
- **Spec methods are predicates, not verbs.** Every method in `spec.js` MUST start with `is` or `has`, followed by a test name (`isValid`, `isAllowed`, `isUnique`, `isAvailable`, `hasNoConflicts`). Imperative names (`verify`, `validate`, `check`, `ensure`) are forbidden in spec files — predicates read as the yes/no question the spec is answering. The method still throws on failure; only the *name* must be interrogative.
- **No language-construct suffixes on method names.** Forbidden: `*Async`, `*Sync`, `*Promise`, `*Callback`, `*Cb`. Names describe *intent*. So `loadConfigAsync` → `loadConfig`, `isValidAsync` → `isAllowed`, `getDataAsync` → `getData`.
- **Constants:** `UPPER_SNAKE` at module level (`VALID_TYPES`, `EXCLUDE_NODES`).
- **Classes/types:** `PascalCase` — and **never** named `*Manager`, `*Controller`, `*Plugin`, `*Helper`, `*Util`. Filename prefixes describing layer (`router.js`, `repo.js`) are fine; identifiers are not.

### 5.2 Imports

- **Use project path aliases for shared library imports.** Configure aliases (`@lib/*`, `@shared/*`, or equivalent) for anything that lives outside the current module tree. Forbidden: deep relative paths like `require('../../../../lib/log')`.
- **Intra-module is relative.** Within a module folder, `require('../../core/recipe')` is correct — don't reach for an alias for a sibling file.
- **Cross-module via alias when available.** Use the project's configured cross-module alias; otherwise use the shortest relative path.
- **Order inside a file:** stdlib → third-party → project aliases → local relative (`./`, `../`).
- **Default aliases** (adjust names to match project convention):

  ```js
  const R = require('ramda');
  const log = require('@lib/log');
  const boom = require('boom');
  ```

### 5.3 Async / Await

- **Standard:** `async` functions with `try / catch` for control flow.
- `.then()` is permitted only as a **terminal mapper** — e.g., `await db().fetch(q).then(R.prop('field'))` — and only when it makes the read a one-liner. Never use `.then()` for branching, sequencing, or error handling.
- Forbidden: `.then(...).catch(...)` chains on more than one `.then`. Convert to `try/catch`.
- Forbidden: callback-style APIs in new code; wrap with `util.promisify` if interfacing with one.

### 5.4 Functional Style

- Compose with Ramda (`R.pipe`, `R.map`, `R.prop`, `R.pluck`, `R.pick`, …) over imperative loops/mutation.
- A function that exceeds **~25 lines** or has **deeply nested control flow** (an `if` inside a `for` inside a `try`) should be split. Use judgement; functions in the 30–50 line range can still be readable — clarity wins over a hard cap.
- One responsibility per function. Name for what it returns/does, not how it's called.

### 5.5 Logging

- `const log = require('@lib/log');` — never `console.*` in app code.
- Error format: `log.error('<resource>: <action> failed', err.message)`. Stack traces only when debugging.
- Avoid per-row debug logs in hot loops; one summary line is the rule.

### 5.6 Error Handling — and the Boom mapping

| Caller error                | Use                            | HTTP |
|-----------------------------|--------------------------------|------|
| Missing/invalid input       | `boom.badRequest('<reason>')`  | 400  |
| No / invalid user           | `boom.unauthorized()`          | 401  |
| User not allowed            | `boom.forbidden()`             | 403  |
| Resource not found          | `boom.notFound('<resource>')`  | 404  |
| Conflict / duplicate        | `boom.conflict('<reason>')`    | 409  |

Where errors live:
- **Edge (`<resource>/<resource>.js`):** `boom.unauthorized()` only.
- **Spec:** all `boom.badRequest()` (sync), `boom.conflict()` (async uniqueness/FK) for input shape, values, and constraints. The factory does **not** throw — it builds; the spec validates.
- **Core orchestrator:** `boom.notFound()` after repo lookups that return empty.
- **Repo:** never throws boom; only `log.error(...)` then rethrow, OR returns a safe default for non-critical reads.

Safe-default rule: only use `[]` / `{}` / `false` returns for **read** paths where the caller can carry on. Writes always rethrow.

### 5.7 Database Patterns

| Helper                  | Returns                            | Standard usage                           |
|-------------------------|------------------------------------|------------------------------------------|
| `db().fetch(q, args)`   | array of objects                   | reads                                    |
| `db().exec(q, args)`    | void / status                      | writes (CREATE/MERGE/SET/DELETE)         |
| `db().exec2(q, args)`   | result object                      | writes that return data                  |

Rules:
- Lazy handle: `const db = () => dbClient.get('<dbName>');`. Never `const db = dbClient.get(...);`.
- Always parameterise. `MATCH (n:${label})` is **forbidden** when `label` is a caller value.
- Pair `exec2` with `db().getResult(...)` or `util.toList(...)` to extract data.
- Use Ramda to shape results: `R.prop`, `R.pluck`, `R.path`.

### 5.8 TypeScript vs JavaScript

- Default to `.ts` for genuinely new modules and any module with non-trivial data shapes.
- Default to `.js` when contributing to a folder that is already JS, when the module is small, or when matching the local convention.
- "Ambiguous" = the immediate folder has no clear majority. Ask the user before creating the file.
- For `.ts`: define `export interface` for any non-trivial data shape; don't lean on `any`.

### 5.9 Testing

- **One `spec.js` test file per entity.** All test cases for a given entity's spec live there — do not split into one test file per method. Same rule applies to `factory.js` and `repo.js` tests.
- Tests mirror the source tree under `test/modules/<module>/<entity>/spec.js` (matching the source filename, not `<entity>-spec-test.js`).
- One test file per `core/<entity>/index.js` (orchestrator), one per `factory.js` (pure tests, easy), one per `spec.js`, one per `repo.js`.
- `repo.js` tests hit a real test database — **do not mock** the db (mock/prod divergence has burned this codebase before).
- Use Mocha + Chai; no new test runners without explicit user approval.

### 5.10 Documentation

- Project docs live under `.documentation/<topic-folder>/` at repo root.
- Folder names: lowercase, hyphenated. File names: short, purpose-named (`fix.md`, `plan.md`, `design.md`).
- Prompt the user for the topic folder name if it isn't obvious.

---

## 6. Reference Flow — `PUT /api/<module>/<resource>/:uuid/:prop`

```
edge/api/index.js                                    # mounts master router into Koa app
  └─ edge/api/router.js                              # master — composes per-resource routers
      └─ edge/api/<resource>/router.js               # /<resource>/:uuid/:prop → handler.setProp
          └─ edge/api/<resource>/<resource>.setProp  # auth + ctx unpack (one folder per resource)
              └─ core/<entity>/index.setProp         # orchestrate (build → isValid → isAllowed → persist)
                  ├─ core/<entity>/factory.buildSetProp(prop, body)         # pure shape
                  ├─ core/<entity>/spec.isValidSetProp(prop, body)          # sync predicate; throws boom
                  ├─ core/<entity>/spec.isSetPropAllowed(uuid, prop, body)  # async predicate; throws boom
                  ├─ core/<entity>/providers/<type>.setProp                 # strategy
                  └─ core/<entity>/repo.update                              # MERGE/SET
                      └─ db().exec2(cypher, {...}, !verbose)
```

Each arrow is a hard boundary. Short-circuiting (e.g. handler → repo) is a violation.

---

## 7. Banned Patterns

Each ❌ has a ✅ with the canonical fix. If you see the bad form in a diff, fix it in the same change.

### 7.1 try/catch swallowing errors in the edge

```js
// ❌ BAD — handler hides the failure mode
exports.get = async (ctx) => {
    try {
        ctx.body = await recipe.get(ctx.params.uuid);
    } catch (e) {
        ctx.body = {};
        ctx.status = 200;
    }
};

// ✅ GOOD — let it bubble; repo logs, framework returns 5xx
exports.get = async (ctx) => {
    const user = ctx.getState(_const.state.user);
    if (R.isNil(user)) throw boom.unauthorized();
    ctx.body = await recipe.get(ctx.params.uuid, user);
    ctx.status = 200;
};
```

### 7.2 Edge calling repo directly

```js
// ❌ BAD — edge knows about Cypher / persistence
const repo = require('../../core/recipe/repo');
exports.list = async (ctx) => { ctx.body = await repo.list(); };

// ✅ GOOD — go through the orchestrator
const recipe = require('../../core/recipe');
exports.list = async (ctx) => { ctx.body = await recipe.list(); };
```

### 7.3 Peer-resource repo import

```js
// ❌ BAD — favorite reaching into recipe's persistence
const recipeRepo = require('../recipe/repo');

// ✅ GOOD — go through the peer's orchestrator
const recipe = require('../recipe');
```

### 7.4 Cypher template-literal interpolation

```js
// ❌ BAD — injection-prone, breaks parametrisation
const cypher = `MATCH (n:${label}) WHERE n.id = ${id} RETURN n`;

// ✅ GOOD — labels are concatenated only when sourced from constants;
//          values always parameterised
const cypher = `MATCH (n:${LABEL}) WHERE n.id = $id RETURN n`;
await db().fetch(cypher, { id }, !verbose);
```

### 7.5 Captured db handle

```js
// ❌ BAD — singleton; can't swap in tests; breaks lazy connect
const db = dbClient.get('<db-name>');

// ✅ GOOD — factory; lazy resolution
const db = () => dbClient.get('<db-name>');
```

### 7.6 .then chains for control flow

```js
// ❌ BAD — chained .then for sequencing
exports.get = (uuid) =>
    db().fetch(GET, { uuid })
        .then(R.head)
        .then(serialiser.unmap)
        .catch((err) => { log.error('get failed', err); throw err; });

// ✅ GOOD — async/await + try/catch
exports.get = async (uuid) => {
    try {
        const row = R.head(await db().fetch(GET, { uuid }, !verbose));
        return serialiser.unmap(row);
    } catch (err) {
        log.error('recipe: get failed', err.message);
        throw err;
    }
};
```

### 7.7 Forbidden identifiers

```js
// ❌ BAD — forbidden suffixes as identifiers
class RecipesController { … }
function tribeManager() { … }
const QueryHelper = { … };

// ✅ GOOD — verb-first functions, noun nouns
exports.get = async (ctx) => …;
exports.create = async (input) => …;
const buildQuery = (input) => …;
```

### 7.8 Route ordering

```js
// ❌ BAD — :prop swallows /sources, /favorites, /settings
router
    .get('/catalog/:prop', catalog.getProp)
    .get('/catalog/sources', catalog.getSources);

// ✅ GOOD — fixed before parameterised
router
    .get('/catalog/sources', catalog.getSources)
    .get('/catalog/:prop', catalog.getProp);
```

### 7.9 Deep relative imports of shared libraries

```js
// ❌ BAD — fragile path; breaks on file moves
const log = require('../../../../../lib/log');

// ✅ GOOD — project path alias
const log = require('@lib/log');
```

### 7.10 Validation in the wrong layer

```js
// ❌ BAD — payload validation in the handler
exports.create = async (ctx) => {
    if (!ctx.body.name) throw boom.badRequest('name required');
    if (!['query', 'pipeline'].includes(ctx.body.type)) throw boom.badRequest('bad type');
    ctx.body = await recipe.create(ctx.body);
};

// ✅ GOOD — handler does identity; spec does validation
exports.create = async (ctx) => {
    const user = ctx.getState(_const.state.user);
    if (R.isNil(user)) throw boom.unauthorized();
    ctx.body = await recipe.create(ctx.body, user);   // orchestrator runs spec.isValid + spec.isAllowed
};
```

### 7.11 Vague validation errors

```js
// ❌ BAD — no field, no value, no rule
if (!recipe.name) throw boom.badRequest('invalid input');
if (!recipe.name) throw boom.badRequest('name required');
if (recipe.tags.length > 10) throw new Error('too many');

// ✅ GOOD — field + rule + offending value
if (isBlank(recipe.name)) {
    throw boom.badRequest(`name must be 1–200 chars; got "" (length 0)`);
}
if (recipe.tags.length > 10) {
    throw boom.badRequest(`tags must be ≤ 10; got ${recipe.tags.length}`);
}
if (!R.includes(recipe.type, VALID_TYPES)) {
    throw boom.badRequest(`type must be one of [${VALID_TYPES.join(', ')}]; got "${recipe.type}"`);
}
```

### 7.12 Validation that writes to the database

```js
// ❌ BAD — spec doing a write or calling a peer module's repo
exports.isAllowed = async (recipe) => {
    await peerRepo.lock(recipe.uuid);            // peer-resource access from spec
    await ownRepo.markPending(recipe.uuid);      // spec must not write
    return true;
};

// ✅ GOOD — spec only reads from its own repo; orchestrator owns the write
exports.isAllowed = async (recipe) => {
    if (await repo.existsByName(recipe.name)) {
        throw boom.conflict(`a recipe named "${recipe.name}" already exists`);
    }
    return true;
};
```

### 7.13 Language-construct suffix on method names

```js
// ❌ BAD — `Async` (and `Sync`, `Promise`, `Callback`) describe mechanism, not intent
exports.isValidAsync = async (recipe) => { … };
exports.loadConfigAsync = async () => { … };
exports.fetchUserPromise = (id) => db().fetch(…);

// ✅ GOOD — name the intent; the signature already shows it's async
// (Note: `verify` is a valid verb outside spec.js — inside spec.js, use is/has: see §7.15)
exports.verify = async (recipe) => { … };
exports.loadConfig = async () => { … };
exports.fetchUser = async (id) => db().fetch(…);
```

### 7.14 Splitting a spec or factory across many files

```js
// ❌ BAD — one file per validation concern
//   core/recipe/recipe-name-spec.js
//   core/recipe/recipe-tags-spec.js
//   core/recipe/recipe-uniqueness-spec.js

// ✅ GOOD — one spec.js per entity; all predicate methods live there
//   core/recipe/spec.js   (isValid, isValidPatch, isAllowed, isPatchAllowed, …)
```

The same rule applies to `factory.js` and `repo.js` — one file per entity per concern. Sub-entities get their own folder under `core/<entity>/<sub-entity>/`, not a sibling spec file.

### 7.15 Imperative verbs as spec method names

```js
// ❌ BAD — verbs read as commands; spec methods should read as questions
exports.verify = async (recipe) => { … };
exports.validate = (recipe) => { … };
exports.checkUniqueness = async (recipe) => { … };
exports.ensureNoConflicts = async (recipe) => { … };

// ✅ GOOD — predicate names; method reads as the yes/no question it answers
exports.isAllowed = async (recipe) => { … };
exports.isValid = (recipe) => { … };
exports.isUnique = async (recipe) => { … };
exports.hasNoConflicts = async (recipe) => { … };
```

The method still throws on failure — only the *name* must be interrogative. This is enforced inside `core/<entity>/spec.js` only; verbs are correct everywhere else (`factory.create`, `repo.save`, `recipe.archive`).

### 7.16 Constants exported from the factory

```js
// ❌ BAD — factory is exporting an enum / allowed-value list
// core/recipe/factory.js
const VALID_TYPES = ['query', 'pipeline'];
exports.VALID_TYPES = VALID_TYPES;
exports.create = (input) => ({ … });

// ❌ BAD — spec pulls the constant from the factory
// core/recipe/spec.js
const factory = require('./factory');
if (!R.includes(recipe.type, factory.VALID_TYPES)) throw boom.badRequest(…);

// ✅ GOOD — constant lives where it's consumed (spec validates against it)
// core/recipe/spec.js
const VALID_TYPES = ['query', 'pipeline'];
if (!R.includes(recipe.type, VALID_TYPES)) throw boom.badRequest(…);

// ✅ GOOD — when truly shared across factory + spec + repo, hoist to a sibling
// core/recipe/constants.js   (or core/recipe/recipe-constants.js)
exports.VALID_TYPES = ['query', 'pipeline'];
```

The factory exists to **build entities**, not to publish vocabulary. Constants only used by validation belong in `spec.js`. Constants genuinely shared across layers go in a sibling `constants.js` — never re-exported from the factory.

---

## 8. Verification Heuristics — run before commit

Mechanical checks that catch the most common drift. Run these on the touched paths.

```bash
# No console.* in app code
grep -rnE '\bconsole\.(log|info|warn|error|debug)\b' app/ src/

# Captured db handle (must be a factory function)
grep -rnE 'const\s+db\s*=\s*dbClient\.get\(' app/ src/

# Cypher template-literal interpolation of a non-constant
grep -rnE '`[^`]*\$\{[a-z][^}]*\}[^`]*`' app/ src/ | grep -iE 'MATCH|MERGE|RETURN|WHERE'

# Forbidden identifiers (class/function ending Manager|Controller|Plugin|Helper)
grep -rnE '(class|function|const|let)\s+[A-Z][A-Za-z0-9_]*(Manager|Controller|Plugin|Helper)\b' app/ src/

# Deep relative shared-lib imports — must use alias
grep -rnE "require\('(\.\./){3,}lib/" app/ src/

# .then chains (more than one .then) — convert to async/await
grep -rnE '\.then\([^)]*\)\.then\(' app/ src/

# Edge calling repo directly
grep -rn "require.*core/[a-z-]*/repo'" app/module/*/edge/ src/

# Peer-resource repo imports inside core/<entity>/index.js
grep -rn "require.*\.\./[a-z-]*/repo'" app/module/*/core/ src/

# Language-construct suffixes on method names (Async / Sync / Promise / Callback / Cb)
grep -rnE '\b(exports|function|const|let|var)\s+[a-z][A-Za-z0-9_]*(Async|Sync|Promise|Callback|Cb)\b' app/ src/

# Imperative-verb method names inside core/<entity>/spec.js — must be predicates (is*/has*)
grep -rnE '^exports\.(verify|validate|check|ensure|assert)[A-Z]?[A-Za-z0-9_]*\s*=' app/module/*/core/*/spec.js

# Factory exporting constants (UPPER_SNAKE) — constants belong in spec.js or a sibling constants.js
grep -rnE '^exports\.[A-Z][A-Z0-9_]+\s*=' app/module/*/core/*/factory.js

# Per-resource folder under edge/api (folder, not flat <noun>.js next to router.js)
find app/module/*/edge/api -maxdepth 1 -type f -name '*.js' \
    ! -name 'index.js' ! -name 'router.js'    # any hit here = handler not in a resource folder

# Route collection present per resource
find app/module/*/edge/api -mindepth 1 -maxdepth 1 -type d \
    -exec test ! -f '{}/test/routes-collection.json' ';' -print
```

A clean pass on these is a precondition for "ready for review".

---

## 9. Application Checklist — final gate before producing code

**Spine (Section 2)**
- [ ] Code lands in the right layer: `edge/api/<resource>/<resource>.js` vs `core/<entity>/index` vs `core/<entity>/factory` vs `core/<entity>/spec` vs `core/<entity>/repo`?
- [ ] No edge → repo, repo → repo, or factory → I/O?
- [ ] Handlers do only auth → unpack → one core call → set body/status (no try/catch)?
- [ ] Factory is pure (no `db`, `log`, `fs`, network), exposes a static `create(input)`, and **does not export constants** (those live in `spec.js` or a sibling `constants.js`)?
- [ ] One `spec.js` per entity (all validation methods in it); one `factory.js`; one `repo.js`?
- [ ] Repo uses lazy `db = () => dbClient.get('…')` factory and parameterised Cypher?
- [ ] **One master `router.js` per module**; per-resource folder under `edge/api/<resource>/` with its own `router.js` + handlers?
- [ ] Each resource has a `test/routes-collection.json` (Bruno/Postman) kept in sync with `router.js`?
- [ ] `router.js` declares fixed paths before `:param` paths? `routes.txt` updated?
- [ ] New strategies are sibling folders, not edits to existing ones (OCP)?

**Cross-cutting (Section 5)**
- [ ] File names are nouns; method names are verbs?
- [ ] **No `Async` / `Sync` / `Promise` / `Callback` suffixes** on method names?
- [ ] **All `spec.js` methods are predicates** — start with `is` or `has` (no `verify`/`validate`/`check`/`ensure`)?
- [ ] No `Manager` / `Controller` / `Plugin` identifiers?
- [ ] Imports use project path aliases for shared libs (no deep relative paths)?
- [ ] `async/await` + `try/catch` everywhere; `.then()` only as a terminal mapper?
- [ ] No `console.*`?
- [ ] Boom errors at the right layer (unauthorized in edge, badRequest/conflict in spec, notFound in core)?
- [ ] Repo error tail: `log.error` then rethrow OR return safe default for non-critical reads?
- [ ] `.ts` vs `.js` decision deliberate (and asked when ambiguous)?

**Verification (Section 8)**
- [ ] Greps in Section 8 are clean on touched paths?

---

## 10. Why — see clean-code

The spine is SOLID applied to the Node.js module structure. The reasoning behind every rule here — layers, contracts, extension, encapsulation, validation, operations, and the full pattern catalog — lives in the `clean-code` skill. Load it when you need the *why* behind any structural decision in this file.

When in doubt, the layered structure is the answer.

---

## 11. Drift Defense

This skill and `clean-code` are paired. When one changes, check the other.

- **Paired skills:**
  - `clean-code` — the *why* behind every rule in this file: layers, contracts, extension, encapsulation, validation, operations, patterns, complexity management. When a spine rule needs justification, clean-code is the source.
  - `dev-gen` — developer scaffolding skill; generates files that must conform to this spine. When this skill's rules change, verify dev-gen's templates match.
  - `dev-audit` — pre-checkin gate; runs grep checks derived from this skill's banned-pattern rules (§7, §8). When a new banned pattern is added here, add the matching check to dev-audit.

- **Re-review triggers — any one of these means re-check all paired skills:**
  1. PR touches `edge/api/**` or `core/<entity>/{index,factory,spec,repo}.js`.
  2. PR edits this file (`.claude/skills/node-spine/SKILL.md`).
  3. PR edits `.claude/skills/clean-code/SKILL.md`.
  4. PR edits `.claude/skills/dev-gen/SKILL.md`.
  5. PR edits `.claude/skills/dev-audit/SKILL.md`.

  **How to re-check:**
  - Read the changed file's diff against the other skills and reconcile any rule that the change implies.
  - Re-run `/dev-audit <module>` to confirm every resource still passes all checks.
  - When reconciliation requires changes to multiple skills, open them as separate PRs so each diff stays reviewable.

- **When this skill and clean-code disagree:** fix this skill to match — clean-code is the design source of truth and node-spine is its structural applier.

When migrating an existing module to the spine, do it **one resource at a time** (single PR per resource) so the diff stays reviewable.
