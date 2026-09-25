'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Eye, Search, ChevronDown, ChevronUp, GitBranch } from 'lucide-react';
import { intelligence } from '@/lib/api';
import { Badge } from '@/features/landscape/landscape';
import { PageHeader } from '@/components/page-header';

// ── Deviation Alerts (with inline Root Cause Analysis) ──────────────────────────
// Relocated from intelligence.tsx's Findings tab — same data/RCA-expand behavior,
// persona-framed under Ops Supervisor (L5) rather than buried in the Decision Gate.

function DeviationAlertsPanel({ items, rcas }: { items: any[]; rcas: any[] }) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const rcaByFinding = useMemo(() => new Map(rcas.map(r => [r.findingId, r])), [rcas]);

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <Search size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Deviation Alerts</p>
                <p className="text-[10px] text-zinc-700">· click a row with a root cause to expand it</p>
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
                            <th className="text-left font-medium px-4 py-2">RCA</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((f, i) => {
                            const rca = rcaByFinding.get(f.id);
                            const expanded = expandedId === f.id;
                            return (
                                <Fragment key={f?.id ?? i}>
                                    <tr
                                        onClick={() => rca && setExpandedId(expanded ? null : f.id)}
                                        className={`${i % 2 === 0 ? 'bg-zinc-950' : 'bg-zinc-900/20'} ${rca ? 'cursor-pointer hover:bg-zinc-800/40' : ''}`}
                                    >
                                        <td className="px-4 py-1.5 font-mono text-zinc-500">{f.id}</td>
                                        <td className="px-4 py-1.5 text-zinc-300">{f.name}</td>
                                        <td className="px-4 py-1.5">{f.severity && <Badge value={f.severity} />}</td>
                                        <td className="px-4 py-1.5 text-zinc-400">{f.controlId ?? '—'}</td>
                                        <td className="px-4 py-1.5">{f.status && <Badge value={f.status} />}</td>
                                        <td className="px-4 py-1.5 text-zinc-500">
                                            {rca ? (expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : '—'}
                                        </td>
                                    </tr>
                                    {expanded && rca && (
                                        <tr className="bg-zinc-900/40">
                                            <td colSpan={6} className="px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                                                        Root Cause Analysis · {rca.id}
                                                    </p>
                                                    <p className="text-xs text-zinc-300">{rca.rootCause}</p>
                                                    <p className="text-[10px] text-zinc-600">analysed {rca.analysedAt} · status {rca.status}</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

// ── Escalation Paths (not yet built) ─────────────────────────────────────────────

function EscalationPathsStub() {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <GitBranch size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Escalation Paths</p>
            </div>
            <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-3">
                <p className="text-xs text-zinc-500">
                    Not yet surfaced — <code className="text-zinc-400">Incident -[:ESCALATES_TO]-&gt; Role</code> edges
                    exist in the graph, but no route reads them yet.
                </p>
            </div>
        </section>
    );
}

// ── Main view ──────────────────────────────────────────────────────────────────

export function OpsSupervisorView() {
    const [findings, setFindings] = useState<any[]>([]);
    const [rcas, setRcas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        Promise.all([intelligence.findings(), intelligence.rcas()])
            .then(([find, rca]: any[]) => {
                setFindings(find.findings ?? []);
                setRcas(rca.rcas ?? []);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    if (loading) {
        return (
            <div className="h-full bg-zinc-950 flex items-center justify-center">
                <div className="flex items-center gap-3 text-zinc-500">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-sm">Loading deviation alerts…</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full bg-zinc-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <span className="text-sm text-zinc-500">Could not load Ops Supervisor data</span>
                    <button onClick={load} className="text-xs text-zinc-400 underline">Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">

            <PageHeader icon={Eye} iconClassName="text-amber-400" title="Ops Supervisor" subtitle="Deviation Alerts & Escalation Paths">
                <button onClick={load} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Refresh">
                    <RefreshCw size={14} className="text-zinc-500" />
                </button>
            </PageHeader>

            {/* ── Content ── */}
            <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
                <div className="flex flex-col gap-6">
                    <DeviationAlertsPanel items={findings} rcas={rcas} />
                    <EscalationPathsStub />
                </div>
            </div>

            {/* ── Footer ── */}
            <footer className="border-t border-zinc-800/60 px-6 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-amber-500 flex items-center justify-center">
                        <Eye size={9} className="text-zinc-950" />
                    </div>
                    <span className="text-[10px] text-zinc-600">Vyra Platform v1</span>
                </div>
                <p className="text-[10px] text-zinc-700">Compliance. Handled.</p>
            </footer>
        </div>
    );
}
