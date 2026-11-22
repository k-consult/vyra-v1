'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, BookOpen, History, ShieldAlert, Plus, Share2, CalendarDays, Inbox } from 'lucide-react';
import { catalog, tenants } from '@/lib/api';
import { getActiveTenant } from '@/lib/active-tenant';
import { PropRow } from '@/features/landscape/landscape';
import { formatValue } from '@/features/validation/display';
import { PageHeader } from '@/components/page-header';
import { CalendarView } from '@/features/calendar/calendar';

type View = 'regulations' | 'obligations' | 'classifications' | 'graph' | 'calendar';

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
    // Same fixed-position, cursor-following tooltip idiom as calendar.tsx's hover
    // card — native `title` has a browser-imposed delay and is invisible to
    // automated/screenshot capture, neither of which this app relies on elsewhere.
    const [hover, setHover] = useState<{ label: string; x: number; y: number } | null>(null);

    if (!options.length) return null;
    return (
        <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">{title}</p>
            {options.map(o => (
                <label
                    key={o.value}
                    className="flex items-center gap-2 text-xs text-zinc-400"
                    onMouseMove={e => setHover({ label: o.label, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHover(null)}
                >
                    <input type="checkbox" checked={selected.has(o.value)} onChange={() => onToggle(o.value)} />
                    <span className="flex-1 truncate">{o.label}</span>
                    <span className="text-zinc-600">{o.count}</span>
                </label>
            ))}
            {hover && (
                <div
                    className="fixed z-50 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 shadow-2xl pointer-events-none max-w-xs"
                    style={{ left: hover.x + 14, top: hover.y + 14 }}
                >
                    <p className="text-[11px] text-zinc-200">{hover.label}</p>
                </div>
            )}
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
            {row.subjectType && <PropRow label="binds to" value={row.subjectType.name} />}
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
    subjecttype: '#fb7185',
};

function GraphView({ regulation, chain }: { regulation: any; chain: any[] }) {
    if (!regulation || !chain.length) {
        return <EmptyState label="Select a regulation with a chain to visualize." />;
    }

    const clauses = Array.from(new Map<string, any>(chain.filter(r => r.clause?.id).map(r => [r.clause.id, r.clause])).values());
    const obligations = Array.from(new Map<string, any>(chain.filter(r => r.obligation?.id).map(r => [r.obligation.id, r.obligation])).values());
    const controls = Array.from(new Map<string, any>(chain.filter(r => r.control?.id).map(r => [r.control.id, r.control])).values());
    const subjectTypes = Array.from(new Map<string, any>(chain.filter(r => r.subjectType?.id).map(r => [r.subjectType.id, r.subjectType])).values());

    const colW = 230;
    const rowH = 34;
    const colX = { regulation: 20, clause: 20 + colW, obligation: 20 + colW * 2, control: 20 + colW * 3, subjectType: 20 + colW * 4 };
    const maxRows = Math.max(1, clauses.length, obligations.length, controls.length, subjectTypes.length);
    const height = Math.max(200, maxRows * rowH + 40);

    const yFor = (i: number, count: number) => (height / (count + 1)) * (i + 1);

    const regPos = { x: colX.regulation + 90, y: height / 2 };
    const clausePos = new Map(clauses.map((c: any, i) => [c.id, { x: colX.clause + 90, y: yFor(i, clauses.length) }]));
    const oblPos = new Map(obligations.map((o: any, i) => [o.id, { x: colX.obligation + 90, y: yFor(i, obligations.length) }]));
    const ctlPos = new Map(controls.map((c: any, i) => [c.id, { x: colX.control + 90, y: yFor(i, controls.length) }]));
    const stPos = new Map(subjectTypes.map((s: any, i) => [s.id, { x: colX.subjectType + 90, y: yFor(i, subjectTypes.length) }]));

    const edges: { from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
    chain.forEach(row => {
        const cp = row.clause && clausePos.get(row.clause.id);
        const op = row.obligation && oblPos.get(row.obligation.id);
        const ctp = row.control && ctlPos.get(row.control.id);
        const stp = row.subjectType && stPos.get(row.subjectType.id);
        if (cp) edges.push({ from: regPos, to: cp });
        if (cp && op) edges.push({ from: cp, to: op });
        if (op && ctp) edges.push({ from: op, to: ctp });
        if (op && stp) edges.push({ from: op, to: stp });
    });

    return (
        <div className="flex-1 min-w-0 overflow-auto px-6 py-4">
            <div className="flex items-center gap-4 mb-3">
                {(['Regulation', 'Clause', 'Obligation', 'Control', 'SubjectType'] as const).map(label => (
                    <div key={label} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                        <span className="w-2 h-2 rounded-full" style={{ background: GRAPH_COLORS[label.toLowerCase()] }} />
                        {label === 'SubjectType' ? 'Binds To' : label}
                    </div>
                ))}
            </div>
            <svg width="100%" height={height} viewBox={`0 0 ${colX.subjectType + colW} ${height}`} preserveAspectRatio="xMinYMin meet">
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

                {subjectTypes.map((s: any) => {
                    const p = stPos.get(s.id)!;
                    return (
                        <g key={s.id}>
                            <circle cx={p.x} cy={p.y} r={6} fill={GRAPH_COLORS.subjecttype} />
                            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="9" fill="#d4d4d8">{s.name}</text>
                            <title>{`${s.name} (${s.bindsAt})`}</title>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

// ── Obligations view ─────────────────────────────────────────────────────────

function ObligationRow({ obligation, subjectTypeName }: { obligation: any; subjectTypeName: (id: string) => string }) {
    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 flex flex-col gap-2">
            <p className="text-[11px] font-mono text-zinc-500">{obligation.id}</p>
            <p className="text-sm text-zinc-200">{obligation.name}</p>
            <PropRow label="type" value={obligation.obligationType} />
            <PropRow label="mandatory" value={obligation.mandatory} />
            <PropRow label="clause" value={obligation.clauseId} />
            <PropRow label="source" value={obligation.sourceAnchor} />
            {obligation.subjectTypeId && <PropRow label="binds to" value={subjectTypeName(obligation.subjectTypeId)} />}
            <TagPills tags={obligation.tags} />
        </div>
    );
}

// ── Propose Obligation form ──────────────────────────────────────────────────

function ProposeObligationForm({ clauses, onProposed, reqOpts }: { clauses: any[]; onProposed: () => void; reqOpts: { central: boolean } }) {
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
        }, reqOpts)
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

// "General" (added 2026-11-22) names no tenant node type — unlike Site/Organisation/
// Asset, a General classification is never an OF_TYPE target; it's descriptive
// catalog vocabulary for concepts like Deep Burial Pit / Hazardous Waste Yard that
// are real regulated things but not literally a tenant's physical Asset/Facility/
// Organisation. It groups under the "Others" facet the same way Site/Organisation do
// (the facet filter is just "not Asset" — General needs no special-casing there).
const CLASSIFICATION_CATEGORIES = ['Site', 'Organisation', 'Asset', 'General'] as const;
type ClassificationCategory = typeof CLASSIFICATION_CATEGORIES[number];

// "Site" is the business-facing word for the graph's Facility bindsAt grain (matches
// ST-SITE's own name) — kept distinct from the internal tenant-node-label vocabulary
// so an admin never has to know what "Facility" means at the graph layer.
const CATEGORY_TO_BINDS_AT: Record<ClassificationCategory, string> = { Site: 'Facility', Organisation: 'Organisation', Asset: 'Asset', General: 'General' };
const BINDS_AT_TO_CATEGORY: Record<string, string> = { Facility: 'Site', Organisation: 'Organisation', Asset: 'Asset', General: 'General' };

// Shown under the Category select so an admin picking a category sees what it means,
// not just its name — only General needs this today (the other three are
// self-explanatory tenant-node grains).
const CATEGORY_DESCRIPTIONS: Partial<Record<ClassificationCategory, string>> = {
    General: 'Everything owned by a site/organisation — not a discrete physical asset.',
};

// Direct admin write, no Decision gate (subtype-registry-plan.md's scoped-down
// 2026-11-22 decision — a Vyra Central admin editing central reference data is the
// only actor here, so there's no second party for a propose/ratify step to check).
// Central-catalog-only (decision 1): api.ts's subjectType* client functions always
// force `central: true`. Facet-driven like Regulations/Obligations (2026-11-22
// restructure) — ASSETS/OTHERS live in the shared facet rail (CatalogView's
// <aside>), so `subjectTypes`/`facet` are props, not locally fetched state.
function ClassificationsPanel({ subjectTypes, facet, includeRetired, onIncludeRetiredChange, onChanged }: {
    subjectTypes: any[];
    facet: 'assets' | 'others';
    includeRetired: boolean;
    onIncludeRetiredChange: (v: boolean) => void;
    onChanged: () => void;
}) {
    const visible = useMemo(
        () => subjectTypes.filter((st: any) => (facet === 'assets' ? st.bindsAt === 'Asset' : st.bindsAt !== 'Asset')),
        [subjectTypes, facet]
    );

    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCategory, setNewCategory] = useState<ClassificationCategory>('Asset');
    const [newDescription, setNewDescription] = useState('');
    const [addError, setAddError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // id is never typed — ST-<NAME_UPPER_SNAKE>, auto-derived from Name, matching the
    // existing ST- id family (ST-SITE, ST-DG_SET, ...) rather than a new prefix.
    const newId = newName.trim() ? `ST-${newName.trim().toUpperCase().replace(/\s+/g, '_')}` : '';

    const submitAdd = () => {
        setSubmitting(true);
        setAddError(null);
        catalog.addSubjectType({ id: newId, name: newName.trim(), bindsAt: CATEGORY_TO_BINDS_AT[newCategory], description: newDescription || undefined })
            .then(() => {
                setAdding(false);
                setNewName(''); setNewCategory('Asset'); setNewDescription('');
                onChanged();
            })
            .catch((err: any) => setAddError(err.message))
            .finally(() => setSubmitting(false));
    };

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editCategory, setEditCategory] = useState<ClassificationCategory>('Asset');
    const [editOriginalCategory, setEditOriginalCategory] = useState<ClassificationCategory>('Asset');
    const [editError, setEditError] = useState<string | null>(null);

    const startEdit = (st: any) => {
        setEditingId(st.id);
        setEditName(st.name ?? '');
        setEditDescription(st.description ?? '');
        const category = (BINDS_AT_TO_CATEGORY[st.bindsAt] ?? st.bindsAt) as ClassificationCategory;
        setEditCategory(category);
        setEditOriginalCategory(category);
        setEditError(null);
    };

    const submitEdit = () => {
        if (!editingId) return;
        setEditError(null);
        // bindsAt is only sent when the category actually changed — the backend
        // treats a present bindsAt as "change it" and runs the zero-usage gate, which
        // would otherwise block a routine name/description edit on an in-use row for
        // no reason.
        const categoryChanged = editCategory !== editOriginalCategory;
        catalog.updateSubjectType(editingId, {
            name: editName,
            description: editDescription || undefined,
            ...(categoryChanged ? { bindsAt: CATEGORY_TO_BINDS_AT[editCategory] } : {}),
        })
            .then(() => { setEditingId(null); onChanged(); })
            .catch((err: any) => setEditError(err.message));
    };

    // Retire gated behind the usage view (subtype-registry-plan.md decision 5) —
    // retiring a classification still bound to Obligations or classified Assets
    // would silently break obligation mapping or tenant classification.
    const [retireTarget, setRetireTarget] = useState<string | null>(null);
    const [usage, setUsage] = useState<any>(null);
    const [usageLoading, setUsageLoading] = useState(false);
    const [retiring, setRetiring] = useState(false);

    const openRetire = (id: string) => {
        setRetireTarget(id);
        setUsage(null);
        setUsageLoading(true);
        catalog.subjectTypeUsage(id)
            .then(r => setUsage(r.usage))
            .finally(() => setUsageLoading(false));
    };

    const confirmRetire = () => {
        if (!retireTarget) return;
        setRetiring(true);
        catalog.retireSubjectType(retireTarget)
            .then(() => { setRetireTarget(null); onChanged(); })
            .finally(() => setRetiring(false));
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                {adding ? null : (
                    <button
                        onClick={() => setAdding(true)}
                        className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-colors"
                    >
                        <Plus size={13} /> Add classification
                    </button>
                )}
                <label className="flex items-center gap-2 text-xs text-zinc-400 ml-auto">
                    <input type="checkbox" checked={includeRetired} onChange={e => onIncludeRetiredChange(e.target.checked)} />
                    show retired
                </label>
            </div>

            {adding && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 flex flex-col gap-3">
                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Add Classification</p>
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="name (e.g. Fire System)" className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200" />
                    <input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="description" className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200" />
                    <select value={newCategory} onChange={e => setNewCategory(e.target.value as ClassificationCategory)} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200">
                        {CLASSIFICATION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {CATEGORY_DESCRIPTIONS[newCategory] && <p className="text-[10px] text-zinc-500">{CATEGORY_DESCRIPTIONS[newCategory]}</p>}
                    {newId && <p className="text-[10px] text-zinc-600 font-mono">id: {newId}</p>}
                    {addError && <p className="text-[11px] text-red-400">{addError}</p>}
                    <div className="flex gap-2">
                        <button onClick={submitAdd} disabled={submitting || !newName.trim()} className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-zinc-950 disabled:opacity-40">
                            {submitting ? 'Adding…' : 'Add'}
                        </button>
                        <button onClick={() => setAdding(false)} className="text-xs px-3 py-1.5 rounded border border-zinc-800 text-zinc-400">Cancel</button>
                    </div>
                </div>
            )}

            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mt-1">
                Classifications · {visible.length}
            </p>

            {visible.length === 0 ? (
                <EmptyState label="No classifications match." />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {visible.map((st: any) => (
                        <div key={st.id} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] font-mono text-zinc-500">{st.id}</p>
                                {st.status === 'retired' && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">retired</span>
                                )}
                            </div>

                            {editingId === st.id ? (
                                <div className="flex flex-col gap-2">
                                    <input value={editName} onChange={e => setEditName(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200" />
                                    <input value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="description" className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200" />
                                    <select value={editCategory} onChange={e => setEditCategory(e.target.value as ClassificationCategory)} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200">
                                        {CLASSIFICATION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    {CATEGORY_DESCRIPTIONS[editCategory] && <p className="text-[10px] text-zinc-500">{CATEGORY_DESCRIPTIONS[editCategory]}</p>}
                                    {editCategory !== editOriginalCategory && (
                                        <p className="text-[10px] text-amber-400">Category change will be rejected if this classification is still in use (checked on save).</p>
                                    )}
                                    {editError && <p className="text-[11px] text-red-400">{editError}</p>}
                                    <div className="flex gap-2">
                                        <button onClick={submitEdit} disabled={!editName} className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-zinc-950 disabled:opacity-40">Save</button>
                                        <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1.5 rounded border border-zinc-800 text-zinc-400">Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm text-zinc-200 font-medium">{st.name}</p>
                                    <PropRow label="category" value={BINDS_AT_TO_CATEGORY[st.bindsAt] ?? st.bindsAt} />
                                    {st.description && <p className="text-xs text-zinc-500">{st.description}</p>}
                                </>
                            )}

                            {editingId !== st.id && st.status !== 'retired' && (
                                <div className="flex gap-2 mt-1">
                                    <button onClick={() => startEdit(st)} className="text-[11px] px-2 py-1 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200">Edit</button>
                                    <button onClick={() => openRetire(st.id)} className="text-[11px] px-2 py-1 rounded border border-zinc-800 text-zinc-400 hover:text-amber-400">Retire…</button>
                                </div>
                            )}

                            {retireTarget === st.id && (
                                <div className="mt-2 rounded border border-amber-900/50 bg-amber-950/20 px-3 py-2 flex flex-col gap-2">
                                    {usageLoading ? (
                                        <p className="text-[11px] text-zinc-500">Checking usage…</p>
                                    ) : (
                                        <>
                                            <p className="text-[11px] text-zinc-400">
                                                {usage?.obligationCount ?? 0} obligation(s) bind to this classification; {usage?.assetCount ?? 0} asset(s) across all tenants are classified under it.
                                            </p>
                                            {(usage?.obligationCount > 0 || usage?.assetCount > 0) && (
                                                <p className="text-[11px] text-amber-400">Retiring will not remove these references, but new classification/binding against this type should stop.</p>
                                            )}
                                        </>
                                    )}
                                    <div className="flex gap-2">
                                        <button onClick={confirmRetire} disabled={usageLoading || retiring} className="text-xs px-3 py-1.5 rounded bg-amber-600 text-zinc-950 disabled:opacity-40">
                                            {retiring ? 'Retiring…' : 'Confirm retire'}
                                        </button>
                                        <button onClick={() => setRetireTarget(null)} className="text-xs px-3 py-1.5 rounded border border-zinc-800 text-zinc-400">Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Root view ─────────────────────────────────────────────────────────────────

// tenantScoped unset (default) is the global Control-Plane /catalog screen — it
// always reads Vyra Central, regardless of whichever tenant is active elsewhere in
// the app (api.ts's `central: true` opt forces that). tenantScoped={true} is the
// per-tenant /tenant/catalog screen — same component, same data shape, just reads
// through the normal X-Tenant-scoped path and the Refresh action re-syncs that
// tenant's database against Central first instead of merely re-fetching.
export function CatalogView({ tenantScoped = false }: { tenantScoped?: boolean } = {}) {
    const [view, setView] = useState<View>('regulations');
    const [syncing, setSyncing] = useState(false);
    const reqOpts = { central: !tenantScoped };

    const [regulations, setRegulations] = useState<any[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [chain, setChain] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [authorities, setAuthorities] = useState<any[]>([]);
    const [jurisdictions, setJurisdictions] = useState<any[]>([]);
    const [complianceAreas, setComplianceAreas] = useState<any[]>([]);
    const [subjectTypes, setSubjectTypes] = useState<any[]>([]);
    const [classificationFacet, setClassificationFacet] = useState<'assets' | 'others'>('assets');
    const [includeRetiredClassifications, setIncludeRetiredClassifications] = useState(false);
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
    const [complianceAreaFilter, setComplianceAreaFilter] = useState<Set<string>>(new Set());
    const [docTypeFilter, setDocTypeFilter] = useState<Set<string>>(new Set());
    const [obligationStatusFilter, setObligationStatusFilter] = useState<Set<string>>(new Set());
    const [coverageFilter, setCoverageFilter] = useState<Set<string>>(new Set());
    const [filingFilter, setFilingFilter] = useState<Set<string>>(new Set());
    const [versionStatusFilter, setVersionStatusFilter] = useState<Set<string>>(new Set());

    const [lastSyncedAt, setLastSyncedAt] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        Promise.all([
            catalog.regulations(currentOnly, reqOpts),
            catalog.syncStatus(reqOpts),
            catalog.authorities(reqOpts),
            catalog.jurisdictions(reqOpts),
            catalog.complianceAreas(reqOpts),
            catalog.subjectTypes(includeRetiredClassifications, reqOpts),
            catalog.clauses(reqOpts),
            catalog.controls(reqOpts),
            uncontrolledOnly ? catalog.uncontrolledObligations(reqOpts) : catalog.obligations(reqOpts),
        ])
            .then(([r, s, auth, jur, ca, st, cls, ctl, obl]) => {
                const regs = r.regulations ?? [];
                setRegulations(regs);
                setLastSyncedAt(s.lastSyncedAt);
                setAuthorities(auth.authorities ?? []);
                setJurisdictions(jur.jurisdictions ?? []);
                setComplianceAreas(ca.complianceAreas ?? []);
                setSubjectTypes(st.subjectTypes ?? []);
                setClauses(cls.clauses ?? []);
                setControls(ctl.controls ?? []);
                setObligations(obl.obligations ?? []);
                if (regs.length && !selectedId) setSelectedId(regs[0].id);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    // Global view: Refresh just re-fetches Central. Tenant view: Refresh re-syncs
    // this tenant's database against Central first — the one place a stale tenant
    // catalog gets closed without going near a terminal.
    const handleRefresh = async () => {
        if (!tenantScoped) { load(); return; }
        const tenant = getActiveTenant();
        if (!tenant) { load(); return; }
        setSyncing(true);
        try {
            await tenants.syncCatalog(tenant);
        } finally {
            setSyncing(false);
            load();
        }
    };

    useEffect(load, [currentOnly, uncontrolledOnly, includeRetiredClassifications]);

    // The selected regulation (and its chain/history) can fall outside the Authority
    // facet's new result set the moment it changes — clearing the selection here is
    // what keeps the detail pane from showing a regulation no longer even visible in
    // the filtered list on the left.
    useEffect(() => { setSelectedId(null); }, [authorityFilter]);

    useEffect(() => {
        if (!selectedId) { setChain([]); setHistory([]); return; }
        Promise.all([catalog.trace(selectedId, reqOpts), catalog.regulationHistory(selectedId, reqOpts)])
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

    // applicability.md §3 step 1 — the entity type an obligation's regulated
    // subject names (e.g. "DG Set"), from BINDS_TO_TYPE; not yet a tenant binding.
    const subjectTypeName = useMemo(() => {
        const byId = new Map(subjectTypes.map((s: any) => [s.id, s.name]));
        return (id: string) => byId.get(id) ?? id ?? 'UNKNOWN';
    }, [subjectTypes]);

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

    // Same flat Control.complianceAreaId/.docType reached via regulationId as the
    // mechanism facet above — one more hop (Control -> ComplianceArea) resolved to
    // a display name through the complianceAreaName lookup already built for ChainRow.
    const complianceAreasByRegulation = useMemo(() => {
        const byReg = new Map<string, Set<string>>();
        controls.forEach((c: any) => {
            if (!c.regulationId || !c.complianceAreaId) return;
            if (!byReg.has(c.regulationId)) byReg.set(c.regulationId, new Set());
            byReg.get(c.regulationId)!.add(complianceAreaName(c.complianceAreaId));
        });
        return byReg;
    }, [controls, complianceAreaName]);

    const complianceAreaOptions = useMemo(() => {
        const counts = new Map<string, number>();
        regulations.forEach((r: any) => {
            (complianceAreasByRegulation.get(r.id) ?? new Set()).forEach((v: string) => counts.set(v, (counts.get(v) ?? 0) + 1));
        });
        return Array.from(counts.entries())
            .map(([value, count]) => ({ value, label: value, count }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [regulations, complianceAreasByRegulation]);

    // docType is legacy-controls-only (graph.md) — a regulation whose only controls
    // are :Catalog rows legitimately has no entry here; that's the real data, not a bug.
    const docTypesByRegulation = useMemo(() => {
        const byReg = new Map<string, Set<string>>();
        controls.forEach((c: any) => {
            if (!c.regulationId || !c.docType) return;
            if (!byReg.has(c.regulationId)) byReg.set(c.regulationId, new Set());
            byReg.get(c.regulationId)!.add(c.docType);
        });
        return byReg;
    }, [controls]);

    const docTypeOptions = useMemo(() => {
        const counts = new Map<string, number>();
        regulations.forEach((r: any) => {
            (docTypesByRegulation.get(r.id) ?? new Set()).forEach((v: string) => counts.set(v, (counts.get(v) ?? 0) + 1));
        });
        return Array.from(counts.entries())
            .map(([value, count]) => ({ value, label: value, count }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [regulations, docTypesByRegulation]);

    // Obligation carries no flat regulationId (unlike Control) — reached the only way
    // the schema allows: Obligation.clauseId -> Clause.regulationId.
    const clauseToRegulation = useMemo(() => {
        const byClause = new Map<string, string>();
        clauses.forEach((c: any) => { if (c.regulationId) byClause.set(c.id, c.regulationId); });
        return byClause;
    }, [clauses]);

    const obligationsByRegulation = useMemo(() => {
        const byReg = new Map<string, any[]>();
        obligations.forEach((o: any) => {
            const regId = clauseToRegulation.get(o.clauseId);
            if (!regId) return;
            if (!byReg.has(regId)) byReg.set(regId, []);
            byReg.get(regId)!.push(o);
        });
        return byReg;
    }, [obligations, clauseToRegulation]);

    const obligationStatusOptions = useMemo(() => {
        const counts = new Map<string, number>();
        regulations.forEach((r: any) => {
            const statuses = new Set((obligationsByRegulation.get(r.id) ?? []).map((o: any) =>
                (o.mandatory === 'Y' || o.mandatory === true) ? 'Mandatory' : 'Voluntary'));
            statuses.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1));
        });
        return Array.from(counts.entries())
            .map(([value, count]) => ({ value, label: value, count }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [regulations, obligationsByRegulation]);

    // Same coverage test domain.ts's hasImplementingControl runs server-side
    // (control.obligationId === obligation.id), applied per regulation.
    const coverageByRegulation = useMemo(() => {
        const byReg = new Map<string, boolean>();
        regulations.forEach((r: any) => {
            const obls = obligationsByRegulation.get(r.id) ?? [];
            byReg.set(r.id, obls.some((o: any) => !controls.some((c: any) => c.obligationId === o.id)));
        });
        return byReg;
    }, [regulations, obligationsByRegulation, controls]);

    const coverageOptions = useMemo(() => {
        const counts = new Map<string, number>();
        regulations.forEach((r: any) => {
            const label = coverageByRegulation.get(r.id) ? 'Has coverage gap' : 'Fully covered';
            counts.set(label, (counts.get(label) ?? 0) + 1);
        });
        return Array.from(counts.entries()).map(([value, count]) => ({ value, label: value, count }));
    }, [regulations, coverageByRegulation]);

    const filingByRegulation = useMemo(() => {
        const byReg = new Map<string, boolean>();
        regulations.forEach((r: any) => {
            const obls = obligationsByRegulation.get(r.id) ?? [];
            byReg.set(r.id, obls.some((o: any) => Boolean(o.reportId)));
        });
        return byReg;
    }, [regulations, obligationsByRegulation]);

    const filingOptions = useMemo(() => {
        const counts = new Map<string, number>();
        regulations.forEach((r: any) => {
            const label = filingByRegulation.get(r.id) ? 'Requires filing' : 'Internal only';
            counts.set(label, (counts.get(label) ?? 0) + 1);
        });
        return Array.from(counts.entries()).map(([value, count]) => ({ value, label: value, count }));
    }, [regulations, filingByRegulation]);

    const versionStatusOptions = useMemo(() => {
        const counts = new Map<string, number>();
        regulations.forEach((r: any) => {
            const label = r.supersededBy ? 'Superseded' : 'Current';
            counts.set(label, (counts.get(label) ?? 0) + 1);
        });
        return Array.from(counts.entries()).map(([value, count]) => ({ value, label: value, count }));
    }, [regulations]);

    const visibleRegulations = regulations.filter((r: any) =>
        (authorityFilter.size === 0 || authorityFilter.has(r.authorityId)) &&
        (jurisdictionFilter.size === 0 || jurisdictionFilter.has(r.jurisdictionId)) &&
        (yearFilter.size === 0 || yearFilter.has(yearOf(r))) &&
        (mechanismFilter.size === 0 || Array.from(mechanismsByRegulation.get(r.id) ?? []).some(m => mechanismFilter.has(m))) &&
        (complianceAreaFilter.size === 0 || Array.from(complianceAreasByRegulation.get(r.id) ?? []).some(v => complianceAreaFilter.has(v))) &&
        (docTypeFilter.size === 0 || Array.from(docTypesByRegulation.get(r.id) ?? []).some(v => docTypeFilter.has(v))) &&
        (obligationStatusFilter.size === 0 || (obligationsByRegulation.get(r.id) ?? []).some((o: any) =>
            obligationStatusFilter.has((o.mandatory === 'Y' || o.mandatory === true) ? 'Mandatory' : 'Voluntary'))) &&
        (coverageFilter.size === 0 || coverageFilter.has(coverageByRegulation.get(r.id) ? 'Has coverage gap' : 'Fully covered')) &&
        (filingFilter.size === 0 || filingFilter.has(filingByRegulation.get(r.id) ? 'Requires filing' : 'Internal only')) &&
        (versionStatusFilter.size === 0 || versionStatusFilter.has(r.supersededBy ? 'Superseded' : 'Current'))
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
                    {((tenantScoped ? ['regulations', 'obligations', 'graph', 'calendar'] : ['regulations', 'obligations', 'classifications', 'graph', 'calendar']) as View[]).map(v => (
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
                <button
                    onClick={handleRefresh}
                    disabled={syncing}
                    className="p-2 rounded-md hover:bg-zinc-800 transition-colors disabled:opacity-40"
                    title={tenantScoped ? 'Sync with central' : 'Refresh'}
                >
                    <RefreshCw size={14} className={`text-zinc-500 ${syncing ? 'animate-spin' : ''}`} />
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
                            <FacetGroup
                                title="Compliance Area"
                                options={complianceAreaOptions}
                                selected={complianceAreaFilter}
                                onToggle={v => toggleInSet(complianceAreaFilter, setComplianceAreaFilter, v)}
                            />
                            <FacetGroup
                                title="Document Type"
                                options={docTypeOptions}
                                selected={docTypeFilter}
                                onToggle={v => toggleInSet(docTypeFilter, setDocTypeFilter, v)}
                            />
                            <FacetGroup
                                title="Obligation Status"
                                options={obligationStatusOptions}
                                selected={obligationStatusFilter}
                                onToggle={v => toggleInSet(obligationStatusFilter, setObligationStatusFilter, v)}
                            />
                            <FacetGroup
                                title="Coverage"
                                options={coverageOptions}
                                selected={coverageFilter}
                                onToggle={v => toggleInSet(coverageFilter, setCoverageFilter, v)}
                            />
                            <FacetGroup
                                title="Filing Requirement"
                                options={filingOptions}
                                selected={filingFilter}
                                onToggle={v => toggleInSet(filingFilter, setFilingFilter, v)}
                            />
                            <FacetGroup
                                title="Version Status"
                                options={versionStatusOptions}
                                selected={versionStatusFilter}
                                onToggle={v => toggleInSet(versionStatusFilter, setVersionStatusFilter, v)}
                            />
                        </>
                    ) : view === 'obligations' ? (
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
                    ) : (
                        <>
                            <label className="flex items-center gap-2 text-xs text-zinc-400">
                                <input type="radio" name="classification-facet" checked={classificationFacet === 'assets'} onChange={() => setClassificationFacet('assets')} />
                                Assets
                            </label>
                            <label className="flex items-center gap-2 text-xs text-zinc-400">
                                <input type="radio" name="classification-facet" checked={classificationFacet === 'others'} onChange={() => setClassificationFacet('others')} />
                                Others
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
                ) : view === 'classifications' ? (
                    <div className="flex-1 min-w-0 overflow-auto px-6 py-4">
                        <ClassificationsPanel
                            subjectTypes={subjectTypes}
                            facet={classificationFacet}
                            includeRetired={includeRetiredClassifications}
                            onIncludeRetiredChange={setIncludeRetiredClassifications}
                            onChanged={load}
                        />
                    </div>
                ) : (
                    <div className="flex-1 min-w-0 overflow-auto px-6 py-4 flex flex-col gap-3">
                        <ProposeObligationForm clauses={clauses} onProposed={load} reqOpts={reqOpts} />
                        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mt-1">
                            Obligations · {visibleObligations.length}
                        </p>
                        {visibleObligations.length === 0 ? (
                            <EmptyState label={uncontrolledOnly ? 'No uncontrolled obligations — every obligation here has an implementing control.' : 'No obligations match the selected facets.'} />
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {visibleObligations.map(o => <ObligationRow key={o.id} obligation={o} subjectTypeName={subjectTypeName} />)}
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
