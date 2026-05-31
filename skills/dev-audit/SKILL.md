---
name: dev-audit
description: Pre-checkin drift and quality gate. Runs 12 structural checks across a module (or a single resource) and reports violations grouped by severity. INVOKE when the user runs `/dev-audit [<module>] [<resource>]` or asks to audit/review code before checkin. Derived from `node-spine` banned-pattern rules — when a new rule is added to node-spine, add the matching check here.
---

# dev-audit — Pre-Checkin Gate

Twelve structural checks. Run before every PR.
No violations = clean. Any finding = fix before merging.

Pairs with **`node-spine`** (the rules these checks enforce) and **`clean-code`** (the design principles behind those rules).

---

## 0. When to invoke

Only when the user explicitly runs `/dev-audit`. Not auto-invoked on code changes.

```
/dev-audit                       # audit the whole codebase (all modules under app/module/)
/dev-audit <module>              # audit one module, all resources
/dev-audit <module> <resource>   # audit one resource inside a module
```

---

## 1. Scope resolution

| Invocation | Files checked |
|---|---|
| `/dev-audit` | All `.js` files under `app/module/`, `jsLib/`, `js_lib/` |
| `/dev-audit <module>` | All `.js` files under `app/module/<module>/` |
| `/dev-audit <module> <resource>` | Files under `app/module/<module>/edge/api/<resource>/` and `app/module/<module>/core/<resource-singular>/` |

Exclude: `node_modules/`, `dist/`, `*.min.js`, generated artifacts.

---

## 2. The 12 checks

Run every check. Collect all violations before reporting. Never stop at first failure.

---

### Check 1 — Required files present

**Rule (spine §1):** Every resource folder must have the four required files.

For each resource folder found under `app/module/*/edge/api/`:
```bash
find app/module/*/edge/api -mindepth 1 -maxdepth 1 -type d
```
Each subfolder must contain:
- `index.js`
- `router.js`
- `<resource>.js` (handler file named after the folder)
- `test/routes-collection.json`

**Report format:**
```
✗ [C1] Missing required files in edge/api/<resource>/
    missing: test/routes-collection.json
```

---

### Check 2 — No edge → repo imports

**Rule (spine §2):** Edge layer must not import any core repo directly.

```bash
grep -rn "require.*core/[a-z-]*/repo'" app/module/*/edge/
```

Match pattern: `require` containing `core/<anything>/repo` inside `edge/` folders.

**Report format:**
```
✗ [C2] Edge → repo import (forbidden — edge must call core/index only)
    app/module/studio/edge/api/recipes/recipes.js:14
      require('../../../core/recipe/repo')
```

---

### Check 3 — No cross-resource repo imports

**Rule (spine §2):** Core orchestrators must not import a peer resource's repo directly.

```bash
grep -rn "require.*\.\./[a-z-]*/repo'" app/module/*/core/
```

Match pattern: `require` containing `../` then a folder name then `/repo` inside `core/` folders.
Exclude self-imports (same entity `repo.js` importing its own peer helpers is allowed).

**Report format:**
```
✗ [C3] Cross-resource repo import (use peer core/index instead)
    app/module/studio/core/recipe/index.js:8
      require('../catalog/repo')
```

---

### Check 4 — No `console.*` calls

**Rule (spine §7):** Use `@jsLib/log` only. `console.*` is banned.

```bash
grep -rnE '\bconsole\.(log|info|warn|error|debug)\b' app/module/ jsLib/ js_lib/
```

Exclude: `*.test.js`, `*.spec.js`, test fixtures.

**Report format:**
```
✗ [C4] console.* call (use @jsLib/log)
    app/module/studio/core/recipe/repo.js:42
      console.log('recipe: save', recipe.uuid)
```

---

### Check 5 — Lazy db handle (no eager singleton capture)

**Rule (spine §4.4):** `const db = () => dbv4x.get('<name>')` — must be a function, never a captured value.

Detect eager captures:
```bash
grep -rnE 'const\s+db\s*=\s*dbv4x[^(]' app/module/*/core/
```

Match: `const db =` followed immediately by `dbv4x.get(` **without** being wrapped in `() =>` or `function`.

The correct form is: `const db = () => dbv4x.get('...');`
The bad form is: `const db = dbv4x.get('...');`

**Report format:**
```
✗ [C5] Eager db handle (wrap in () => to keep lazy)
    app/module/studio/core/recipe/repo.js:5
      const db = dbv4x.get('studio')
```

---

### Check 6 — No `.then()` promise chains

**Rule (spine §7):** Use `async/await` + `try/catch`. No `.then().catch()` chains.

```bash
grep -rnE '\.then\s*\(' app/module/ jsLib/ js_lib/
```

Exclude: test files, vendor files.

**Report format:**
```
✗ [C6] .then() chain (use async/await + try/catch)
    app/module/studio/core/recipe/index.js:27
      return repo.save(recipe, user).then(result => result)
```

---

### Check 7 — No deep `@jsLib` relative path hack

**Rule (spine §7):** Use `@jsLib/<lib>` alias. Never `require('../../jsLib/...')` deep relative paths.

```bash
grep -rnE "require\('(\.\./)+jsLib/" app/module/
```

**Report format:**
```
✗ [C7] Deep relative jsLib path (use @jsLib/<lib> alias)
    app/module/studio/core/recipe/repo.js:3
      require('../../../../jsLib/dbv4x+')
```

---

### Check 8 — No `*Async` / `*Sync` / `*Promise` method suffixes

**Rule (spine §5.1, clean-code §2.4):** Mechanism suffixes are banned. The signature conveys async-ness.

```bash
grep -rnE '\b[a-zA-Z]+(Async|Sync|Promise|Callback|Cb)\s*[=(]' app/module/ jsLib/ js_lib/
```

Exclude matches inside string literals and comments.

**Report format:**
```
✗ [C8] Mechanism suffix on method name (remove Async/Sync/Promise/Callback/Cb)
    app/module/studio/core/recipe/spec.js:31
      exports.isAllowedAsync = async (recipe, { user }) => {
```

---

### Check 9 — Spec predicates use `is`/`has` only (no imperative verbs)

**Rule (spine §4.3):** Exported functions in `spec.js` files must start with `is` or `has`. Imperative verbs (`verify`, `validate`, `check`, `ensure`, `assert`) are banned.

```bash
grep -rnE '^exports\.(verify|validate|check|ensure|assert)[A-Za-z]*\s*=' app/module/*/core/*/spec.js
```

Note: `verify`, `validate`, `check`, `ensure`, `assert` are valid **outside** `spec.js` — this check is scoped to spec files only.

**Report format:**
```
✗ [C9] Imperative verb on spec export (rename to is*/has* predicate)
    app/module/studio/core/recipe/spec.js:45
      exports.validatePatch = (patch) => {
    → rename to: exports.isValidPatch
```

---

### Check 10 — No exported constants from `factory.js`

**Rule (spine §4.2):** `factory.js` is a builder only. No exported constants or enums.

```bash
grep -rnE '^exports\.[A-Z][A-Z0-9_]+\s*=' app/module/*/core/*/factory.js
```

Match: `exports.SCREAMING_SNAKE_CASE` in factory files.

**Report format:**
```
✗ [C10] Exported constant from factory.js (move to spec.js or a constants.js sibling)
    app/module/studio/core/recipe/factory.js:3
      exports.VALID_TYPES = ['query', 'pipeline']
```

---

### Check 11 — `routes.txt` in sync with `router.js`

**Rule (spine §3.3):** `edge/api/routes.txt` must be regenerated whenever a router changes.

For each `router.js` under `edge/api/*/`:
- Compare the `mtime` of `router.js` to the `mtime` of `../../routes.txt` (module-level).
- If `router.js` is newer than `routes.txt`, flag as out of sync.

**Report format:**
```
✗ [C11] routes.txt out of sync (run: node app/module/.maker/sync.js <module>)
    app/module/studio/edge/api/recipes/router.js modified 2026-05-24 14:30
    app/module/studio/edge/api/routes.txt last updated 2026-05-22 09:15
```

---

### Check 12 — Bruno collections in sync with `router.js`

**Rule (spine §3.3):** Per-resource Bruno collections must be regenerated whenever a router changes.

For each `router.js` under `edge/api/<resource>/`:
- Check that `edge/api/.api-client/<module>-<resource>.json` exists.
- Compare `mtime` of `router.js` to `mtime` of the corresponding collection file.
- If `router.js` is newer, or collection is missing, flag.

**Report format:**
```
✗ [C12] Bruno collection out of sync or missing (run: node app/module/.maker/client.js <module>)
    app/module/studio/edge/api/recipes/router.js modified 2026-05-24 14:30
    app/module/studio/edge/api/.api-client/studio-recipes.json missing
```

---

## 3. Output format

### Clean pass

```
✓ code-audit clean — <scope>
  12/12 checks passed
```

### Findings

```
code-audit — <scope>
──────────────────────────────────────────────────────────
✗ [C2] Edge → repo import  (2 occurrences)
    app/module/studio/edge/api/recipes/recipes.js:14
      require('../../../core/recipe/repo')
    app/module/studio/edge/api/catalog/catalog.js:9
      require('../../../core/catalog/repo')

✗ [C9] Imperative verb on spec export  (1 occurrence)
    app/module/studio/core/recipe/spec.js:45
      exports.validatePatch = (patch) => {
    → rename to: exports.isValidPatch

──────────────────────────────────────────────────────────
2 checks failed  |  10 checks passed  |  3 total violations

Fix all violations before merging.
```

### Grouping

- Group all violations for the same check together (e.g., all C2 violations in one block).
- Sort by check number (C1 → C12).
- List each file+line on its own line, indented under the check header.
- Where a rename is obvious (C9), suggest the corrected name.

---

## 4. Exit semantics

| Outcome | Exit signal |
|---|---|
| All checks pass | "✓ code-audit clean" — no further action |
| Any check fails | List all findings; do not continue to code generation or other tasks until the developer acknowledges |

When violations are found, **do not offer to fix them automatically** unless the user explicitly asks. Surface findings and let the developer decide.

---

## 5. Drift with code-spine

This skill's checks are derived directly from `code-spine` banned-pattern rules (§§4–7). The mapping:

| Audit check | code-spine rule |
|---|---|
| C1 — required files | §1 module layout |
| C2 — edge→repo | §2 layer boundaries |
| C3 — cross-resource repo | §2 layer boundaries |
| C4 — console.* | §7.12 |
| C5 — lazy db | §4.4 |
| C6 — .then chains | §7.2 |
| C7 — deep jsLib | §7.11 |
| C8 — mechanism suffixes | §5.1, §7.14 |
| C9 — spec predicates | §4.3 |
| C10 — factory constants | §4.2 |
| C11 — routes.txt sync | §3.3 |
| C12 — Bruno sync | §3.3 |

**When a new banned pattern is added to code-spine, add the matching check here in the same PR.**
