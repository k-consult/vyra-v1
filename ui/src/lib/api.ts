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

export const knowledge = {
    regulations: () => get<{ regulations: any[] }>('/knowledge/regulations'),
    controls:    () => get<{ controls: any[] }>('/knowledge/controls'),
    agentProposedControls: () => get<{ controls: any[] }>('/knowledge/controls/agent-proposed'),
    traceForward: (id: string) => get(`/knowledge/trace/${id}`),
    traceReverse: (id: string) => get(`/knowledge/reverse/${id}`),
};

export const execution = {
    programs:      () => get('/execution/programs'),
    tasks:         (workflowId?: string) => get(`/execution/tasks${workflowId ? `?workflowId=${workflowId}` : ''}`),
    capas:         () => get<{ capas: any[] }>('/execution/capas'),
    verifications: () => get<{ verifications: any[] }>('/execution/verifications'),
};

export type CreateSignalInput = {
    id: string;
    assetId: string;
    type: string;
    name?: string;
    source?: string;
    payload?: string;
};

export const operational = {
    assets:    () => get('/operational/assets'),
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
    requirementsCovered: number;
    assets: number;
    coveredAssets: number;
};

export type CoverageScore = {
    scope: string;
    requirements: { total: number; covered: number; coveragePercent: number };
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

export const catalog = {
    regulations:      () => get<{ regulations: any[] }>('/catalog/regulations'),
    authorities:      () => get<{ authorities: any[] }>('/catalog/authorities'),
    complianceAreas:  () => get<{ complianceAreas: any[] }>('/catalog/complianceAreas'),
    traceRequirements: (id: string) => get(`/catalog/trace/${id}`),
    calendar:         (horizonWeeks?: number) => get<{ calendar: any[] }>(`/catalog/calendar${horizonWeeks ? `?horizonWeeks=${horizonWeeks}` : ''}`),
};

export const enterprise = {
    organizations: () => get<{ organizations: any[] }>('/enterprise/organizations'),
    roles:         () => get<{ roles: any[] }>('/enterprise/roles'),
    orgChart:      (id: string) => get(`/enterprise/org-chart/${id}`),
    vendors:       () => get<{ vendors: any[] }>('/enterprise/vendors'),
    contracts:     () => get<{ contracts: any[] }>('/enterprise/contracts'),
};
