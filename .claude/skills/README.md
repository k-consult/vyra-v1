# Skills

| Skill | Purpose |
|-------|---------|
| `/grc` | Entry point — resume agentic-grc platform project state: phase status, open gaps, recommended next step. Start here at the top of a session. |
| `/clean-code` | Design & dev standard — architecture, design patterns/principles, and this repo's actual structural/naming/functional-style conventions (Part 0). INVOKE before any code design or change. |
| `/graph-spine` | Cypher/Neo4j coding standard — `lib/graph-db` call shape, parameterisation, MERGE idempotency, naming. INVOKE before any Cypher or graph schema change. |
| `/api-route-spine` | API route lookup and module structure for the platform's Fastify `api/` workspace. INVOKE for any `/api/<domain>` route lookup or new endpoint. |

For the graph domain/schema reference (entity types, relationship types, traversal patterns), read `.design/graph.md` directly — there is no separate summary skill for it, to avoid a hand-maintained copy drifting behind the ground-truth doc.

## Adding a new skill

- Keep skill names lowercase-hyphenated. No project names in skill names.
- Ground any new skill in the actual codebase (real file paths, real conventions) rather than a generic template — check it against `CLAUDE.md` and the workspace it covers before writing rules.
- Prefer pointing at a canonical doc (`.design/*.md`) over duplicating its content in a skill — duplicated summaries drift.
- Update this README and cross-reference the new skill from any skill it pairs with.
