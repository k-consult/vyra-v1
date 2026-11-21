'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Rocket, Circle, Upload, CheckCircle2, HelpCircle, Clock, FileText, Sparkles } from 'lucide-react';
import { blueprint, catalog, intelligence, onboarding, tenants, type ObligationMapping, type StructureSummary, type StructureTreeNode, type Tenant } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { LoadingState, ErrorState, RefreshButton, UploadTrigger, InstanceTree, iconForLabel } from '@/features/tenant/shared';
import { getActiveTenant } from '@/lib/active-tenant';
import { formatValue } from '@/features/validation/display';

type StageId = 'structure' | 'annotate' | 'mapping' | 'ratification';

type Stage = { id: StageId; label: string; description: string };

// Order matches the operating sequence, not the mockup it replaces
// (.design/journey/03-enterprise-onboarding.html did Applicability before
// Structure) — you need the org tree before anything can be classified against
// it, and classified before obligations can be mapped onto it. 'Annotate' is its
// own stage, not folded into Mapping — classification is the action a human
// takes (confirm/override each asset's type); Mapping is the resulting view,
// read-only. Replaces what used to be the separate "Applicability" stage — a
// tenant admin doesn't need to know what a SubjectType is, only "here's my
// asset, confirm what it is" (applicability.md §7 step 3, now live).
const STAGES: Stage[] = [
    { id: 'structure',    label: 'Upload Structure',   description: 'Upload the tenant’s current footprint — locations, assets' },
    { id: 'annotate',     label: 'Annotate',           description: 'Confirm or correct what each asset is classified as' },
    { id: 'mapping',      label: 'Obligation Mapping', description: 'See the obligations mapped onto your structure' },
    { id: 'ratification', label: 'Ratification',       description: 'Approve or reject regulation applicability, per entity' },
];

// Named, not blank — same discipline as the platform's `origin: agent-proposed
// | synthetic` tagging and `DESIGN MOCKUP` banners: an unbuilt stage says so and
// cites the gap, rather than faking completeness.
function GapPlaceholder({ title, gapRef, children }: { title: string; gapRef: string; children: ReactNode }) {
    return (
        <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-5 py-4 flex flex-col gap-2 max-w-[70ch]">
            <div className="flex items-center gap-2">
                <Circle size={8} className="text-amber-500 fill-amber-500" />
                <p className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">Not yet built — {gapRef}</p>
            </div>
            <p className="text-sm text-zinc-200 font-medium">{title}</p>
            <div className="text-xs text-zinc-500 leading-relaxed">{children}</div>
        </div>
    );
}

function StructureStage({ onClassificationStarted }: { onClassificationStarted: () => void }) {
    const [tree, setTree] = useState<StructureTreeNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [lastSummary, setLastSummary] = useState<StructureSummary | null>(null);
    const [classifying, setClassifying] = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        blueprint.structureTree()
            .then(({ tree }) => setTree(tree))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    // The point of Annotate's existence is to review what the agent proposed —
    // so proposing should start the moment there's something to classify, not
    // wait for a second manual trigger after the upload that already told us
    // new Assets exist.
    const onUploaded = async (summary: StructureSummary) => {
        setLastSummary(summary);
        load();
        const tenant = getActiveTenant();
        if (!tenant) return;
        setClassifying(true);
        try {
            await tenants.runClassification(tenant);
            onClassificationStarted();
        } finally {
            setClassifying(false);
        }
    };

    if (loading) return <LoadingState label="Loading structure…" />;
    if (error) return <ErrorState onRetry={load} />;

    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-400 leading-relaxed max-w-[70ch]">
                Upload the tenant&rsquo;s assets with their full location hierarchy — site, building, zone/floor,
                room. This <span className="text-zinc-300">is</span> the org blueprint: a one-time parse into real
                <code className="text-zinc-300"> Facility</code>/<code className="text-zinc-300">Asset</code> graph
                nodes, rendered below as the tenant&rsquo;s structure tree.
            </p>
            <div className="flex items-center gap-3">
                <UploadTrigger
                    className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium bg-sky-500 text-zinc-950 hover:bg-sky-400 transition-colors cursor-pointer"
                    upload={tenants.uploadStructure}
                    onUploaded={onUploaded}
                >
                    <Upload size={13} /> Upload asset register
                </UploadTrigger>
                <RefreshButton onClick={load} />
            </div>

            {lastSummary && (
                <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 px-4 py-3 text-xs text-emerald-200">
                    Ingested {Object.entries(lastSummary.nodesCreatedByLevel).map(([level, count]) => `${count} ${level.toLowerCase()}`).join(', ')}.
                    {lastSummary.rowsSkipped > 0 && ` ${lastSummary.rowsSkipped} row(s) skipped (missing Site Code or Asset Code).`}
                    {classifying && <span className="block mt-1 text-sky-300">Classifying new assets against known obligations…</span>}
                </div>
            )}

            <InstanceTree nodes={tree} />
        </div>
    );
}

const MAPPING_STATUS_STYLE: Record<ObligationMapping['status'], { icon: React.ElementType; className: string; label: string }> = {
    classified:   { icon: CheckCircle2, className: 'text-emerald-400', label: 'Obligations identified' },
    pending:      { icon: Clock,        className: 'text-amber-400',  label: 'Needs your confirmation' },
    none:         { icon: HelpCircle,   className: 'text-zinc-500',   label: 'No obligations' },
    rejected:     { icon: HelpCircle,   className: 'text-zinc-500',   label: 'Flagged for follow-up' },
    unclassified: { icon: Circle,       className: 'text-zinc-600',   label: 'Not yet assessed' },
};

const NONE_SUBJECT_TYPE = 'none';

type StatusFilter = ObligationMapping['status'] | 'all';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'classified', label: 'Classified' },
    { key: 'none', label: 'No obligations' },
    { key: 'rejected', label: 'Flagged' },
    { key: 'unclassified', label: 'Not assessed' },
    { key: 'all', label: 'All' },
];

const mappingStatusOf = (m: ObligationMapping | undefined): ObligationMapping['status'] => m?.status ?? 'unclassified';

// Pruning predicate for the filter/search bar — a branch node (Facility, etc.)
// survives if any Asset underneath it matches; an Asset matches on its own
// status + text. This is what keeps the tree navigable at hundreds of
// facilities/thousands of assets: you're never scrolling past branches that
// have nothing relevant in them.
function nodeMatchesFilter(
    node: StructureTreeNode,
    mappingByAssetId: Map<string, ObligationMapping>,
    statusFilter: StatusFilter,
    searchText: string
): boolean {
    if (node.label === 'Asset') {
        const status = mappingStatusOf(mappingByAssetId.get(node.node.id));
        if (statusFilter !== 'all' && status !== statusFilter) return false;
        const text = searchText.trim().toLowerCase();
        if (!text) return true;
        return [node.node.name, node.node.category, node.node.code]
            .some((v) => typeof v === 'string' && v.toLowerCase().includes(text));
    }
    return node.children.some((c) => nodeMatchesFilter(c, mappingByAssetId, statusFilter, searchText));
}

function collectPendingInSubtree(node: StructureTreeNode, mappingByAssetId: Map<string, ObligationMapping>): ObligationMapping[] {
    if (node.label === 'Asset') {
        const m = mappingByAssetId.get(node.node.id);
        return m?.status === 'pending' ? [m] : [];
    }
    return node.children.flatMap((c) => collectPendingInSubtree(c, mappingByAssetId));
}

// Annotate is the action step: confirm or correct what each asset actually is,
// so the right obligations attach to it downstream. One asset leaf in the org
// tree — editable regardless of status (not just while pending), so a
// correction months later is "Reclassify" on the same row, not a hunt through
// a different screen. Never surfaces the word "SubjectType" — a tenant admin
// needs "is this a boiler or not," not the Knowledge-graph vocabulary bridging
// it to obligations (applicability.md §3).
function AnnotateAssetRow({ node, mapping, assetSubjectTypes, onResolved }: {
    node: StructureTreeNode;
    mapping: ObligationMapping | undefined;
    assetSubjectTypes: { id: string; name: string }[];
    onResolved: () => void;
}) {
    const isPending = mapping?.status === 'pending';
    const [editing, setEditing] = useState(false);
    const [choice, setChoice] = useState(mapping?.previewSubjectType?.id ?? NONE_SUBJECT_TYPE);
    const [busy, setBusy] = useState(false);
    const [suggesting, setSuggesting] = useState(false);
    const [suggestion, setSuggestion] = useState<{ rationale: string; confidence: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { icon: StatusIcon, className, label } = MAPPING_STATUS_STYLE[mappingStatusOf(mapping)];
    const NodeIcon = iconForLabel(node.label);

    const confirmPending = async (action: 'approve' | 'reject') => {
        setBusy(true);
        setError(null);
        try {
            await (action === 'approve'
                ? intelligence.approve(mapping!.decisionId!, '', undefined, choice)
                : intelligence.reject(mapping!.decisionId!, ''));
            onResolved();
        } catch (err: any) {
            setError(err.message);
            setBusy(false);
        }
    };

    const saveReclassify = async () => {
        setBusy(true);
        setError(null);
        try {
            await onboarding.reclassify(node.node.id, choice, '');
            setEditing(false);
            onResolved();
        } catch (err: any) {
            setError(err.message);
            setBusy(false);
        }
    };

    // Writes nothing — just asks the model fresh and pre-fills the dropdown
    // with its answer. The reviewer still has to click Confirm/Save for
    // anything to reach the graph; Cancel discards it same as a manual pick.
    const invokeModel = async () => {
        setSuggesting(true);
        setError(null);
        try {
            const result = await onboarding.suggestClassification(node.node.id);
            setChoice(result.proposedSubjectTypeId);
            setSuggestion({ rationale: result.rationale, confidence: result.confidence });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSuggesting(false);
        }
    };

    const showEditor = isPending || editing;

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 px-2 py-1">
                <NodeIcon size={12} className="text-zinc-500" />
                <span className="text-xs text-zinc-300">{node.node.name}</span>
                {node.node.code && <span className="text-[10px] font-mono text-zinc-600">{node.node.code}</span>}
                {node.node.category && <span className="text-[10px] text-zinc-600">{node.node.category}</span>}
                <span className={`ml-auto flex items-center gap-1 text-[10px] shrink-0 ${className}`}>
                    <StatusIcon size={10} /> {label}
                </span>
                {!isPending && (
                    <button
                        onClick={() => setEditing((v) => !v)}
                        className="text-[10px] text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline shrink-0"
                    >
                        {editing ? 'Cancel' : mapping && mapping.status !== 'unclassified' ? 'Reclassify' : 'Classify'}
                    </button>
                )}
            </div>

            {showEditor && (
                <div className="flex flex-col gap-1 pl-7 pb-1">
                    <div className="flex items-center gap-1.5">
                        <select
                            value={choice}
                            onChange={(e) => { setChoice(e.target.value); setSuggestion(null); }}
                            title="Correct the asset's classification if the agent got it wrong"
                            className="min-w-0 flex-1 max-w-xs rounded border border-sky-800/60 bg-zinc-950 px-1.5 py-1 text-[10.5px] text-sky-300"
                        >
                            <option value={NONE_SUBJECT_TYPE}>This asset has no obligations</option>
                            {assetSubjectTypes.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                        </select>
                        <button
                            onClick={invokeModel}
                            disabled={suggesting || busy}
                            title="Ask the model for a fresh read — doesn't save anything by itself"
                            className="shrink-0 flex items-center gap-1 rounded border border-violet-700/50 bg-violet-900/20 px-2 py-1 text-[10.5px] font-medium text-violet-300 hover:bg-violet-900/40 disabled:opacity-40"
                        >
                            <Sparkles size={10} /> {suggesting ? 'Asking…' : 'Invoke model'}
                        </button>
                        {isPending ? (
                            <>
                                <button
                                    onClick={() => confirmPending('approve')}
                                    disabled={busy}
                                    className="shrink-0 rounded border border-emerald-700/50 bg-emerald-900/30 px-2 py-1 text-[10.5px] font-medium text-emerald-300 hover:bg-emerald-900/50 disabled:opacity-40"
                                >
                                    Confirm
                                </button>
                                <button
                                    onClick={() => confirmPending('reject')}
                                    disabled={busy}
                                    className="shrink-0 rounded border border-red-700/50 bg-red-900/30 px-2 py-1 text-[10.5px] font-medium text-red-300 hover:bg-red-900/50 disabled:opacity-40"
                                >
                                    Flag
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={saveReclassify}
                                    disabled={busy}
                                    className="shrink-0 rounded border border-emerald-700/50 bg-emerald-900/30 px-2 py-1 text-[10.5px] font-medium text-emerald-300 hover:bg-emerald-900/50 disabled:opacity-40"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => setEditing(false)}
                                    disabled={busy}
                                    className="shrink-0 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10.5px] font-medium text-zinc-400 hover:bg-zinc-800 disabled:opacity-40"
                                >
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>
                    {suggestion && (
                        <p className="text-[10px] text-violet-400/80 max-w-md">
                            Model ({Math.round(suggestion.confidence * 100)}%): {suggestion.rationale}
                        </p>
                    )}
                    {error && <span className="text-[10.5px] text-red-400">{error}</span>}
                </div>
            )}
        </div>
    );
}

// A branch node (Facility/Building/Floor/...) in the Annotate tree. Collapses
// by default once everything under it is resolved; stays open — or reopens —
// whenever a status/search filter is active or a pending item exists beneath
// it, so applying a filter across hundreds of facilities surfaces matches
// without the user hunting for which branches to expand.
function AnnotateTreeNode({ node, mappingByAssetId, assetSubjectTypes, statusFilter, searchText, onResolved }: {
    node: StructureTreeNode;
    mappingByAssetId: Map<string, ObligationMapping>;
    assetSubjectTypes: { id: string; name: string }[];
    statusFilter: StatusFilter;
    searchText: string;
    onResolved: () => void;
}) {
    const [manualOpen, setManualOpen] = useState<boolean | null>(null);
    const [bulkBusy, setBulkBusy] = useState(false);

    if (!nodeMatchesFilter(node, mappingByAssetId, statusFilter, searchText)) return null;

    if (node.label === 'Asset') {
        return <AnnotateAssetRow node={node} mapping={mappingByAssetId.get(node.node.id)} assetSubjectTypes={assetSubjectTypes} onResolved={onResolved} />;
    }

    const pendingHere = collectPendingInSubtree(node, mappingByAssetId);
    const isFiltering = statusFilter !== 'all' || searchText.trim().length > 0;
    const autoOpen = isFiltering || pendingHere.length > 0;
    const open = manualOpen ?? autoOpen;
    const NodeIcon = iconForLabel(node.label);

    const confirmAllRecommended = async () => {
        setBulkBusy(true);
        try {
            await Promise.all(pendingHere.map((m) => intelligence.approve(m.decisionId!, '', undefined, m.previewSubjectType?.id ?? NONE_SUBJECT_TYPE)));
            onResolved();
        } finally {
            setBulkBusy(false);
        }
    };

    return (
        <div className="flex flex-col gap-1">
            <button
                onClick={() => setManualOpen(!open)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
            >
                <NodeIcon size={12} className="text-zinc-500" />
                <span className="text-xs text-zinc-300">{node.node.name}</span>
                {pendingHere.length > 0 && (
                    <span className="text-[10px] text-amber-400">{pendingHere.length} pending</span>
                )}
                <span className="ml-auto text-[10px] text-zinc-500">{node.children.length}</span>
            </button>
            {pendingHere.length > 0 && (
                <div className="pl-7 pb-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); confirmAllRecommended(); }}
                        disabled={bulkBusy}
                        className="rounded border border-emerald-700/50 bg-emerald-900/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-40"
                    >
                        Confirm all recommended ({pendingHere.length})
                    </button>
                </div>
            )}
            {open && (
                <div className="flex flex-col gap-1 pl-5 ml-1.5 border-l border-zinc-800/60">
                    {node.children.map((child) => (
                        <AnnotateTreeNode
                            key={child.node.id}
                            node={child}
                            mappingByAssetId={mappingByAssetId}
                            assetSubjectTypes={assetSubjectTypes}
                            statusFilter={statusFilter}
                            searchText={searchText}
                            onResolved={onResolved}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function AnnotateStage() {
    const [tree, setTree] = useState<StructureTreeNode[]>([]);
    const [mappings, setMappings] = useState<ObligationMapping[]>([]);
    const [subjectTypes, setSubjectTypes] = useState<{ id: string; name: string; bindsAt: string }[]>([]);
    const [tenantInfo, setTenantInfo] = useState<Tenant | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
    const [searchText, setSearchText] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [runningClassification, setRunningClassification] = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        Promise.all([blueprint.structureTree(), onboarding.obligationMapping(), catalog.subjectTypes(), tenants.list()])
            .then(([t, m, s, tn]: any[]) => {
                setTree(t.tree ?? []);
                setMappings(m.mappings ?? []);
                setSubjectTypes(s.subjectTypes ?? []);
                const active = getActiveTenant();
                setTenantInfo((tn.tenants ?? []).find((x: Tenant) => x.name === active) ?? null);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const mappingByAssetId = useMemo(() => new Map(mappings.map((m) => [m.asset.id, m])), [mappings]);
    const assetSubjectTypes = useMemo(() => subjectTypes.filter((st) => st.bindsAt === 'Asset'), [subjectTypes]);
    const counts = useMemo(() => {
        const c: Record<StatusFilter, number> = { pending: 0, classified: 0, none: 0, rejected: 0, unclassified: 0, all: mappings.length };
        for (const m of mappings) c[m.status]++;
        return c;
    }, [mappings]);
    const allPending = useMemo(() => mappings.filter((m) => m.status === 'pending'), [mappings]);
    const [bulkBusy, setBulkBusy] = useState(false);

    const confirmAllRecommendedGlobally = async () => {
        setBulkBusy(true);
        try {
            await Promise.all(allPending.map((m) => intelligence.approve(m.decisionId!, '', undefined, m.previewSubjectType?.id ?? NONE_SUBJECT_TYPE)));
            load();
        } finally {
            setBulkBusy(false);
        }
    };

    // Deliberately gated on counts.unclassified, not just "always runnable" —
    // the agent's own idempotency guard means a run against an already-fully-
    // classified org just observes 0, but pretending that's a live action
    // worth repeating invites exactly the mindless re-clicking this was built
    // to avoid. Disabled + labeled "Up to date" once there's nothing new.
    const runClassification = async () => {
        const tenant = getActiveTenant();
        if (!tenant) return;
        setRunningClassification(true);
        try {
            await tenants.runClassification(tenant);
            load();
        } finally {
            setRunningClassification(false);
        }
    };

    if (loading) return <LoadingState label="Loading assets…" />;
    if (error) return <ErrorState onRetry={load} />;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-400 leading-relaxed max-w-[70ch]">
                    Confirm what each asset is — this determines which obligations apply to it.{' '}
                    {counts.pending > 0 ? `${counts.pending} need your review.` : 'All confirmed.'}
                </p>
                <div className="flex flex-col items-end gap-1 shrink-0">
                    <button
                        onClick={runClassification}
                        disabled={runningClassification || counts.unclassified === 0}
                        title={counts.unclassified === 0 ? 'Every asset has already been assessed' : `Classify ${counts.unclassified} new asset(s)`}
                        className="flex items-center gap-1.5 rounded border border-violet-700/50 bg-violet-900/20 px-2.5 py-1.5 text-[11px] font-medium text-violet-300 hover:bg-violet-900/40 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Sparkles size={12} />
                        {runningClassification ? 'Running…' : counts.unclassified > 0 ? `Run classification (${counts.unclassified} new)` : 'Up to date'}
                    </button>
                    {tenantInfo?.lastClassificationRunAt && (
                        <span className="text-[10px] text-zinc-600">Last run: {formatValue(tenantInfo.lastClassificationRunAt)}</span>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-end gap-2">
                {allPending.length > 0 && (
                    <button
                        onClick={confirmAllRecommendedGlobally}
                        disabled={bulkBusy}
                        className="rounded border border-emerald-700/50 bg-emerald-900/20 px-2.5 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-40"
                    >
                        Confirm all recommended ({allPending.length})
                    </button>
                )}
                <RefreshButton onClick={load} />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                {STATUS_FILTERS.map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setStatusFilter(key)}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                            statusFilter === key
                                ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                                : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                        }`}
                    >
                        {label} · {counts[key]}
                    </button>
                ))}
                <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search by asset, category, or code…"
                    className="min-w-[220px] flex-1 max-w-sm rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-300 placeholder:text-zinc-600"
                />
            </div>

            {tree.length === 0 ? (
                <p className="text-sm text-zinc-500 italic">No assets yet — upload the tenant&rsquo;s structure first.</p>
            ) : (() => {
                const visibleRoots = tree.filter((n) => nodeMatchesFilter(n, mappingByAssetId, statusFilter, searchText));
                if (visibleRoots.length === 0) {
                    return <p className="text-sm text-zinc-500 italic">No assets match this filter.</p>;
                }
                return (
                    <div className="flex flex-col gap-2">
                        {visibleRoots.map((n) => (
                            <div key={n.node.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1">
                                <AnnotateTreeNode
                                    node={n}
                                    mappingByAssetId={mappingByAssetId}
                                    assetSubjectTypes={assetSubjectTypes}
                                    statusFilter={statusFilter}
                                    searchText={searchText}
                                    onResolved={load}
                                />
                            </div>
                        ))}
                    </div>
                );
            })()}
        </div>
    );
}

// The org tree *is* the obligation map — obligations render as nested rows
// under the asset they apply to, not as a separate screen the user has to
// mentally re-link back to the structure they just uploaded. Read-only: the
// classification action happens in Annotate, not here — a still-pending asset
// links back there instead of offering its own copy of the same control.
function ObligationTreeNode({ node, mappingByAssetId, onNeedsAnnotation }: {
    node: StructureTreeNode;
    mappingByAssetId: Map<string, ObligationMapping>;
    onNeedsAnnotation: () => void;
}) {
    const mapping = node.label === 'Asset' ? mappingByAssetId.get(node.node.id) : undefined;
    const obligationCount = mapping?.obligations.length ?? 0;
    const hasChildren = node.children.length > 0 || obligationCount > 0;
    const [open, setOpen] = useState(true);
    const NodeIcon = iconForLabel(node.label);

    return (
        <div className="flex flex-col gap-1">
            <button
                onClick={() => hasChildren && setOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
            >
                <NodeIcon size={12} className="text-zinc-500" />
                <span className="text-xs text-zinc-300">{node.node.name}</span>
                {node.node.code && <span className="text-[10px] font-mono text-zinc-600">{node.node.code}</span>}
                {node.node.category && <span className="text-[10px] text-zinc-600">{node.node.category}</span>}
                {mapping && (() => {
                    const { icon: StatusIcon, className, label } = MAPPING_STATUS_STYLE[mapping.status];
                    if (mapping.status === 'pending') {
                        return (
                            <span
                                role="button"
                                onClick={(e) => { e.stopPropagation(); onNeedsAnnotation(); }}
                                title="Go to Annotate to confirm this asset"
                                className={`ml-auto flex items-center gap-1 text-[10px] shrink-0 underline-offset-2 hover:underline ${className}`}
                            >
                                <StatusIcon size={10} /> {label}
                            </span>
                        );
                    }
                    return (
                        <span className={`ml-auto flex items-center gap-1 text-[10px] shrink-0 ${className}`}>
                            <StatusIcon size={10} /> {label}
                        </span>
                    );
                })()}
                {!mapping && hasChildren && <span className="ml-auto text-[10px] text-zinc-500">{node.children.length}</span>}
            </button>

            {open && hasChildren && (
                <div className="flex flex-col gap-1 pl-5 ml-1.5 border-l border-zinc-800/60">
                    {mapping?.obligations.map((o) => (
                        <div key={o.id} className="flex items-center gap-2 px-2 py-1">
                            <FileText size={11} className="text-sky-500/70 shrink-0" />
                            <span className="text-[11px] text-zinc-400">{o.name}</span>
                        </div>
                    ))}
                    {node.children.map((child) => (
                        <ObligationTreeNode key={child.node.id} node={child} mappingByAssetId={mappingByAssetId} onNeedsAnnotation={onNeedsAnnotation} />
                    ))}
                </div>
            )}
        </div>
    );
}

function ObligationMappingStage({ onNeedsAnnotation }: { onNeedsAnnotation: () => void }) {
    const [tree, setTree] = useState<StructureTreeNode[]>([]);
    const [mappings, setMappings] = useState<ObligationMapping[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        Promise.all([blueprint.structureTree(), onboarding.obligationMapping()])
            .then(([t, m]: any[]) => {
                setTree(t.tree ?? []);
                setMappings(m.mappings ?? []);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const mappingByAssetId = useMemo(() => new Map(mappings.map((m) => [m.asset.id, m])), [mappings]);

    if (loading) return <LoadingState label="Loading obligation mapping…" />;
    if (error) return <ErrorState onRetry={load} />;

    const pendingCount = mappings.filter((m) => m.status === 'pending').length;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-400 leading-relaxed max-w-[70ch]">
                    Your obligations, mapped onto the structure you uploaded — expand an asset to see what applies to it.{' '}
                    {pendingCount > 0 ? `${pendingCount} still need confirming in Annotate.` : 'All caught up.'}
                </p>
                <RefreshButton onClick={load} />
            </div>
            {tree.length === 0 ? (
                <p className="text-sm text-zinc-500 italic">No structure yet — upload the tenant&rsquo;s structure first.</p>
            ) : (
                <div className="flex flex-col gap-2">
                    {tree.map((n) => (
                        <div key={n.node.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1">
                            <ObligationTreeNode node={n} mappingByAssetId={mappingByAssetId} onNeedsAnnotation={onNeedsAnnotation} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function RatificationStage() {
    return (
        <GapPlaceholder title="Per-entity × per-regulation ratification grid" gapRef="track.md — new agent capability">
            Asset-level obligation mapping (the previous stage) is live. What&rsquo;s still missing is the step above it:
            recommending whole-*regulation* applicability at every level of the org (organization/facility/asset) and
            letting a human approve or reject each one individually — <code className="text-zinc-400">track.md</code> names
            this explicitly as undesigned (<code className="text-zinc-400">applicability.md</code> §7 step 4). The only
            other live coverage edge today (<code className="text-zinc-400">COVERED_BY</code>) is a one-time CLI backfill
            with a constant confidence, not a per-tenant agent proposal.
        </GapPlaceholder>
    );
}

export function OnboardingView() {
    const [stage, setStage] = useState<StageId>('structure');

    return (
        <div className="h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">
            <PageHeader
                icon={Rocket}
                iconClassName="text-sky-400"
                title="Onboarding"
                subtitle="Upload Structure → Annotate → Obligation Mapping → Ratification"
            />
            <div className="flex-1 min-h-0 flex overflow-hidden">
                <aside className="w-64 shrink-0 border-r border-zinc-800/60 overflow-y-auto px-4 py-4 flex flex-col gap-1">
                    {STAGES.map((s, i) => {
                        const isActive = s.id === stage;
                        return (
                            <button
                                key={s.id}
                                onClick={() => setStage(s.id)}
                                className={`flex items-start gap-2.5 text-left px-2.5 py-2.5 rounded-lg border transition-colors ${
                                    isActive ? 'bg-sky-500/10 border-sky-500/30' : 'border-transparent hover:bg-zinc-900'
                                }`}
                            >
                                <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                                    isActive ? 'bg-sky-500 text-zinc-950' : 'bg-zinc-800 text-zinc-500'
                                }`}>
                                    {i + 1}
                                </span>
                                <span className="flex flex-col gap-0.5 min-w-0">
                                    <span className={`text-xs font-medium ${isActive ? 'text-sky-300' : 'text-zinc-300'}`}>{s.label}</span>
                                    <span className="text-[10.5px] text-zinc-500 leading-snug">{s.description}</span>
                                </span>
                            </button>
                        );
                    })}
                </aside>
                <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5">
                    {stage === 'structure' && <StructureStage onClassificationStarted={() => setStage('annotate')} />}
                    {stage === 'annotate' && <AnnotateStage />}
                    {stage === 'mapping' && <ObligationMappingStage onNeedsAnnotation={() => setStage('annotate')} />}
                    {stage === 'ratification' && <RatificationStage />}
                </div>
            </div>
        </div>
    );
}
