# Journey-First — The Missing Spine

**A critical evaluation: the platform is built graph-first, not journey-first.** `foundation.md` specifies seven personas and their JTBDs; `track.md` scores whether each *layer* is fed by live data. Neither document asks the question this one does: **does the platform take a persona through their actual day, end to end, or does it just expose what's stored?** Compiled 2026-09-22, prompted by a product-expert review of the live UI against the intended onboarding journey.

> **Status: critique, not a status report.** Doc 7 in the `.design/README.md` reading order — read alongside `foundation.md` (1) and `track.md` (5), not in place of either. It exists to make one finding legible and durable: the current UI is organized by graph domain, not by JTBD — and that gap has a name (Gap #8 in `track.md`) but no journey attached to it until now.

---

## The vision, as specified

A platform earns the word "agentic" (per `foundation.md`) only if it can carry an enterprise through three distinct days without ever losing the thread. As described:

### Day X — Catalog day
- Ingest the regulatory catalog.
- View the compliance landscape — traverse the full catalog in all directions.
- View a 52-week calendar of what's due and when.
- See tasks and obligations.

### Day X+n — Onboarding day
- Onboard an enterprise: select the applicable domain/regulation.
- Set up the enterprise — user uploads an artifact, starts from a base template, or a hybrid of both.
- This covers physical structure (enterprise → region → zone → facility), people (employees), roles, and escalation hierarchy.
- **Checkpoint:** org is set and mapped to a regulatory framework. No signals yet. The 52-week compliance calendar should already show real tasks, laid out and mapped to the new org.

### Day X+n+n — Operationalizing
- Signals start flowing in.
- Tasks get allocated, workflows run, compliance gets handled — the whole nine yards.

This is a **journey**, not a feature list: each day builds on a checkpoint the previous day produced. That's the test the current platform needs to be held to.

---

## Where the platform actually is

### Day X — closer to real, still not a full experience (updated 2026-09-25)

- Ingestion works: `cli/` pipeline is live (parser → compiler → projection → `LOAD CSV`).
- `knowledge/`, `landscape/`, and `calendar/` screens exist and are backed by real graph data — see `track.md`'s L1/L3 rows (🟢 live).
- **The Day-1 framing gap is partially closed.** A persistent, persona-grouped nav shell (`ui/src/components/nav-shell.tsx`) now replaces the ad-hoc per-page header this section originally found — every screen is reachable from one "here's what you can see today" sidebar, grouped by the 7-layer operating model instead of by graph domain.
- **`calendar/` is no longer browse-first.** It now lands on a ranked worklist (overdue / due-in-14-days), with the old full-grid demoted behind a toggle.
- **`knowledge/`, `landscape/`, and `assurance/` are still browse-first** — the worklist treatment hasn't been extended to them.
- **Verdict:** the entry point now exists. Of the "live" screens, only Calendar is actually ranked/actionable rather than browse-only — the other four are the natural next slice of the same pattern.

### Day X+n — org setup still does not exist; the transition-tracking half got a first slice (updated 2026-09-25)

Confirmed by direct code search — zero hits for `shadowMode`/`continuityBaseline`/`decommission` across `api/`, `agents/`, `cli/`, `lib/` (`cutover` now has real hits — see below). Confirmed again by the UI tree itself:

- `ui/src/features/enterprise/` still contains exactly one screen: `contracts.tsx`. No org, region, facility, role, or escalation *builder* exists anywhere — `Organization`/`Role`/`Person`/`Facility`/`Asset`/`Vendor` are still seeded entirely by CSV batch (`track.md` Gap #10). There is still no "select domain/regulation," no "upload artifact vs. template vs. hybrid" flow, no checkpoint concept.
- `ui/src/features/dashboard/` and `ui/src/features/execution/` are still **empty directories**.
- **What did change:** `track.md` Gap #8 got its first real slice — `CutoverCriterion` is now live graph state (a workflow's proving window, system-of-record, and a queryable `cutover-overdue` status), visible at `/onboarding`. This is real, but it's the **transition-measurement** mechanic for a workflow already underway — it doesn't touch org/role/facility/asset setup at all, which is what this section is actually about.
- **Verdict for org setup: unchanged, still a total gap.** `CutoverCriterion` is genuine progress on a different, later piece of `foundation.md` §0 — not this one. It is still the literal bridge between Day X and Day X+n+n; nothing downstream can exist without it.

### Day X+n+n — plumbing exists, product doesn't

- Signals do flow in live (`POST /operational/signals`) and do reactivate tasks (`track.md` Gap #3, closed).
- But 3 of 4 agent families still reason single-shot, not multi-turn — only `control-intelligence` has the tool-using upgrade (`track.md` Gap #16, scoped narrowly).
- No workflow-orchestration layer exists — no cockpit for "task allocated → in progress → resolved" as a driven process.
- No domain objects enforce their own invariants or raise events (`domain.md`'s Aggregates/Domain Events/Factories are a target design, not built code — `track.md` Gap #9). "Workflow" today means rows and routes, not a system state machine.
- **Verdict:** the wiring for signals-in is real; the operational cockpit around it is not.

---

## Root cause

The build went **schema-first**: five graph domains (`graph.md`) → a UI screen per domain (`knowledge`, `execution`, `intelligence`, `assurance`, `enterprise`, ...) → done. Nothing in the architecture organizes around `foundation.md`'s seven **personas** — Catalog Admin, Ops Admin, Planner, Ops Supervisor, Compliance Mgmt, Risk Manager — even though the spec names them explicitly as who each layer serves.

The result is a technically correct data model with no product wrapped around it. "It looks like a view of what's stored" is accurate, because that is what was built: a graph browser, not a journey.

---

## What this changes

`track.md`'s Gap #8 ("Onboarding-as-a-phase") already names the biggest hole in the platform, but frames it as a missing *subsystem* (shadow mode, cutover criteria, continuity baseline). This document adds the finding that closing Gap #8 as a subsystem still won't produce the vision above unless it's built **as the Day X+n leg of a three-day journey**, with:

- A real Day X entry point (not just existing screens, a guided "what can I see today" landing).
- A real onboarding flow for Day X+n: select domain/regulation → upload/template/hybrid → structure + people + roles + escalation → checkpoint gate that visibly re-renders the Day X calendar against the new org.
- A real operational cockpit for Day X+n+n, not just live signal writes underneath existing domain screens.

## Priority ordering (updated 2026-09-25)

1. **Onboarding-as-a-phase (Gap #8)** — first real slice done (`CutoverCriterion`, transition-tracking only, `track.md`). The literal missing bridge — org setup (select domain/regulation, upload/template/hybrid, structure+people+roles+escalation, checkpoint) — is still fully unbuilt.
2. ~~Reframe the UI around JTBD, not graph domain~~ — **done.** Persistent persona-grouped nav shell replaced the graph-domain-organized header pattern; Ops Supervisor and Risk Manager each got their own screen split out of `/intelligence`'s mashup; Calendar became worklist-first. Not yet extended to Knowledge/Landscape/Assurance — those are still browse-first, the natural next slice of the same pattern, not a new priority.
3. **Domain model (Gap #9)** — becomes worth doing once there's an onboarding flow to drive it; right now it's architecture with no workflow to serve. Unchanged.
4. **Scenario Simulation (Gap #7)** — real, but secondary. It's a Day X+n+n capability, and Day X+n+n has no home to live in yet. Unchanged.

---

## Where to go next

- **What's live/partial/gap today** → `track.md`
- **The 7-layer operating model and personas this doc measures against** → `foundation.md`
- **Software layers a journey-first rebuild would touch** → `architecture.md`
- **DDD model an onboarding flow would need to construct/ratify** → `domain.md`
