# Vyra v1 — AI-Native Engineering Practices Drift Report

**Scope:** `vyra-v1` repo, all 31 commits (`7b89ce2` … `53ae0a8`), current branch `v2026.07.05/clean-up`.
**Method:** git history analysis (log, numstat, shortstat), inspection of `CLAUDE.md`, `.claude/settings*.json`, `.claude/skills/*`, lint/build/test config, and source in `lib/`, `api/`, `agents/`, `cli/`.
**Not in scope:** feature/product completeness (already tracked separately in `.design/__ref/drift-from-agentic-grc-2026aug16.md`). This report is only about *how the code gets written and reviewed*, not what it does.

---

## 1. Standards encoded upfront

**Reference practice:** a `CLAUDE.md` (or equivalent) that captures architecture, naming conventions, schema/query patterns, and known gotchas, kept current as the system evolves, so standards live in the repo rather than in one person's head.

**What's here:** this is the strongest area in the repo, and unusually good for a single-developer project. `CLAUDE.md` documents the five-graph domain model, the CLI ingestion pipeline order, the Neo4j DB access rule ("API DB access via `lib/graph-db` only... No DML from UI"), coding conventions (functional/Ramda style, `lib/log` only, banned `Manager`/`Controller`/`Helper` suffixes), and workflow preferences. Beyond that, `.claude/skills/` holds 12 dedicated skill files — `neo4j-spine` (Cypher parameterization, MERGE-vs-CREATE, naming, audit-field, and error-handling rules with a `grep`-based verification checklist), `node-spine`, `react-spine`, `clean-code`, `dev-gen`, `dev-tools`, `sync-api-routes`, `vyra-graph`, `verify`, `dev-audit`, and `code-ninja` as a router into the rest. Most teams — including many "AI-native" ones — don't get past a thin `CLAUDE.md`; this repo has gone further into codified, checkable rules.

The gap is fidelity, not existence. Two concrete problems:

- `dev-audit` (the skill explicitly framed as "Run before every PR" / "pre-checkin drift and quality gate") is written against a *different* codebase's layout — `app/module/*/edge/api/<resource>/`, `jsLib`, `dbv4x.get(...)` — none of which exist in `vyra-v1`. The actual repo uses `api/modules/<domain>/{index,repo}.ts`. Every one of its 12 checks greps for paths and patterns that cannot appear here, so it would report "clean" on a codebase it isn't actually looking at. It reads as carried over from a prior project and never adapted.
- Rules stated in `CLAUDE.md` and `neo4j-spine` are already violated in the code that's supposed to exemplify them — detailed in §6 below (task-reference comments, incomplete audit fields). Standards that drift from themselves inside the same commit that documents them are a weaker signal than the presence of the standard suggests.

**Severity: Low–Medium.** The mechanism (encoded, checkable standards) is genuinely ahead of typical practice; the risk is that `dev-audit` gives false confidence that a gate exists when it cannot fire correctly on this repo.

---

## 2. Fresh-context review

**Reference practice:** the agent/session that writes a change is not the same one that approves it — a second, independently-primed context (a fresh Claude Code session, a subagent, or a human) reviews before merge, so mistakes the writer was blind to get a second pass.

**What's here:** none. All 31 commits are authored by the same person (`krishnan`/`Krishnan` — one contributor, no co-authors). There are zero merge commits in the entire history, meaning there has never been a pull request opened and merged, despite the repo having a live GitHub remote (`k-consult/vyra-v1`) that supports PRs. The only automation in `.claude/settings.json` is a `PostToolUse` hook that runs `eslint --fix` after every `Write`/`Edit` — a same-session auto-formatter, not a review step. The `verify` and `dev-audit` skills exist, but both are manually invoked ("Only when the user explicitly runs `/dev-audit`") by the same person, in the same session, that just wrote the code — self-review with a checklist, not independent review.

**Severity: High.** This is the textbook same-context-writes-and-self-approves pattern the reference practice is designed to avoid, and it's total (0 of 31 commits had any independent pass).

---

## 3. PR/commit size and scope

**Reference practice:** commits/PRs are small and scoped to one concern, so a reviewer (human or fresh-context agent) can actually hold the whole diff in their head.

**What's here:** commits are large and multi-domain. Typical "Phase N" commits touch design docs, CLI seed CSVs, API modules, agent code, and UI in a single commit:

- `5788ee7` "Phase 7 - human-in-the-loop decision gate" — 20 files, +549/−23, spanning `.claude/skills/`, `.design/`, `agents/`, `api/`, `ui/`.
- `00f3d48` "phase-3" — 23 files, +607/−95.
- `fa56b84` "phase-2 - 52W view" — 16 files, +709/−24.
- `3fa8eba` "Phase 4b - control-intelligence" — 13 files, +296/−46.

Five such multi-file commits (`fb2c9a5`, `3fa8eba`, `be1f460`, `f8d9a5f`, `5788ee7`, `fa85bab`, `e5d1a69`) landed in a single calendar day, 2026‑08‑16, between 07:49 and 21:52 — an extended agent-assisted session producing what would normally be several separate reviewable units, committed straight through with no intermediate checkpoint. Commit messages are terse phase labels ("Phase 8 — Complete the Agent Roster", "minor bug fixes" ×3, "doc update"), not scoped-change descriptions. There has never been a PR at all — the current branch is 29 commits ahead of `origin/main` and has never been merged back through GitHub's review surface, even though that surface exists and is configured.

**Severity: High.** Diffs of this size, landing directly on a branch with no PR, are well past what a reviewer — fresh-context agent or human — can meaningfully hold in mind in one pass.

---

## 4. Automated gates before human review

**Reference practice:** lint, type-checking, tests, and (ideally) security scanning run and pass *before* anything reaches a human, so review time is spent on logic and intent rather than catching mechanical errors.

**What's here:** effectively nothing blocks a commit.

- The only wired automation is the `PostToolUse` `eslint --fix` hook — it *rewrites* files opportunistically, it doesn't fail a change or gate anything.
- `eslint.config.mjs` sets `@typescript-eslint/no-explicit-any` to `'warn'`, not `'error'` — and it shows: `grep` across `api/agents/cli/lib/ui/src` finds **256** occurrences of `: any` / `as any`, effectively unenforced type safety.
- `lib/package.json` declares `"test": "jest"` (plus `test:watch`, `test:coverage`), but there is not a single `*.test.ts`, `*.spec.ts`, or `describe(`/`it(` block anywhere in the repository. The test command is aspirational — it would fail immediately ("no tests found") if run.
- There is no CI at all: no `.github/workflows`, no other CI YAML anywhere in the tree. No `husky`/pre-commit hook (`.git/hooks/pre-commit` doesn't exist). No `tsc --noEmit` gate wired to anything — each workspace's `build` script runs `tsc`, but nothing runs it automatically before a commit lands.
- No security/secret scanning of any kind — see the `CLAUDE.md` credential note under §6.

**Severity: High.** Every category the reference practice expects to run before a human (or reviewing agent) looks at code — lint-as-gate, types, tests, CI, secrets — is either absent or explicitly non-blocking here.

---

## 5. Human role in review

**Reference practice:** human attention is spent on architecture and intent (does this change the right thing, in the right way), with mechanical correctness already filtered out by gates — and there's visible evidence review happened (PR comments, requested changes, at minimum a considered commit message).

**What's here:** there is no review surface to evaluate, because none of the 31 commits went through one — no PRs, no merge commits, no review comments anywhere in the history (§2, §3). `CLAUDE.md`'s own "Workflow Preferences" section *asks* for the right kind of human checkpoint — "Plan first. For non-trivial tasks, outline the approach and wait for approval before writing code" — which is exactly an architecture/intent-level gate, done before code exists rather than after. But there's no artifact in the repo showing that happened per change (no plan docs, no PR descriptions, no approval trail) — the "Phase N" commit messages read as after-the-fact labels applied once work was already done, not evidence of an upfront plan-and-approve step per commit. It's not possible to distinguish "planned and approved, then committed directly because there's no PR habit" from "written and committed with no separate approval step at all" — and either way, nothing downstream of that intent-level checkpoint (the actual diff) gets a second look at all, line-level or otherwise.

**Severity: High.** Not because of evidence of *bad* review (rubber-stamping), but because there is no review event to point to for any commit — the more extreme case.

---

## 6. Consistency of AI-generated code over time ("confidently wrong" patterns)

**Reference practice:** watch for code that reads as clean and idiomatic but silently mishandles errors, edge cases, or diverges from the schema/contract it's supposed to honor — the specific failure mode of capable models producing plausible-looking code that's subtly wrong, which is *harder* to catch in review than obviously bad code.

Four concrete instances found:

**a. The codebase's own conventions are already drifting from themselves.** `CLAUDE.md` states under Coding Conventions: *"Comments: only when the WHY is non-obvious. No docstrings. No task-reference comments."* `api/modules/intelligence/repo.ts` — one of the most recently written files (Phase 7/8) — is full of exactly the comments this rule bans: `// Phase 7 — Human-in-the-Loop Decision Gate...`, `// (see .design/7-human-in-the-loop-decision-gate-plan.md)`, `// ...same convention as Phase 0.5's :Catalog convention`, `// ...see vyra-implementation-plan.md Phase 8`. The rule and the violation are in the same repo, written by the same tool, days apart.

**b. Error handling that looks compliant with the written rule but is dangerous for this domain.** `neo4j-spine`'s own §8 rule is reasonable in the abstract — rethrow on write failure, safe default (`[]`/`null`) on "non-critical" read failure — and the code follows it: `listFindings`, `listRisks`, `listDecisions`, and `getReverseTrace` in `api/modules/intelligence/repo.ts` all catch any Neo4j error and return `[]` or `null`. But in a compliance/audit product, "no findings" and "the database call failed" are not distinguishable to the caller or the UI — a Neo4j outage or a bad query would render as *the system is fully compliant with zero open risks*, which is the worst possible failure mode for exactly this product. The rule is being followed to the letter while missing the point for this domain.

**c. Silent partial writes with no post-write verification.** `agents/tools/graph-write.ts`'s `writeFinding` and `writeDecision` both `MERGE` the primary node unconditionally, then `MATCH` a related node (`Control` / the decision's source entity) and `MERGE` the relationship *only if that `MATCH` finds something*. If the id doesn't resolve — stale reference, timing issue, bad agent output — the Finding or Decision is still created, no exception is thrown, `exec2` returns normally, and the caller's `try/catch` reports success. The result is an orphaned Finding with no `AGAINST` edge to a Control, or a Decision with no `ABOUT` edge to its source — both invisible unless someone queries the graph directly. Nothing in the codebase re-checks that the relationship was actually created.

**d. Documented schema requirements not met by the code that introduced the pattern.** `neo4j-spine` §7 requires `createdBy`, `updatedAt`/`updatedBy`, and `archived`/`archivedAt`/`archivedBy` on every node with a lifecycle. The `AgentProposed` `Control`/`Risk`/`Finding` nodes created in `api/modules/intelligence/repo.ts` (Phase 7/8 — the newest agent-facing write paths) set only `createdAt` and `status`; `createdBy`, `archived`, and the rest are simply absent. Because these are also the reference implementations the file's own comments point back to for "the same convention," any future agent-written code copying this pattern will propagate the gap forward rather than closing it.

Combined with §1's finding that `dev-audit` — the one mechanism that could catch (c) and (d) mechanically — is checking a codebase layout that doesn't exist here, these are drifts with no safety net positioned to catch them.

**Severity: High.** (b) and (c) are not style nits — they're silent-failure and silent-data-loss patterns in the write/read paths of a system whose entire value proposition is trustworthy compliance state.

---

## Additional observation (outside the six areas, but load-bearing)

`CLAUDE.md` — a file committed to the repo and readable by anyone with clone access — states the Neo4j database password in plaintext (`Prerequisites: ... Neo4j Desktop running with password 'vyra-ai@2025'`). `.env` itself is correctly git-ignored and not tracked, but the credential ended up in a tracked doc anyway. This is a direct downstream consequence of §4: with no gate of any kind (secret scanning or otherwise) between an edit and a commit, nothing catches this before it lands.

---

## Prioritized drift list, ranked by risk

1. **No automated gate blocks anything before it lands.** Lint is warn-only (256 unenforced `any` usages), a declared `jest` test suite has zero actual tests, there is no CI, no pre-commit hook, no type-check gate, no secret scanning. The only wired automation (`eslint --fix` on save) rewrites rather than blocks. Every other item on this list exists *because* nothing stops it.
2. **Zero independent review, ever.** 31/31 commits by one author, 0 merge commits despite a live GitHub remote, no PR has ever been opened. The `dev-audit`/`verify` skills that could substitute for a second reviewer are invoked manually, by the same person, in the same session that wrote the change.
3. **Large, multi-domain commits merged straight to a branch with no PR.** Commits routinely span 10–23 files and hundreds of lines across design docs, CLI, API, agents, and UI at once; five such commits landed in one day (2026‑08‑16). The current branch is 29 commits ahead of `origin/main` and has never been merged through the review surface that exists.
4. **Silent read-side failure masking as "compliant."** `listFindings`/`listRisks`/`listDecisions`/`getReverseTrace` return `[]`/`null` on any Neo4j error — in this specific product, an outage is indistinguishable from "no risk, fully compliant," which is the single worst failure mode a GRC platform can have.
5. **Silent partial writes with no verification.** `writeFinding`/`writeDecision` can create a Finding/Decision with a missing required relationship (orphaned from its Control/source) with no thrown error and no check that the relationship actually landed.
6. **The one mechanical safety net that could catch #4/#5 doesn't apply to this repo.** `dev-audit`'s 12 checks are written against a different codebase's file layout (`app/module/*/edge/api/*`, `dbv4x`) and would silently report "clean" without ever examining `vyra-v1`'s actual `api/modules/<domain>/repo.ts` files.
7. **Standards are already drifting from themselves in the newest code.** `CLAUDE.md` bans task-reference comments; the most recently written core file (`intelligence/repo.ts`) is full of them. `neo4j-spine`'s audit-field rule (`createdBy`, `archived`, etc.) is unmet on every `AgentProposed` node type introduced since Phase 7 — and that same file's comments frame itself as the pattern future work should follow, so the gap compounds forward.
8. **Type safety erosion with no downward pressure.** `no-explicit-any` is warn-only; 256 occurrences accumulated over 31 commits with nothing forcing a paydown.
9. **Plaintext Neo4j credential committed in `CLAUDE.md`.** Not one of the six requested areas directly, but a direct symptom of #1 — no gate exists that would have caught it.
