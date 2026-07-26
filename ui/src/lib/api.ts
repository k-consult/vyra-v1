const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) throw new Error(`API ${path} ${res.status}`);
    return res.json();
};

export const knowledge = {
    regulations: () => get<{ regulations: any[] }>('/knowledge/regulations'),
    controls:    () => get<{ controls: any[] }>('/knowledge/controls'),
    traceForward: (id: string) => get(`/knowledge/trace/${id}`),
    traceReverse: (id: string) => get(`/knowledge/reverse/${id}`),
};

export const execution = {
    programs:      () => get('/execution/programs'),
    tasks:         (workflowId?: string) => get(`/execution/tasks${workflowId ? `?workflowId=${workflowId}` : ''}`),
    capas:         () => get<{ capas: any[] }>('/execution/capas'),
    verifications: () => get<{ verifications: any[] }>('/execution/verifications'),
};

export const operational = {
    assets:    () => get('/operational/assets'),
    signals:   (assetId?: string) => get(`/operational/signals${assetId ? `?assetId=${assetId}` : ''}`),
    incidents: () => get<{ incidents: any[] }>('/operational/incidents'),
    facilities:() => get<{ facilities: any[] }>('/operational/facilities'),
    vendors:   () => get<{ vendors: any[] }>('/operational/vendors'),
    lifecycle: (id: string) => get<any>(`/operational/incidents/${id}/lifecycle`),
};

export const intelligence = {
    findings:     () => get('/intelligence/findings'),
    risks:        () => get('/intelligence/risks'),
    decisions:    () => get('/intelligence/decisions'),
    rcas:         () => get<{ rcas: any[] }>('/intelligence/rcas'),
    reverseTrace: (id: string) => get<any>(`/intelligence/incidents/${id}/reverse-trace`),
};

export const assurance = {
    posture:      () => get('/assurance/posture'),
    attestations: () => get('/assurance/attestations'),
    evidence:     () => get<{ evidence: any[] }>('/assurance/evidence'),
};

export const dashboard = {
    landscape: () => get<any>('/dashboard/landscape'),
};

export const catalog = {
    regulations:      () => get<{ regulations: any[] }>('/catalog/regulations'),
    authorities:      () => get<{ authorities: any[] }>('/catalog/authorities'),
    complianceAreas:  () => get<{ complianceAreas: any[] }>('/catalog/complianceAreas'),
    traceRequirements: (id: string) => get(`/catalog/trace/${id}`),
};

export const enterprise = {
    organizations: () => get<{ organizations: any[] }>('/enterprise/organizations'),
    roles:         () => get<{ roles: any[] }>('/enterprise/roles'),
    orgChart:      (id: string) => get(`/enterprise/org-chart/${id}`),
};
