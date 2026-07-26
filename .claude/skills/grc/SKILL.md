---
name: grc
description: Single authoritative entry point for resuming work on Vyra across sessions. Reads vyra-landscape.md, vyra-implementation-plan.md, and vyra-graph-spine.md's header, cross-checks against git log/status, and reports current phase, what's done, what's explicitly next, and open decisions/gaps the docs already flag. INVOKE at the start of a new session, after a context reset, or whenever asked "where were we" / "what's next" on this project.
---

# grc — Session Resume

Load this first when starting or resuming a Vyra session with no prior context. It replaces re-reading three docs from scratch by doing the read + synthesis in one pass, then hands off to the right paired skill for whatever comes next.

## What to do when invoked

1. Read `.design/vyra-landscape.md` in full — vision, operating model, the 7-layer JTBD status table.
2. Read `.design/vyra-implementation-plan.md` in full — phase sequencing, what's ✅ done vs. not-started, verification approach.
3. Read only `.design/vyra-graph-spine.md`'s header (Version / Status / Source data lines) — not the full schema. If schema detail is actually needed for the task at hand, invoke `/vyra-graph` separately rather than reading the whole spine doc here.
4. Run `git log --oneline -10` and `git status --short` — the docs describe intent, git is ground truth for what's actually committed vs. sitting uncommitted in the working tree.
5. Report back, in this order:
   - **Phase status** — which phases are done (per the plan doc's ✅ markers), which is explicitly next, and whether the working tree has uncommitted changes from the phase just finished.
   - **Open gaps/decisions** — pull directly from the landscape doc's 7-layer table and the plan doc's phase notes; they're already itemized, don't re-derive from scratch (e.g. `Person` unfed, the `Security`-category `ComplianceArea` gap, Phase 4's Audit-Ready Export sequencing hole, `ANTHROPIC_API_KEY` not in `.env`).
   - **Recommended next step** — name the 1–2 most-ready next increments (least blocked first). If more than one is genuinely ready, state the tradeoff between them rather than silently picking one.

## Known staleness to flag, not silently fix

`vyra-graph-spine.md` gets updated phase-by-phase as part of each phase's own work — check its Version header against the plan doc's latest completed phase. `/vyra-graph`'s SKILL.md is a hand-maintained *summary* of the spine doc and can drift behind it (e.g. it may still list retired blueprint-only node types, or omit a phase's additions). If its tables look out of step with what the spine doc or `v2.ts` actually say, say so — the spine doc is always the fallback authority, never `/vyra-graph`'s summary.

## Paired skills

- `/vyra-graph` — full schema detail (entities, relationships, Cypher patterns) once you know what you're building
- `/code-ninja` — coding-convention skill map (`clean-code`, `node-spine`, `react-spine`, etc.) once you're past "what's the state" and into "how do I write this"

Don't duplicate `/vyra-graph`'s content here — this skill is about project *state*, not schema.
