const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) throw new Error(`API ${path} ${res.status}`);
    return res.json();
};

const post = async <T>(path: string, body?: any): Promise<T> => {
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
    });
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
    syncStatus:      () => get<{ lastSyncedAt: any }>('/catalog/sync-status'),
    regulations:     (currentOnly?: boolean) => get<{ regulations: any[] }>(`/catalog/regulations${currentOnly ? '?current=true' : ''}`),
    regulationHistory: (id: string) => get<{ regulationId: string; history: any[] }>(`/catalog/regulations/${id}/history`),
    trace:           (id: string) => get<{ regulationId: string; chain: any[] }>(`/catalog/regulations/${id}/trace`),
    clauses:         () => get<{ clauses: any[] }>('/catalog/clauses'),
    obligations:     () => get<{ obligations: any[] }>('/catalog/obligations'),
    uncontrolledObligations: () => get<{ obligations: any[] }>('/catalog/obligations/uncontrolled'),
    proposeObligation: (input: ProposeObligationInput) => post<{ decision: any }>('/catalog/obligations', input),
    controls:        () => get<{ controls: any[] }>('/catalog/controls'),
    agentProposedControls: () => get<{ controls: any[] }>('/catalog/controls/agent-proposed'),
    authorities:     () => get<{ authorities: any[] }>('/catalog/authorities'),
    complianceAreas: () => get<{ complianceAreas: any[] }>('/catalog/compliance-areas'),
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

export const enterprise = {
    organizations: () => get<{ organizations: any[] }>('/enterprise/organizations'),
    roles:         () => get<{ roles: any[] }>('/enterprise/roles'),
    orgChart:      (id: string) => get(`/enterprise/org-chart/${id}`),
    vendors:       () => get<{ vendors: any[] }>('/enterprise/vendors'),
    contracts:     () => get<{ contracts: any[] }>('/enterprise/contracts'),
    proposeContract: (input: ProposeContractInput) => post<{ decision: any }>('/enterprise/contracts', input),
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
