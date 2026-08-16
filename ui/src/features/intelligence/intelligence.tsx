'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    AlertTriangle, RefreshCw, Brain, ArrowLeft,
    Sparkles, TrendingUp, Search, GitBranch, Users, ShieldCheck,
} from 'lucide-react';
import { intelligence, operational, knowledge } from '@/lib/api';
import { PropRow, BADGE_COLORS } from '@/features/landscape/landscape';

function Badge({ value }: { value: string }) {
    const cls = BADGE_COLORS[value] ?? 'bg-zinc-800 text-zinc-300 border-zinc-600';
    return <span className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{value}</span>;
}

// ── Decisions (agent activity) ──────────────────────────────────────────────────

const CONFIDENCE_COLOR = (c: number) =>
    c >= 0.8 ? 'text-emerald-300' : c >= 0.5 ? 'text-amber-300' : 'text-red-300';

function DecisionCard({ decision, people, onResolved }: { decision: any; people: any[]; onResolved: () => void }) {
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

    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-mono text-zinc-500">{decision.id}</p>
                <span className={`text-[11px] font-semibold tabular-nums ${CONFIDENCE_COLOR(decision.confidence ?? 0)}`}>
                    {Math.round((decision.confidence ?? 0) * 100)}%
                </span>
            </div>
            <p className="text-sm text-zinc-200">{decision.rationale}</p>
            <div className="flex flex-col gap-0">
                <PropRow label="agentId" value={decision.agentId} />
                <PropRow label="type" value={decision.type} />
                <PropRow label="autonomyLevel" value={decision.autonomyLevel} />
                <PropRow label="status" value={decision.status} />
                <PropRow label="decidedAt" value={decision.decidedAt} />
            </div>
            {decision.status === 'pending' ? (
                <div className="flex items-center gap-2 pt-2 mt-1 border-t border-zinc-800/60">
                    <select
                        value={reviewedBy}
                        onChange={(e) => setReviewedBy(e.target.value)}
                        className="flex-1 min-w-0 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300"
                    >
                        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button
                        onClick={() => resolve('approve')}
                        disabled={busy}
                        className="shrink-0 rounded border border-emerald-700/50 bg-emerald-900/30 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-900/50 disabled:opacity-40"
                    >
                        Approve
                    </button>
                    <button
                        onClick={() => resolve('reject')}
                        disabled={busy}
                        className="shrink-0 rounded border border-red-700/50 bg-red-900/30 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-900/50 disabled:opacity-40"
                    >
                        Reject
                    </button>
                </div>
            ) : (
                <div className="flex flex-col gap-0 pt-2 mt-1 border-t border-zinc-800/60">
                    <PropRow label="reviewedBy" value={decision.reviewedBy} />
                    <PropRow label="reviewedAt" value={decision.reviewedAt} />
                </div>
            )}
            {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
    );
}

function DecisionsSection({ items, people, onResolved }: { items: any[]; people: any[]; onResolved: () => void }) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <Sparkles size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Agent Decisions · {items.length}</p>
                <p className="text-[10px] text-zinc-700">· Autonomy Level 1 — agent recommends, human approves</p>
            </div>
            {items.length === 0 ? (
                <p className="text-sm text-zinc-500 italic">No agent decisions yet — run an agent (e.g. `agents/index.ts control-intelligence`) to populate this.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((d, i) => <DecisionCard key={d?.id ?? i} decision={d} people={people} onResolved={onResolved} />)}
                </div>
            )}
        </section>
    );
}

// ── Agent-Proposed Controls (what approving a control-recommendation created) ────

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

function AgentProposedControlsSection({ items }: { items: any[] }) {
    if (items.length === 0) return null;
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <ShieldCheck size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Agent-Proposed Controls · {items.length}</p>
                <p className="text-[10px] text-zinc-700">· created by approving a control-recommendation Decision above, status "proposed" — not yet counted in coverage</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((c, i) => <AgentProposedControlCard key={c?.id ?? i} control={c} />)}
            </div>
        </section>
    );
}

// ── Findings ─────────────────────────────────────────────────────────────────────

function FindingsSection({ items }: { items: any[] }) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <Search size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Findings · {items.length}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-zinc-900/60 text-zinc-500">
                            <th className="text-left font-medium px-4 py-2">ID</th>
                            <th className="text-left font-medium px-4 py-2">Name</th>
                            <th className="text-left font-medium px-4 py-2">Severity</th>
                            <th className="text-left font-medium px-4 py-2">Control</th>
                            <th className="text-left font-medium px-4 py-2">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((f, i) => (
                            <tr key={f?.id ?? i} className={i % 2 === 0 ? 'bg-zinc-950' : 'bg-zinc-900/20'}>
                                <td className="px-4 py-1.5 font-mono text-zinc-500">{f.id}</td>
                                <td className="px-4 py-1.5 text-zinc-300">{f.name}</td>
                                <td className="px-4 py-1.5">{f.severity && <Badge value={f.severity} />}</td>
                                <td className="px-4 py-1.5 text-zinc-400">{f.controlId ?? '—'}</td>
                                <td className="px-4 py-1.5">{f.status && <Badge value={f.status} />}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

// ── Risks ────────────────────────────────────────────────────────────────────────

function RisksSection({ items }: { items: any[] }) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <TrendingUp size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Risks · {items.length}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((r, i) => (
                    <div key={r?.id ?? i} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
                        <p className="text-[11px] font-mono text-zinc-500 mb-2">{r.id}</p>
                        <p className="text-sm text-zinc-200 mb-2">{r.name}</p>
                        <PropRow label="inherentRating" value={r.inherentRating} />
                        <PropRow label="inherentScore" value={r.inherentScore} />
                        <PropRow label="residualRating" value={r.residualRating} />
                        <PropRow label="residualScore" value={r.residualScore} />
                        <PropRow label="owner" value={r.owner} />
                    </div>
                ))}
            </div>
        </section>
    );
}

// ── RCAs ─────────────────────────────────────────────────────────────────────────

function RcasSection({ items }: { items: any[] }) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <GitBranch size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Root Cause Analyses · {items.length}</p>
            </div>
            <div className="max-h-[360px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((r, i) => (
                    <div key={r?.id ?? i} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
                        <p className="text-[11px] font-mono text-zinc-500 mb-2">{r.id}</p>
                        <PropRow label="name" value={r.name} />
                        <PropRow label="rootCause" value={r.rootCause} />
                        <PropRow label="analysedAt" value={r.analysedAt} />
                        <PropRow label="status" value={r.status} />
                    </div>
                ))}
            </div>
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

function PeopleSection({ items }: { items: any[] }) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <Users size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">People · {items.length}</p>
                <p className="text-[10px] text-zinc-700" title="Extracted from free-text name fields already in the data — see vyra-graph-spine.md">
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
    const [findings, setFindings] = useState<any[]>([]);
    const [risks, setRisks] = useState<any[]>([]);
    const [rcas, setRcas] = useState<any[]>([]);
    const [people, setPeople] = useState<any[]>([]);
    const [agentProposedControls, setAgentProposedControls] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        Promise.all([
            intelligence.decisions(), intelligence.findings(), intelligence.risks(),
            intelligence.rcas(), operational.people(), knowledge.agentProposedControls(),
        ])
            .then(([dec, find, risk, rca, ppl, ctl]: any[]) => {
                setDecisions(dec.decisions ?? []);
                setFindings(find.findings ?? []);
                setRisks(risk.risks ?? []);
                setRcas(rca.rcas ?? []);
                setPeople(ppl.people ?? []);
                setAgentProposedControls(ctl.controls ?? []);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    if (loading) {
        return (
            <div className="h-screen bg-zinc-950 flex items-center justify-center">
                <div className="flex items-center gap-3 text-zinc-500">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-sm">Loading intelligence…</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen bg-zinc-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <span className="text-sm text-zinc-500">Could not load intelligence data</span>
                    <button onClick={load} className="text-xs text-zinc-400 underline">Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">

            {/* ── Header ── */}
            <header className="border-b border-zinc-800/60 shrink-0">
                <div className="flex items-center justify-between px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-red-500 flex items-center justify-center shrink-0">
                            <Brain size={18} className="text-zinc-950" />
                        </div>
                        <div>
                            <p className="text-base font-semibold leading-tight">VYRA</p>
                            <p className="text-xs text-zinc-500 leading-tight">Intelligence &amp; Agent Activity</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-5">
                        <button onClick={load} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Refresh">
                            <RefreshCw size={14} className="text-zinc-500" />
                        </button>
                        <Link href="/" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
                            <ArrowLeft size={13} /> Landscape
                        </Link>
                    </div>
                </div>
            </header>

            {/* ── Content ── */}
            <div className="flex-1 min-h-0 overflow-auto px-6 py-4 flex flex-col gap-6">
                <DecisionsSection items={decisions} people={people} onResolved={load} />
                <AgentProposedControlsSection items={agentProposedControls} />
                <FindingsSection items={findings} />
                <RisksSection items={risks} />
                <RcasSection items={rcas} />
                <PeopleSection items={people} />
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
