# Drift from "Agentic GRC" — Master TODO
**Vyra v1 · reviewed 2026-08-16 · against commit `f8d9a5f` ("signal-intelligence and persons")**

Tracks the gap between what the docs/UI claim and what the code actually does. Source of truth for status/build detail stays `vyra-tracker.md` / `vyra-implementation-plan.md` / `vyra-graph-spine.md` — this file is the standing punch-list distilled from reviewing those against the actual code.

---

## Closed since last review (Phase 6, same-day commit)
- `Person` is now fed (7 rows, extracted from free-text name fields — `capturedBy`/`reviewedBy`/`CAPA.owner`/`Verification.verifiedBy`/`Risk.owner`/`Task.owner`) — no longer "declared, not fed."
- `WORKS_AT` (Person → Facility) live, many-valued (7 people × 2–4 facilities each, no single "home" exists in the data).
- Signal-driven `Task.owner` now resolves to a real name (`Asset -[:LOCATED_AT]-> Facility <-[:WORKS_AT]- Person`) instead of falling back to `'UNKNOWN'`; a real non-determinism bug (multiple people per facility) was found and fixed with `ORDER BY person.id LIMIT 1`.
- New surfaced gap, not a bug: `HAS_ROLE` (Person → Role) still never fires — the 7 people's real job titles (QA Executive, Corporate EHS, etc.) don't match any of the 16 seeded `Role` rows, because that Role catalog comes from a different vertical (Industrial Parks/Warehouse/3PL) than the legacy 7-incident dataset the names come from (biotech/pharma/food-safety). `roleTitle` preserves the real text; `roleId` stays blank.

---

## Master TODO (one-liners)

**Agents**
1. Implement `risk-intelligence` agent (stub — `console.log('Logic TBD.')`)
2. Implement `assurance-intelligence` agent (stub — same)
3. Add scheduling/event-triggering for agents (currently manual CLI invocation only)
4. Upgrade `reasonWithLLM` from single-shot JSON prompt to multi-turn tool-use
5. Scope + build Scenario Simulation (L7) — needs agents beyond `control-intelligence`

**Human-in-the-loop**
6. Add approve/reject action on Decision cards (currently read-only display)
7. Wire an approved Decision to actually mutate the graph (create Control/Finding, flip status)

**Knowledge / Interpret**
8. Add `Contract` node type (L1 — unscoped, no node exists)
9. Model SOPs as a distinct catalog item (currently folded into `Control.controlType`)
10. Reconcile `Person.roleTitle` against the `Role` catalog so `HAS_ROLE` can fire — two seed datasets are different verticals with zero title overlap (new gap surfaced by Phase 6)
11. Resolve the 2 unmapped `Security`-category assets (coverage gap)

**Oversight / Assurance**
12. Model Escalation Paths as a real graph chain to `Person`/`Role` (currently free text on `Incident`) — now unblocked, since `Person`/`WORKS_AT` are live as of Phase 6
13. Replace synthetic Audit-Ready Export seed data with a real audit-trail source
14. Tie 52-week calendar occurrences to actual task-completion tracking (currently planned/derived only)

**Platform / infra**
15. Re-verify calendar matrix UI in browser (no Playwright pass since v2 consolidation)
16. Label the 16 legacy `Regulation` nodes (neither `:Catalog` nor `:Enterprise`)
17. Build the real central `vyra-catalog` service (currently same-DB, label-only split)
18. Add Identity/SSO integration (planned, not built)
19. Add Notifications/Alerting integration (planned, not built)
