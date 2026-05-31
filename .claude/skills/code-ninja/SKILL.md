---
name: code-ninja
description: Starting point for every coding session. Loads clean-code (always active) and displays the full skill map so the developer knows which skill to invoke for their context.
---

# code-ninja — Skill Map

When this skill is invoked:
1. Invoke the `clean-code` skill — universal design principles, always active.
2. Display the table below.

---

## What's available and when

| Skill | When to invoke |
|-------|---------------|
| `/clean-code` | Any design decision, architecture review, or new module. The universal baseline. |
| `/node-spine` | Any code change in a Node.js or TypeScript backend — API, CLI, or shared lib. |
| `/react-spine` | Any React component work — design, refactor, or review. |
| `/neo4j-spine` | Any Cypher query, graph schema change, or `db.fetch` / `db.exec` call. |
| `/dev-tools` | Starting a new feature or module — loads `node-spine` + `clean-code` together. |
| `/dev-audit` | Pre-commit and pre-PR quality gate — runs structural checks on touched paths. |
| `/dev-gen` | Scaffold a new resource from a spec file — generates the full file set. |
| `/sync-api-routes` | Look up an API endpoint, request body shape, or route contract. |

---

## Quick-pick by context

| Working on | Invoke |
|------------|--------|
| Backend module (API / CLI / lib) | `/dev-tools` |
| Single backend file edit | `/node-spine` |
| React component or page | `/react-spine` |
| Cypher query or graph schema | `/neo4j-spine` |
| Pre-commit check | `/dev-audit` |
| New resource scaffold | `/dev-gen` |
| Not sure — start here | `/clean-code` |
