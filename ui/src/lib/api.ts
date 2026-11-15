import { getActiveTenant } from './active-tenant';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

// Read by api/API.ts's onRequest hook — switches which Neo4j database the request
// hits at runtime (no API restart), scoped to just this request. Absent entirely
// when no tenant is active, so the server falls back to its default tenant.
// central:true forces that fallback regardless of the active tenant — the global
// Control-Plane Catalog view (ui/src/features/catalog/catalog.tsx, tenantScoped
// unset) must always read Vyra Central, never silently inherit whatever tenant
// happens to be active elsewhere in the app.
export type ReqOpts = { central?: boolean };

const tenantHeaders = (opts?: ReqOpts): Record<string, string> => {
    if (opts?.central) return {};
    const tenant = getActiveTenant();
    return tenant ? { 'X-Tenant': tenant } : {};
};

const get = async <T>(path: string, opts?: ReqOpts): Promise<T> => {
    const res = await fetch(`${BASE}${path}`, { headers: { ...tenantHeaders(opts) } });
    if (!res.ok) throw new Error(`API ${path} ${res.status}`);
    return res.json();
};

const post = async <T>(path: string, body?: any, opts?: ReqOpts): Promise<T> => {
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...tenantHeaders(opts) },
        body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `API ${path} ${res.status}`);
    }
    return res.json();
};

const patch = async <T>(path: string, body?: any): Promise<T> => {
    const res = await fetch(`${BASE}${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...tenantHeaders() },
        body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `API ${path} ${res.status}`);
    }
    return res.json();
};

const del = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: { ...tenantHeaders() } });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `API ${path} ${res.status}`);
    }
    return res.json();
};

export const execution = {
    programs:      () => get('/execution/programs'),
    tasks:         (workflowId?: string) => get(`/execution/tasks${workflowId ? `?workflowId=${workflowId}` : ''}`),
    capas:         () => get<{ capas: any[] }>('/execution/capas'),
    verifications: () => get<{ verifications: any[] }>('/execution/verifications'),
    calendar:      (horizonWeeks?: number) => get<{ calendar: any[] }>(`/execution/calendar${horizonWeeks ? `?horizonWeeks=${horizonWeeks}` : ''}`),
    updateTaskStatus: (id: string, status: string) => patch<{ task: any }>(`/execution/tasks/${id}`, { status }),
};

export type CreateSignalInput = {
    id: string;
    assetId: string;
    type: string;
    raisedBy: string;
    name?: string;
    source?: string;
    payload?: string;
};

export const operational = {
    assets:    () => get<{ assets: any[] }>('/operational/assets'),
    signals:   (assetId?: string) => get(`/operational/signals${assetId ? `?assetId=${assetId}` : ''}`),
    incidents: () => get<{ incidents: any[] }>('/operational/incidents'),
    facilities:() => get<{ facilities: any[] }>('/operational/facilities'),
    vendors:   () => get<{ vendors: any[] }>('/operational/vendors'),
    people:    () => get<{ people: any[] }>('/operational/people'),
    documentObligations: () => get<{ documentObligations: any[] }>('/operational/document-obligations'),
    lifecycle: (id: string) => get<any>(`/operational/incidents/${id}/lifecycle`),
    createSignal: (input: CreateSignalInput) => post<{ signal: any; task: any }>('/operational/signals', input),
};

export const intelligence = {
    findings:     () => get<{ findings: any[] }>('/intelligence/findings'),
    risks:        () => get<{ risks: any[] }>('/intelligence/risks'),
    decisions:    () => get<{ decisions: any[] }>('/intelligence/decisions'),
    agreementRates: () => get<{ agreementRates: { agentId: string; approved: number; rejected: number; total: number; agreementRate: number | null }[] }>('/intelligence/decisions/agreement-rates'),
    rcas:         () => get<{ rcas: any[] }>('/intelligence/rcas'),
    reverseTrace: (id: string) => get<any>(`/intelligence/incidents/${id}/reverse-trace`),
    approve: (id: string, reviewedBy?: string, reviewNote?: string) =>
        post<any>(`/intelligence/decisions/${id}/approve`, { reviewedBy, reviewNote }),
    reject: (id: string, reviewedBy?: string, reviewNote?: string) =>
        post<any>(`/intelligence/decisions/${id}/reject`, { reviewedBy, reviewNote }),
};

export type ComplianceAreaCoverage = {
    complianceAreaId: string;
    complianceAreaName: string;
    controls: number;
    obligationsCovered: number;
    assets: number;
    coveredAssets: number;
};

export type CoverageScore = {
    scope: string;
    obligations: { total: number; covered: number; coveragePercent: number };
    assets: { total: number; covered: number; unmappedComplianceArea: number; coveragePercent: number };
    byComplianceArea: ComplianceAreaCoverage[];
};

export type RiskRollup = {
    byRating: { rating: string; count: number; avgScore: number }[];
    totalRisks: number;
    avgResidualScore: number;
};

export const assurance = {
    posture:             () => get<{ coverage: CoverageScore; riskRollup: RiskRollup }>('/assurance/posture'),
    attestations:        () => get<{ attestations: any[] }>('/assurance/attestations'),
    evidence:            () => get<{ evidence: any[] }>('/assurance/evidence'),
    evidencePackages:    () => get<{ evidencePackages: any[] }>('/assurance/evidence-packages'),
    assuranceStatements: () => get<{ assuranceStatements: any[] }>('/assurance/assurance-statements'),
    audits:              () => get<{ audits: any[] }>('/assurance/audits'),
};

export const dashboard = {
    landscape: () => get<any>('/dashboard/landscape'),
};

export type ProposeObligationInput = {
    proposedBy: string;
    clauseId: string;
    proposedName: string;
    proposedObligationType?: string;
    proposedMandatory?: string;
};

export const catalog = {
    syncStatus:      (opts?: ReqOpts) => get<{ lastSyncedAt: any }>('/catalog/sync-status', opts),
    regulations:     (currentOnly?: boolean, opts?: ReqOpts) => get<{ regulations: any[] }>(`/catalog/regulations${currentOnly ? '?current=true' : ''}`, opts),
    regulationHistory: (id: string, opts?: ReqOpts) => get<{ regulationId: string; history: any[] }>(`/catalog/regulations/${id}/history`, opts),
    trace:           (id: string, opts?: ReqOpts) => get<{ regulationId: string; chain: any[] }>(`/catalog/regulations/${id}/trace`, opts),
    clauses:         (opts?: ReqOpts) => get<{ clauses: any[] }>('/catalog/clauses', opts),
    obligations:     (opts?: ReqOpts) => get<{ obligations: any[] }>('/catalog/obligations', opts),
    uncontrolledObligations: (opts?: ReqOpts) => get<{ obligations: any[] }>('/catalog/obligations/uncontrolled', opts),
    proposeObligation: (input: ProposeObligationInput, opts?: ReqOpts) => post<{ decision: any }>('/catalog/obligations', input, opts),
    controls:        (opts?: ReqOpts) => get<{ controls: any[] }>('/catalog/controls', opts),
    agentProposedControls: (opts?: ReqOpts) => get<{ controls: any[] }>('/catalog/controls/agent-proposed', opts),
    authorities:     (opts?: ReqOpts) => get<{ authorities: any[] }>('/catalog/authorities', opts),
    jurisdictions:   (opts?: ReqOpts) => get<{ jurisdictions: any[] }>('/catalog/jurisdictions', opts),
    complianceAreas: (opts?: ReqOpts) => get<{ complianceAreas: any[] }>('/catalog/compliance-areas', opts),
};

export type ProposeContractInput = {
    proposedBy: string;
    proposedServiceType: string;
    proposedVendorId: string;
    proposedSlaResponseTime?: string;
    proposedAmcStartDate?: string;
    proposedAmcExpiryDate?: string;
    proposedCoordinatorRoleId?: string;
    priorContractId?: string;
};

export type ProposeWarrantyInput = {
    proposedBy: string;
    proposedCoverageTerms: string;
    proposedAssetId: string;
    proposedVendorId: string;
    proposedStartDate?: string;
    proposedExpiryDate?: string;
    priorWarrantyId?: string;
};

export type ProposePermitInput = {
    proposedBy: string;
    proposedInstrumentType: string;
    proposedAuthorityId: string;
    proposedFacilityId: string;
    proposedAssetIds: string[];
    proposedIssuedDate?: string;
    proposedExpiryDate?: string;
    proposedRenewalWindowDays?: number;
    priorPermitId?: string;
};

export const enterprise = {
    organizations: () => get<{ organizations: any[] }>('/enterprise/organizations'),
    roles:         () => get<{ roles: any[] }>('/enterprise/roles'),
    orgChart:      (id: string) => get(`/enterprise/org-chart/${id}`),
    vendors:       () => get<{ vendors: any[] }>('/enterprise/vendors'),
    contracts:     () => get<{ contracts: any[] }>('/enterprise/contracts'),
    proposeContract: (input: ProposeContractInput) => post<{ decision: any }>('/enterprise/contracts', input),
    warranties:    () => get<{ warranties: any[] }>('/enterprise/warranties'),
    proposeWarranty: (input: ProposeWarrantyInput) => post<{ decision: any }>('/enterprise/warranties', input),
    permits:       () => get<{ permits: any[] }>('/enterprise/permits'),
    proposePermit: (input: ProposePermitInput) => post<{ decision: any }>('/enterprise/permits', input),
};

export type ProposeCutoverCriterionInput = {
    proposedBy: string;
    workflowName: string;
    criterionDescription: string;
    systemOfRecord: 'legacy' | 'vyra';
    agreementRateTarget: number;
    dueBy: string;
};

export type ProposeBlueprintInput = {
    proposedBy: string;
    facilityId: string;
    scopeDescription: string;
    roleIds: string[];
    assetIds: string[];
};

export const onboarding = {
    cutoverCriteria: () => get<{ cutoverCriteria: any[] }>('/onboarding/cutover-criteria'),
    proposeCutoverCriterion: (input: ProposeCutoverCriterionInput) =>
        post<{ decision: any }>('/onboarding/cutover-criteria', input),
    blueprints: () => get<{ blueprints: any[] }>('/onboarding/blueprints'),
    proposeBlueprint: (input: ProposeBlueprintInput) =>
        post<{ decision: any }>('/onboarding/blueprints', input),
};

export type Tenant = {
    name: string;
    description: string;
    database: string;
    uri: string;
    host: string;
    port: number;
    status: string;
    authoritiesLoaded: string[];
    createdAt: string;
    lastCatalogSyncAt?: string;
};

export type DocumentCatalogSummary = {
    facilitiesCreated: number;
    assetsCreated: number;
    documentObligationsCreated: number;
    unmappedAgencies: string[];
    rowsSkipped: number;
};

export type StructureSummary = {
    nodesCreatedByLevel: Record<string, number>;
    rowsSkipped: number;
};

// Multipart upload, shared shape for every tenant feed upload below — can't go
// through the post() helper above (that's JSON-only).
const uploadMultipart = async <T>(path: string, file: File): Promise<{ summary: T }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}${path}`, { method: 'POST', body: formData });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `API ${path} ${res.status}`);
    }
    return res.json();
};

export type PropertyDataType = 'STRING' | 'NUMBER' | 'DECIMAL';
export type BlueprintProperty = {
    id: string;
    name: string;
    ingestKey: string;
    description?: string;
    dataType?: PropertyDataType;
    defaultValue?: string;
    required?: boolean;
};
export type BlueprintLevel = {
    id: string;
    name: string;
    alias?: string;
    description?: string;
    order: number;
    properties: BlueprintProperty[];
};
export type TenantBlueprint = { id: string; levels: BlueprintLevel[] };
export type StructureTreeNode = { label: string; node: Record<string, any>; children: StructureTreeNode[] };

// Direct CRUD, no Decision gate — TenantBlueprint is editable config (the
// hierarchy shape a structure upload must match), not a ratified assertion
// about enterprise reality. See api/modules/blueprint/ and .design/graph.md's
// "Tenant Blueprint Graph" section.
export const blueprint = {
    get: () => get<{ blueprint: TenantBlueprint }>('/blueprint'),
    structureTree: () => get<{ tree: StructureTreeNode[] }>('/blueprint/structure-tree'),
    addLevel: (input: { name: string; alias?: string; description?: string; afterLevelId?: string }) =>
        post<{ blueprint: TenantBlueprint }>('/blueprint/levels', input),
    updateLevel: (id: string, input: { name?: string; alias?: string; description?: string }) =>
        patch<{ blueprint: TenantBlueprint }>(`/blueprint/levels/${id}`, input),
    removeLevel: (id: string) => del<{ blueprint: TenantBlueprint }>(`/blueprint/levels/${id}`),
    reorderLevels: (orderedIds: string[]) => patch<{ blueprint: TenantBlueprint }>('/blueprint/levels/reorder', { orderedIds }),
    addProperty: (levelId: string, input: { name: string; ingestKey: string; description?: string; dataType?: PropertyDataType; defaultValue?: string; required?: boolean }) =>
        post<{ blueprint: TenantBlueprint }>(`/blueprint/levels/${levelId}/properties`, input),
    updateProperty: (id: string, input: { name?: string; description?: string; dataType?: PropertyDataType; defaultValue?: string; required?: boolean; ingestKey?: string }) =>
        patch<{ blueprint: TenantBlueprint }>(`/blueprint/properties/${id}`, input),
    removeProperty: (id: string) => del<{ blueprint: TenantBlueprint }>(`/blueprint/properties/${id}`),
};

export const tenants = {
    list:     () => get<{ tenants: Tenant[] }>('/tenants'),
    provision: (input: { name: string; description?: string }) => post<{ tenant: Tenant }>('/tenants', input),
    remove:   (name: string) => del<{ databaseDropped: boolean }>(`/tenants/${name}`),
    syncCatalog: (name: string) => post<{ tenant: Tenant }>(`/tenants/${name}/catalog/sync`),
    uploadDocumentCatalog: (name: string, file: File) =>
        uploadMultipart<DocumentCatalogSummary>(`/tenants/${name}/document-catalog`, file),
    // The onboarding blueprint upload — facilities/assets with their location
    // hierarchy (see ui/src/features/onboarding/onboarding.tsx's Structure stage).
    uploadStructure: (name: string, file: File) =>
        uploadMultipart<StructureSummary>(`/tenants/${name}/structure`, file),
};
