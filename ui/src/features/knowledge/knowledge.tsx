'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, BookOpen, ArrowLeft, History } from 'lucide-react';
import { knowledge } from '@/lib/api';
import { PropRow } from '@/features/landscape/landscape';
import { formatValue } from '@/features/validation/display';

function RegulationListItem({ regulation, selected, onSelect }: { regulation: any; selected: boolean; onSelect: () => void }) {
    return (
        <button
            onClick={onSelect}
            className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                selected ? 'border-emerald-600 bg-zinc-900' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
            }`}
        >
            <p className="text-[11px] font-mono text-zinc-500">{regulation.id}</p>
            <p className="text-sm text-zinc-200 leading-snug">{regulation.name}</p>
            {regulation.supersededBy && (
                <p className="text-[10px] text-amber-500 mt-1">superseded by {regulation.supersededBy}</p>
            )}
        </button>
    );
}

function VersionHistoryStrip({ history }: { history: any[] }) {
    if (history.length < 2) return null;
    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
                <History size={12} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Version History</p>
            </div>
            <div className="flex flex-col gap-2">
                {history.map(v => (
                    <div key={v.id} className="flex items-center gap-3 text-xs">
                        <span className="font-mono text-zinc-500">{v.id}</span>
                        <span className="text-zinc-300">v{v.catalogVersion}</span>
                        <span className="text-zinc-500">effective {formatValue(v.effectiveFrom)}</span>
                        {v.supersededBy && <span className="text-amber-500">→ superseded by {v.supersededBy}</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}

function ChainRow({ row }: { row: any }) {
    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 flex flex-col gap-2">
            <div>
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1">Clause {row.clause?.clauseRef}</p>
                <p className="text-sm text-zinc-200">{row.clause?.name}</p>
                <p className="text-xs text-zinc-500 mt-1">
                    Source: {row.clause?.sourceDocumentId || 'UNKNOWN'} — {row.clause?.sourceAnchor || 'UNKNOWN'}
                </p>
            </div>
            <PropRow label="obligation" value={row.obligation?.name} />
            <PropRow label="mandatory" value={row.obligation?.mandatory} />
            <PropRow label="control" value={row.control?.name} />
            <PropRow label="docType" value={row.control?.docType} />
        </div>
    );
}

export function KnowledgeView() {
    const [regulations, setRegulations] = useState<any[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [chain, setChain] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [lastSyncedAt, setLastSyncedAt] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        Promise.all([knowledge.regulations(), knowledge.syncStatus()])
            .then(([r, s]) => {
                const regs = r.regulations ?? [];
                setRegulations(regs);
                setLastSyncedAt(s.lastSyncedAt);
                if (regs.length && !selectedId) setSelectedId(regs[0].id);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    useEffect(() => {
        if (!selectedId) return;
        Promise.all([knowledge.traceForward(selectedId), knowledge.regulationHistory(selectedId)])
            .then(([t, h]) => {
                setChain(t.chain ?? []);
                setHistory(h.history ?? []);
            })
            .catch(() => { setChain([]); setHistory([]); });
    }, [selectedId]);

    if (loading) {
        return (
            <div className="h-screen bg-zinc-950 flex items-center justify-center">
                <div className="flex items-center gap-3 text-zinc-500">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-sm">Loading knowledge graph…</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen bg-zinc-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <span className="text-sm text-zinc-500">Could not load the knowledge graph</span>
                    <button onClick={load} className="text-xs text-zinc-400 underline">Retry</button>
                </div>
            </div>
        );
    }

    const selected = regulations.find(r => r.id === selectedId);

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">

            {/* ── Header ── */}
            <header className="border-b border-zinc-800/60 shrink-0">
                <div className="flex items-center justify-between px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
                            <BookOpen size={18} className="text-zinc-950" />
                        </div>
                        <div>
                            <p className="text-base font-semibold leading-tight">VYRA</p>
                            <p className="text-xs text-zinc-500 leading-tight">
                                Knowledge — Regulation → Clause → Obligation → Control
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-5">
                        <span className="text-[10px] text-zinc-600">
                            last synced: {lastSyncedAt ? formatValue(lastSyncedAt) : 'never'}
                        </span>
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
            <div className="flex-1 min-h-0 overflow-hidden flex">
                <aside className="w-80 shrink-0 border-r border-zinc-800/60 overflow-auto px-4 py-4 flex flex-col gap-2">
                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1">
                        Regulations · {regulations.length}
                    </p>
                    {regulations.map(r => (
                        <RegulationListItem key={r.id} regulation={r} selected={r.id === selectedId} onSelect={() => setSelectedId(r.id)} />
                    ))}
                </aside>

                <div className="flex-1 min-w-0 overflow-auto px-6 py-4 flex flex-col gap-3">
                    {selected && (
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
                            <p className="text-[11px] font-mono text-zinc-500">{selected.id}</p>
                            <p className="text-sm text-zinc-200 font-medium mb-1">{selected.name}</p>
                            <PropRow label="catalogVersion" value={selected.catalogVersion} />
                            <PropRow label="effectiveFrom" value={selected.effectiveFrom} />
                            <PropRow label="supersededBy" value={selected.supersededBy} />
                        </div>
                    )}

                    <VersionHistoryStrip history={history} />

                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mt-1">
                        Clause → Obligation → Control chain · {chain.length}
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {chain.map((row, i) => <ChainRow key={i} row={row} />)}
                    </div>
                </div>
            </div>

            {/* ── Footer ── */}
            <footer className="border-t border-zinc-800/60 px-6 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-emerald-500 flex items-center justify-center">
                        <BookOpen size={9} className="text-zinc-950" />
                    </div>
                    <span className="text-[10px] text-zinc-600">Vyra Platform v1</span>
                </div>
                <p className="text-[10px] text-zinc-700">Compliance. Handled.</p>
            </footer>
        </div>
    );
}
