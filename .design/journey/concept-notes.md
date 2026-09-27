# Obligation Cockpit — Concept Notes

**Working design notes, not a canonical spec.** Captures the reasoning behind Stage 4 of the `.design/journey/` mockups (`04-obligation-cockpit.html`) — the model we landed on, how we got there, and what's still open — so it isn't lost the next time this is picked up. Companion to the four HTML mockups in this folder; treat like `.design/domain-extension.md` (decided/explored, not necessarily built).

---

## 1. The current model

**1.1 Core entity: a Compliance Task node, not a flat obligation instance.**
Stage 4's first build modeled "one obligation, assigned to one person." That's wrong. The real entity carries:
- **WHAT** — the obligation/control payload (from the Catalog)
- **WHO** — the accountable role/person — this is also the delegation tree (see 1.3)
- **WHERE** — the facility/location it applies to (from the ratified Blueprint)
- **WHEN** — a due point inside a bounded window (see 1.4)
- **Parent/child delegation edges** — the obligation a task was decomposed from, and the sub-tasks it fans out into

**1.2 WHO/WHAT/WHEN/WHERE are four hierarchies over one node set — not four tabs.**
The first build treated each as a separately-filtered view. Instead: they're four different ways to group the *same* task-node set. **WHO** (org/role/person tree) is the default spine, because it doubles as the delegation structure — Line Manager → Supervisor → Executor delegation follows the org chart's own parent-child edges, it isn't a separate tree. **WHERE** (facility/zone, from the Blueprint) and **WHEN** (the bounded calendar) are alternate nestings, or overlay attributes + rollups when WHO is primary. **WHAT** is usually the leaf payload, though nothing stops it from being a nesting too.

**1.3 Drill-down / bubble-up is one interaction, not four disconnected personas.**
Executive → Line Manager → Supervisor → Executor is a **drill path through the WHO tree**, not four fixed buttons showing four unrelated snapshots. Clicking a node in whichever hierarchy is currently the spine moves you deeper; a breadcrumb bubbles you back out. Any of the four dimensions can become the spine (a pivot), not just WHO.

**1.4 A bounded time window, not a rolling one.**
WHEN is clipped to **[Blueprint-ratification date → end of the current calendar year]** — a finite catch-up view ("everything I owe before Dec 31"), not an evergreen "today + 52 weeks" template. This is deliberately different from Stage 2's Catalog-level 52-week grid, which is correctly a generic, enterprise-agnostic template — Stage 4 is where that template gets **instantiated** against a real onboarding date.

**1.5 Visualization: a space-filling hierarchical chart, not a table.**
"More than 2D" and "a landscape in one view" point at a sunburst or treemap, not a report: nesting/angle/area = whichever dimension is currently the pivot; color = rolled-up compliance health; size = obligation load; click = drill in; breadcrumb = bubble out. This is what makes it a landscape (bird's-eye + drillable in the same artifact) rather than a filtered list. **Not yet decided which of sunburst vs. treemap** — see Open Questions.

**1.6 The agentic loop is a fifth, cross-cutting layer.**
Every task node's rendering also depends on where it sits in `foundation.md`'s real agent lifecycle — Observe → Interpret → Reason → Act → Verify → Learn:

| Loop stage | What the human sees |
|---|---|
| Dormant — not yet triggered | Nothing, or a faint next-due marker |
| Triggered, agent reasoning | A "working on it" indicator |
| Agent proposed, awaiting decision | An Approve/Reject card (rationale, confidence) |
| Agent executed autonomously | A dismissible status notice, not an action |
| Human executes directly | A plain task checkbox |
| Closed | Resolved, feeds the audit trail |

This layers **on top of** the health color from 1.5, not instead of it — a node can be simultaneously "on-track" (health) and "awaiting your decision" (loop-stage). These are different facts.

**1.7 Two distinct axes that both vary, at different timescales — don't conflate them.**
- **Autonomy Level (0–4)** — a property of the *workflow class* (e.g. "Monthly HIRA review, LOC-001, EHS Manager"), earned slowly via measured agreement rate (`foundation.md` §3). Stable across instances of the same recurring obligation.
- **Loop-stage** — a property of each individual *firing* of that workflow. Cycles every cadence trigger, resets each cycle.

**1.8 Divergence rules.**
- **Sibling divergence (across branches of the tree): unconstrained, expected.** Different workflow classes earn autonomy independently — a mature site's recurring inspection can sit at Level 3 ("informed") while the same obligation at a newly onboarded site is still Level 1 ("awaiting decision"). Not an inconsistency; the platform correctly reflecting that trust is earned per class.
- **Vertical rollup (parent vs. children): constrained.** A parent's displayed state is a **computed distribution/blend** of its children's states, never asserted independently of them — and completion is **monotonic**: a parent can't show "closed" while any child beneath it is still open.

**1.9 Trigger chain, mapped onto what's real today.**
`Signal (asset floor event, or a Schedule cadence firing) → Agent maps it to a Task → Agent reasons → Decision gate: Involve or Inform.` "Involve" = Level 1, the platform's actual default (pending `Decision`, human must approve/reject). "Inform" = Level 3/4, which must be *earned*, not toggled. Today almost everything renders as "Involve" — that's the honest starting state, and **"% of obligations now autonomous" is itself a legitimate executive-altitude metric** that falls directly out of this model, not a vanity number bolted on.

---

## 2. How we got here (the critique trail)

Kept deliberately, not cleaned up — the reasoning is as load-bearing as the conclusion, same discipline `graph.md`'s changelog and `domain-extension.md` already use.

- **v1 (built, `04-obligation-cockpit.html` as it stands today):** a flat persona switcher (Executive/Line Manager/Supervisor/Executor as four fixed buttons) plus Timeline/Role/Location tabs, each a separately-filtered view of the same 18 hardcoded obligation instances.
- **Rejected because:** personas were disconnected snapshots, not one traversable hierarchy; the "52-week view" was a dense per-row table, not a bird's-eye shape; the time window was an evergreen rolling 52 weeks from today, unrelated to when onboarding actually happened.
- **v2:** replace the flat switcher with drill-down/bubble-up through one hierarchy; bind the window to onboarding date → year-end instead of today → +52 weeks.
- **v3:** "more than 2D" — reframed as obligations **superimposed on the enterprise Blueprint**; WHO/WHAT/WHEN/WHERE recast as four pivotable hierarchies over one node set rather than four tabs; the delegation-tree insight (task decomposition mirrors the org chart, it isn't a second tree); sunburst/treemap proposed as the natural technique for a landscape-in-one-view.
- **v4:** the agentic vision stated directly — an obligation is a task fulfilled by a human or an agent; a true agentic GRC system reasons about the task, sometimes completes it autonomously (informs), mostly awaits a human decision (involves). Mapped onto `foundation.md`'s real Observe→Interpret→Reason→Act→Verify→Learn lifecycle and the Decision-gate mechanism that already exists.
- **v5:** resolved whether loop-stage should diverge as you drill down — yes, but along two distinct axes (Autonomy Level: per-class, slow / Loop-stage: per-instance, fast), with a monotonic-completion constraint on rollups and unconstrained divergence across sibling branches.

---

## 3. Open questions — not yet decided

- Sunburst vs. treemap vs. some other space-filling technique — not chosen.
- **Delegation-tree edges (`Obligation → sub-task → sub-task`) don't exist in the real Vyra graph today.** This is a genuine schema gap surfaced by this exercise, not just a UI concern — worth its own `track.md` entry if this direction is pursued for real, the same way the WINAIM comparison earned gap #18.
- How a "workflow class" is precisely scoped for Autonomy-Level purposes (obligation-type × role? × facility? something coarser?) — named, not specified.
- Whether a blended/composite color at non-leaf nodes (a mix of loop-stages beneath) stays legible once the tree gets deep — a real risk with sunburst/treemap techniques at scale, untested.
- Relationship to Stage 2's generic 52-week template and Stage 3's Blueprint ratification is conceptually resolved (this is the enterprise-instantiated version of that template) but not built.
- **No HTML mockup reflects v2–v5 yet.** `04-obligation-cockpit.html` as it stands is v1 — it needs a rebuild once/if this direction is approved for an actual mockup pass.

---

## 4. References

- `foundation.md` §0 (onboarding/Blueprint ratification), §2 (Actor polymorphism — Human/Agent, autonomy as a property of the assignment, not the platform), §3 (Autonomy Levels 0–4, agreement-rate-earned elevation, the Decision gate, the Observe→Interpret→Reason→Act→Verify→Learn lifecycle)
- `domain-extension.md` — companion comparison doc; same "decided, not implemented" discipline this doc follows
- `track.md` — Gap #7 (Scenario Simulation), Gap #9 (anemic domain model), Gap #18 (WINAIM content gaps); a delegation-tree-edge gap would land here if this direction is pursued
- `journey-first.md` — coined "operational cockpit," the term Stage 4's name comes from
- `journey/01-catalog-ingestion.html`, `02-catalog-browsing.html`, `03-enterprise-onboarding.html`, `04-obligation-cockpit.html` — the mockups this note explains
