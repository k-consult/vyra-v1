# Vyra Domain Model (DDD)

**Bounded Contexts, Entities, Value Objects, Repositories, and Specifications** — derived from `vyra-graph-spine.md` (Appendices A/B) and `vyra-architecture.md`'s Context Map + Target Architecture sections. Full reading order: `.design/README.md`.

---

## Bounded Contexts

1. **Tenant Compliance Twin** — one per enterprise (one Neo4j database = one BC, per `vyra-architecture.md`'s Context Map). The five graph domains are **subdomains inside this one BC**, not separate contexts.
2. **Vyra Central** — the platform BC (separate deployment, separate stores). Per `vyra-foundation.md` §4 ("every monetizable asset is structurally separable"), it splits into three sub-boundaries: **Master Catalog Distribution**, **Collective Intelligence**, **Tenancy & Entitlement**.

![Architecture diagram showing the Tenant Compliance Twin bounded context, one per enterprise, receiving a live catalog sync from Vyra Central's Master Catalog Distribution sub-boundary, with target pattern feed-down and harvest to Collective Intelligence, and target tenant resolution from Tenancy and Entitlement.](artifacts/domain-model-overview.svg)

*Two Bounded Contexts. The Tenant Compliance Twin (coral, focal) is the subject of this document; Vyra Central's three sub-boundaries each cross the tenant boundary differently — catalog sync is live/partial today, pattern feed-down/harvest and tenant resolution are target. No direct link exists between the twin's own subdomains and Central beyond these three — Separate Ways otherwise.*

---

## BC 1 — Tenant Compliance Twin

![UML-style class diagram of the Tenant Compliance Twin bounded context, showing seven subdomains — Knowledge, Operational, Intelligence, Execution, Assurance, Onboarding, and cross-cutting platform mechanics — each with its Entities, Value Objects, Repositories, and Specifications, connected by the compliance operating loop and onboarding's touchpoints into Operational and Intelligence.](artifacts/domain-model-bc1-tenant-twin.svg)

*Seven subdomains inside one Bounded Context. Solid arrows are the compliance operating loop (Knowledge → Operational → Intelligence → Execution → Assurance); dashed arrows are Onboarding's transitional touchpoints into Operational (Discovery) and Intelligence (Proving Run). Intelligence is coral — the agentic reasoning core `vyra-foundation.md`'s throughline centers on.*

### Subdomain: Knowledge
- **Entities**: Authority, Jurisdiction, Regulation, Standard, Clause, Requirement, Control, ComplianceArea
- **Value Objects**: CatalogProvenance (catalogVersion, effectiveFrom, supersededBy, sourceRevision), SourceSpan (document, version, anchor/offset), ConfidenceAssertion (confidence, author, assertedAt)
- **Repositories**: RegulationRepository, StandardRepository, ControlRepository, ComplianceAreaRepository, AuthorityRepository
- **Specifications**: CatalogFactIsCurrentSpecification, RequirementIsDefinedBySpecification, ControlImplementsRequirementSpecification

### Subdomain: Operational
- **Entities**: Facility, Asset, Vendor, Contract, Organization, Role, Person, Signal
- **Value Objects**: MappingProvenance (origin: ingestion|declared|inferred|observed, confidence, timestamp), SiteCoverageRange, EscalationPath (currently unstructured — VO candidate)
- **Repositories**: FacilityRepository, AssetRepository, VendorRepository, ContractRepository, OrganizationRepository, PersonRepository, SignalRepository
- **Specifications**: AssetHasControlCoverageSpecification (gap = documented absence, not silent null), AssetIsInComplianceAreaSpecification, PersonHasResolvableRoleSpecification

### Subdomain: Execution
- **Entities**: Schedule, Task, CAPA, Verification, Workflow (designed, not yet active), Program (designed, not yet active)
- **Value Objects**: CadenceRule (cadenceUnit, cadenceInterval, anchorDate), ComplianceWindow (derived occurrence set — computed, not stored)
- **Repositories**: ScheduleRepository, TaskRepository, CAPARepository, VerificationRepository
- **Specifications**: TaskIsScheduledSpecification, CAPAIsClosedSpecification (has a Verification), TaskImplementsControlSpecification

### Subdomain: Intelligence
- **Entities**: Finding, Risk, RCA, Decision
- **Value Objects**: RiskScore (likelihood, consequence, residualScore, rating), AutonomyLevel (0–4 + rationale), ReviewOutcome (status, reviewedBy, reviewedAt, reviewNote)
- **Repositories**: FindingRepository, RiskRepository, RCARepository, DecisionRepository
- **Specifications**: DecisionIsApprovableSpecification, DecisionIsRejectableSpecification, WorkflowEligibleForAutonomyElevationSpecification (agreement-rate threshold), FindingRequiresCAPASpecification

### Subdomain: Assurance
- **Entities**: Evidence, EvidencePackage, Attestation, AssuranceStatement, Audit
- **Value Objects**: PostureStatement (scope, posture, generatedAt — posture always computed, never asserted), CoverageScore
- **Repositories**: EvidenceRepository, EvidencePackageRepository, AttestationRepository, AssuranceStatementRepository, AuditRepository
- **Specifications**: EvidencePackageIsCompleteSpecification, PostureIsCompliantSpecification (every reachable CAPA has a Verification), AssuranceStatementCoversRegulationSpecification

### Subdomain: Onboarding (transitional — dashed region, not a permanent domain)
- **Entities**: Blueprint, CutoverCriterion, ContinuityBaseline
- **Value Objects**: ContinuityMetric (baseline metric name, value, capturedAt), ProvingRunWindow (target date + agreement-rate criterion)
- **Repositories**: BlueprintRepository, CutoverCriterionRepository, ContinuityBaselineRepository
- **Specifications**: CutoverExitCriterionMetSpecification, WorkflowIsCutoverOverdueSpecification, BlueprintIsRatifiedSpecification

### Cross-cutting (platform mechanics inside the Tenant BC)
- **Entities**: Actor (polymorphic Human/Agent base for Person/Agent), WorkItem (Coordination Ledger), AuditEvent (target — Audit Writer)
- **Value Objects**: TenantContext (tenantId, database, actorId, roles — request-scoped), ClaimLease (WorkItem claim protocol)
- **Repositories**: ActorRepository, WorkItemRepository, AuditEventRepository
- **Specifications**: ActorIsAssignableSpecification, WorkItemIsClaimableSpecification, WriteIsVersionConsistentSpecification (Optimistic Concurrency Guard)

---

## BC 2 — Vyra Central

![UML-style class diagram of the Vyra Central bounded context, showing its three sub-boundaries — Master Catalog Distribution, Collective Intelligence, and Tenancy and Entitlement — each with its Entities, Value Objects, Repositories, and Specifications, with Tenancy and Entitlement's target entitlement checks gating the other two.](artifacts/domain-model-bc2-vyra-central.svg)

*Three independently monetized sub-boundaries (`vyra-foundation.md` §4). Tenancy & Entitlement's target entitlement gate reaches into both of the others; Master Catalog Distribution and Collective Intelligence have no direct link to each other — each is Separate Ways, sold and scaled independently.*

### Sub-boundary: Master Catalog Distribution
- **Entities**: MasterRegulation, MasterClause, MasterRequirement, MasterControl, SyncRun
- **Value Objects**: CatalogDiff, SyncSchedule
- **Repositories**: MasterCatalogRepository, SyncRunRepository
- **Specifications**: CatalogSyncIsAdditiveSpecification (tenant extensions survive re-sync), CatalogVersionIsPublishableSpecification

### Sub-boundary: Collective Intelligence
- **Entities**: CorroborationRecord
- **Value Objects**: TypedPattern (identifier-free, the only thing allowed to cross the tenant boundary), CorroborationThreshold (N unrelated tenants)
- **Repositories**: CollectiveIntelligenceRepository, CorroborationGateRepository
- **Specifications**: PatternIsCorroboratedSpecification, PatternIsIdentifierFreeSpecification (abstraction-contract enforcement), TenantHasOptedInSpecification

### Sub-boundary: Tenancy & Entitlement
- **Entities**: Tenant, Entitlement, UsageRecord
- **Value Objects**: EntitlementScope (catalog scope, jurisdictions, agent families, CI participation), ProvisioningCredentialsRef
- **Repositories**: TenantRegistryRepository, EntitlementRepository, UsageMeteringRepository (reads Audit Writer + SyncRun, not its own instrumentation)
- **Specifications**: TenantIsEntitledToSpecification, TenantIsProvisionedSpecification
