'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ChevronRight } from 'lucide-react';
import { operational } from '@/lib/api';
import { PropRow, NodeCard, NodeList, CoverageSummary } from './display';

// ── State types ────────────────────────────────────────────────────────────────

type Incident = { id: string; name: string; riskRating?: string; status?: string };

type LifecycleData = {
    incident: Record<string, any>;
    facilities: any[];
    regulations: any[];
    controls: any[];
    tasks: any[];
    assets: any[];
    vendors: any[];
    findings: any[];
    findingControls: any[];
    risks: any[];
    rcas: any[];
    capas: any[];
    verifications: any[];
    evidence: any[];
};

type StageStatus = 'full' | 'partial' | 'missing';

// ── Stage definitions ──────────────────────────────────────────────────────────

const STAGES: { n: number; label: string; sub: string }[] = [
    { n: 1,  label: 'Applicability',     sub: 'Facility + Regulations' },
    { n: 2,  label: 'Controls',          sub: 'Failed controls' },
    { n: 3,  label: 'Policies / SOPs',   sub: 'Control types' },
    { n: 4,  label: 'Tasks',             sub: 'Owner + SLA' },
    { n: 5,  label: 'Evidence',          sub: 'Artifact list' },
    { n: 6,  label: 'Escalation',        sub: 'Path chain' },
    { n: 7,  label: 'Risk',              sub: 'Likelihood × Severity' },
    { n: 8,  label: 'Findings',          sub: 'Audit findings' },
    { n: 9,  label: 'RCA → CAPA',        sub: 'Root causes + actions' },
    { n: 10, label: 'Verification',      sub: 'Closure status' },
    { n: 11, label: 'Monitoring',        sub: 'KPIs + AI watch' },
];

// ── Pure status derivation ─────────────────────────────────────────────────────

const either = (a: any[], b: any[]): StageStatus =>
    a.length > 0 && b.length > 0 ? 'full' : a.length > 0 || b.length > 0 ? 'partial' : 'missing';

const present = (arr: any[]): StageStatus => (arr.length > 0 ? 'full' : 'missing');
const prop    = (v: any): StageStatus      => (v ? 'full' : 'missing');

const stageCount = (n: number, d: LifecycleData): number => {
    const inc = d.incident;
    switch (n) {
        case 1:  return d.facilities.length + d.regulations.length;
        case 2:  return d.controls.length;
        case 3:  return d.controls.length;
        case 4:  return d.tasks.length;
        case 5:  return d.evidence.length;
        case 6:  return inc?.escalationPath ? 1 : 0;
        case 7:  return d.risks.length;
        case 8:  return d.findings.length;
        case 9:  return d.rcas.length + d.capas.length;
        case 10: return d.verifications.length;
        case 11: return [inc?.dashboardMetrics, inc?.continuousMonitoring].filter(Boolean).length;
        default: return 0;
    }
};

const stageStatus = (n: number, d: LifecycleData): StageStatus => {
    const inc = d.incident;
    switch (n) {
        case 1:  return either(d.facilities, d.regulations);
        case 2:  return present(d.controls);
        case 3:  return present(d.controls);
        case 4:  return present(d.tasks);
        case 5:  return present(d.evidence);
        case 6:  return prop(inc?.escalationPath);
        case 7:  return present(d.risks);
        case 8:  return present(d.findings);
        case 9:  return either(d.rcas, d.capas);
        case 10: return present(d.verifications);
        case 11: return prop(inc?.dashboardMetrics ?? inc?.continuousMonitoring);
        default: return 'missing';
    }
};

// ── Presentation primitives ────────────────────────────────────────────────────

const STATUS_META: Record<StageStatus, { icon: React.ReactNode; ring: string; bg: string }> = {
    full:    { icon: <CheckCircle2  size={14} className="text-emerald-400" />, ring: 'border-emerald-500', bg: 'bg-emerald-950' },
    partial: { icon: <AlertTriangle size={14} className="text-amber-400"   />, ring: 'border-amber-500',   bg: 'bg-amber-950'   },
    missing: { icon: <XCircle       size={14} className="text-red-400"     />, ring: 'border-red-800',     bg: 'bg-red-950'     },
};

function StageTile({
    stage,
    status,
    count,
    selected,
    onClick,
}: {
    stage: (typeof STAGES)[number];
    status: StageStatus;
    count: number;
    selected: boolean;
    onClick: () => void;
}) {
    const meta = STATUS_META[status];
    return (
        <button
            onClick={onClick}
            className={[
                'flex flex-col gap-1 px-3 py-2 rounded-lg border text-left min-w-[96px] transition-colors',
                selected
                    ? `${meta.ring} ${meta.bg} border-2`
                    : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500',
            ].join(' ')}
        >
            <div className="flex items-center gap-1 w-full justify-between">
                <span className="text-[10px] font-mono text-zinc-500">S{stage.n}</span>
                {meta.icon}
            </div>
            <span className="text-xs font-medium text-zinc-200 leading-tight">{stage.label}</span>
            <div className="flex items-center justify-between gap-1 w-full">
                <span className="text-[10px] text-zinc-500 leading-tight">{stage.sub}</span>
                {count > 0 && (
                    <span className="text-[10px] font-mono font-semibold text-zinc-400 bg-zinc-800 rounded px-1">
                        {count}
                    </span>
                )}
            </div>
        </button>
    );
}

// ── Stage detail panel ─────────────────────────────────────────────────────────

function StageDetail({ n, data }: { n: number; data: LifecycleData }) {
    const inc = data.incident;
    switch (n) {
        case 1:
            return (
                <div className="flex flex-col gap-6">
                    <Section label="Facilities">
                        <NodeList nodes={data.facilities} emptyLabel="No facility link found" />
                    </Section>
                    <Section label="Governing Regulations">
                        <NodeList nodes={data.regulations} emptyLabel="No governing regulations found" />
                    </Section>
                </div>
            );
        case 2:
        case 3:
            return (
                <Section label={n === 2 ? 'Failed Controls' : 'Policies / SOPs'}>
                    <NodeList nodes={data.controls} emptyLabel="No controls linked" />
                </Section>
            );
        case 4:
            return (
                <Section label="Compliance Tasks">
                    <NodeList nodes={data.tasks} emptyLabel="No tasks found" />
                </Section>
            );
        case 5:
            return (
                <Section label="Evidence Artifacts">
                    <NodeList nodes={data.evidence} emptyLabel="No evidence artifacts linked" />
                </Section>
            );
        case 6:
            return (
                <Section label="Escalation Path">
                    {inc?.escalationPath
                        ? <EscalationChain path={inc.escalationPath} />
                        : <p className="text-sm text-zinc-500 italic">No escalation path defined</p>}
                </Section>
            );
        case 7:
            return (
                <div className="flex flex-col gap-6">
                    <Section label="Risk Score">
                        <div className="flex gap-6 text-sm">
                            <Metric label="Likelihood"  value={inc?.likelihood}  />
                            <span className="text-zinc-600 self-center">×</span>
                            <Metric label="Severity"    value={inc?.severity}    />
                            <span className="text-zinc-600 self-center">=</span>
                            <Metric label="Residual"    value={inc?.residualRisk} />
                            <RatingBadge rating={inc?.riskRating} />
                        </div>
                    </Section>
                    <Section label="Risk Nodes">
                        <NodeList nodes={data.risks} emptyLabel="No risk nodes linked" />
                    </Section>
                </div>
            );
        case 8:
            return (
                <Section label="Audit Findings">
                    <NodeList nodes={data.findings} emptyLabel="No findings recorded" />
                </Section>
            );
        case 9:
            return (
                <div className="flex flex-col gap-6">
                    <Section label="Root Cause Analysis">
                        <NodeList nodes={data.rcas} emptyLabel="No RCA nodes found" />
                    </Section>
                    <Section label="Corrective Actions (CAPA)">
                        <NodeList nodes={data.capas} emptyLabel="No CAPA nodes found" />
                    </Section>
                </div>
            );
        case 10:
            return (
                <Section label="Verifications">
                    <NodeList nodes={data.verifications} emptyLabel="No verifications recorded" />
                </Section>
            );
        case 11:
            return (
                <div className="flex flex-col gap-4 text-sm">
                    <Section label="Dashboard Metrics">
                        <p className="text-zinc-300">{inc?.dashboardMetrics ?? '—'}</p>
                    </Section>
                    <Section label="AI Monitoring">
                        <p className="text-zinc-300">{inc?.continuousMonitoring ?? '—'}</p>
                    </Section>
                </div>
            );
        default:
            return null;
    }
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">{label}</h3>
            {children}
        </div>
    );
}

function EscalationChain({ path }: { path: string }) {
    const steps = path.split(' → ').map((s) => s.trim()).filter(Boolean);
    return (
        <div className="flex flex-wrap items-center gap-2">
            {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
                        {step}
                    </span>
                    {i < steps.length - 1 && <ChevronRight size={12} className="text-zinc-600" />}
                </div>
            ))}
        </div>
    );
}

function Metric({ label, value }: { label: string; value: any }) {
    return (
        <div className="flex flex-col items-center gap-1">
            <span className="text-lg font-semibold text-zinc-100">{value ?? '—'}</span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</span>
        </div>
    );
}

const RATING_COLORS: Record<string, string> = {
    Critical: 'bg-red-900 text-red-300 border-red-700',
    High:     'bg-orange-900 text-orange-300 border-orange-700',
    Medium:   'bg-amber-900 text-amber-300 border-amber-700',
    Low:      'bg-emerald-900 text-emerald-300 border-emerald-700',
};

function RatingBadge({ rating }: { rating?: string }) {
    if (!rating) return null;
    const cls = RATING_COLORS[rating] ?? 'bg-zinc-800 text-zinc-300 border-zinc-600';
    return (
        <span className={`self-center rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
            {rating}
        </span>
    );
}

// ── Orchestration ──────────────────────────────────────────────────────────────

export function LifecycleView() {
    const [incidents, setIncidents]     = useState<Incident[]>([]);
    const [selectedId, setSelectedId]   = useState('');
    const [data, setData]               = useState<LifecycleData | null>(null);
    const [loading, setLoading]         = useState(false);
    const [selectedStage, setSelectedStage] = useState(1);

    useEffect(() => {
        operational.incidents().then(({ incidents }) => {
            setIncidents(incidents ?? []);
            if (incidents?.length > 0) setSelectedId(incidents[0].id);
        });
    }, []);

    useEffect(() => {
        if (!selectedId) return;
        setLoading(true);
        setData(null);
        operational.lifecycle(selectedId)
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [selectedId]);

    return (
        <div className="flex flex-col gap-6">
            {/* Selector */}
            <div className="flex items-center gap-3">
                <label className="text-sm text-zinc-400 shrink-0">Incident</label>
                <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                >
                    {incidents.length === 0 && <option value="">Loading…</option>}
                    {incidents.map((inc) => (
                        <option key={inc.id} value={inc.id}>
                            {inc.id} — {inc.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Coverage summary */}
            {data && (() => {
                const counts = STAGES.reduce(
                    (acc, s) => { acc[stageStatus(s.n, data)]++; acc.total++; return acc; },
                    { full: 0, partial: 0, missing: 0, total: 0 }
                );
                return <CoverageSummary counts={counts} unit="stages" />;
            })()}

            {/* Stage pipeline */}
            <div className="overflow-x-auto bg-zinc-950 rounded-lg py-1">
                <div className="flex items-start gap-2 min-w-max pb-1">
                    {STAGES.map((stage, i) => (
                        <div key={stage.n} className="flex items-start gap-2">
                            <StageTile
                                stage={stage}
                                status={data ? stageStatus(stage.n, data) : 'missing'}
                                count={data ? stageCount(stage.n, data) : 0}
                                selected={selectedStage === stage.n}
                                onClick={() => setSelectedStage(stage.n)}
                            />
                            {i < STAGES.length - 1 && (
                                <ChevronRight size={16} className="text-zinc-700 mt-5 shrink-0" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Detail panel */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 min-h-[200px]">
                {loading && (
                    <p className="text-sm text-zinc-500">Loading lifecycle data…</p>
                )}
                {!loading && !data && selectedId && (
                    <p className="text-sm text-red-400">Could not load data for {selectedId}</p>
                )}
                {!loading && data && (
                    <div>
                        <h2 className="text-sm font-semibold text-zinc-300 mb-4">
                            Stage {selectedStage} — {STAGES[selectedStage - 1].label}
                        </h2>
                        <StageDetail n={selectedStage} data={data} />
                    </div>
                )}
            </div>
        </div>
    );
}
