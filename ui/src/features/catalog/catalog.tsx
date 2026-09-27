'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, BookOpen, History, ShieldAlert, Plus } from 'lucide-react';
import { catalog } from '@/lib/api';
import { PropRow } from '@/features/landscape/landscape';
import { formatValue } from '@/features/validation/display';
import { PageHeader } from '@/components/page-header';

type View = 'regulations' | 'obligations';

// ── Regulations view ────────────────────────────────────────────────────────

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

function FacetGroup({ title, options, selected, onToggle }: {
    title: string;
    options: { value: string; label: string; count: number }[];
    selected: Set<string>;
    onToggle: (value: string) => void;
}) {
    if (!options.length) return null;
    return (
        <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">{title}</p>
            {options.map(o => (
                <label key={o.value} className="flex items-center gap-2 text-xs text-zinc-400">
                    <input type="checkbox" checked={selected.has(o.value)} onChange={() => onToggle(o.value)} />
                    <span className="flex-1 truncate">{o.label}</span>
                    <span className="text-zinc-600">{o.count}</span>
                </label>
            ))}
        </div>
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

function ChainRow({ row, complianceAreaName }: { row: any; complianceAreaName: string }) {
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
            <PropRow label="mechanism" value={row.control?.controlType} />
            <PropRow label="docType" value={row.control?.docType} />
            <PropRow label="complianceArea" value={complianceAreaName} />
        </div>
    );
}

// ── Obligations view ─────────────────────────────────────────────────────────

function ObligationRow({ obligation }: { obligation: any }) {
    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 flex flex-col gap-2">
            <p className="text-[11px] font-mono text-zinc-500">{obligation.id}</p>
            <p className="text-sm text-zinc-200">{obligation.name}</p>
            <PropRow label="type" value={obligation.obligationType} />
            <PropRow label="mandatory" value={obligation.mandatory} />
            <PropRow label="clause" value={obligation.clauseId} />
            <PropRow label="source" value={obligation.sourceAnchor} />
        </div>
    );
}

// ── Propose Obligation form ──────────────────────────────────────────────────

function ProposeObligationForm({ clauses, onProposed }: { clauses: any[]; onProposed: () => void }) {
    const [open, setOpen] = useState(false);
    const [clauseId, setClauseId] = useState('');
    const [name, setName] = useState('');
    const [obligationType, setObligationType] = useState('');
    const [mandatory, setMandatory] = useState<'Y' | 'N'>('N');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = () => {
        setSubmitting(true);
        setError(null);
        catalog.proposeObligation({
            proposedBy: 'UNKNOWN',
            clauseId,
            proposedName: name,
            proposedObligationType: obligationType || undefined,
            proposedMandatory: mandatory,
        })
            .then(() => {
                setOpen(false);
                setClauseId('');
                setName('');
                setObligationType('');
                setMandatory('N');
                onProposed();
            })
            .catch((err: any) => setError(err.message))
            .finally(() => setSubmitting(false));
    };

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-colors"
            >
                <Plus size={13} /> Propose obligation (manual entry)
            </button>
        );
    }

    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 flex flex-col gap-3">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Propose Obligation — Manual Entry</p>
            <select value={clauseId} onChange={e => setClauseId(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200">
                <option value="">select clause…</option>
                {clauses.map(c => <option key={c.id} value={c.id}>{c.id} — {c.name}</option>)}
            </select>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="obligation description" className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200" />
            <input value={obligationType} onChange={e => setObligationType(e.target.value)} placeholder="obligation type" className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200" />
            <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input type="checkbox" checked={mandatory === 'Y'} onChange={e => setMandatory(e.target.checked ? 'Y' : 'N')} />
                mandatory
            </label>
            {error && <p className="text-[11px] text-red-400">{error}</p>}
            <div className="flex gap-2">
                <button onClick={submit} disabled={submitting || !clauseId || !name} className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-zinc-950 disabled:opacity-40">
                    {submitting ? 'Submitting…' : 'Submit for approval'}
                </button>
                <button onClick={() => setOpen(false)} className="text-xs px-3 py-1.5 rounded border border-zinc-800 text-zinc-400">Cancel</button>
            </div>
            <p className="text-[10px] text-zinc-600">Lands as a pending Decision — approve it from the Intelligence decision queue.</p>
        </div>
    );
}

// ── Root view ─────────────────────────────────────────────────────────────────

export function CatalogView() {
    const [view, setView] = useState<View>('regulations');

    const [regulations, setRegulations] = useState<any[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [chain, setChain] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [authorities, setAuthorities] = useState<any[]>([]);
    const [complianceAreas, setComplianceAreas] = useState<any[]>([]);
    const [clauses, setClauses] = useState<any[]>([]);

    const [obligations, setObligations] = useState<any[]>([]);
    const [uncontrolledOnly, setUncontrolledOnly] = useState(false);
    const [mandatoryOnly, setMandatoryOnly] = useState(false);
    const [currentOnly, setCurrentOnly] = useState(false);
    const [authorityFilter, setAuthorityFilter] = useState<Set<string>>(new Set());
    const [yearFilter, setYearFilter] = useState<Set<string>>(new Set());

    const [lastSyncedAt, setLastSyncedAt] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        Promise.all([
            catalog.regulations(currentOnly),
            catalog.syncStatus(),
            catalog.authorities(),
            catalog.complianceAreas(),
            catalog.clauses(),
            uncontrolledOnly ? catalog.uncontrolledObligations() : catalog.obligations(),
        ])
            .then(([r, s, auth, ca, cls, obl]) => {
                const regs = r.regulations ?? [];
                setRegulations(regs);
                setLastSyncedAt(s.lastSyncedAt);
                setAuthorities(auth.authorities ?? []);
                setComplianceAreas(ca.complianceAreas ?? []);
                setClauses(cls.clauses ?? []);
                setObligations(obl.obligations ?? []);
                if (regs.length && !selectedId) setSelectedId(regs[0].id);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, [currentOnly, uncontrolledOnly]);

    useEffect(() => {
        if (!selectedId) return;
        Promise.all([catalog.trace(selectedId), catalog.regulationHistory(selectedId)])
            .then(([t, h]) => {
                setChain(t.chain ?? []);
                setHistory(h.history ?? []);
            })
            .catch(() => { setChain([]); setHistory([]); });
    }, [selectedId]);

    const authorityName = useMemo(() => {
        const byId = new Map(authorities.map((a: any) => [a.id, a.name]));
        return (id: string) => byId.get(id) ?? id ?? 'UNKNOWN';
    }, [authorities]);

    const complianceAreaName = useMemo(() => {
        const byId = new Map(complianceAreas.map((c: any) => [c.id, c.name]));
        return (id: string) => byId.get(id) ?? id ?? 'UNKNOWN';
    }, [complianceAreas]);

    const visibleObligations = mandatoryOnly ? obligations.filter(o => o.mandatory === 'Y' || o.mandatory === true) : obligations;

    const yearOf = (r: any): string => (r.effectiveFrom || '').slice(0, 4);

    const toggleInSet = (set: Set<string>, setSet: (s: Set<string>) => void, value: string) => {
        const next = new Set(set);
        next.has(value) ? next.delete(value) : next.add(value);
        setSet(next);
    };

    const authorityOptions = useMemo(() => {
        const counts = new Map<string, number>();
        regulations.forEach((r: any) => { if (r.authorityId) counts.set(r.authorityId, (counts.get(r.authorityId) ?? 0) + 1); });
        return Array.from(counts.entries())
            .map(([id, count]) => ({ value: id, label: authorityName(id), count }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [regulations, authorityName]);

    const yearOptions = useMemo(() => {
        const counts = new Map<string, number>();
        regulations.forEach((r: any) => { const y = yearOf(r); if (y) counts.set(y, (counts.get(y) ?? 0) + 1); });
        return Array.from(counts.entries())
            .map(([year, count]) => ({ value: year, label: year, count }))
            .sort((a, b) => b.value.localeCompare(a.value));
    }, [regulations]);

    const visibleRegulations = regulations.filter((r: any) =>
        (authorityFilter.size === 0 || authorityFilter.has(r.authorityId)) &&
        (yearFilter.size === 0 || yearFilter.has(yearOf(r)))
    );

    if (loading) {
        return (
            <div className="h-full bg-zinc-950 flex items-center justify-center">
                <div className="flex items-center gap-3 text-zinc-500">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-sm">Loading catalog…</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full bg-zinc-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <span className="text-sm text-zinc-500">Could not load the catalog</span>
                    <button onClick={load} className="text-xs text-zinc-400 underline">Retry</button>
                </div>
            </div>
        );
    }

    const selected = regulations.find(r => r.id === selectedId);

    return (
        <div className="h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">

            <PageHeader icon={BookOpen} iconClassName="text-emerald-400" title="Catalog" subtitle="Regulation → Clause → Obligation → Control">
                <div className="flex items-center gap-1 rounded-md border border-zinc-800 p-0.5">
                    {(['regulations', 'obligations'] as View[]).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`px-2.5 py-1 rounded text-[11px] capitalize transition-colors ${view === v ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            {v}
                        </button>
                    ))}
                </div>
                <span className="text-[10px] text-zinc-600">
                    last synced: {lastSyncedAt ? formatValue(lastSyncedAt) : 'never'}
                </span>
                <button onClick={load} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Refresh">
                    <RefreshCw size={14} className="text-zinc-500" />
                </button>
            </PageHeader>

            <div className="flex-1 min-h-0 overflow-hidden flex">
                {/* ── Facet rail ── */}
                <aside className="w-56 shrink-0 border-r border-zinc-800/60 overflow-auto px-4 py-4 flex flex-col gap-4">
                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Facets</p>
                    {view === 'regulations' ? (
                        <>
                            <label className="flex items-center gap-2 text-xs text-zinc-400">
                                <input type="checkbox" checked={currentOnly} onChange={e => setCurrentOnly(e.target.checked)} />
                                current versions only
                            </label>
                            <FacetGroup
                                title="Authority"
                                options={authorityOptions}
                                selected={authorityFilter}
                                onToggle={v => toggleInSet(authorityFilter, setAuthorityFilter, v)}
                            />
                            <FacetGroup
                                title="Effective Year"
                                options={yearOptions}
                                selected={yearFilter}
                                onToggle={v => toggleInSet(yearFilter, setYearFilter, v)}
                            />
                        </>
                    ) : (
                        <>
                            <label className="flex items-center gap-2 text-xs text-zinc-400">
                                <input type="checkbox" checked={mandatoryOnly} onChange={e => setMandatoryOnly(e.target.checked)} />
                                mandatory only
                            </label>
                            <label className="flex items-center gap-2 text-xs text-zinc-400">
                                <ShieldAlert size={12} className="text-amber-500" />
                                <input type="checkbox" checked={uncontrolledOnly} onChange={e => setUncontrolledOnly(e.target.checked)} />
                                uncontrolled only
                            </label>
                        </>
                    )}
                </aside>

                {view === 'regulations' ? (
                    <>
                        <aside className="w-80 shrink-0 border-r border-zinc-800/60 overflow-auto px-4 py-4 flex flex-col gap-2">
                            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1">
                                Regulations · {visibleRegulations.length}
                            </p>
                            {visibleRegulations.map(r => (
                                <RegulationListItem key={r.id} regulation={r} selected={r.id === selectedId} onSelect={() => setSelectedId(r.id)} />
                            ))}
                        </aside>

                        <div className="flex-1 min-w-0 overflow-auto px-6 py-4 flex flex-col gap-3">
                            {selected && (
                                <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
                                    <p className="text-[11px] font-mono text-zinc-500">{selected.id}</p>
                                    <p className="text-sm text-zinc-200 font-medium mb-1">{selected.name}</p>
                                    <PropRow label="authority" value={authorityName(selected.authorityId)} />
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
                                {chain.map((row, i) => (
                                    <ChainRow key={i} row={row} complianceAreaName={complianceAreaName(row.control?.complianceAreaId)} />
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 min-w-0 overflow-auto px-6 py-4 flex flex-col gap-3">
                        <ProposeObligationForm clauses={clauses} onProposed={load} />
                        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mt-1">
                            Obligations · {visibleObligations.length}
                        </p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {visibleObligations.map(o => <ObligationRow key={o.id} obligation={o} />)}
                        </div>
                    </div>
                )}
            </div>

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
