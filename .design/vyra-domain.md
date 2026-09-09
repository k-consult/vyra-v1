# Vyra Domain Model (DDD)

**Bounded Contexts, Aggregates, Value Objects, Domain Events, Factories, Repositories, and Specifications** — derived from `vyra-graph-spine.md` (Appendices A/B) and `vyra-architecture.md`'s Context Map + Target Architecture sections. Full reading order: `.design/README.md`.

> **2026-09-07 revision.** The prior version of this document listed Entities and Value Objects per subdomain with no Aggregate, no Domain Event, and no Factory — a critical review found this was an anemic data catalog wearing DDD vocabulary, not a domain model: nothing said what had to change together, nothing owned construction of derived state, and nothing named the events that already drive the live write path (Signal ingestion, Decision approval, CAPA closure). This revision fixes that, and both BC1/BC2 diagrams under `artifacts/` are redrawn to match — each subdomain/sub-boundary box now shows **Aggregates** (root plus `(owns X)` child entities), **Value Objects**, **Domain Events**, **Factories**, **Repositories**, and **Specifications**, in that order.

---

## Tactical toolkit used below

Every subdomain is described the same way:

| Building block | What it means here |
|---|---|
| **Aggregate** | A root Entity plus the child Entities it owns, forming one consistency boundary. Everything outside the boundary is referenced **by id only** — never embedded, never loaded to enforce another aggregate's rule. |
| **Value Object** | Immutable, equality-by-value, no identity of its own. Replaced wholesale, never mutated in place. |
| **Domain Event** | A past-tense fact an aggregate raises when its state changes meaningfully. Producers don't know their consumers. |
| **Factory** | Owns construction of an aggregate that another aggregate's event triggers — kept separate from the aggregate itself because the *thing constructing* a Risk from a Decision is a different concern from the Risk aggregate's own invariants. |
| **Repository** | One per **Aggregate root**, never per child Entity. A child Entity (e.g. `Verification`) is read/written only through its owning aggregate's repository. |
| **Specification** | A named, composable predicate. Where an aggregate now enforces its own invariant as behavior (e.g. `capa.close()`), the matching Specification becomes a read-side check rather than the only place the rule lived. |

---

## Bounded Contexts

1. **Tenant Compliance Twin** — one per enterprise (one Neo4j database = one BC, per `vyra-architecture.md`'s Context Map). The five graph domains are **subdomains inside this one BC**, not separate contexts — they share one schema and one consistency boundary, which in DDD terms makes them a Shared Kernel with each other, not independent contexts.
2. **Vyra Central** — the platform BC (separate deployment, separate stores). Per `vyra-foundation.md` §4 ("every monetizable asset is structurally separable"), it splits into three sub-boundaries: **Master Catalog Distribution**, **Collective Intelligence**, **Tenancy & Entitlement**.

![Architecture diagram showing the Tenant Compliance Twin bounded context, one per enterprise, receiving a live catalog sync from Vyra Central's Master Catalog Distribution sub-boundary, with target pattern feed-down and harvest to Collective Intelligence, and target tenant resolution from Tenancy and Entitlement.](artifacts/domain-model-overview.svg)

*Two Bounded Contexts. The Tenant Compliance Twin (coral, focal) is the subject of this document; Vyra Central's three sub-boundaries each cross the tenant boundary differently — catalog sync is live/partial today, pattern feed-down/harvest and tenant resolution are target. No direct link exists between the twin's own subdomains and Central beyond these three — Separate Ways otherwise.*

---

## BC 1 — Tenant Compliance Twin

![UML-style class diagram of the Tenant Compliance Twin bounded context, showing seven subdomains — Knowledge, Operational, Intelligence, Execution, Assurance, Onboarding, and cross-cutting platform mechanics — each with its Entities, Value Objects, Repositories, and Specifications, connected by the compliance operating loop and onboarding's touchpoints into Operational and Intelligence.](artifacts/domain-model-bc1-tenant-twin.svg)

*Seven subdomains inside one Bounded Context. Solid arrows are the compliance operating loop (Knowledge → Operational → Intelligence → Execution → Assurance); dashed arrows are Onboarding's transitional touchpoints into Operational (Discovery) and Intelligence (Proving Run). Intelligence is coral — the agentic reasoning core `vyra-foundation.md`'s throughline centers on. Each box lists its Aggregates first, `(owns X)` marking a child Entity inside that root's consistency boundary, followed by Value Objects, Domain Events, Factories, Repositories, and Specifications.*

### Subdomain: Knowledge

**Aggregates**
- **`Regulation`** (root) — owns `Clause[]` that belong to it. Refs: `Authority` (by id). Invariant: a `Clause` added to this aggregate belongs to exactly this parent — enforced at add-time, not by a nullable FK on the Clause side.
- **`Standard`** (root) — owns `Clause[]` that belong to it. Same invariant as `Regulation`, mirrored because `Clause`'s parent is XOR (`vyra-graph-spine.md` Appendix A), never both.
- **`Obligation`** (root, standalone) — refs `Clause` (by id). Kept independent of the `Regulation`/`Standard` aggregate because an Obligation has its own version lifecycle and is referenced by many `Control`s — embedding it under `Clause` would force loading a whole Regulation to revise one obligation.
- **`Control`** (root, standalone) — refs `Obligation`, `ComplianceArea` (by id). Origin (`:Catalog` / `:Enterprise` / `:AgentProposed` / legacy) is a VO field on this one Entity type, not a subtype — this is deliberate: it forecloses a future `if (control.origin === ...)` branch by keeping origin as data, not as a type hierarchy.
- **`ComplianceArea`** (root, reference data) — no owned children, no refs.
- **`Authority`** (root, reference data) — no owned children, no refs.

**Value Objects**: CatalogProvenance (catalogVersion, effectiveFrom, supersededBy, sourceRevision), SourceSpan (document, version, anchor/offset), ConfidenceAssertion (confidence, author, assertedAt — revised by replacing the VO wholesale under the Append-and-Supersede Protocol, never mutated in place)

**Domain Events**
- `RegulationSuperseded` — raised when a `Regulation` aggregate's `supersededBy` is set; consumed by anything holding a stale reference to flag it for re-check, not to cascade a delete (nothing is deleted, only superseded).
- `ObligationRevised` — raised when an `Obligation`'s definition changes version; consumed by `Control` owners to re-evaluate `ControlImplementsObligationSpecification`.

**Factories**: none — construction here is direct authoring/ingestion, not derived from another aggregate's event.

**Repositories** (one per Aggregate root): RegulationRepository, StandardRepository, ObligationRepository, ControlRepository, ComplianceAreaRepository, AuthorityRepository

**Specifications**: CatalogFactIsCurrentSpecification, ObligationIsDefinedBySpecification, ControlImplementsObligationSpecification

---

### Subdomain: Operational

**Aggregates**
- **`Facility`**, **`Vendor`**, **`Organization`**, **`Role`**, **`Person`** (each root, reference-data aggregates) — cross-reference each other by id (`Person` → `Role`/`Facility`, `Role` → `Organization`) but own no children.
- **`Asset`** (root) — refs `Facility`, `Vendor`, `ComplianceArea` (by id). No owned children — `Signal`s emitted by an Asset are not loaded into it (see below).
- **`Contract`** (root) — refs `Vendor`, `Role`, `Facility[]` (COVERS, by id). Invariant: every id in its site-coverage range must resolve to a real Facility at write time.
- **`Signal`** (root, standalone) — refs `Asset` (by id). Deliberately not a child of `Asset`: signals arrive independently, at volume, and writing one must never require loading the Asset aggregate.

**Value Objects**: MappingProvenance (origin: ingestion|declared|inferred|observed, confidence, timestamp — attaches to the `COVERED_BY` edge; see the open note below on edge-property VOs), SiteCoverageRange, EscalationPath (**free text by decision, not a VO candidate** — `vyra-graph-spine.md`'s Gap Review already closed this: zero title matches to seeded Roles, no hierarchy property to model against; keeping it "candidate" status here was itself stale)

**Domain Events**
- `SignalReceived` — raised on `Signal` write; consumed by `SignalTaskFactory` and by `signal-intelligence`'s observe step.
- `CoverageGapDetected` — **not raised today, and deliberately left as a query** (`AssetHasControlCoverageSpecification`) rather than an event — nothing currently reacts to a new gap the moment it appears, so manufacturing an event here would be speculative (YAGNI). Revisit if a live alerting consumer appears.

**Factories**: `SignalTaskFactory` — consumes `SignalReceived`, resolves the owner via `Asset → Facility ← Person`, and constructs the derived `Task`(s). Formalizes logic that lives ad hoc in the events sink today.

**Repositories**: FacilityRepository, AssetRepository, VendorRepository, ContractRepository, OrganizationRepository, RoleRepository, PersonRepository, SignalRepository

**Specifications**: AssetHasControlCoverageSpecification (gap = documented absence, not silent null), AssetIsInComplianceAreaSpecification, PersonHasResolvableRoleSpecification (currently always-false for all 7 seeded People — kept because "documented absence is a first-class state," not because it's expected to fire soon)

**Open note**: `MappingProvenance` models an edge property (on `COVERED_BY`), not a property of either endpoint Entity. Classic Entity/VO/Aggregate assumes object references, not property-bearing relationships — this doc doesn't yet have a clean answer for edge-attached VOs, and it recurs (cadence, coverage ranges, provenance). Flagged, not resolved.

---

### Subdomain: Execution

**Aggregates**
- **`Schedule`** (root, standalone) — owns its `CadenceRule` state; refs nothing. **Deliberately not a VO embedded on `Task`**: a cadence like "quarterly fire-safety check" can legitimately drive more than one `Task` (or a future non-Task action), and a VO has no identity to be shared across owners. `Task` and any future action-aggregate hold a `scheduleId` reference instead of a private copy — one change to the cadence is one write, not N.
- **`Task`** (root) — refs `Control` (IMPLEMENTS), `Schedule` (by id, not embedded).
- **`CAPA`** (root) — owns `Verification` (child). Refs `Finding`. Invariant: a CAPA transitions to closed only via `capa.close(verifiedBy, outcome)`, which constructs its own `Verification` as one behavior — not two independent writes joined after the fact by `CLOSES`. This is where `CAPAIsClosedSpecification` gets **enforced**, not merely queried.
- `Workflow`, `Program` (designed, not yet active) — will be standalone aggregates, referenced by id from `Task`/`Workflow` respectively via `PART_OF`, once ratified in `vyra-graph-spine.md`.

**Value Objects**: CadenceRule (now internal state of `Schedule`, not a per-Task copy), ComplianceWindow (derived occurrence set — computed on `Schedule`, never stored)

**Domain Events**
- `TaskScheduled` — raised when a `Task` first references a `Schedule`.
- `CAPAClosed` — raised by `capa.close()`; consumed by `assurance-intelligence` (evidence is now assemblable) and by the risk rollup (residual exposure may drop).

**Factories**: `CAPAFactory` — consumes `FindingAnalysed` (below) when a `Finding`'s RCA determines a corrective action is required; constructs the `CAPA` aggregate.

**Repositories** (one per Aggregate root — `Verification` has none of its own; it's read/written only through `CAPARepository`): ScheduleRepository, TaskRepository, CAPARepository

**Specifications**: TaskIsScheduledSpecification, CAPAIsClosedSpecification (has a Verification — read-side check now that `capa.close()` enforces it directly), TaskImplementsControlSpecification

---

### Subdomain: Intelligence

This is the reasoning core, and where aggregate size matters most — every root here is kept deliberately small.

**Aggregates**
- **`Decision`** (root, standalone) — refs `ABOUT → *` and `RESULTED_IN → *` (both by id, polymorphic target). **Deliberately tiny.** `Decision` is a *trigger*, not a container: it must never hold the things its approval causes, or every approval becomes a multi-aggregate transaction and the whole point of raising an event to decouple construction is lost.
- **`Finding`** (root) — owns `RCA` (child). Refs `Control`/`Signal` (AGAINST/ABOUT), `Incident`. Live data is 15 Findings : 15 RCAs — exactly 1:1 — which is what justifies `finding.analyse(rootCause)` constructing the RCA as one behavior rather than a second independent write.
- **`Risk`** (root, standalone) — refs `Finding` (by id).

**Value Objects**: RiskScore (likelihood, consequence, residualScore, rating), ReviewOutcome (status, reviewedBy, reviewedAt, reviewNote)

> **`AutonomyLevel` is removed from this subdomain's VO list.** The prior draft placed it here modeling `Decision.autonomyLevel`, but `vyra-foundation.md` is explicit that autonomy level is "a property of the **assignment**, not of the platform" — i.e. it belongs on a `Task -[:ASSIGNED_TO]-> Actor` assignment, which has no Entity to attach to yet (`ASSIGNED_TO` doesn't appear anywhere in `vyra-graph-spine.md`, live or designed-not-active). `Decision.autonomyLevel` stays as a plain field on `Decision` describing the level *that decision* was proposed at; the assignment-level concept foundation.md requires is an open gap, not something this VO should silently stand in for. See Cross-cutting, below.

**Domain Events** — type-specific, not one generic `DecisionApproved` + a switch on `decision.type`:
- `ControlRecommendationApproved`
- `DeviationAssessmentApproved`
- `RiskAssessmentApproved`
- `AssurancePackageProposalApproved`
- `DecisionRejected` — symmetric event, currently with no consumer. This is exactly the hook foundation.md's "Learning closes the loop" requirement needs and doesn't have today — naming it gives the future feedback mechanism somewhere to subscribe.
- `FindingAnalysed` — raised by `finding.analyse()`; carries whether a CAPA is required.

**Factories**
- `ControlFactory` — consumes `ControlRecommendationApproved` → constructs `Control:AgentProposed`.
- `FindingFactory` — consumes `DeviationAssessmentApproved` → constructs `Finding:AgentProposed` (resolving `AGAINST`/`ABOUT`). Also used, via a second named construction method, when `Finding`s are seeded from `Incident` ingestion — one Factory owns both valid construction paths.
- `RiskFactory` — consumes `RiskAssessmentApproved` → constructs `Risk:AgentProposed`, computing `inherentScore = likelihood × consequence` itself. This determinism requirement ("never trusted from the LLM as arithmetic," per `vyra-graph-spine.md`) is exactly what a Factory is for: pure, deterministic construction, no I/O, no model call.

**Repositories**: DecisionRepository, FindingRepository, RiskRepository (`RCA` has no repository of its own — read/written only through `FindingRepository`)

**Specifications**: DecisionIsApprovableSpecification, DecisionIsRejectableSpecification, WorkflowEligibleForAutonomyElevationSpecification (agreement-rate threshold), FindingRequiresCAPASpecification

---

### Subdomain: Assurance

**Aggregates**
- **`EvidencePackage`** (root) — owns `Attestation` (child), `AssuranceStatement` (child). Refs `Evidence[]` (PART_OF, by id), `Audit` (by id). Attesting to a package and issuing its posture statement have no meaning outside "this specific package," and the live write path already constructs all three together from one Decision approval — collapsing them into one aggregate matches what already happens atomically, instead of three independent writes joined by relationships after the fact.
- **`Evidence`** (root, standalone) — refs `Task` (by id). Kept independent of `EvidencePackage` because Evidence is produced continuously as work happens, before any package exists to bundle it.
- **`Audit`** (root, standalone) — no owned children. The engagement can exist before evidence is assembled against it.

**Value Objects**: PostureStatement (scope, posture, generatedAt — posture always computed, never asserted, now specifically as `EvidencePackage`'s own computed state), CoverageScore

**Domain Events**
- `EvidenceCollected` — raised on `Evidence` write (Task produces it).
- `AssurancePackageAssembled` — raised once `EvidencePackage`'s `Attestation` + `AssuranceStatement` are constructed, regardless of which caller triggered it (see Factory below) — one event, two legitimate producers.

**Factories**: `AssurancePackageFactory` — consumes `AssurancePackageProposalApproved` (live path) **or** is called directly by the Phase-4b historical batch script (synthetic path). One Factory, two callers — this removes the current split between live and synthetic construction logic, which today are two independently-maintained code paths producing the same shape.

**Repositories**: EvidencePackageRepository, EvidenceRepository, AuditRepository (`Attestation`/`AssuranceStatement` have no repository of their own — read/written only through `EvidencePackageRepository`)

**Specifications**: EvidencePackageIsCompleteSpecification, PostureIsCompliantSpecification (every reachable CAPA has a Verification), AssuranceStatementCoversRegulationSpecification

---

### Subdomain: Onboarding (transitional — dashed region, not a permanent domain)

**Aggregates**
- **`Blueprint`**, **`CutoverCriterion`**, **`ContinuityBaseline`** — each a standalone root, no owned children yet defined.

> **Status flag, carried here explicitly because the rest of this document now marks it elsewhere and this subdomain shouldn't be the exception:** all three of these are **target** — `vyra-architecture.md` states they are "pending `vyra-graph-spine.md` ratification." None exist as graph entities today. Treat this subdomain's Aggregates/Events/Factories as a proposed shape, not a built one.

**Value Objects**: ContinuityMetric (baseline metric name, value, capturedAt), ProvingRunWindow (target date + agreement-rate criterion)

**Domain Events**: `WorkflowCutoverCriterionMet`, `WorkflowCutoverOverdue` (the `dueBy`-elapsed alarm state `vyra-foundation.md` §0 requires)

**Factories**: none scoped yet — deferred until Phase 11's onboarding agent family is scoped (`vyra-implementation-plan.md`).

**Repositories**: BlueprintRepository, CutoverCriterionRepository, ContinuityBaselineRepository

**Specifications**: CutoverExitCriterionMetSpecification, WorkflowIsCutoverOverdueSpecification, BlueprintIsRatifiedSpecification

---

### Cross-cutting (platform mechanics inside the Tenant BC)

**Aggregates**
- **`Actor`** (root, standalone) — polymorphic Human/Agent base for `Person`/agent identities.
- **`WorkItem`** (root, standalone, target) — the Coordination Ledger's claim-lease unit.

> **`AuditEvent` is removed as an Entity.** It isn't a business object with behavior — it's the **persisted form of a Domain Event**, the Transactional-Outbox record `vyra-architecture.md`'s Audit Writer already names. Every `DomainEvent` listed in this document (SignalReceived, CAPAClosed, ControlRecommendationApproved, …) is what an `AuditEvent` row *is*, once written. Keeping it as a separate flat Entity in the old draft obscured that it's the event log, not a sixth kind of business thing. It keeps an append-only repository (below) for infrastructure reasons, not because it has domain behavior.

**Value Objects**: TenantContext (tenantId, database, actorId, roles — request-scoped), ClaimLease (WorkItem claim protocol)

**Domain Events**: every event named in the subdomains above, in its persisted form, is what flows through here — this section is the sink, not a separate producer.

**Aggregates**
- **`Assignment`** (root, target) — owns `AutonomyLevel` as its own VO; refs `Task`/action and `Actor` (by id). Closes the gap this document flagged: `vyra-foundation.md`'s "the autonomy level is a property of the assignment, not of the platform" now has an Entity to attach to — `Assignment` and `Actor` were added to `vyra-graph-spine.md` (Execution Graph) as designed-not-active in the 2026-09-07 revision. Neither has seed data or a live write path yet; `Decision.autonomyLevel` remains the only live autonomy-level property, and describes one proposal's level, not a standing assignment.

**Repositories**: ActorRepository, WorkItemRepository, AuditEventRepository (append-only, infrastructure)

**Specifications**: ActorIsAssignableSpecification, WorkItemIsClaimableSpecification, WriteIsVersionConsistentSpecification (Optimistic Concurrency Guard)

---

## BC 2 — Vyra Central

![UML-style class diagram of the Vyra Central bounded context, showing its three sub-boundaries — Master Catalog Distribution, Collective Intelligence, and Tenancy and Entitlement — each with its Entities, Value Objects, Repositories, and Specifications, with Tenancy and Entitlement's target entitlement checks gating the other two.](artifacts/domain-model-bc2-vyra-central.svg)

*Three independently monetized sub-boundaries (`vyra-foundation.md` §4). Tenancy & Entitlement's target entitlement gate reaches into both of the others; Master Catalog Distribution and Collective Intelligence have no direct link to each other — each is Separate Ways, sold and scaled independently. **Status: everything in this BC is target — 0% built per `vyra-architecture.md` — except Master Catalog Distribution's same-database catalog sync, which is live but not yet split into its own physical store.***

### Sub-boundary: Master Catalog Distribution

**Aggregates**
- **`MasterRegulation`** (root) — owns `MasterClause[]`.
- **`MasterObligation`** (root, standalone) — refs `MasterClause` (by id).
- **`MasterControl`** (root, standalone) — refs `MasterObligation` (by id).
- **`SyncRun`** (root, standalone) — its own aggregate, not a child of `MasterRegulation`: one `SyncRun` spans the whole catalog fan-out across every tenant, not one regulation's lifecycle.

**Value Objects**: CatalogDiff, SyncSchedule

**Domain Events**: `CatalogVersionPublished`, `SyncRunCompleted` — these are **cross-context integration events**, not same-model domain events: this is the one place a tenant twin's Catalog Ingester subscribes across the BC boundary, and it's the concrete mechanism behind the Open Host Service + Published Language relationship `vyra-architecture.md` already names.

**Factories**: none — catalog authoring is direct CRUD, not derived from another aggregate's event. The **Sync Diff Engine is a Domain Service, not a Factory**: it computes a `CatalogDiff` VO by comparing two existing aggregates' state; it doesn't construct a new Entity, which is what a Factory is for.

**Repositories**: MasterCatalogRepository (covers `MasterRegulation`/`MasterClause`/`MasterObligation`/`MasterControl` under one repo — an accepted exception to "one repo per aggregate root," since this is read-heavy reference data published together on one cadence, not a transactional consistency boundary), SyncRunRepository

**Specifications**: CatalogSyncIsAdditiveSpecification (tenant extensions survive re-sync), CatalogVersionIsPublishableSpecification

---

### Sub-boundary: Collective Intelligence

**Aggregates**
- **`CorroborationRecord`** (root, standalone) — accumulates tenant-submitted observations keyed by pattern signature. Invariant: promotion to the Collective Intelligence Store requires corroboration across N unrelated tenants (`CorroborationThreshold`).

**Value Objects**: TypedPattern (identifier-free — the only thing allowed to cross the tenant boundary), CorroborationThreshold

**Domain Events**: `PatternSubmitted` (a tenant offers an observation), `PatternCorroborated` (threshold met — admits the pattern to the Collective Intelligence Store)

**Factories**: `TypedPatternFactory` — the Anti-Corruption translator the prior review flagged as missing entirely: the one place raw tenant Signal/Decision history is converted into an identifier-free `TypedPattern` before it can cross the tenant boundary. This is the highest-stakes Factory in the whole model — it's what makes "isolation of data, circulation of intelligence" (`vyra-foundation.md`) an enforced code boundary instead of a promise in prose.

**Repositories**: CollectiveIntelligenceRepository

> **`CorroborationGateRepository` is renamed `CorroborationGateService`** and reclassified as a Domain Service, not a Repository. A "gate" that decides whether a submitted pattern gets promoted is a policy decision, not persistence — naming it a Repository (as the prior draft did) made a business rule look like storage.

**Specifications**: PatternIsCorroboratedSpecification, PatternIsIdentifierFreeSpecification (abstraction-contract enforcement), TenantHasOptedInSpecification

---

### Sub-boundary: Tenancy & Entitlement

**Aggregates**
- **`Tenant`** (root) — owns `Entitlement` (child; has no meaning outside its tenant — an entitlement change is a change to this tenant's record, not an independent write).
- **`UsageRecord`** (root, standalone) — refs `Tenant` (by id). Kept independent of `Tenant` because usage records are produced continuously, the same reasoning as `Evidence`/`Signal` elsewhere — appending one shouldn't require loading the Tenant aggregate.

**Value Objects**: EntitlementScope (catalog scope, jurisdictions, agent families, CI participation), ProvisioningCredentialsRef

**Domain Events**: `TenantProvisioned`, `EntitlementChanged`, `TenantOptedOutOfCollectiveIntelligence` (revocable per `vyra-foundation.md` §3 — feedback participation is opt-in and reversible, never conditioning the base platform on it)

**Factories**: `TenantProvisioningFactory` — constructs a new `Tenant` + `Entitlement` pair at onboarding, wired to the already-existing `DB.createDB()` multi-driver mechanism `vyra-architecture.md` names as reusable (not new infrastructure).

**Repositories**: TenantRegistryRepository, EntitlementRepository, UsageRecordRepository (reads the Audit Writer + `SyncRun` records, not its own instrumentation — per `vyra-foundation.md` §4: "if billing needs its own instrumentation, the provenance model was incomplete")

**Specifications**: TenantIsEntitledToSpecification, TenantIsProvisionedSpecification
