# SubjectType Registry — Plan

## Context

Built during this session: `applicability.md` §7 step 3 (tenant `Asset -[:OF_TYPE]-> SubjectType` classification) — a new `applicability-intelligence` agent, the Annotate onboarding stage (hierarchical tree, filter/search, bulk confirm, reclassify-after-resolution, per-asset "Invoke model" preview), and the tenant-scoped classification-run trigger. All of that assumes the `SubjectType` vocabulary itself is fixed and complete — 11 rows seeded once (`cli/feeds/csv/catalog/cpcb/subjectTypes.csv`), read-only from every other system's point of view.

That assumption breaks the first time a reviewer hits an asset with no matching type in the dropdown. This plan is the next piece: let `SubjectType` be a managed, growable registry instead of a fixed seed — without turning it into per-tenant ad hoc vocabulary.

**Not started — no code written.** This is a design-only plan to resume against in a fresh session.

## Decisions reached in discussion (2026-11-21)

1. **Central, not tenant-scoped.** `SubjectType` is `:Catalog` data — the shared bridge vocabulary between the catalog's `Obligation.subjectTypeId`/`BINDS_TO_TYPE` and every tenant's own `Asset.OF_TYPE`. A tenant-side "add new" write would let every tenant invent its own ad hoc types, defeating the point of a shared vocabulary. The registry screen belongs under global `/catalog` (Vyra Central), not any tenant-scoped route.

2. **Add = Decision-gated propose/ratify, not a direct write.** Mirrors the existing `catalog-obligation-proposal` (Manual Entry channel) and `Contract`/`Permit`/`Warranty` propose-then-approve pattern already live in this codebase — not a new mechanism. Annotate's dropdown, when nothing fits, should route into this propose flow rather than growing its own write path.

3. **Edit scope is narrow.** `description`/metadata safe to change freely. `id`/`bindsAt` should be treated as immutable once any `Obligation.subjectTypeId` or tenant `OF_TYPE` edge references the row — same instinct as `Contract`/`Regulation` immutability (new node + supersede, never mutate a referenced identity in place).

4. **Retire, never delete.** A hard delete would orphan every `BINDS_TO_TYPE`/`OF_TYPE` edge pointing at the row. Mark inactive instead — consistent with this platform's "documented absence is a first-class state" rule (`foundation.md` §2).

5. **Usage view is required before any retire decision.** For a given `SubjectType`: which `Obligation`s bind to it (`BINDS_TO_TYPE`), and how many tenant `Asset`s across the platform are currently classified under it (`OF_TYPE`). Without this, retiring a type that's actually in use silently breaks obligation mapping for whoever's using it.

## WINAIM-CPCB-Map.xlsx — evaluated, not a seed

`/Users/krishnan/_ks/work/win-aim/documents/from-winaim/08-OCT-2026/WINAIM-CPCB-Map.xlsx` was proposed as a master seed and evaluated this session (and once before, `track.md`'s Catalog Pending list, 2026-11-16, in the Demography/workerCategory context — same conclusion reached independently twice now).

Two sheets: Sheet1 is WINAIM's own meta-ontology (Topic→Sub-topic→Source→Activity→Asset→Aspect→Obligation→...→Event) — structurally interesting (parallels Vyra's own five-graph model) but not data. Sheet2 is the useful part: Key Topic (Water/Air&Noise/Waste) → Sub-Topic → Sources/Activities/**Assets Covered**/Control Measures/Measurements, 37 rows.

**Verdict: good candidate-expansion source, not a drop-in seed.**
- "Assets Covered" cells are comma-separated groupings (e.g. "Boiler, DG, furnace, heater, kiln, incinerator" under one sub-topic) — atomizing into individual `SubjectType` candidates is manual judgment, not a mechanical import.
- No obligation-text linkage — the file never says which real `Obligation` names each asset type. `BINDS_TO_TYPE` still has to be derived obligation-by-obligation, same discipline that produced today's 11 rows (`applicability.md`'s "most specific regulated entity" resolution rule, and its documented Fire System/Borewell gaps).
- Purely environmental (Water/Air&Noise/Waste) — no stable ids, never validated against a real tenant asset register.

**If pursued**: treat Sheet2 as a checklist to work through by hand (atomize → cross-check against real obligation text → propose via the registry's own propose/ratify flow once it exists), not a CSV to replay.

## Open questions for next session

- Exact API/route shape for the registry screen (list/usage-view/propose/retire) and the propose-flow Decision type (new type, e.g. `subject-type-registration-proposal`, or reuse an existing shape) — not yet designed in Cypher or route terms.
- Where "edit" draws the line precisely in practice (just `description`, or also things like `bindsAt` before any reference exists vs. after).
- Whether the WINAIM candidate list gets worked through before or after the registry mechanism is built — i.e. do we need the registry to exist first, or can early candidates still land via the current manual CSV-seed process and the registry absorb them as pre-existing rows later.
- UI entry point for "propose a new SubjectType" from within Annotate's dropdown — likely an "Other — propose new" option that opens a small form, routed to the central Catalog's propose endpoint rather than anything tenant-scoped.

## References

- `.design/applicability.md` §3 (SubjectType's role), §7 (sequencing)
- `.design/graph.md`'s `SubjectType` entry (Appendix A) and `OF_TYPE`/`BINDS_TO_TYPE` entries (Appendix B)
- `cli/feeds/csv/catalog/cpcb/subjectTypes.csv` — current 11-row seed
- `.design/track.md` — Catalog pillar Pending list (2026-11-16 WINAIM note, and this plan's new entry)
- `/Users/krishnan/_ks/work/win-aim/documents/from-winaim/08-OCT-2026/WINAIM-CPCB-Map.xlsx` — candidate source, Sheet2
