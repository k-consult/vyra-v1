'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, BookOpen, History, ShieldAlert, Plus, Share2, CalendarDays, Inbox } from 'lucide-react';
import { catalog } from '@/lib/api';
import { PropRow } from '@/features/landscape/landscape';
import { formatValue } from '@/features/validation/display';
import { PageHeader } from '@/components/page-header';
import { CalendarView } from '@/features/calendar/calendar';

type View = 'regulations' | 'obligations' | 'graph' | 'calendar';

function EmptyState({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-zinc-600">
            <Inbox size={20} />
            <p className="text-xs">{label}</p>
        </div>
    );
}

// Backs the catalog_search full-text index (cli/projection/index.ts) — the same
// `tags` array Neo4j indexes is what's rendered here, nothing re-derived.
function TagPills({ tags }: { tags?: string[] }) {
    if (!tags?.length) return null;
    // Dedupe — the same tag value can legitimately appear twice in the source data
    // (e.g. a Report's board tag and its authority abbreviation both being "CPCB"),
    // and a raw-value key broke React's uniqueness requirement for duplicates.
    const unique = Array.from(new Set(tags));
    return (
        <div className="flex flex-wrap gap-1 mt-1.5">
            {unique.map(t => (
                <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
                    {t}
                </span>
            ))}
        </div>
    );
}

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
            <TagPills tags={regulation.tags} />
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

function ChainRow({ row, complianceAreaName, reportAuthorityName }: { row: any; complianceAreaName: string; reportAuthorityName: string }) {
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
            <TagPills tags={row.obligation?.tags} />
            {row.control ? (
                <>
                    <PropRow label="control" value={row.control?.name} />
                    <PropRow label="mechanism" value={row.control?.controlType} />
                    <PropRow label="docType" value={row.control?.docType} />
                    <PropRow label="complianceArea" value={complianceAreaName} />
                </>
            ) : (
                <p className="text-[11px] text-amber-500">no implementing control — documented gap, not a silent omission</p>
            )}
            {row.report ? (
                <div className="mt-1 pt-2 border-t border-zinc-800/60 flex flex-col gap-1">
                    <p className="text-[10px] font-semibold text-sky-500/80 uppercase tracking-wider">Requires filing</p>
                    <PropRow label="report" value={row.report?.name} />
                    <PropRow label="cadence" value={row.report?.cadenceRaw} />
                    {row.report?.triggerCondition && <PropRow label="trigger" value={row.report?.triggerCondition} />}
                    <PropRow label="filed with" value={reportAuthorityName} />
                    <TagPills tags={row.report?.tags} />
                </div>
            ) : (
                <p className="text-[11px] text-zinc-600">no distinct external filing — internal record only</p>
            )}
        </div>
    );
}

// ── Graph view ───────────────────────────────────────────────────────────────
// Real data only — the selected regulation's own chain (same `chain` the card
// grid renders), laid out as four columns (Regulation / Clause / Obligation /
// Control) rather than a full-catalog force-directed mindmap. A ~90-node
// whole-catalog graph with pan/zoom is a real, separate feature (interactive
// canvas, hit-testing, layout engine) — scoping to one regulation's fan-out
// ships something complete and correct now instead of something half-built.

const GRAPH_COLORS: Record<string, string> = {
    regulation: '#38bdf8',
    clause: '#a78bfa',
    obligation: '#34d399',
    control: '#fbbf24',
};

function GraphView({ regulation, chain }: { regulation: any; chain: any[] }) {
    if (!regulation || !chain.length) {
        return <EmptyState label="Select a regulation with a chain to visualize." />;
    }

    const clauses = Array.from(new Map<string, any>(chain.filter(r => r.clause?.id).map(r => [r.clause.id, r.clause])).values());
    const obligations = Array.from(new Map<string, any>(chain.filter(r => r.obligation?.id).map(r => [r.obligation.id, r.obligation])).values());
    const controls = Array.from(new Map<string, any>(chain.filter(r => r.control?.id).map(r => [r.control.id, r.control])).values());

    const colW = 230;
    const rowH = 34;
    const colX = { regulation: 20, clause: 20 + colW, obligation: 20 + colW * 2, control: 20 + colW * 3 };
    const maxRows = Math.max(1, clauses.length, obligations.length, controls.length);
    const height = Math.max(200, maxRows * rowH + 40);

    const yFor = (i: number, count: number) => (height / (count + 1)) * (i + 1);

    const regPos = { x: colX.regulation + 90, y: height / 2 };
    const clausePos = new Map(clauses.map((c: any, i) => [c.id, { x: colX.clause + 90, y: yFor(i, clauses.length) }]));
    const oblPos = new Map(obligations.map((o: any, i) => [o.id, { x: colX.obligation + 90, y: yFor(i, obligations.length) }]));
    const ctlPos = new Map(controls.map((c: any, i) => [c.id, { x: colX.control + 90, y: yFor(i, controls.length) }]));

    const edges: { from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
    chain.forEach(row => {
        const cp = row.clause && clausePos.get(row.clause.id);
        const op = row.obligation && oblPos.get(row.obligation.id);
        const ctp = row.control && ctlPos.get(row.control.id);
        if (cp) edges.push({ from: regPos, to: cp });
        if (cp && op) edges.push({ from: cp, to: op });
        if (op && ctp) edges.push({ from: op, to: ctp });
    });

    return (
        <div className="flex-1 min-w-0 overflow-auto px-6 py-4">
            <div className="flex items-center gap-4 mb-3">
                {(['Regulation', 'Clause', 'Obligation', 'Control'] as const).map(label => (
                    <div key={label} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                        <span className="w-2 h-2 rounded-full" style={{ background: GRAPH_COLORS[label.toLowerCase()] }} />
                        {label}
                    </div>
                ))}
            </div>
            <svg width="100%" height={height} viewBox={`0 0 ${colX.control + colW} ${height}`} preserveAspectRatio="xMinYMin meet">
                {edges.map((e, i) => (
                    <line key={i} x1={e.from.x} y1={e.from.y} x2={e.to.x} y2={e.to.y} stroke="#3f3f46" strokeWidth={1} />
                ))}
                <circle cx={regPos.x} cy={regPos.y} r={7} fill={GRAPH_COLORS.regulation} />
                <text x={regPos.x} y={regPos.y - 12} textAnchor="middle" fontSize="10" fill="#e4e4e7">{regulation.id}</text>
                <title>{regulation.name}</title>

                {clauses.map((c: any) => {
                    const p = clausePos.get(c.id)!;
                    return (
                        <g key={c.id}>
                            <circle cx={p.x} cy={p.y} r={6} fill={GRAPH_COLORS.clause} />
                            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="9" fill="#d4d4d8">{c.clauseRef?.slice(0, 24) ?? c.id}</text>
                            <title>{c.name}</title>
                        </g>
                    );
                })}

                {obligations.map((o: any) => {
                    const p = oblPos.get(o.id)!;
                    return (
                        <g key={o.id}>
                            <circle cx={p.x} cy={p.y} r={6} fill={GRAPH_COLORS.obligation} />
                            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="9" fill="#d4d4d8">{o.id}</text>
                            <title>{o.name}</title>
                        </g>
                    );
                })}

                {controls.map((c: any) => {
                    const p = ctlPos.get(c.id)!;
                    return (
                        <g key={c.id}>
                            <circle cx={p.x} cy={p.y} r={6} fill={GRAPH_COLORS.control} />
                            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="9" fill="#d4d4d8">{c.id}</text>
                            <title>{c.name}</title>
                        </g>
                    );
                })}
            </svg>
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
            <TagPills tags={obligation.tags} />
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
    const [jurisdictions, setJurisdictions] = useState<any[]>([]);
    const [complianceAreas, setComplianceAreas] = useState<any[]>([]);
    const [clauses, setClauses] = useState<any[]>([]);
    const [controls, setControls] = useState<any[]>([]);

    const [obligations, setObligations] = useState<any[]>([]);
    const [uncontrolledOnly, setUncontrolledOnly] = useState(false);
    const [mandatoryOnly, setMandatoryOnly] = useState(false);
    const [currentOnly, setCurrentOnly] = useState(false);
    const [authorityFilter, setAuthorityFilter] = useState<Set<string>>(new Set());
    const [jurisdictionFilter, setJurisdictionFilter] = useState<Set<string>>(new Set());
    const [mechanismFilter, setMechanismFilter] = useState<Set<string>>(new Set());
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
            catalog.jurisdictions(),
            catalog.complianceAreas(),
            catalog.clauses(),
            catalog.controls(),
            uncontrolledOnly ? catalog.uncontrolledObligations() : catalog.obligations(),
        ])
            .then(([r, s, auth, jur, ca, cls, ctl, obl]) => {
                const regs = r.regulations ?? [];
                setRegulations(regs);
                setLastSyncedAt(s.lastSyncedAt);
                setAuthorities(auth.authorities ?? []);
                setJurisdictions(jur.jurisdictions ?? []);
                setComplianceAreas(ca.complianceAreas ?? []);
                setClauses(cls.clauses ?? []);
                setControls(ctl.controls ?? []);
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

    const jurisdictionName = useMemo(() => {
        const byId = new Map(jurisdictions.map((j: any) => [j.id, j.name]));
        return (id: string) => byId.get(id) ?? id ?? 'UNKNOWN';
    }, [jurisdictions]);

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

    const jurisdictionOptions = useMemo(() => {
        const counts = new Map<string, number>();
        regulations.forEach((r: any) => { if (r.jurisdictionId) counts.set(r.jurisdictionId, (counts.get(r.jurisdictionId) ?? 0) + 1); });
        return Array.from(counts.entries())
            .map(([id, count]) => ({ value: id, label: jurisdictionName(id), count }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [regulations, jurisdictionName]);

    const yearOptions = useMemo(() => {
        const counts = new Map<string, number>();
        regulations.forEach((r: any) => { const y = yearOf(r); if (y) counts.set(y, (counts.get(y) ?? 0) + 1); });
        return Array.from(counts.entries())
            .map(([year, count]) => ({ value: year, label: year, count }))
            .sort((a, b) => b.value.localeCompare(a.value));
    }, [regulations]);

    // Which control mechanisms (Preventive/Detective/Corrective) a Regulation has,
    // via its Obligations' Controls — reached through Control.regulationId, the
    // same flat reference catalog/cpcb/controls.csv already carries.
    const mechanismsByRegulation = useMemo(() => {
        const byReg = new Map<string, Set<string>>();
        controls.forEach((c: any) => {
            if (!c.regulationId || !c.controlType) return;
            if (!byReg.has(c.regulationId)) byReg.set(c.regulationId, new Set());
            byReg.get(c.regulationId)!.add(c.controlType);
        });
        return byReg;
    }, [controls]);

    const mechanismOptions = useMemo(() => {
        const counts = new Map<string, number>();
        regulations.forEach((r: any) => {
            (mechanismsByRegulation.get(r.id) ?? new Set()).forEach((m: string) => counts.set(m, (counts.get(m) ?? 0) + 1));
        });
        return Array.from(counts.entries())
            .map(([value, count]) => ({ value, label: value, count }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [regulations, mechanismsByRegulation]);

    const visibleRegulations = regulations.filter((r: any) =>
        (authorityFilter.size === 0 || authorityFilter.has(r.authorityId)) &&
        (jurisdictionFilter.size === 0 || jurisdictionFilter.has(r.jurisdictionId)) &&
        (yearFilter.size === 0 || yearFilter.has(yearOf(r))) &&
        (mechanismFilter.size === 0 || Array.from(mechanismsByRegulation.get(r.id) ?? []).some(m => mechanismFilter.has(m)))
    );

    // Same facet set drives the Calendar — narrow its tasks to the controls
    // belonging to whichever regulations survive the facet filters above.
    const visibleControlIds = useMemo(() => {
        const regIds = new Set(visibleRegulations.map((r: any) => r.id));
        return new Set(controls.filter((c: any) => regIds.has(c.regulationId)).map((c: any) => c.id));
    }, [controls, visibleRegulations]);

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
                    {(['regulations', 'obligations', 'graph', 'calendar'] as View[]).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] capitalize transition-colors ${view === v ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            {v === 'graph' && <Share2 size={11} />}
                            {v === 'calendar' && <CalendarDays size={11} />}
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
                {/* ── Facet rail — same Jurisdiction/Authority/Year/Mechanism facets
                     drive Regulations, Graph, and Calendar; Obligations gets its own
                     mandatory/uncontrolled facet set ── */}
                <aside className="w-56 shrink-0 border-r border-zinc-800/60 overflow-auto px-4 py-4 flex flex-col gap-4">
                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Facets</p>
                    {view === 'regulations' || view === 'graph' || view === 'calendar' ? (
                        <>
                            <label className="flex items-center gap-2 text-xs text-zinc-400">
                                <input type="checkbox" checked={currentOnly} onChange={e => setCurrentOnly(e.target.checked)} />
                                current versions only
                            </label>
                            <FacetGroup
                                title="Jurisdiction"
                                options={jurisdictionOptions}
                                selected={jurisdictionFilter}
                                onToggle={v => toggleInSet(jurisdictionFilter, setJurisdictionFilter, v)}
                            />
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
                            <FacetGroup
                                title="Control Mechanism"
                                options={mechanismOptions}
                                selected={mechanismFilter}
                                onToggle={v => toggleInSet(mechanismFilter, setMechanismFilter, v)}
                            />
                        </>
                    ) : (
                        <>
                            <label className="flex items-center gap-2 text-xs text-zinc-400">
                                <input type="checkbox" checked={mandatoryOnly} onChange={e => setMandatoryOnly(e.target.checked)} />
                                mandatory only
                            </label>
                            <label className="flex items-center gap-2 text-xs text-zinc-400">
                                {uncontrolledOnly && <ShieldAlert size={12} className="text-amber-500 shrink-0" />}
                                <input type="checkbox" checked={uncontrolledOnly} onChange={e => setUncontrolledOnly(e.target.checked)} />
                                uncontrolled only
                            </label>
                        </>
                    )}
                </aside>

                {view === 'calendar' ? (
                    <CalendarView embedded controlIds={visibleControlIds} />
                ) : view === 'regulations' || view === 'graph' ? (
                    <>
                        <aside className="w-80 shrink-0 border-r border-zinc-800/60 overflow-auto px-4 py-4 flex flex-col gap-2">
                            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1">
                                Regulations · {visibleRegulations.length}
                            </p>
                            {visibleRegulations.length === 0 ? (
                                <EmptyState label="No regulations match the selected facets." />
                            ) : (
                                visibleRegulations.map(r => (
                                    <RegulationListItem key={r.id} regulation={r} selected={r.id === selectedId} onSelect={() => setSelectedId(r.id)} />
                                ))
                            )}
                        </aside>

                        {view === 'graph' ? (
                            <GraphView regulation={selected} chain={chain} />
                        ) : (
                            <div className="flex-1 min-w-0 overflow-auto px-6 py-4 flex flex-col gap-3">
                                {selected && (
                                    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
                                        <p className="text-[11px] font-mono text-zinc-500">{selected.id}</p>
                                        <p className="text-sm text-zinc-200 font-medium mb-1">{selected.name}</p>
                                        <PropRow label="jurisdiction" value={jurisdictionName(selected.jurisdictionId)} />
                                        <PropRow label="authority" value={authorityName(selected.authorityId)} />
                                        <PropRow label="catalogVersion" value={selected.catalogVersion} />
                                        <PropRow label="effectiveFrom" value={selected.effectiveFrom} />
                                        <PropRow label="supersededBy" value={selected.supersededBy} />
                                        <TagPills tags={selected.tags} />
                                    </div>
                                )}

                                <VersionHistoryStrip history={history} />

                                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mt-1">
                                    Clause → Obligation → Control chain · {chain.length}
                                </p>
                                {chain.length === 0 ? (
                                    <EmptyState label="This regulation has no chained clauses yet." />
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                        {chain.map((row, i) => (
                                            <ChainRow
                                                key={i}
                                                row={row}
                                                complianceAreaName={complianceAreaName(row.control?.complianceAreaId)}
                                                reportAuthorityName={authorityName(row.report?.authorityId)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex-1 min-w-0 overflow-auto px-6 py-4 flex flex-col gap-3">
                        <ProposeObligationForm clauses={clauses} onProposed={load} />
                        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mt-1">
                            Obligations · {visibleObligations.length}
                        </p>
                        {visibleObligations.length === 0 ? (
                            <EmptyState label={uncontrolledOnly ? 'No uncontrolled obligations — every obligation here has an implementing control.' : 'No obligations match the selected facets.'} />
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {visibleObligations.map(o => <ObligationRow key={o.id} obligation={o} />)}
                            </div>
                        )}
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
