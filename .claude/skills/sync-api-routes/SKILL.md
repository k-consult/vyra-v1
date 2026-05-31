---
  name: sync-api-routes
  description: Use when the user wants to call a GA backend route from this UI, generate a client call, or verify a request/response shape against the api repo. Points at
  the canonical contract folders for a specified GA api module (Bruno collections, routes.txt, .design/<resource>.md). Invoked as `/sync-api-routes <module>` where <module>
   is the folder name under `app/module/` in the api repo (e.g. studio, data, tribes). Trigger on any mention of: a GA backend endpoint, /api/<something>, "what's the body
  for…", or "how do I call the <module> API".
  ---

  # sync-api-routes

  The GA api contract lives in a sibling `api` repo, organised per module under `app/module/<module>/`. Whenever the user asks for a backend endpoint, **read from the 
  contract files first** — never guess a route, method, or body shape from memory or training data.

  ## Module argument

  The skill takes the api module name — the folder name under `app/module/` in the api repo — as its argument.

  - Invoked as `/sync-api-routes <module>` → use `<module>` directly.
  - Invoked with no arg → ask the user: **"Which api module? (e.g. `studio`, `data`, `tribes` — the folder name under `app/module/` in the api repo)"** — wait for the
  answer, then proceed. Do not guess.
  - Cache the resolved `<module>` for the rest of the session unless the user names a different one.

  ## Resolve `<api>` once per session

  Replace `<api>` with the api repo root on disk. Discover candidates by checking which of these exist:

  1. `<ui-repo>/../api-multisite/`
  2. `<ui-repo>/../api/`

  Then prompt the user to pick. Use the `AskUserQuestion` tool with one question and the candidates as options. Always include both candidates if both exist; include only
  the ones that exist; if neither exists, include just the "specify another path" option.

  Phrasing template:

  > **Question:** Which api repo should I use?
  > **Header:** API repo
  > **Options:**
  > - `../api-multisite/` (exists) — *only if discovered*
  > - `../api/` (exists) — *only if discovered*
  > - `Specify another path` — *always; lets the user type a path*

  If the user picks "Specify another path" (or both candidates are missing), follow up with a free-text prompt: **"Path to the api repo on disk?"** Then validate.

  ### Validation step (mandatory)

  After resolving, confirm:

  - `<api>/app/module/<module>/edge/api/` exists.
  - If it doesn't exist but `<api>/app/module/` does, list the folders under `app/module/` back to the user and ask which one they meant — the module name may differ
  between `api/` and `api-multisite/` checkouts.
  - If `<api>/app/module/` itself doesn't exist, the path is wrong — re-prompt.

  Once resolved and validated, cache the path for the rest of the session and reuse it across subsequent `/sync-api-routes <module>` invocations unless the user explicitly
  names a different api repo.

  ## Source-of-truth paths

  All paths are relative to the api repo root. Substitute `<module>` everywhere.

  | Path | What's in it | When to read it |
  |------|--------------|-----------------|
  | `<api>/app/module/<module>/edge/api/routes.txt` | Flat list of every route in the module, grouped by resource | Start here — "does this endpoint exist?" |
  | `<api>/app/module/<module>/edge/api/.api-client/<module>-<resource>.json` | Bruno collection per resource: method, full path, headers, worked sample body for every
  request | Authoritative executable contract |
  | `<api>/app/module/<module>/edge/api/.api-client/env.json` | Bruno env (baseUrl, ga_user, ga_pwd, ga_token) | Reference only — UI uses its own auth client |
  | `<api>/app/module/<module>/edge/api/.api-client/script-*.txt` | Post-response scripts (e.g. capture login token) | Only needed when reproducing Bruno flows; not for UI 
  code |
  | `<api>/app/module/<module>/edge/api/<resource>/samples.js` | Source of the sample bodies above. Keys are `'METHOD path'` (e.g. `'POST /recipes/:type'`) | When you need 
  to copy a body shape into UI code |
  | `<api>/app/module/<module>/.design/MODULE.md` | Module metadata: `db`, `mounts-at`, full resource list | Once per session, for orientation |
  | `<api>/app/module/<module>/.design/<resource>.md` | Full contract for spine-migrated resources. `<!-- entity:start -->` (fields, defaults, patchable), `<!-- rules:start
   -->` (validation), `<!-- routes:start -->`, `<!-- samples:start -->`, `<!-- persistence:start -->` | When you need field-level validation rules or the exact patchable 
  set |
  | `<api>/app/module/<module>/.docs/README.md` | Module overview prose + auto-regenerated routes block | Human-readable context |

  ### Mount prefix

  Read `<api>/app/module/<module>/.design/MODULE.md` and look inside the `<!-- meta:start --> ... <!-- meta:end -->` block for the `mounts-at:` line. That's the prefix 
  every route in `routes.txt` gets prepended with in production. Common convention is `/api/<module>` (e.g. `/api/studio`, `/api/data`), but always confirm against 
  `MODULE.md` — never assume.

  A route written as `POST /recipes/:type` in `routes.txt` under module `studio` (mounts-at `/api/studio`) is called as `POST /api/studio/recipes/:type`.

  ### Resources

  `MODULE.md`'s `<!-- resources:start --> ... <!-- resources:end -->` block lists every resource folder. Use it to know which `<module>-<resource>.json` collections to 
  expect, and to know when a `.design/<resource>.md` is missing (some resources may still be pre-spine).

  ## Workflow

  1. **Confirm module + api path.** From the skill argument and the cached `<api>` root. Validate `<api>/app/module/<module>/edge/api/` exists.
  2. **Identify the resource.** Map the user's request to a resource listed in `MODULE.md`. If the user names something like "get a recipe's plan" for module `studio`, 
  resolve to resource = `recipes`, verb = `getPlan`.
  3. **Look up the route.** Read `routes.txt` (or the matching `<module>-<resource>.json`) and locate the exact `METHOD path`. Do not paraphrase.
  4. **Find the body shape.** Read the matching entry in `<resource>/samples.js`. If the resource has a `.design/<resource>.md`, prefer its `entity` and `rules` blocks — 
  they're authoritative for field names, defaults, validation, and which fields are patchable.
  5. **Generate the client call** in whatever http library this UI uses. Use the exact path (with the mount prefix from `MODULE.md`), method, and body shape — do not invent
   fields that aren't in the sample or the entity block.
  6. **Auth.** Most GA routes require a logged-in user. The Bruno collections inject `Authorization: Bearer {{ga_token}}` (captured by the `login` request via
  `script-login.txt`). The UI side should reuse whatever auth client it already has for other authenticated calls.

  ## Anti-patterns

  - ❌ Guessing a route from training data or other casino-API conventions. Read `routes.txt`.
  - ❌ Adding fields to a request body that aren't in `samples.js` or the entity block.
  - ❌ Calling a route without the mount prefix from `MODULE.md`.
  - ❌ Hard-coding a `:param` segment when the route takes a path param.
  - ❌ Assuming `GET` when the contract says `POST` (or vice versa). Methods that look interchangeable usually aren't.
  - ❌ Hardcoding the module name in this skill's instructions — the module is always the argument.

  ## When something doesn't match

  If the user reports a 404, 405, or "the field is missing":

  1. Check whether the api repo has been pulled recently. The contract is regenerated by the backend running `/learn-module <module>`; if the UI's local checkout of the api
   repo is stale, the lookup will mismatch reality.
  2. Compare the actual request the UI is sending against the Bruno collection entry for that route. The collection is the executable spec — if it works in Bruno, it'll
  work from code.
  3. If the route truly doesn't exist for that module, surface that to the user — don't paper over with a workaround. The backend team needs to add it (and re-run
  `/learn-module <module>`).

  ## What this skill does NOT do

  - Modify backend code. The api repo is read-only from this UI's side.
  - Invent fields, routes, or status codes. Every detail comes from the source files above.
  - Cache contract shapes across sessions. Always re-read the source files — they're local and cheap.
  - Resolve cross-module dependencies automatically. If `MODULE.md`'s `<!-- depends-on:start -->` block lists peers (e.g. `data.dates`), and the user's question spans them,
   re-run the skill for each module separately.
  - Assume the mount prefix or api repo path. Always read the prefix from the target module's `MODULE.md`; always confirm the path via the picker on first use of the
  session.

  Quick recap

  - Usage: /sync-api-routes <module> (e.g. /sync-api-routes studio). Without an arg, it asks for the module name.
  - Path resolution: Picks between ../api-multisite/ and ../api/ interactively on first invocation, cached for the session. "Specify another path" available for
  non-standard layouts.
  - Authoritative sources: routes.txt → samples.js → .design/<resource>.md (when present), with the mount prefix read from MODULE.md.
  - Same file, two homes: drop at .claude/skills/sync-api-routes/SKILL.md for slash-command behavior, or at docs/sync-api-routes.md to use as a paste-and-go prompt in
  non-Claude-Code tools.