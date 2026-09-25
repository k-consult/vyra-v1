# Vyra Design Docs — Start Here

`.design/` holds Vyra's canonical docs. This file is the front door: read the six docs below **in this order** and every fact you hit will already have the context it needs — nothing here assumes you've read ahead.

| # | Doc | Read this to answer | Read this if you are |
|---|---|---|---|
| 1 | [`foundation.md`](foundation.md) | *What is Vyra, whose job does each layer serve, what compounds commercially, and what must be true for any of it to work?* | **Everyone.** This is the capability specification — the model, the value, and the guarantees, in one document |
| 2 | [`graph.md`](graph.md) | *What does Vyra actually store, and how do the five graph domains connect?* | Anyone about to touch schema, write Cypher, or design an agent — this is ground truth |
| 3 | [`architecture.md`](architecture.md) | *How is the software layered around that graph, and who's allowed to talk to whom?* | Anyone touching `api/`, `agents/`, `cli/`, or `ui/` and needs the access rules |
| 4 | [`domain.md`](domain.md) | *What are the Bounded Contexts, Entities, Value Objects, Repositories, and Specifications?* | Anyone designing a module or aggregate — the DDD model layered over the graph spine and architecture |
| 5 | [`track.md`](track.md) | *What's live, partial, or a gap, right now?* | Anyone asking "is X built yet" — the single source of current status |
| 6 | [`plan.md`](plan.md) | *What's next, and what's blocking it?* | Anyone resuming work — sequencing and open decisions only, not a build log |
| 7 | [`journey-first.md`](journey-first.md) | *Does the platform actually carry a persona through their day end to end, or does it just expose what's stored?* | Anyone designing UI/UX or sequencing onboarding work — a critique of the build against `foundation.md`'s personas, not a status report |

## How the docs relate

**1 is the specification.** It carries the operating model (7 layers, personas, JTBD), the two central assets and how they're monetized, and the requirement tables that say what must be structurally true — but no build-status of its own.

**2, 3, and 4 are its technical references** — the graph schema the spec implies, the software layers wrapped around that graph, and the DDD model (Bounded Contexts/Entities/Value Objects/Repositories/Specifications) derived from both. Read them when you're building, not when you're deciding.

**5 and 6 are the only two that carry build-status**, and they're deliberately split by question rather than duplicated: **5** answers *what's true today*, **6** answers *what happens next*. If you only need one, pick by that question.

**7 is a critique, not a status report.** It holds 1's personas and 5's layer-by-layer status side by side and asks a question neither answers alone: does the platform take a persona through their actual day end to end, or does it just expose what's stored, layer by layer? Read it when the question is about product journey, not schema or build status.

## Everything else in `.design/`

- **`artifacts/`** — generated diagrams referenced by the docs above: `foundation-venn` (the four regions), `foundation-value` (the two compounding assets), the architecture diagrams, and the domain-model diagrams (`domain-model-overview`, `domain-model-bc1-tenant-twin`, `domain-model-bc2-vyra-central`).
- **`__ref/`** — historical and working material: retired canonical docs (including `vyra-landscape.md`, absorbed into `foundation.md` on 2026-09-06), drift-analysis notes, synthetic seed data, archived phase-plan drafts, and the full build narrative in `implementation-history.md`. Not part of the reading path above — nothing there is ground truth, and `plan.md` says so explicitly wherever it cites something from here.

## For Claude specifically

`CLAUDE.md` at the repo root is the actual entry point for a coding session — it names the workspaces, setup commands, and skills, and `@`-imports docs 1–3 above directly into context. This file is the human-facing map of the same territory; `/grc` starts here too.
