'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    AlertTriangle, RefreshCw, Brain, ArrowRight,
    Sparkles, TrendingUp, Search, Users, ShieldCheck,
    Radio, FileText, ClipboardCheck, Eye, Gavel, Flag,
} from 'lucide-react';
import { intelligence, operational, knowledge } from '@/lib/api';
import { Badge, PropRow } from '@/features/landscape/landscape';
import { formatValue } from '@/features/validation/display';
import { PageHeader } from '@/components/page-header';

type Tab = 'decisions' | 'controls' | 'people';
type DecisionFilter = 'pending' | 'approved' | 'rejected' | 'all';

const STATUS_STYLE: Record<string, string> = {
    pending:  'bg-amber-900 text-amber-300 border-amber-700',
    approved: 'bg-emerald-900 text-emerald-300 border-emerald-700',
    rejected: 'bg-red-900 text-red-300 border-red-700',
};

// A resolved Decision's approval creates one real node elsewhere in the graph —
// this maps its `type` to what shows what got created, so a reviewer can follow
// their own approval straight to its consequence instead of hunting for it.
// 'control-recommendation' stays a local tab (Controls lives in this screen);
// deviation/risk decisions now route out to their own persona screen. Type-keyed
// maps are the fallback for Decisions approved before RESULTED_IN existed (no
// `result` on the wire yet) — current data routes directly via decision.result's
// own label through RESULT_ROUTE_BY_ENTITY below.
const RESULT_TAB: Partial<Record<string, Tab>> = {
    'control-recommendation': 'controls',
};

const RESULT_ROUTE_BY_TYPE: Partial<Record<string, string>> = {
    'deviation-assessment': '/ops-supervisor',
    'risk-assessment': '/risk-manager',
};

const RESULT_ROUTE_BY_ENTITY: Partial<Record<string, string>> = {
    Finding: '/ops-supervisor',
    Risk: '/risk-manager',
};

const ENTITY_ICON: Record<string, React.ElementType> = {
    Signal: Radio,
    Finding: Search,
    Obligation: FileText,
    Incident: AlertTriangle,
    Control: ShieldCheck,
    Risk: TrendingUp,
    Audit: ClipboardCheck,
};

// ── Decisions ────────────────────────────────────────────────────────────────────

const CONFIDENCE_COLOR = (c: number) =>
    c >= 0.8 ? 'text-emerald-300' : c >= 0.5 ? 'text-amber-300' : 'text-red-300';

// A single stage in the horizontal Origin → Reasoned → Reviewed → Result strip.
// `state` drives the dot/connector styling: 'done' (filled, reached), 'current'
// (the live actionable stage), 'empty' (a terminal non-outcome, e.g. rejected —
// nothing was created), or 'pending' (not reached yet).
function TimelineStage({ label, icon: Icon, state, last, children }: {
    label: string; icon: React.ElementType; state: 'done' | 'current' | 'empty' | 'pending';
    last?: boolean; children: React.ReactNode;
}) {
    const dotStyle = {
        done:    'bg-emerald-500',
        current: 'bg-amber-500',
        empty:   'bg-zinc-700 ring-1 ring-zinc-600',
        pending: 'bg-zinc-800',
    }[state];
    const lineStyle = state === 'done' ? 'bg-emerald-700' : 'bg-zinc-800';

    return (
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full shrink-0 ${dotStyle}`} />
                {!last && <div className={`flex-1 h-px ${lineStyle}`} />}
            </div>
            <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-zinc-600">
                <Icon size={9} /> {label}
            </div>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

function DecisionRow({ decision, people, onResolved, onViewResult }: {
    decision: any; people: any[]; onResolved: () => void; onViewResult: (tab: Tab) => void;
}) {
    const [reviewedBy, setReviewedBy] = useState(people[0]?.id ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resolve = async (action: 'approve' | 'reject') => {
        setBusy(true);
        setError(null);
        try {
            await (action === 'approve'
                ? intelligence.approve(decision.id, reviewedBy)
                : intelligence.reject(decision.id, reviewedBy));
            onResolved();
        } catch (err: any) {
            setError(err.message);
            setBusy(false);
        }
    };

    const reviewed = decision.status !== 'pending';
    const approved = decision.status === 'approved';
    const rejected = decision.status === 'rejected';
    const origin = decision.origin;
    const result = decision.result;
    const fallbackResultTab = RESULT_TAB[decision.type];
    const fallbackResultRoute = RESULT_ROUTE_BY_TYPE[decision.type];
    const resultRoute = result ? RESULT_ROUTE_BY_ENTITY[result.label] : undefined;
    const OriginIcon = ENTITY_ICON[origin?.label] ?? FileText;
    const ResultIcon = ENTITY_ICON[result?.label] ?? ShieldCheck;

    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-mono text-zinc-500">{decision.id}</p>
                    <p className="text-sm text-zinc-200 mt-0.5 truncate" title={decision.rationale}>{decision.rationale}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {decision.status && <Badge value={decision.status} />}
                    <span className={`text-[11px] font-semibold tabular-nums ${CONFIDENCE_COLOR(decision.confidence ?? 0)}`}>
                        {Math.round((decision.confidence ?? 0) * 100)}%
                    </span>
                </div>
            </div>

            <div className="flex items-stretch gap-3 pt-1">
                <TimelineStage label="Origin" icon={OriginIcon} state="done">
                    <p className="text-[11px] text-zinc-300">{origin?.label ?? 'Unknown'}</p>
                    <p className="text-[10px] font-mono text-zinc-500 truncate" title={origin?.id}>{origin?.id ?? '—'}</p>
                </TimelineStage>

                <TimelineStage label="Reasoned" icon={Eye} state="done">
                    <p className="text-[11px] text-zinc-300 truncate" title={decision.agentId}>{decision.agentId}</p>
                    <p className="text-[10px] text-zinc-500">{formatValue(decision.decidedAt)}</p>
                </TimelineStage>

                <TimelineStage label="Reviewed" icon={Gavel} state={reviewed ? 'done' : 'current'}>
                    {reviewed ? (
                        <>
                            <p className="text-[11px] text-zinc-300 truncate" title={decision.reviewedBy}>{decision.reviewedBy || 'unattributed'}</p>
                            <p className="text-[10px] text-zinc-500">{formatValue(decision.reviewedAt)}</p>
                        </>
                    ) : (
                        <p className="text-[11px] text-amber-400/90">awaiting review</p>
                    )}
                </TimelineStage>

                <TimelineStage label="Result" icon={result ? ResultIcon : Flag} last state={approved ? 'done' : rejected ? 'empty' : 'pending'}>
                    {approved && result && resultRoute ? (
                        <Link href={resultRoute} className="text-left group">
                            <p className="text-[11px] text-emerald-400 group-hover:text-emerald-300">{result.label}</p>
                            <p className="text-[10px] font-mono text-zinc-500 truncate flex items-center gap-0.5">{result.id} <ArrowRight size={9} /></p>
                        </Link>
                    ) : approved && result ? (
                        <button onClick={() => onViewResult(fallbackResultTab ?? 'controls')} className="text-left group">
                            <p className="text-[11px] text-emerald-400 group-hover:text-emerald-300">{result.label}</p>
                            <p className="text-[10px] font-mono text-zinc-500 truncate flex items-center gap-0.5">{result.id} <ArrowRight size={9} /></p>
                        </button>
                    ) : approved && decision.type === 'assurance-package-proposal' ? (
                        <Link href="/assurance" className="text-[11px] text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-0.5">
                            assurance chain <ArrowRight size={9} />
                        </Link>
                    ) : approved && fallbackResultRoute ? (
                        <Link href={fallbackResultRoute} className="text-[11px] text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-0.5">
                            view <ArrowRight size={9} />
                        </Link>
                    ) : approved && fallbackResultTab ? (
                        <button onClick={() => onViewResult(fallbackResultTab)} className="text-[11px] text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-0.5">
                            view <ArrowRight size={9} />
                        </button>
                    ) : rejected ? (
                        <p className="text-[11px] text-zinc-600">nothing created</p>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <select
                                value={reviewedBy}
                                onChange={(e) => setReviewedBy(e.target.value)}
                                className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-[10px] text-zinc-300"
                            >
                                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <button
                                onClick={() => resolve('approve')}
                                disabled={busy}
                                className="shrink-0 rounded border border-emerald-700/50 bg-emerald-900/30 px-1.5 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-900/50 disabled:opacity-40"
                            >
                                Approve
                            </button>
                            <button
                                onClick={() => resolve('reject')}
                                disabled={busy}
                                className="shrink-0 rounded border border-red-700/50 bg-red-900/30 px-1.5 py-1 text-[10px] font-medium text-red-300 hover:bg-red-900/50 disabled:opacity-40"
                            >
                                Reject
                            </button>
                        </div>
                    )}
                </TimelineStage>
            </div>
            {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
    );
}

const DECISION_FILTERS: { key: DecisionFilter; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
];

function DecisionsPanel({ items, people, onResolved, onViewResult }: {
    items: any[]; people: any[]; onResolved: () => void; onViewResult: (tab: Tab) => void;
}) {
    const [filter, setFilter] = useState<DecisionFilter>('pending');

    const counts = useMemo(() => ({
        pending: items.filter(d => d.status === 'pending').length,
        approved: items.filter(d => d.status === 'approved').length,
        rejected: items.filter(d => d.status === 'rejected').length,
        all: items.length,
    }), [items]);

    const filtered = filter === 'all' ? items : items.filter(d => d.status === filter);

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <Sparkles size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Agent Decisions</p>
                <p className="text-[10px] text-zinc-700">· Autonomy Level 1 — agent recommends, human approves</p>
            </div>

            <div className="flex items-center gap-1.5">
                {DECISION_FILTERS.map(({ key, label }) => {
                    const active = filter === key;
                    const style = key !== 'all' ? STATUS_STYLE[key] : 'bg-zinc-800 text-zinc-300 border-zinc-600';
                    return (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                                active ? style : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                            }`}
                        >
                            {label} · {counts[key]}
                        </button>
                    );
                })}
            </div>

            {filtered.length === 0 ? (
                <p className="text-sm text-zinc-500 italic">
                    {filter === 'pending'
                        ? 'Nothing awaiting review right now — the 4 agents will surface new proposals here as they poll the graph.'
                        : `No ${filter === 'all' ? '' : filter + ' '}decisions.`}
                </p>
            ) : (
                <div className="flex flex-col gap-2">
                    {filtered.map((d, i) => (
                        <DecisionRow key={d?.id ?? i} decision={d} people={people} onResolved={onResolved} onViewResult={onViewResult} />
                    ))}
                </div>
            )}
        </section>
    );
}

// ── Agreement Rates ────────────────────────────────────────────────────────────

function AgreementRatesPanel({ items }: { items: { agentId: string; approved: number; rejected: number; total: number; agreementRate: number | null }[] }) {
    if (items.length === 0) return null;
    return (
        <section className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <TrendingUp size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Agent Agreement Rates</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {items.map(a => (
                    <div key={a.agentId} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 flex flex-col gap-1">
                        <p className="text-[11px] font-mono text-zinc-500">{a.agentId}</p>
                        <p className="text-lg text-zinc-100 font-semibold">
                            {a.agreementRate === null ? '—' : `${Math.round(a.agreementRate * 100)}%`}
                        </p>
                        <p className="text-[11px] text-zinc-500">{a.approved} approved · {a.rejected} rejected</p>
                    </div>
                ))}
            </div>
        </section>
    );
}

// ── Agent-Proposed Controls ──────────────────────────────────────────────────────

function AgentProposedControlCard({ control }: { control: any }) {
    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-mono text-zinc-500">{control.id}</p>
                {control.status && <Badge value={control.status} />}
            </div>
            <p className="text-sm text-zinc-200">{control.name}</p>
            {control.description && <p className="text-xs text-zinc-400">{control.description}</p>}
            <div className="flex flex-col gap-0">
                <PropRow label="controlType" value={control.controlType} />
                <PropRow label="createdAt" value={control.createdAt} />
            </div>
        </div>
    );
}

function ControlsPanel({ items }: { items: any[] }) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <ShieldCheck size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Agent-Proposed Controls</p>
                <p className="text-[10px] text-zinc-700">· created by approving a control-recommendation Decision, status &quot;proposed&quot; — not yet counted in coverage</p>
            </div>
            {items.length === 0 ? (
                <p className="text-sm text-zinc-500 italic">
                    None yet — approve a &quot;control-recommendation&quot; Decision to create one.
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((c, i) => <AgentProposedControlCard key={c?.id ?? i} control={c} />)}
                </div>
            )}
        </section>
    );
}

// ── People ───────────────────────────────────────────────────────────────────────

function PersonCard({ person }: { person: any }) {
    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-[11px] font-mono text-zinc-500 mb-2">{person.id}</p>
            <p className="text-sm text-zinc-200 mb-2">{person.name}</p>
            <PropRow label="roleTitle" value={person.roleTitle} />
            <PropRow label="worksAt" value={(person.facilityIds ?? []).join(', ')} />
        </div>
    );
}

function PeoplePanel({ items }: { items: any[] }) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <Users size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">People</p>
                <p className="text-[10px] text-zinc-700" title="Extracted from free-text name fields already in the data — see graph.md">
                    · extracted from free-text names, no roleId match (different Role catalog vertical)
                </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((p, i) => <PersonCard key={p?.id ?? i} person={p} />)}
            </div>
        </section>
    );
}

// ── Main view ──────────────────────────────────────────────────────────────────

export function IntelligenceView() {
    const [decisions, setDecisions] = useState<any[]>([]);
    const [people, setPeople] = useState<any[]>([]);
    const [agentProposedControls, setAgentProposedControls] = useState<any[]>([]);
    const [agreementRates, setAgreementRates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('decisions');

    const load = () => {
        setLoading(true);
        setError(false);
        Promise.all([
            intelligence.decisions(), operational.people(), knowledge.agentProposedControls(),
            intelligence.agreementRates(),
        ])
            .then(([dec, ppl, ctl, rates]: any[]) => {
                setDecisions(dec.decisions ?? []);
                setPeople(ppl.people ?? []);
                setAgentProposedControls(ctl.controls ?? []);
                setAgreementRates(rates.agreementRates ?? []);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const pendingCount = useMemo(() => decisions.filter(d => d.status === 'pending').length, [decisions]);

    const tabs: { key: Tab; label: string; icon: React.ElementType; count: number; alert?: number }[] = [
        { key: 'decisions', label: 'Decisions', icon: Sparkles, count: decisions.length, alert: pendingCount },
        { key: 'controls', label: 'Proposed Controls', icon: ShieldCheck, count: agentProposedControls.length },
        { key: 'people', label: 'People', icon: Users, count: people.length },
    ];

    if (loading) {
        return (
            <div className="h-full bg-zinc-950 flex items-center justify-center">
                <div className="flex items-center gap-3 text-zinc-500">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-sm">Loading intelligence…</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full bg-zinc-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <span className="text-sm text-zinc-500">Could not load intelligence data</span>
                    <button onClick={load} className="text-xs text-zinc-400 underline">Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">

            <PageHeader icon={Brain} iconClassName="text-red-400" title="Intelligence" subtitle="Decision Gate · L4 Review">
                <button onClick={load} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Refresh">
                    <RefreshCw size={14} className="text-zinc-500" />
                </button>
            </PageHeader>

            {/* ── Tabs ── */}
            <div className="px-6 pt-3 flex items-center gap-1 shrink-0 border-b border-zinc-800/60">
                {tabs.map(({ key, label, icon: Icon, count, alert }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`relative flex items-center gap-1.5 text-xs px-3 py-2 rounded-t-md border-b-2 transition-colors ${
                            activeTab === key ? 'border-emerald-500 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        <Icon size={12} /> {label}
                        <span className="text-zinc-600">· {count}</span>
                        {!!alert && (
                            <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-bold">
                                {alert}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Content ── */}
            <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
                {activeTab === 'decisions' && (
                    <div className="flex flex-col gap-6">
                        <AgreementRatesPanel items={agreementRates} />
                        <DecisionsPanel items={decisions} people={people} onResolved={load} onViewResult={setActiveTab} />
                    </div>
                )}
                {activeTab === 'controls' && <ControlsPanel items={agentProposedControls} />}
                {activeTab === 'people' && <PeoplePanel items={people} />}
            </div>

            {/* ── Footer ── */}
            <footer className="border-t border-zinc-800/60 px-6 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500 flex items-center justify-center">
                        <Brain size={9} className="text-zinc-950" />
                    </div>
                    <span className="text-[10px] text-zinc-600">Vyra Platform v1</span>
                </div>
                <p className="text-[10px] text-zinc-700">Compliance. Handled.</p>
            </footer>
        </div>
    );
}
