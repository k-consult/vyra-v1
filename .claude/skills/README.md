# Skills

Type `/code-ninja` at any time to see the full skill map and quick-pick guide.

| Skill | Layer | Purpose |
|-------|-------|---------|
| `/grc` | Entry point | Resume Vyra project state — phase status, open gaps, recommended next step. Start here at the top of a session. |
| `/code-ninja` | Entry point | Skill map — start here for coding conventions |
| `/clean-code` | Principles | Universal design bible (GOF, SOLID, DDD) |
| `/node-spine` | Spine | Node.js / TypeScript structural rules |
| `/react-spine` | Spine | React component structural rules |
| `/neo4j-spine` | Spine | Cypher query and graph DB rules |
| `/dev-tools` | Workflow | Entry point for a new feature or module |
| `/dev-audit` | Workflow | Pre-commit / pre-PR quality gate |
| `/dev-gen` | Workflow | Scaffold a resource from a spec |
| `/sync-api-routes` | Workflow | Look up API route contracts |

## Adding a new skill

- **New spine** (new runtime or framework): create `<runtime>-spine/SKILL.md`, pair it with `clean-code`.
- **New workflow tool**: create `dev-<tool>/SKILL.md`, update this README and `/code-ninja`.
- Keep skill names lowercase-hyphenated. No project names in skill names.
