# Phase 7 — Human-in-the-Loop Decision Gate: approve/reject mapping

## Context

Every `Decision` node (`agents/tools/graph-write.ts`'s `writeDecision`) is created with `status: 'pending'` and stays there forever — `ui/src/features/intelligence/intelligence.tsx`'s `DecisionsSection` renders it as a read-only card. Autonomy Level 1 ("Agent Recommends, Human Approves," `vyra-landscape.md`) is asserted in UI copy (`"Autonomy Level 1 — proposals only, pending human review"`) but nothing anywhere lets a human actually review it. This phase closes that: approve/reject becomes a real action, and approval writes the thing the agent was recommending, not just a status flip.

Two live `Decision.type`s exist today, from `control-intelligence` and `signal-intelligence`. They resolve differently on approval — laid out below, not glossed over, because forcing one shape onto both would be exactly the kind of guess this repo has consistently avoided (`Person.roleId`, `Asset`'s `Security`-category gap, etc. are all left honestly unresolved rather than faked).

## Resolved: the "No DML from UI" question

`CLAUDE.md`'s Neo4j section states "No DML from UI — MATCH only." Read literally against a UI approve button, that looks like a conflict. It isn't, once read against precedent: `POST /operational/signals` (Phase 3) is already a UI/external-triggered endpoint that performs a real graph write (`createSignal`, a `MERGE`) — the rule is about the **read-serving routes** (`GET /*`) staying MATCH-only, not about banning purpose-built action endpoints. Decision approval follows the same shape as signal creation: a narrow, named endpoint, one specific write, not generic UI-driven Cypher. The UI still never touches Neo4j directly, still only speaks HTTP to the API — consistent with the existing invariant, not an exception to it. Flagging this explicitly since it's inferred from precedent, not a rule stated outright — say so if the intent was actually stricter.

## Decision-type → write mapping

### `control-recommendation` (from `control-intelligence`, `sourceId` = `Requirement.id`)

**On approve**: create a real `Control` node, `-[:IMPLEMENTS]-> Requirement` (existing relationship, existing direction — same one the catalog pipeline already uses 30 times). This directly resolves the gap the agent found: an uncontrolled Requirement gets a real Control.

**Gap this surfaces**: `reasonWithLLM` returns only `{rationale, confidence}` — no structured field for *which kind* of control (policy / SOP / operational check) was recommended, even though the prompt already asks for exactly that choice. Parsing the free-text rationale for a keyword would be a guess, and this repo doesn't do that (see `Person.roleId`: left blank rather than force-matched). **Proposed fix, scoped to this phase, not deferred to Phase 10's tool-use work**: extend `control-intelligence`'s JSON response contract to add `recommendedControlType: 'policy' | 'sop' | 'operational-check'` alongside `rationale`/`confidence` — the model is already being asked to choose from exactly that enum, so this is asking it to state its own answer structurally, not inventing new judgment.

**New Control's shape**: `id: CTL-{decisionId}`, `controlType` = the field above, `description` = `Decision.rationale`, `status: 'proposed'`. Label `:AgentProposed` (alongside `Control`) — a fourth origin category next to `:Catalog`/`:Enterprise`/unlabeled-legacy, same structural-label reasoning Phase 0.5 already used ("a property flag is invisible to Cypher pattern matching... a second label makes catalog-scoping structural"). Lets coverage-score queries (`getCoverageScore()`) filter it in or out explicitly later, instead of it silently blending into catalog data.

### `deviation-assessment` (from `signal-intelligence`, `sourceId` = `Signal.id`)

This one forks on whether the signal's asset had Control coverage — `fetchUnassessedSignals` already surfaces this via `taskIds` (non-empty = covered, matching Task carries `controlIds` per Phase 3; empty = coverage gap, same condition the `Security`-category assets already hit).

**Covered case, on approve**: write a `Finding`, `-[:AGAINST]-> Control` for each `controlId` on the linked Task(s). `writeFinding()` (`agents/tools/graph-write.ts`) is already scaffolded but takes a single `controlId` — needs widening to `controlIds: string[]`, one `AGAINST` edge per id, since one asset can resolve to multiple Controls (same reason `createSignal`'s Task already stores `controlIds` as an array, not a single FK).

**Uncovered case, on approve**: still write a `Finding`, but with zero `AGAINST` edges and a new `-[:ABOUT]-> Signal` edge instead (mirrors `Decision`'s own `-[:ABOUT]->` convention). Recording "yes, this was a real deviation" honestly, without fabricating a Control link that doesn't exist. This is arguably the more valuable half — it's exactly the `Security`-category gap surfacing as an actual Finding instead of staying invisible.

Both cases get label `:AgentProposed` too, same reasoning as above.

## Schema additions (`Decision`)

- `status`: was already a free string defaulting to `'pending'`; now a real enum — `'pending' | 'approved' | 'rejected'`
- `reviewedBy`: `Person.id` if resolved, else blank — see attribution below
- `reviewedAt`: datetime
- `reviewNote`: string, optional (mainly for rejection reasons)
- New relationship: `Decision -[:REVIEWED_BY]-> Person`, written only when `reviewedBy` resolves to one of the 7 seeded people — same dual-representation pattern already used for `Task.owner` (free-text fallback + real edge when resolvable)

## Attribution — no auth exists yet, don't fake one

There's no login/session anywhere in this repo. Two honest options, not a silent default:
1. A simple picker in the UI ("Reviewing as:") populated from the 7 real seeded `Person` rows (`GET /operational/people`, already live from Phase 6) — no real auth, but attributes to a real person instead of nobody.
2. Leave `reviewedBy` blank for now, revisit once Identity/SSO (already tracked as a gap) exists.

Recommending (1) — it's real data already sitting there unused for this exact purpose, and it's the same "use what's real, don't fabricate, don't silently skip" instinct that fed `Person` in the first place. But this is a UX call, flagging rather than deciding unilaterally.

## Rejection

Simpler by design: `status: 'rejected'`, optional `reviewNote`, no graph mutation beyond the `Decision` itself. Nothing gets created for a rejected recommendation.

## New API surface (`api/modules/intelligence/`)

- `resolveDecision(id, action: 'approve' | 'reject', reviewedBy?, note?)` in `repo.ts` — branches on the `Decision.type` MATCH-ed by `id` to run the right write (Control creation, Finding creation with the covered/uncovered fork, or just the status flip for reject). Lives in the API layer, not `agents/` — consistent with "agents never call the API, and the API never calls agents" (`vyra-architecture.md`); this is the API's own second direct-write path, same category as `createSignal`, not an agent action.
- `POST /intelligence/decisions/:id/approve`, `POST /intelligence/decisions/:id/reject` — narrow, purpose-built, matching `POST /operational/signals`'s precedent (see the DML question above).

## UI (`ui/src/features/intelligence/intelligence.tsx`)

- `DecisionCard` gets Approve/Reject buttons when `status === 'pending'`, hidden otherwise (already-resolved decisions render as-is with their `reviewedBy`/`reviewedAt` shown instead).
- Reviewer picker (see Attribution) — likely a small `<select>` sourced from the `people` state the component already fetches for the People section.
- Optimistic UI or refetch-on-action — mirrors the existing `load()`/`RefreshCw` pattern already in this component.

## Verification approach (matching the standard this repo holds every phase to)

- Approve a real `control-recommendation` Decision live, confirm the new `Control` node + `IMPLEMENTS` edge via direct Cypher, confirm it's excluded/included correctly by `getCoverageScore()`'s existing `:Catalog`/`:Enterprise` label filter (it should currently be excluded — filter logic may need a decision on whether `:AgentProposed` controls count toward coverage).
- Approve a `deviation-assessment` Decision against both a covered signal and an uncovered (`Security`-category) one, confirm the `Finding` shape differs correctly in each case.
- Reject a Decision, confirm no graph mutation beyond `Decision.status`/`reviewedBy`/`reviewNote`.
- Hit both new API routes live with invalid `id`/already-resolved-decision cases, confirm clean 4xx, not silent no-ops.
- Load `/intelligence` in a real browser (Playwright), approve/reject through the actual buttons, confirm the card updates and zero console errors.

## Resolved (2026-08-16)

1. **Coverage counting**: `:AgentProposed` Controls stay **excluded** from `getCoverageScore()`, same treatment as the 15 legacy per-incident Controls today. The new `Control`/`IMPLEMENTS` edge is real and stops `control-intelligence` re-flagging the Requirement as uncontrolled, but the `/assurance` headline percentage stays conservative — it doesn't move until a control is verified operational, not just proposed-and-approved. Status-gating (`Control.status: 'proposed' → 'operational'`, coverage keyed off status) is the correct long-term answer but is explicitly out of scope for Phase 7 — a fast-follow once "verified operational" has a real mechanism, not built speculatively now.
2. **Attribution**: build the reviewer picker now (Attribution option 1) — a `<select>` sourced from the 7 real seeded `Person` rows. Not waiting for SSO.
3. **DML from UI**: confirmed — purpose-built `POST` action endpoints (like the existing `/operational/signals`) are allowed to perform real graph writes. `GET` read routes stay MATCH-only. Phase 7's two new `POST /intelligence/decisions/:id/{approve,reject}` routes follow the same shape.

All three open calls are now closed — this phase is fully spec'd and buildable.
