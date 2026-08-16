# Phase 4b — Audit-Ready Export: derived Assurance-graph seed

## Context

`Audit`, `EvidencePackage`, `Attestation`, `AssuranceStatement` are fully declared in `cli/semantic-contract/contracts/v2.ts` but have zero seed data — Phase 4b has been blocked on this since Phase 1. There is no real source dataset for these (unlike the catalog/enterprise CSVs, which came from an actual spreadsheet). The user has no third data source to ingest and wants to move fast toward an investor-facing MVP.

Investigation found that **every field these four node types need already exists elsewhere in the live graph**, keyed by the 7 existing `Incident`s:
- `Audit` ≈ `Incident.auditType/auditTime/reviewedBy` (an Incident already *is* an audit record)
- `EvidencePackage` ≈ the 30 existing `Evidence` rows, grouped by `Evidence.source` (already `INC-00N`)
- `Attestation.attestedBy/attestedAt` ≈ `Incident.reviewedBy` / `Incident.incidentTime` (the reviewer already exists as a real field)
- `AssuranceStatement.scope` ≈ `Incident.scope`; `.posture` ≈ computed from `Finding.status` + `Risk.residualRating` for that incident (both real, already graphed)

So instead of fabricating data, this phase **materializes the Assurance layer as an explicit projection of facts already in the Knowledge/Execution/Intelligence/Operational graphs** — one full chain (`Audit → EvidencePackage → Attestation → AssuranceStatement`) per existing Incident, 7 of each. Nothing is invented; every value traces back to a CSV cell that already shipped. This is the strongest possible position for investor scrutiny ("is this real?") and is fast — one generation script, no new spreadsheet to source or clean.

Deliberately deferred (not in this pass): extending this to the catalog-driven 52-week calendar (would require fabricating "audits" for future/unexecuted scheduled Tasks — real task-completion tracking doesn't exist yet, per `vyra-landscape.md` L3). `Exception` stays dormant too — not named in Phase 4b's original scope.

## Schema additions (`cli/semantic-contract/contracts/v2.ts`)

Minimal, additive, backward-compatible (`ON MATCH SET n += row` merges, never replaces):

- **`Audit`**: add prop `incidentId`; add rel `{ type: 'AUDITS', targetLabel: 'Incident', sourceField: 'incidentId' }`
- **`EvidencePackage`**: add props `incidentId`, `evidenceIds` (pipe-delimited string, e.g. `EVD-001-01|EVD-001-02` — reuses the multi-value convention `Incident.scope`/`.dashboardMetrics` already use, not a new pattern); add rel `{ type: 'COLLECTED_DURING', targetLabel: 'Incident', sourceField: 'incidentId' }`
- `Attestation` and `AssuranceStatement` already have every field needed (`attestedBy`, `attestedAt`, `packageId`/`BACKED_BY`; `scope`, `posture`, `generatedAt`, `attestationId`/`DERIVED_FROM`) — no changes.

**Label convention**: new nodes get `:Derived` (alongside their domain label, e.g. `(:Audit:Derived)`), following the existing `:Catalog`/`:Enterprise` dual-label pattern (`vyra-graph-spine.md`'s "`:Catalog` Label Convention" section). `:Derived` signals "materialized from existing graph facts, not sourced from an external file" — distinct from both. This is the one new convention this phase introduces; flagging it explicitly since it extends a documented pattern rather than reusing it verbatim.

## New files

**`cli/scripts/generate-assurance-seed.ts`** (mirrors `convert-catalog-seed.ts`'s shape: read → transform → `writeCSV`, but reads existing feed CSVs instead of the spreadsheet):
- Reads `cli/feeds/csv/operational/incidents.csv`, `assurance/evidence.csv`, `intelligence/findings.csv`, `intelligence/risks.csv`
- Per incident (7): groups Evidence by `source`, Findings by `incidentId` (for closed/total counts), Risk via `findingId` → incident
- Writes 4 new CSVs to `cli/feeds/csv/assurance/`: `audits.csv`, `evidencePackages.csv`, `attestations.csv`, `assuranceStatements.csv`
- `posture` string is computed, e.g. `"2/2 findings closed · residual risk Critical (18)"` — a real aggregate, not prose fabrication

**`cli/domains/assurance/ingest-hints.json`** — `feedMap` only (all 4 rels are embedded FK, same as catalog/enterprise — no `edgeMap` needed), mirrors `cli/domains/catalog/ingest-hints.json`'s shape.

**`cli/orchestration/assurance-sync.ts`** — mirrors `catalog-sync.ts`/`enterprise-sync.ts` verbatim except `run(projection, { originLabel: 'Derived' })`. Run manually via `npx ts-node --project cli/tsconfig.json cli/orchestration/assurance-sync.ts` (same convention catalog-sync/enterprise-sync already use — neither is wired into `ingest.sh`).

## API (`api/modules/assurance/`)

`repo.ts`: add `listAudits()`, `listEvidencePackages()`, `listAssuranceStatements()` — copy `listAttestations()`'s exact shape (simple `MATCH (n:Label) RETURN properties(n)`, try/catch → `[]`). `listAttestations()` itself needs no code change — it already queries `Attestation` and will start returning real rows.

`index.ts`: add routes `GET /assurance/audits`, `/assurance/evidence-packages`, `/assurance/assurance-statements`, same pattern as the existing `/evidence` route. `/assurance/attestations` already exists and will just start working.

## UI (`ui/src/features/assurance/assurance.tsx`)

- Delete the `AttestationsSection` "Not yet available — blocked on Phase 4b" placeholder (lines ~139–158) and replace with a real list, reusing the existing `EvidenceSection`'s card-grid + `PropRow` pattern (already imported from `landscape.tsx`).
- Add compact `AuditsSection` and `AssuranceStatementsSection` alongside it, same card pattern.
- `ui/src/lib/api.ts`: add `audits()`, `evidencePackages()`, `assuranceStatements()` to the `assurance` client object (mirror `evidence()`).
- `AssuranceView`'s `load()` fetches the 3 new endpoints alongside existing ones.

## Docs

Update `.design/vyra-graph-spine.md` (mark Phase 4b done, document `:Derived` label + new rels/props, update node/edge counts) and `.design/vyra-implementation-plan.md` (move Phase 4b from "blocked" to done, record the scoping decision made here, update the Task Brief's L6 line) — per this repo's stated convention of keeping the plan and spine in sync every phase, not just at the end.

## Verification

- Run `generate-assurance-seed.ts`, confirm exactly 7 rows in each of the 4 new CSVs, spot-check one full chain (e.g. `INC-001` → `AUD-001` → `EVP-001` → `ATT-001` → `ASR-001`) by hand against `incidents.csv`/`evidence.csv`/`findings.csv`/`risks.csv`.
- Run `assurance-sync.ts` live, confirm via direct Cypher: 28 new `:Derived` nodes, `AUDITS` (7), `COLLECTED_DURING` (7), `BACKED_BY` (7), `DERIVED_FROM` (7) edge counts, and that `AUD-001` resolves to `INC-001`.
- Hit all 3 new API routes live plus the now-populated `/assurance/attestations`.
- Load `/assurance` in a real browser (Playwright), confirm all sections render real data, zero console errors.
- `tsc --noEmit` clean on `cli/`, `api/`, `ui/`.
