# Vyra Design Docs — Start Here

`.design/` holds Vyra's canonical docs. This file is the front door: read the six docs below **in this order** and every fact you hit will already have the context it needs — nothing here assumes you've read ahead.

| # | Doc | Read this to answer | Read this if you are |
|---|---|---|---|
| 1 | [`vyra-foundation.md`](vyra-foundation.md) | *Why does this have to be agentic, and what does Vyra's design actually guarantee?* | Anyone new to the project — this is the pitch, made technically precise |
| 2 | [`vyra-landscape.md`](vyra-landscape.md) | *What is Vyra, and whose job does each layer serve?* | A stakeholder, or anyone who needs the vision / 7-layer operating model (JTBD) without build-status noise |
| 3 | [`vyra-graph-spine.md`](vyra-graph-spine.md) | *What does Vyra actually store, and how do the five graph domains connect?* | Anyone about to touch schema, write Cypher, or design an agent — this is ground truth |
| 4 | [`vyra-architecture.md`](vyra-architecture.md) | *How is the software layered around that graph, and who's allowed to talk to whom?* | Anyone touching `api/`, `agents/`, `cli/`, or `ui/` and needs the access rules |
| 5 | [`vyra-tracker.md`](vyra-tracker.md) | *What's live, partial, or a gap, right now?* | Anyone asking "is X built yet" — the single source of current status |
| 6 | [`vyra-implementation-plan.md`](vyra-implementation-plan.md) | *What's next, and what's blocking it?* | Anyone resuming work — sequencing and open decisions only, not a build log |

## How the docs relate

**1 → 2** narrows the pitch into an operating model. **2 → 3** gives that model a concrete schema. **3 → 4** wraps that schema in software layers. **5** and **6** are the only two that carry build-status, and they're deliberately split by question, not duplicated: **5** answers *what's true today*, **6** answers *what happens next*. If you only need one, pick by that question.

## Everything else in `.design/`

- **`artifacts/`** — generated diagrams (architecture, foundation Venn) referenced by the docs above.
- **`__ref/`** — historical and working material: retired doc versions, drift-analysis notes, synthetic seed data, archived phase-plan drafts. Not part of the reading path above — nothing there is ground truth, and `vyra-implementation-plan.md` says so explicitly wherever it cites something from here.

## For Claude specifically

`CLAUDE.md` at the repo root is the actual entry point for a coding session — it names the workspaces, setup commands, and skills, and `@`-imports docs 1–4 above directly into context. This file is the human-facing map of the same territory; `/resume` and `/grc` both start here too.
