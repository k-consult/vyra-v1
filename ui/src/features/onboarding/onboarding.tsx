'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Rocket, Circle, Upload } from 'lucide-react';
import { blueprint, tenants, type StructureSummary, type StructureTreeNode } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { LoadingState, ErrorState, RefreshButton, UploadTrigger, InstanceTree } from '@/features/tenant/shared';

type StageId = 'structure' | 'applicability' | 'ratification' | 'view';

type Stage = { id: StageId; label: string; description: string };

// Order matches the operating sequence, not the mockup it replaces
// (.design/journey/03-enterprise-onboarding.html did Applicability before
// Structure) — you need the org tree before applicability can be recommended
// at each level of it.
const STAGES: Stage[] = [
    { id: 'structure',      label: 'Structure',             description: 'Upload the tenant’s current footprint — locations, assets' },
    { id: 'applicability',  label: 'Applicability',         description: 'Choose the authorities and regulations in scope' },
    { id: 'ratification',   label: 'Ratification',          description: 'Approve or reject regulation applicability, per entity' },
    { id: 'view',           label: 'Obligation Blueprint',  description: 'The tenant fully mapped — obligations by entity' },
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

function StructureStage() {
    const [tree, setTree] = useState<StructureTreeNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [lastSummary, setLastSummary] = useState<StructureSummary | null>(null);

    const load = () => {
        setLoading(true);
        setError(false);
        blueprint.structureTree()
            .then(({ tree }) => setTree(tree))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

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
                    onUploaded={(summary) => { setLastSummary(summary); load(); }}
                >
                    <Upload size={13} /> Upload asset register
                </UploadTrigger>
                <RefreshButton onClick={load} />
            </div>

            {lastSummary && (
                <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 px-4 py-3 text-xs text-emerald-200">
                    Ingested {Object.entries(lastSummary.nodesCreatedByLevel).map(([level, count]) => `${count} ${level.toLowerCase()}`).join(', ')}.
                    {lastSummary.rowsSkipped > 0 && ` ${lastSummary.rowsSkipped} row(s) skipped (missing Site Code or Asset Code).`}
                </div>
            )}

            <InstanceTree nodes={tree} />
        </div>
    );
}

function ApplicabilityStage() {
    return (
        <GapPlaceholder title="Enterprise-wide regulation scoping" gapRef="track.md — Operational Context, Pending">
            Choosing which authorities/regulations are in scope for this tenant needs a Decision-gated write path
            that doesn&rsquo;t exist yet (e.g. an <code className="text-zinc-400">(Organization)-[:IN_SCOPE_OF]-&gt;(Regulation|Standard)</code>{' '}
            edge, proposed and approved the same way a <code className="text-zinc-400">Contract</code> is). Today applicability
            is data-only via the Landscape drill-down — there&rsquo;s no propose/approve flow to surface here yet.
        </GapPlaceholder>
    );
}

function RatificationStage() {
    return (
        <GapPlaceholder title="Per-entity × per-regulation ratification grid" gapRef="track.md — new agent capability">
            Recommending regulation applicability at every level of the org (organization/facility/asset) and letting a
            human approve or reject each one individually is a new agent capability — <code className="text-zinc-400">track.md</code>{' '}
            names it explicitly as undesigned. The only live applicability edge today
            (<code className="text-zinc-400">COVERED_BY</code>) is a one-time CLI backfill with a constant confidence, not a
            per-tenant agent proposal. <code className="text-zinc-400">Blueprint</code> is also still scoped to one facility
            per proposal — ratifying a full org tree needs its own schema pass first.
        </GapPlaceholder>
    );
}

function ViewStage() {
    return (
        <GapPlaceholder title="Obligation Cockpit — the tenant fully mapped" gapRef="track.md Gap #19">
            Blocked on deciding the Demography/<code className="text-zinc-400">workerCategory</code> and Industry/Asset-Category
            controlled vocabularies (named but unresolved in <code className="text-zinc-400">track.md</code>), plus
            delegation-tree edges, a per-workflow-class Autonomy Level, and a real Loop-stage state model — none of which
            exist yet. The interaction design is already validated in{' '}
            <code className="text-zinc-400">.design/journey/04-obligation-cockpit.html</code>; what&rsquo;s missing is the backend.
            <br /><br />
            The previous <code className="text-zinc-400">/onboarding</code> page&rsquo;s live cutover-criterion tracking will
            fold in here once this stage is built — it isn&rsquo;t dropped, just not ported yet.
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
                subtitle="Structure → Applicability → Ratification → Obligation Blueprint"
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
                    {stage === 'structure' && <StructureStage />}
                    {stage === 'applicability' && <ApplicabilityStage />}
                    {stage === 'ratification' && <RatificationStage />}
                    {stage === 'view' && <ViewStage />}
                </div>
            </div>
        </div>
    );
}
