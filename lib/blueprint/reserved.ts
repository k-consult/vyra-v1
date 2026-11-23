// The two Level *labels* (derived from `name` via labelFromName) that alias
// onto already-live node types (Facility, Asset) — every other module
// (Permit/Contract/Signal/...) already depends on those exact labels, so a
// Level currently resolving to one of these can never be renamed *away* from
// it (see spec.ts's isValidLevelNameChange — cosmetic edits that don't change
// the resolved label are still allowed).
export const RESERVED_LABELS = new Set(['Facility', 'Asset']);

// Levels that can never be removed, regardless of their current position in
// the chain (not just "whatever's currently first/last") — Organisation is
// the hierarchy's permanent root concept, Facility/Asset are the two reserved
// aliases every other module depends on. A Level resolving to one of these
// three labels is blocked at spec.ts's isValidLevelRemoval.
export const UNDELETABLE_LABELS = new Set(['Organisation', 'Facility', 'Asset']);

// Roles stamped only by a blueprint restore (api/modules/blueprint/repo.ts's
// restoreBlueprint) — never settable through the public add/update-property
// API. This is what lets structure-sync.ts resolve
// "which property is this Facility/Asset's identifier/display name/etc"
// without hardcoding a literal ingestKey string, so every property stays
// fully editable (including a rename) without breaking ingestion or silently
// changing the name of a graph property other code already depends on.
//
// 'code'/'name' drive Facility/Asset's `id`/`name` directly (never stored as
// a property under their own key). 'category'/'assetType' instead each pin a
// *fixed output property name* (ROLE_PROPERTY_NAME below) regardless of the
// property's current ingestKey/camelCase — `Asset.category` is read directly
// by ui/src/features/tenant/shared.tsx, simulator.tsx, and is the field
// IN_COMPLIANCE_AREA's mapping is conceptually keyed on; renaming
// ASSET_CATEGORY's ingestKey must never turn that into `assetCategory`.
export type PropertyRole = 'code' | 'name' | 'category' | 'assetType';

export const ROLE_PROPERTY_NAME: Record<string, string> = {
    category: 'category',
    assetType: 'assetType',
};

// Every real node label the system creates anywhere else in the graph — a
// Level name must never resolve (via labelFromName) to one of these, or a
// blueprint restore's structure-wipe (api/modules/blueprint/repo.ts's
// restoreBlueprint) would delete that domain's data under the guise of
// wiping the org structure. Deliberately excludes Organisation/BusinessUnit/
// Facility/Building/Floor/Area/Asset — the expected default Level labels.
export const PROTECTED_SYSTEM_LABELS = new Set([
    // Knowledge / Catalog
    'Jurisdiction', 'Authority', 'Regulation', 'Clause', 'Obligation', 'Control',
    'ComplianceArea', 'SubjectType', 'ApplicabilityAttribute', 'ApplicabilityRule',
    'Report', 'Policy', 'Standard',
    // Execution
    'Program', 'Workflow', 'Task', 'CAPA', 'Verification', 'Schedule', 'Assignment', 'Actor',
    // Operational (non-blueprint)
    'Incident', 'Vendor', 'Contract', 'Permit', 'Organization', 'DocumentObligation',
    'Role', 'Person', 'Signal', 'Evidence', 'Hazard', 'HazardAssessment', 'EmergencyPlan', 'Warranty',
    // Intelligence
    'Finding', 'Risk', 'Decision', 'RCA',
    // Assurance
    'EvidencePackage', 'Attestation', 'AssuranceStatement', 'Audit', 'ReportSubmission', 'Exception',
    // Blueprint meta
    'TenantBlueprint', 'Level', 'Property',
    // Onboarding
    'CutoverCriterion', 'Blueprint',
    // Tenancy
    'Tenant',
]);

// Deleted wholesale on a blueprint restore, regardless of whether they appear
// in the old blueprint's own Level chain — these are tenant-structure-adjacent
// node types with no catalog-template variant.
export const STRUCTURE_ADJACENT_LABELS = new Set(['Permit', 'Contract', 'Warranty', 'Signal', 'Vendor']);

// Deleted on restore too, but only the tenant-instance rows — a Task/Schedule
// node also carrying :Catalog is a reusable template replayed into every
// tenant at provisioning (same mechanism as Control) and must survive.
export const CATALOG_EXEMPT_STRUCTURE_LABELS = new Set(['Task', 'Schedule']);
