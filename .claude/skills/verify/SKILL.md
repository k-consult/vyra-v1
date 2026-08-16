---
name: verify
description: Project recipe for driving Vyra's running app (api/ui/agents) to observe a change end-to-end, rather than just typechecking. INVOKE when verifying a change actually works, not just compiles.
---

# verify — Vyra project recipe

## Dev servers

Check what's already running before starting anything new — this repo's dev servers are usually already up in the user's own terminals, started via `./run.sh` (api :4001 + ui :3002) from the repo root.

```bash
lsof -nP -iTCP:4001 -sTCP:LISTEN   # api
lsof -nP -iTCP:3002 -sTCP:LISTEN   # ui
nc -z -w2 localhost 7687 && echo neo4j-up   # Neo4j Desktop, bolt port
curl -s -m2 http://localhost:11434/api/tags # Ollama, for agent runs
```

If you edit `api/` code and the api dev server is already running as a background `ts-node index.ts` process (no hot reload configured), find its PID via `lsof -nP -iTCP:4001` and restart it (`kill <pid>`, then `cd api && npx ts-node index.ts &`) to pick up the change — it's the user's own dev process, so this is a reversible local action, not something to do without noting it.

## Backend (api/agents) — curl + direct Cypher

For a repo write path, curl the endpoint, then confirm the graph state directly rather than trusting the response body alone. There's no `cypher-shell` in this environment — write a throwaway `.ts` file inside the relevant workspace (e.g. `api/_verify-tmp.ts`) that imports `../lib/graph-db` + `../lib/config` the same way `repo.ts` files do, runs one Cypher string from `process.argv[2]`, and prints the JSON result. Run with `npx ts-node _verify-tmp.ts "<cypher>"`, then delete the file — never commit it.

## UI — Playwright, no local dependency

`ui/` has no Playwright devDependency and no `.claude/skills/` of its own. `npx playwright` resolves a cached CLI but scripts can't `require('playwright')` from it directly. Cold-start recipe (chromium is already cached at `~/Library/Caches/ms-playwright/` on this machine from a prior session, so `npx playwright install chromium` is usually instant):

```bash
mkdir -p <scratchpad>/pw-verify && cd <scratchpad>/pw-verify
npm init -y && npm install playwright@1.62.1
npx playwright install chromium   # near-instant if already cached
```

Then a plain Node script using `require('playwright')`, `chromium.launch()`, `page.goto('http://localhost:3002/...')`, drive it, `page.screenshot(...)`, and collect `page.on('console', ...)` errors. Run with plain `node verify.js` — no test runner needed for a one-off drive.

**Gotcha**: `cd` does not persist across separate Bash tool calls in this sandbox ("Shell cwd was reset" appears after each call) — always `cd <dir> && <command>` in one invocation, or use absolute paths throughout.

## What's worth driving here

- `/intelligence` — Agent Decisions section (Phase 7: reviewer picker + Approve/Reject on pending `Decision` cards, collapses to `reviewedBy`/`reviewedAt` once resolved), Findings, Risks, RCAs, People.
- `/assurance` — coverage score, risk rollup, audit chain (synthetic, Phase 4b).
- `/calendar` — 52-week task×week matrix.
- `POST /operational/signals` — the live, non-CLI write path; auto-creates a Task and (if `signal-intelligence` has run) surfaces a new pending `Decision`.
