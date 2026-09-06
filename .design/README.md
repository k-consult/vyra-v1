# Vyra Design Docs — Start Here

`.design/` holds Vyra's canonical docs. This file is the front door: read the five docs below **in this order** and every fact you hit will already have the context it needs — nothing here assumes you've read ahead.

| # | Doc | Read this to answer | Read this if you are |
|---|---|---|---|
| 1 | [`vyra-foundation.md`](vyra-foundation.md) | *What is Vyra, whose job does each layer serve, what compounds commercially, and what must be true for any of it to work?* | **Everyone.** This is the capability specification — the model, the value, and the guarantees, in one document |
| 2 | [`vyra-graph-spine.md`](vyra-graph-spine.md) | *What does Vyra actually store, and how do the five graph domains connect?* | Anyone about to touch schema, write Cypher, or design an agent — this is ground truth |
| 3 | [`vyra-architecture.md`](vyra-architecture.md) | *How is the software layered around that graph, and who's allowed to talk to whom?* | Anyone touching `api/`, `agents/`, `cli/`, or `ui/` and needs the access rules |
| 4 | [`vyra-tracker.md`](vyra-tracker.md) | *What's live, partial, or a gap, right now?* | Anyone asking "is X built yet" — the single source of current status |
| 5 | [`vyra-implementation-plan.md`](vyra-implementation-plan.md) | *What's next, and what's blocking it?* | Anyone resuming work — sequencing and open decisions only, not a build log |

## How the docs relate

**1 is the specification.** It carries the operating model (7 layers, personas, JTBD), the two central assets and how they're monetized, and the requirement tables that say what must be structurally true — but no build-status of its own.

**2 and 3 are its technical references** — the graph schema the spec implies, and the software layers wrapped around that graph. Read them when you're building, not when you're deciding.

**4 and 5 are the only two that carry build-status**, and they're deliberately split by question rather than duplicated: **4** answers *what's true today*, **5** answers *what happens next*. If you only need one, pick by that question.

## Everything else in `.design/`

- **`artifacts/`** — generated diagrams referenced by the docs above: `foundation-venn` (the four regions), `foundation-value` (the two compounding assets), and the architecture diagrams.
- **`__ref/`** — historical and working material: retired canonical docs (including `vyra-landscape.md`, absorbed into `vyra-foundation.md` on 2026-09-06), drift-analysis notes, synthetic seed data, archived phase-plan drafts, and the full build narrative in `implementation-history.md`. Not part of the reading path above — nothing there is ground truth, and `vyra-implementation-plan.md` says so explicitly wherever it cites something from here.

## For Claude specifically

`CLAUDE.md` at the repo root is the actual entry point for a coding session — it names the workspaces, setup commands, and skills, and `@`-imports docs 1–3 above directly into context. This file is the human-facing map of the same territory; `/resume` and `/grc` both start here too.
