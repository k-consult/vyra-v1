# SubjectType Registry — Plan

## Context

Built during this session: `applicability.md` §7 step 3 (tenant `Asset -[:OF_TYPE]-> SubjectType` classification) — a new `applicability-intelligence` agent, the Annotate onboarding stage (hierarchical tree, filter/search, bulk confirm, reclassify-after-resolution, per-asset "Invoke model" preview), and the tenant-scoped classification-run trigger. All of that assumes the `SubjectType` vocabulary itself is fixed and complete — 11 rows seeded once (`cli/feeds/csv/catalog/cpcb/subjectTypes.csv`), read-only from every other system's point of view.

That assumption breaks the first time a reviewer hits an asset with no matching type in the dropdown. This plan is the next piece: let `SubjectType` be a managed, growable registry instead of a fixed seed — without turning it into per-tenant ad hoc vocabulary.

**Scoped down 2026-11-22**: ship the direct-write central-admin path only (list/add/edit/retire/usage) — no Decision-gated propose/ratify. The propose/ratify flow (decision 2 below) only earns its cost when the proposer and the approver are different actors, which is true for a future tenant-side "none of these fit" escalation from Annotate, but not for a Vyra Central admin acting directly. That tenant-escalation path is deferred; this plan now covers only the admin CRUD + usage view.

**Admin half shipped 2026-11-22** — see `track.md`'s Catalog pillar Closed list for the verified-live summary. The Deferred section below (tenant-side escalation) remains open.

**Design-review correction, same day.** Manual testing of the "Add asset category" form produced a fabricated row, `ST-WATER-SOURCE` ("BORE-WELL"), with zero `BINDS_TO_TYPE` references from any real Obligation — and a human reviewer then used it to reclassify `Borewell-01` away from the correct documented-unmapped-asset state (`applicability.md` §6's worked example already says Borewell has no CPCB `SubjectType`, by design — the real CGWA NOC obligation binds at `ST-SITE`, not asset grain). Both reverted: the Asset's `OF_TYPE` edge removed via the existing `reclassifyAsset`/"none" path (new superseding Decision, full history preserved — `DEC-...-RECLASSIFY-1795332513586` → `...-1795345552101`), the `SubjectType` node deleted from the central DB, both tenant DBs (`orchid`, `xyz`), and the CSV seed.

**Governing rule, going forward:** a `SubjectType` row is only legitimate if some real `Obligation`'s `BINDS_TO_TYPE` points at it. The direction is obligation → vocabulary, never asset → vocabulary — don't mint a row just so an unmapped asset has something to resolve to. (`ST-DEEP_BURIAL_PIT` is not a counter-example: it's part of the original 11-row CPCB-derived seed, legitimately unused by today's obligation slice but traceable to real regulated-entity text — a temporarily-unbound *derived* row, not an invented one.) This rule applies directly to working through the WINAIM Sheet2 candidate list below — atomize and cross-check against real obligation text before adding, never add speculatively.

**UI labeling, same review.** User-facing label for this vocabulary is "Asset Category" — never "Equipment Category" (too narrow; `ST-HAZARDOUS_WASTE_YARD`/`ST-DEEP_BURIAL_PIT` are infrastructure/locations, not equipment) and never the raw word "SubjectType". `bindsAt` is internal graph-routing metadata (which tenant node label `OF_TYPE` attaches to) and must never render as raw copy (e.g. "DG Set (Asset)") to a reviewer. `intelligence.tsx`'s `DecisionRow` (the `subject-type-proposal` review UI) already only ever offers Asset-bound candidates (`assetSubjectTypes` filters `bindsAt === 'Asset'`) — just the leaking "SubjectType" copy in its override tooltip/option text was renamed to "Asset Category". *(Superseded by the Classifications restructure immediately below — "Asset Category" as a whole-screen label didn't survive; "Category" is now just one of three fields on a "Classification".)*

**Classifications restructure, same day (second pass).** Reworked again, same day, into a facet-driven screen matching the Regulations tab's pattern rather than two stacked sections: tab renamed "Subject Types" → **Classifications**; the former `SubjectTypeRegistry` component became `ClassificationsPanel`, now a props-driven presentational component fed by the parent `CatalogView`'s existing `subjectTypes` state (not a self-contained fetcher) so the shared facet rail — a single-select **Assets / Others** radio facet — can live in `CatalogView`'s `<aside>` like every other tab's facets. Fields are now explicitly Name/Description/**Category** (Category's dropdown shows `Site`/`Organisation`/`Asset` — "Site" is the business word for the `Facility` grain, matching `ST-SITE`'s own name — rather than the raw `bindsAt` enum). `id` is no longer typed: auto-derived `ST-<NAME_UPPER_SNAKE>` from Name, shown live in the add form, keeping the existing `ST-` id family rather than a new prefix.

**`General` category + edit-time reclassification, same day (third pass).** A 4th Category value, `General` — **definition: everything owned by a site/organisation, not a discrete physical asset** (surfaced as the Category field's own helper text in `catalog.tsx`'s add/edit forms, `CATEGORY_DESCRIPTIONS`). Added for rows that are real regulated concepts but not literally a tenant Asset/Facility/Organisation (motivating case: `ST-DEEP_BURIAL_PIT`/`ST-HAZARDOUS_WASTE_YARD` aren't "assets" in the same sense as `ST-DG_SET`). `General` is deliberately not a real tenant-node grain — a `General` row can never be an `OF_TYPE` target. This required reversing the earlier "`bindsAt` immutable always" decision: the edit form now allows changing Category, gated by the same usage-zero check retire uses (`spec.ts`'s `isValidSubjectTypeUpdate`, extended) — a category change is rejected if the row has any real `BINDS_TO_TYPE`/`OF_TYPE` reference, since changing category on an in-use row would silently strand those references exactly the way an unguarded retire would. The UI only sends `bindsAt` in the PATCH body when Category actually changed (not on every save), so a routine name/description edit on an in-use row never trips the gate.

Reclassifying `ST-DEEP_BURIAL_PIT`/`ST-HAZARDOUS_WASTE_YARD` to `General` was the actual goal — both failed the gate on first attempt (`ST-HAZARDOUS_WASTE_YARD`: 2 Obligations + 4 tenant Assets in `orchid`; `ST-DEEP_BURIAL_PIT`: 1 tenant Asset), confirmed live via `GET .../usage`. User explicitly chose to force the change through anyway. Done via a one-off call to `repo.ts`'s `updateSubjectType` directly (bypassing only `spec.ts`'s gate, not the function — central write, tenant fan-out, and CSV seed sync all still ran) — **not** a product feature; there is no force flag anywhere in the API or UI. Accepted, documented consequence: those 2 Obligations and 5 Asset classifications now reference a category defined as "never classified" (see `graph.md`'s `SubjectType` entry for the full note) — doesn't break any live code path today, but will need accounting for when the `ApplicabilityRule`/`Applicability` evaluator (`applicability.md` §7 step 4) is eventually built.

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

## Scoped-down design (2026-11-22)

- **Status field**: reuse `status` from `baseProps` (`cli/semantic-contract/contracts/v2.ts:8`) — already part of the `SubjectType` contract but unset on all 11 seeded rows (verified live: `status: null`, `version: null`). Reads `coalesce(st.status, 'active')`; retire writes `status = 'retired'`. No new property, no soft-delete convention invented.
- **Immutability**: `id`/`bindsAt` are immutable always (not just "once referenced") — simpler than conditional immutability. Only `name`/`description` are editable.
- **Repo** (`api/modules/catalog/repo.ts`): `addSubjectType` (existence-checked — admin picks a meaningful id, collision is a real validation error, not a retry duplicate), `updateSubjectType` (name/description only), `retireSubjectType`, `getSubjectTypeUsage`.
- **Spec**: new `api/modules/catalog/spec.ts` (catalog has none today; `operational`/`intelligence` are the existing precedent for a mutating-endpoint spec file).
- **Routes**: `POST /catalog/subject-types`, `PATCH /catalog/subject-types/:id`, `POST /catalog/subject-types/:id/retire`, `GET /catalog/subject-types/:id/usage`.
- **Usage view — cross-tenant Asset count**: Assets live in per-tenant Neo4j databases (`grc-tenant-*`), not the catalog DB, so the `OF_TYPE` count isn't a single query. Decision (2026-11-22): build the aggregation now — `listTenants()` (`api/modules/tenants/repo.ts`) then query each tenant's DB for its `OF_TYPE` count and sum, alongside the single-query central `BINDS_TO_TYPE` Obligation count. This is the one genuinely new infra pattern in this pass (no existing code loops across tenant DBs).
- **UI**: registry screen under `/catalog` — list (id/name/bindsAt/status), add form, edit (name/description), retire gated behind the usage view.

## Deferred

- Decision-gated propose/ratify flow (`subject-type-registration-proposal`) for the tenant-side "none of these fit" escalation from Annotate's classification dropdown — real maker-checker need (tenant reviewer ≠ central catalog authority), but not required for the admin registry screen itself.
- Working through the WINAIM candidate list (Sheet2) — can happen via the now-built admin add path once it exists; no ordering dependency.

## References

- `.design/applicability.md` §3 (SubjectType's role), §7 (sequencing)
- `.design/graph.md`'s `SubjectType` entry (Appendix A) and `OF_TYPE`/`BINDS_TO_TYPE` entries (Appendix B)
- `cli/feeds/csv/catalog/cpcb/subjectTypes.csv` — current 11-row seed
- `.design/track.md` — Catalog pillar Pending list (2026-11-16 WINAIM note, and this plan's new entry)
- `/Users/krishnan/_ks/work/win-aim/documents/from-winaim/08-OCT-2026/WINAIM-CPCB-Map.xlsx` — candidate source, Sheet2
