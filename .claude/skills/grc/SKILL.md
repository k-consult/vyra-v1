---
name: grc
description: Resumes work on the agentic-grc platform across sessions — reads the canonical docs (foundation, graph, architecture, domain, tracker), cross-checks git log/status, reports current status and open gaps. INVOKE at session start, after a context reset, or when asked "where were we"/"what's next".
---

# grc — Session Resume

Load this first when starting or resuming a session on this platform with no prior context. It replaces re-reading the canonical docs from scratch by doing the read + synthesis in one pass, then hands off to the right paired skill for whatever comes next.

This skill reports **current status**, not a plan. It does not read or synthesize `.design/plan.md` — that document is phase-sequencing detail for whoever is actively planning a phase, not session-resume context. If a task genuinely needs the plan's phase sequencing, read it separately at that point.

## The canonical docs (in reading order)

Each has one job — don't look for status in the spec doc, or a schema in the tracker:

1. **`.design/foundation.md`** — the capability specification: what this platform is, the 7-layer operating model (persona + capabilities), the two central assets and how they're monetized, and the requirement tables. Sets context. **Carries no build-status.**
2. **`.design/graph.md`** — the ground-truth graph schema (nodes, relationships, feeds, traversal patterns). This is the full schema reference — there is no separate summary skill; read this doc directly for entity/relationship detail.
3. **`.design/architecture.md`** — the software layers and components (Presentation / API / Agents / Ingestion / Foundation / Data) built around the graph.
4. **`.design/domain.md`** — the DDD model layered over the graph and architecture: Bounded Contexts, Entities, Value Objects, Repositories, Specifications. Read this before designing a module or aggregate.
5. **`.design/track.md`** — the single build tracker (consolidated from the former `track.md`+`track-platform.md` split on 2026-11-15). Organized by the **three MVP pillars `foundation.md` §1–§3 name** (Catalog, Operational Context, Intelligence), each scaffolded onto the JTBD layers from `foundation.md`'s own operating-model table, plus a standalone **Onboarding** section (cross-cutting, §0) and a **Not MVP-gating** appendix. Each pillar carries a live/partial status, a **Pending** checklist, and a compressed **Closed** ledger. **This is where "what's done" and "what's next" both live.**

## What to do when invoked

1. Read `.design/foundation.md` in full — what this platform is, the 7-layer operating model (persona/capability only, no status), the two central assets, and the requirement tables.
2. Read only `.design/graph.md`'s header (Version / Status / Source data lines) — not the full schema. If schema, entity, or relationship detail is actually needed for the task at hand, read `.design/graph.md` in full at that point rather than loading it here.
3. Read `.design/architecture.md`'s Orientation + "Layers at a Glance" table — the component map. Stable across phases; skim unless the task is architectural.
4. Read `.design/domain.md`'s Bounded Context overview (top section) — skim; full Entity/Repository/Specification detail only needed when actually designing a module or aggregate.
5. Read `.design/track.md` in full — the Pillar Map plus each pillar's **Pending**/**Closed** lists are the authoritative "what's live vs. gap" view; the **Onboarding** section covers the cross-cutting transition work that doesn't belong to one pillar.
6. Run `git log --oneline -10` and `git status --short` — the docs describe intent, git is ground truth for what's actually committed vs. sitting uncommitted in the working tree.
7. Report back — **every time this skill runs**, not just on first load — in this order:
   - **Current status** — the Pillar Map's live/partial status per pillar, and whether the working tree has uncommitted changes.
   - **Open gaps/decisions** — pull directly from each pillar's **Pending** checklist and the **Onboarding** section; they're already itemized, don't re-derive from scratch.
   - **Candidate next steps** — name what the tracker's Pending items mark as least-blocked, as observations from the tracker, not a committed plan. If more than one is genuinely ready, state the tradeoff rather than silently picking one.
8. Then **stop and ask** — don't pick a direction yourself. Use `AskUserQuestion` with options along these lines (adapt wording to what the state report actually surfaced):
   - Understand the platform — how it works
   - Add a new feature
   - Debug an issue
   - Something else
   Route the answer to the right paired skill below rather than assuming which one the user wants.

## Known staleness to flag, not silently fix

- **Tracker vs. code.** `track.md` is a pillar/layer-readiness lens maintained by hand and can drift behind what's actually committed — this happened once already (`journey/v1-plan.md` and `journey-first.md` both drifted behind real work and were retired to `__ref/` on 2026-11-15 once `track.md` absorbed what was still true). Cross-check its statuses against `git log` — if the tracker says something is a gap but the code and recent commits show it built, trust the code and flag the tracker as stale.
- **Graph doc vs. code.** `graph.md` gets updated as schema changes land; check its Version header against `cli/semantic-contract/contracts/v2.ts` and the live write paths in `api/modules/*/repo.ts` and `agents/tools/*.ts` — the doc can drift behind the actual write path.
- **Domain doc vs. graph doc.** `domain.md`'s Entities/Repositories map onto `graph.md`'s node types. If a domain-doc concept has no corresponding node in the graph doc (or vice versa), flag the drift rather than assuming one is wrong.

## Paired skills

- `clean-code` — general design/dev conventions once you're past "what's the state" and into "how do I write this"
- `graph-spine` — Cypher coding rules and `lib/graph-db` call shape
- `api-route-spine` — API-route lookup and the add-a-route workflow

Don't duplicate `.design/graph.md` or `.design/domain.md`'s content here — this skill is about project *state*, not schema or domain model.
