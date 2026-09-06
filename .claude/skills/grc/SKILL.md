---
name: grc
description: Single authoritative entry point for resuming work on Vyra across sessions. Reads the five canonical docs (vyra-foundation, vyra-architecture, vyra-graph-spine's header, vyra-tracker, vyra-implementation-plan), cross-checks against git log/status, and reports current phase, what's done, what's explicitly next, and open decisions/gaps the docs already flag. INVOKE at the start of a new session, after a context reset, or whenever asked "where were we" / "what's next" on this project.
---

# grc — Session Resume

Load this first when starting or resuming a Vyra session with no prior context. It replaces re-reading the canonical docs from scratch by doing the read + synthesis in one pass, then hands off to the right paired skill for whatever comes next.

## The five canonical docs (in reading order)

Each has one job — don't look for status in the vision doc, or vision in the tracker:

1. **`.design/vyra-foundation.md`** — the capability specification: what Vyra is, the 7-layer operating model (persona + capabilities), the two central assets and how they're monetized, and the requirement tables. Sets context. **Carries no build-status.**
2. **`.design/vyra-architecture.md`** — the software layers and components (Presentation / API / Agents / Ingestion / Foundation / Data) built around the graph.
3. **`.design/vyra-graph-spine.md`** — the ground-truth graph schema (nodes, relationships, feeds).
4. **`.design/vyra-tracker.md`** — the project/build tracker: per-JTBD-layer status (live / partial / gap) + phase rollup. **This is where "what's done" lives now**, not the landscape doc.
5. **`.design/vyra-implementation-plan.md`** — the planner: phase sequencing, verification approach, per-phase detail.

## What to do when invoked

1. Read `.design/vyra-foundation.md` in full — what Vyra is, the 7-layer operating model (persona/capability only, no status), the two central assets, and the requirement tables.
2. Read `.design/vyra-architecture.md`'s Orientation + "Layers at a Glance" table — the component map. Stable across phases; skim unless the task is architectural.
3. Read only `.design/vyra-graph-spine.md`'s header (Version / Status / Source data lines) — not the full schema. If schema detail is actually needed for the task at hand, invoke `/vyra-graph` separately rather than reading the whole spine doc here.
4. Read `.design/vyra-tracker.md` in full — the JTBD Layer Status table and phase rollup are the authoritative "what's live vs. gap" view.
5. Read `.design/vyra-implementation-plan.md` in full — phase sequencing, what's ✅ done vs. not-started, verification approach.
6. Run `git log --oneline -10` and `git status --short` — the docs describe intent, git is ground truth for what's actually committed vs. sitting uncommitted in the working tree.
7. Report back — **every time this skill runs**, not just on first load — in this order:
   - **Phase status** — which phases are done (per the plan doc's ✅ markers + the tracker's phase rollup), which is explicitly next, and whether the working tree has uncommitted changes from the phase just finished.
   - **Open gaps/decisions** — pull directly from the tracker's JTBD Layer Status table and the plan doc's phase notes; they're already itemized, don't re-derive from scratch (e.g. `Person` unfed, the `Security`-category `ComplianceArea` gap, Phase 4b (Audit-Ready Export) blocked pending a scoping decision, `ANTHROPIC_API_KEY` not in `.env`).
   - **Recommended next step** — name the 1–2 most-ready next increments (least blocked first). If more than one is genuinely ready, state the tradeoff between them rather than silently picking one.
8. Then **stop and ask** — don't pick a direction yourself. Use `AskUserQuestion` with options along these lines (adapt wording to what the state report actually surfaced):
   - Understand the GRC platform — how it works
   - Add a new feature
   - Debug an issue
   - Something else
   Route the answer to the right paired skill/workflow below rather than assuming which one the user wants.

## Known staleness to flag, not silently fix

- **Tracker vs. plan.** `vyra-tracker.md` is a layer-readiness lens over the plan and can drift behind it — cross-check its statuses and phase rollup against the plan's latest completed phase (and against git). If the tracker says a layer is a gap but the plan marks the phase ✅ done, trust the plan + code and flag the tracker.
- **Spine vs. plan.** `vyra-graph-spine.md` gets updated phase-by-phase as part of each phase's own work — check its Version header against the plan doc's latest completed phase.
- **`/vyra-graph` vs. spine.** `/vyra-graph`'s SKILL.md is a hand-maintained *summary* of the spine doc and can drift behind it (e.g. it may still list retired blueprint-only node types, or omit a phase's additions). If its tables look out of step with what the spine doc or `v2.ts` actually say, say so — the spine doc is always the fallback authority, never `/vyra-graph`'s summary.

## Paired skills

- `/vyra-graph` — full schema detail (entities, relationships, Cypher patterns) once you know what you're building
- `/code-ninja` — coding-convention skill map (`clean-code`, `node-spine`, `react-spine`, etc.) once you're past "what's the state" and into "how do I write this"

Don't duplicate `/vyra-graph`'s content here — this skill is about project *state*, not schema.
