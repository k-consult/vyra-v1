---
name: dev-gen
description: Developer scaffolding skill. Two modes — (A) spec-first: reads a completed .design/<spec>.md and generates/updates the full file set for one resource; (B) text-first: infers a spec from a text description, lists gaps, asks for confirmation before writing. Also provides `/dev-gen api-client <module>` to regenerate routes.txt and Bruno collections for any module. INVOKE when the user runs `/dev-gen ...` or asks to scaffold a new resource, module, or API client. Pairs with `node-spine` (structural rules) and `clean-code` (design principles).
---

# code-gen — GA API Scaffolding

Scaffold, generate, and keep API modules in sync from a spec file.
Two entry modes, one strict validation gate, one output format.

Pairs with **`node-spine`** for structural rules and **`clean-code`** for design principles.

---

## 0. When to invoke

Only when the user explicitly runs `/dev-gen`. Do not auto-invoke on code changes — use `node-spine` for that gate.

---

## 1. Command surface

```
/dev-gen <spec> <module> [<sub-folder>]
/dev-gen api-client <module>
```

| Argument | Meaning |
|---|---|
| `<spec>` | Filename (no extension) of the spec inside `app/module/<module>/.design/`. E.g. `recipes` resolves to `app/module/studio/.design/recipes.md`. |
| `<module>` | Folder name under `app/module/`. E.g. `studio`. |
| `[<sub-folder>]` | Optional override for the resource's edge sub-folder. Defaults to the `resource:` value in the spec's `<!-- meta:start -->` block. |
| `api-client` | Sub-command: regenerate routes.txt + Bruno collections only. No code generation. |

**Examples:**
```
/dev-gen recipes studio           # generate/update all files for the recipes resource in studio
/dev-gen metric-groups studio     # scaffold metric-groups inside studio (creates .design/ if absent)
/dev-gen api-client studio        # regenerate Bruno collections + routes.txt for all studio resources
```

---

## 2. Spec file location

Spec files live at:
```
app/module/<module>/.design/<spec>.md
```

If the `.design/` folder does not exist, create it. If the spec file does not exist, create an empty template (§2.1) and stop — tell the user to fill it in before re-running.

### 2.1 Empty spec template

When creating a new spec file, write this template pre-filled with the `module` and `resource` args:

```markdown
# <spec> (<module>)

<!-- meta:start -->
module:    <module>
resource:  <spec>
entity:    <spec-singular>
db:        <module>
<!-- meta:end -->

<!-- entity:start -->
field   type   required   patchable   default   normalise
<!-- entity:end -->

<!-- enums:start -->
<!-- enums:end -->

<!-- rules:start -->
<!-- rules:end -->

<!-- routes:start -->
# Order matters: fixed segments before :param at same depth.
<!-- routes:end -->

<!-- samples:start -->
<!-- samples:end -->

<!-- persistence:start -->
node:        <EntityNode>
key:         uuid
soft-delete: archived (boolean) + archivedAt + archivedBy + archivedReason
audit:       createdAt, createdBy, updatedAt, updatedBy
<!-- persistence:end -->

<!-- providers:start -->
<!-- providers:end -->
```

Stop after writing. Do not generate code from an empty template.

---

## 3. Entry modes

### Mode A — spec-first (developer wrote the spec)

1. Read `app/module/<module>/.design/<spec>.md`.
2. Run the validation gate (§5). If any required section is empty → stop, list all gaps.
3. Generate files (§6) in the order listed there.
4. Wire + post-generate (§7).
5. Report: one line per file written/updated.

### Mode B — text-first (developer describes the resource)

Used when the user says "I want to add X to Y" or similar without a pre-written spec.

1. Infer as much of the 6-section spec as possible from the description.
   - `meta`: derive from the command args.
   - `entity`: extract field names and types mentioned in the description.
   - `enums`: extract any enumerated values mentioned.
   - `rules`: infer common patterns (name length, required checks, type validation).
   - `routes`: infer CRUD routes from the resource name; flag any non-standard ones as uncertain.
   - `samples`: generate illustrative examples from inferred fields.
   - `persistence`: use defaults (uuid key, soft-delete, audit).
   - `providers`: leave empty unless the description mentions custom execution.
2. Show the inferred spec in full inside a code block.
3. List every gap — fields, rules, or routes that could not be inferred with confidence. Use this format:
   ```
   ⚠ GAPS — fill these before proceeding:
     entity: missing field types for [X, Y]
     routes: non-CRUD route "/recipes/:uuid/run" — confirm verb + status
     persistence: node label unconfirmed — defaulting to <SpecResource>
   ```
4. **Do not write any files until the user confirms** the inferred spec is correct and all gaps are resolved.
5. After confirmation: write the spec to `app/module/<module>/.design/<spec>.md`, then continue as Mode A.

---

## 4. Spec format — the 6 sections

All sections use `<!-- <name>:start -->` / `<!-- <name>:end -->` delimiters. A section is "present and non-empty" when there is at least one non-comment, non-blank line between its delimiters.

### 4.1 `meta` (required)

```markdown
<!-- meta:start -->
module:    studio
resource:  recipes
entity:    recipe
db:        studio
<!-- meta:end -->
```

| Key | Meaning |
|---|---|
| `module` | Folder name under `app/module/`. |
| `resource` | Plural resource name; used for the edge sub-folder and handler filename. |
| `entity` | Singular entity name; used for factory/spec/repo/core filenames. |
| `db` | Database name passed to `dbv4x.get('<db>')`. |

### 4.2 `entity` + `enums` (required)

```markdown
<!-- entity:start -->
field         type      required  patchable  default      normalise
name          string    yes       yes        "Untitled"   trim
type          string    yes       no         —            —
tags          string[]  no        yes        []           uniq
<!-- entity:end -->

<!-- enums:start -->
types:  [query]
<!-- enums:end -->
```

- `required`: `yes` → factory sets a default or the spec enforces presence.
- `patchable`: `yes` → allowed in `PATCH`/`PUT`; `no` → immutable after creation (spec enforces).
- `default`: value factory inserts when input omits the field; `—` = no default, caller must provide.
- `normalise`: `trim`, `uniq`, or `—` = factory normalisation applied at build time.

### 4.3 `rules` (required)

```markdown
<!-- rules:start -->
sync isValid:
  - type      one of types        → "type must be one of [{types}]; got \"{value}\""
  - name      length 1..200       → "name must be 1–200 chars; got \"{value}\" (length {length})"

sync isValidPatch:
  - keys      subset of patchable → "only [{patchable}] are patchable; got [{offending}]"

(no async rules)
<!-- rules:end -->
```

- `sync` rules → `spec.isValid`, `spec.isValidPatch`, `spec.isValidType`, etc. — pure, no I/O.
- `async` rules → `spec.isAllowed`, `spec.isPatchAllowed`, etc. — may call own `repo.js` for db checks.
- Each rule maps to one `spec.js` predicate method (starts with `is` or `has`).

### 4.4 `routes` + `samples` (required)

```markdown
<!-- routes:start -->
GET     /recipes/:type/ingredients   → listIngredients  (provider)  status 200
POST    /recipes/:type               → create           (provider)  status 200  sample: createBody
GET     /recipes                     → list                         status 200
GET     /recipes/:uuid               → get              (provider)  status 200
PUT     /recipes/:uuid               → update                       status 200  sample: updateBody
DELETE  /recipes/:uuid               → archive                      status 204
<!-- routes:end -->

<!-- samples:start -->
createBody:
    name: sample-recipe
    description: ""
    tags: []

updateBody:
    name: updated-name
    description: updated description
<!-- samples:end -->
```

- Fixed paths (no `:param`) MUST appear before parameterised paths at the same prefix depth.
- `(provider)` flag → the orchestrator dispatches to `core/<entity>/providers/<type>/`.
- `sample: <key>` → references a block in `<!-- samples:start -->`.

### 4.5 `persistence` (required)

```markdown
<!-- persistence:start -->
node:           Recipe
key:            uuid
soft-delete:    archived (boolean) + archivedAt + archivedBy + archivedReason
audit:          createdAt, createdBy, updatedAt, updatedBy
serialiser:     provider

queries:
  save        write    MERGE on uuid; ON CREATE sets payload + audit + archived=false
  update      write    MATCH on uuid; SET payload + updatedAt/By
  archive     write    MATCH on uuid; SET archived=true + archivedAt/By/Reason
  get         read     MATCH on uuid; returns properties(r)
  list        read     MATCH WHERE NOT archived; returns properties(r)
<!-- persistence:end -->
```

| Key | Meaning |
|---|---|
| `node` | Neo4j node label. |
| `key` | Primary lookup field (almost always `uuid`). |
| `soft-delete` | If present, `archive` query is generated instead of `delete`. |
| `audit` | Audit fields; stamped in repo, never from factory. |
| `serialiser` | `provider` = `provider.getSerialiser()` per request; `none` = no mapping needed. |
| `queries` | One row per `repo.js` method. `write` = `exec2`; `read` = `fetch`. |

### 4.6 `providers` (optional)

```markdown
<!-- providers:start -->
strategy:   type
types:      types

interface:
  - type                      → string identifier
  - create(input)             → returns the built value
  - getSerialiser()           → { map(props), unmap(props) }
<!-- providers:end -->
```

When present, a `providers/` subfolder skeleton is generated (§6.8) if it does not already exist.
When absent, no provider code is generated.

---

## 5. Validation gate

**Fail fast. Never write a partial file set.**

Before touching any file, verify all required sections are present and non-empty:

| Section | Required | "Non-empty" means |
|---|---|---|
| `meta` | yes | `module`, `resource`, `entity`, `db` all present |
| `entity` | yes | At least one data row (beyond the header) |
| `enums` | yes (even if empty — must be present) | Delimiter present; may be empty |
| `rules` | yes | At least one `sync` or `async` block |
| `routes` | yes | At least one route line |
| `samples` | yes (even if empty — must be present) | Delimiter present; may be empty |
| `persistence` | yes | `node`, `key`, `queries` all present |
| `providers` | no | Optional |

On failure, stop and emit:
```
✗ code-gen refused — spec is incomplete.

Missing or empty sections in app/module/<module>/.design/<spec>.md:
  - entity: no fields defined
  - rules: no sync or async blocks
  - routes: no routes listed

Fill all gaps and re-run /dev-gen.
```

---

## 6. Generation — file by file

All paths are relative to `app/module/<module>/`. Use `app/module/studio/` as the canonical template source. When a file already exists, update only the contents inside marker blocks — leave all code outside markers untouched.

### 6.1 `core/<entity>/factory.js`

Generate from `entity` section:
- `exports.create(input)` — applies all defaults and normalisations from the spec table.
- `exports.update(input)` — `R.pick([...patchable fields], input)`.
- `exports.fromRow(row)` — identity pass-through (override point for providers).
- Pure functions only (`ramda` import; no db/log/fs/network).

Template pattern:
```js
const R = require('ramda');

// ── normalisers ─────────────────────────────────────────────────────────────
// (one per normalise rule in the entity table)

exports.create = (input) => ({
    // one line per entity field; apply defaults + normalisers
});

exports.update = (input) => R.pick([/* patchable fields */], input);

exports.fromRow = (row) => row;
```

### 6.2 `core/<entity>/spec.js`

Generate from `rules` section:
- One exported predicate per `sync` rule block (name = the rule block name, e.g. `isValid`).
- One exported async predicate per `async` rule block.
- Error messages verbatim from the spec's `→ "…"` annotations.
- Constants (valid types, length limits) defined at top of file from `enums` section.
- `isValidPatch` includes an immutability check for every non-patchable field.

Template pattern:
```js
const R = require('ramda');
const boom = require('boom');
const repo = require('./repo');   // only if async rules present

// ── constants ───────────────────────────────────────────────────────────────
// (from enums section)

// ── predicates (internal) ───────────────────────────────────────────────────
// (private helpers used by the public surface below)

// ── public sync surface ─────────────────────────────────────────────────────
exports.isValid = (entity) => { /* ... */ };

// ── public async surface ────────────────────────────────────────────────────
// (only if async rules present)
```

### 6.3 `core/<entity>/repo.js`

Generate from `persistence` section:
- One exported async function per `queries` row.
- `const db = () => dbv4x.get('<db>');` — lazy handle at the top.
- `const verbose = process.env.VERBOSE === 'ON';`
- Each query: named `const cypher = \`...\`` defined at top of function; parameterised only (no template-literal interpolation of caller values).
- `soft-delete: yes` → `archive` writes `archived:true + archivedAt + archivedBy + archivedReason`.
- `audit` fields stamped in `save` (createdAt/By) and `update`/`archive` (updatedAt/By + archivedAt/By/Reason).
- Serialiser wrapping: if `serialiser: provider`, wrap `save` and `get` returns through the serialiser map/unmap.

Template pattern:
```js
const R = require('ramda');
const log = require('@jsLib/log');
const dbv4x = require('@jsLib/dbv4x+');
const uuid = require('uuid').v4;

const db = () => dbv4x.get('<db>');
const verbose = process.env.VERBOSE === 'ON';

exports.save = async (entity, user) => {
    const cypher = `...`;
    try {
        return await db().exec2(cypher, { entity: R.assoc('uuid', uuid(), entity), user }, !verbose);
    } catch (err) {
        log.error(`<entity>: save failed`, err.message);
        throw err;
    }
};
```

### 6.4 `core/<entity>/index.js` — orchestrator

Generate from `routes` section (one exported verb per route handler name):
- `create`, `get`, `update`, `archive`, `list` + any custom verbs from routes.
- Standard flow: `factory.create → spec.isValid → (spec.isAllowed if async rules) → repo.save`.
- Provider-flagged routes (`(provider)`) add `providers.dispatch(type, verb, ...)` call.
- No Cypher, no raw db handles.

### 6.5 `edge/api/<resource>/router.js`

Generate from `routes` section:
- Fixed paths MUST appear before `:param` paths at the same depth.
- One line per route, mapping to its handler name.
- All routes under the `/<resource>` prefix.

```js
const Router = require('koa-router');
const handlers = require('./<resource>');

module.exports = new Router()
    // fixed paths first
    .get('/<resource>/:type/schema', handlers.getSchema)
    // then parameterised
    .get('/<resource>/:uuid', handlers.get)
    .get('/<resource>', handlers.list);
```

### 6.6 `edge/api/<resource>/<resource>.js` — handlers

Generate from `routes` section (one exported handler per route):
- Each handler: auth check → unpack ctx → one core call → set `ctx.body` + `ctx.status`.
- Status 200 for data responses, 204 for empty success (archive/delete).
- No try/catch. No validation logic.

```js
const R = require('ramda');
const boom = require('boom');
const _const = require('../../../../app-constants');
const <entity> = require('../../../core/<entity>');

exports.<handlerName> = async (ctx) => {
    const user = ctx.getState(_const.state.user);
    if (R.isNil(user)) throw boom.unauthorized();
    ctx.body = await <entity>.<verb>(...);
    ctx.status = 200;
};
```

### 6.7 `edge/api/<resource>/index.js`

```js
exports.router = require('./router');
```

### 6.8 `edge/api/<resource>/test/routes-collection.json`

Generate from `routes` + `samples` sections:
- One request per route.
- `sample: <key>` routes use the matching sample body from `<!-- samples:start -->`.
- Auth placeholder: `{ "token": "{{AUTH_TOKEN}}" }` header on every request.
- Bruno format (`.bru` item syntax wrapped in a collection JSON).

### 6.9 `core/<entity>/providers/` (only if `providers` section present)

**First-run only — never overwrite existing provider code.**

Check: does `core/<entity>/providers/` exist?
- If **no** → create skeleton:
  - `providers/index.js` — registry: `resolve`, `route`, `dispatch` using `iProvider.js` contract.
  - `providers/iProvider.js` — interface with throwing defaults for every method in the `interface:` list.
  - `providers/<default-type>/index.js` — stub that inherits `iProvider` defaults and throws `not implemented` for each method.
- If **yes** → skip entirely. Never touch existing provider implementations.

---

## 7. Wiring + post-generation

### 7.1 Master router

After generating the per-resource files, check `edge/api/router.js` (the module's master router):
- If the resource is not already mounted, add `.use(<resource>.router.routes())`.
- Import the resource at the top if not present.
- Do not reorder existing mounts.

### 7.2 Post-generation chain

After all files are written, run both makers:

```bash
node app/module/.maker/sync.js <module>
node app/module/.maker/client.js <module>
```

- `sync.js` writes `edge/api/routes.txt` and the routes marker block in `.docs/README.md`.
- `client.js` writes per-resource Bruno collections under `edge/api/.api-client/`.

Report the output of both commands verbatim (one line per file written).

### 7.3 Generation report

After all writes and maker runs, emit a summary:

```
✓ code-gen complete — <module>/<resource>

Files written:
  core/<entity>/factory.js       (new)
  core/<entity>/spec.js          (new)
  core/<entity>/repo.js          (new)
  core/<entity>/index.js         (new)
  edge/api/<resource>/router.js  (updated — added 2 routes)
  edge/api/<resource>/<resource>.js (new)
  edge/api/<resource>/index.js   (new)
  edge/api/<resource>/test/routes-collection.json (new)

Post-generation:
  edge/api/routes.txt            (updated)
  edge/api/.api-client/<module>-<resource>.json (updated)
```

---

## 8. `api-client` mode

```
/dev-gen api-client <module>
```

Regenerates routes.txt and Bruno collections for all resources in the module. No code changes.

Steps:
1. Verify `app/module/<module>/` exists.
2. Run `node app/module/.maker/sync.js <module>`.
3. Run `node app/module/.maker/client.js <module>`.
4. Report output verbatim: one line per `learning <resource>...`, each collection path written, README path, and any `script-*.txt` paths (content not expanded — path only).

This mode fully replaces the retired `learn-module` skill.

---

## 9. Module creation

If `app/module/<module>/` does not exist, create the full skeleton first:

```
app/module/<module>/
├── index.js                     # module entry — exports init()
├── edge/
│   ├── api/
│   │   ├── index.js             # mounts master router into Koa app
│   │   ├── router.js            # master router — empty; resources mounted as generated
│   │   └── routes.txt           # empty; populated by sync.js
│   └── cli/
│       └── index.js             # CLI surface stub
├── core/                        # empty; core/<entity>/ added per spec
└── .design/
    └── MODULE.md                # module-level spec stub (see template below)
```

`MODULE.md` template:
```markdown
# <module>

<!-- meta:start -->
module:    <module>
db:        <module>
cli:       no
mounts-at: /api/<module>
<!-- meta:end -->

<!-- resources:start -->
<!-- resources:end -->

<!-- depends-on:start -->
<!-- depends-on:end -->
```

After skeleton creation, tell the user to fill in `MODULE.md` and then create a resource spec before re-running `/dev-gen`.

---

## 10. What code-gen does NOT do

- **Does not overwrite provider implementations.** Provider strategies under `core/<entity>/providers/<type>/` are written once on first run (stubs). All subsequent `/dev-gen` runs skip that folder.
- **Does not touch code outside marker blocks.** Any logic a developer added between `<!-- <section>:end -->` markers and the surrounding code is preserved.
- **Does not run migrations.** Schema changes in the spec do not generate Cypher migrations. The developer is responsible for migrating the Neo4j graph.
- **Does not enforce runtime guards.** It generates the structure; `code-audit` checks for banned patterns after the fact.
- **Does not validate business logic.** The generated spec.js contains the rule structure; the developer fills in the actual thresholds and messages.
- **Does not commit.** All writes are local. The developer reviews the diff and commits.
