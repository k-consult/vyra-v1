'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, GitPullRequestArrow, Plus, CheckCircle2, Clock } from 'lucide-react';
import { onboarding, operational, ProposeCutoverCriterionInput } from '@/lib/api';
import { PropRow } from '@/features/landscape/landscape';
import { PageHeader } from '@/components/page-header';

const STATUS_STYLE: Record<string, string> = {
    proving:           'bg-sky-900 text-sky-300 border-sky-700',
    'cutover-complete': 'bg-emerald-900 text-emerald-300 border-emerald-700',
    'cutover-overdue':  'bg-red-900 text-red-300 border-red-700',
};

function StatusPill({ status }: { status: string }) {
    const cls = STATUS_STYLE[status] ?? 'bg-zinc-800 text-zinc-300 border-zinc-600';
    return <span className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{status}</span>;
}

// Never writes a CutoverCriterion directly — every submission is a Decision
// proposal, reviewed the same way an agent's proposal is (see /intelligence).
// foundation.md §0: "Every workflow entering a proving run carries a target
// criterion and a window, agreed at onboarding and held as graph state."
function ProposeCutoverCriterionForm({ people, onSubmitted }: { people: any[]; onSubmitted: () => void }) {
    const [proposedBy, setProposedBy] = useState('');
    const [workflowName, setWorkflowName] = useState('');
    const [criterionDescription, setCriterionDescription] = useState('');
    const [systemOfRecord, setSystemOfRecord] = useState<'legacy' | 'vyra'>('legacy');
    const [agreementRateTarget, setAgreementRateTarget] = useState('0.9');
    const [dueBy, setDueBy] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const submit = async () => {
        setSubmitting(true);
        setSubmitError(null);
        const input: ProposeCutoverCriterionInput = {
            proposedBy,
            workflowName,
            criterionDescription,
            systemOfRecord,
            agreementRateTarget: Number(agreementRateTarget),
            dueBy,
        };
        try {
            await onboarding.proposeCutoverCriterion(input);
            setSubmitted(true);
            onSubmitted();
        } catch (err: any) {
            setSubmitError(err.message || 'Proposal was rejected by the API');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 px-4 py-3 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <p className="text-sm text-emerald-200">
                    Proposal submitted — check <Link href="/intelligence" className="underline">Intelligence</Link> to approve.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-3">
            <p className="text-sm font-medium text-zinc-200">Propose a cutover criterion</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Proposed by</span>
                    <select value={proposedBy} onChange={e => setProposedBy(e.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 text-sm px-3 py-2">
                        <option value="">Select person…</option>
                        {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Workflow</span>
                    <input value={workflowName} onChange={e => setWorkflowName(e.target.value)} placeholder="e.g. 52-Week Calendar task completion" className="rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 text-sm px-3 py-2" />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Exit criterion</span>
                    <input value={criterionDescription} onChange={e => setCriterionDescription(e.target.value)} placeholder="e.g. ≥90% agreement with legacy tracker for 8 consecutive weeks" className="rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 text-sm px-3 py-2" />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">System of record today</span>
                    <select value={systemOfRecord} onChange={e => setSystemOfRecord(e.target.value as 'legacy' | 'vyra')} className="rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 text-sm px-3 py-2">
                        <option value="legacy">legacy</option>
                        <option value="vyra">vyra</option>
                    </select>
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Agreement rate target (0–1)</span>
                    <input type="number" min={0} max={1} step={0.01} value={agreementRateTarget} onChange={e => setAgreementRateTarget(e.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 text-sm px-3 py-2" />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Due by</span>
                    <input type="date" value={dueBy} onChange={e => setDueBy(e.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 text-sm px-3 py-2" />
                </label>
            </div>
            {submitError && <p className="text-xs text-red-400">{submitError}</p>}
            <div>
                <button
                    onClick={submit}
                    disabled={submitting || !proposedBy || !workflowName || !criterionDescription || !dueBy}
                    className="text-xs px-4 py-2 rounded-md bg-sky-500 text-zinc-950 font-medium hover:bg-sky-400 transition-colors disabled:opacity-50"
                >
                    {submitting ? 'Submitting…' : 'Submit proposal'}
                </button>
            </div>
        </div>
    );
}

function CutoverCriterionCard({ criterion }: { criterion: any }) {
    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-mono text-zinc-500">{criterion.id}</p>
                <StatusPill status={criterion.effectiveStatus} />
            </div>
            <p className="text-sm text-zinc-200 font-medium">{criterion.workflowName}</p>
            <p className="text-xs text-zinc-400">{criterion.criterionDescription}</p>
            <PropRow label="systemOfRecord" value={criterion.systemOfRecord} />
            <PropRow label="agreementRateTarget" value={criterion.agreementRateTarget} />
            <PropRow label="dueBy" value={criterion.dueBy} />
            <PropRow label="enteredProvingAt" value={criterion.enteredProvingAt} />
        </div>
    );
}

export function OnboardingView() {
    const [criteria, setCriteria] = useState<any[]>([]);
    const [people, setPeople] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        Promise.all([onboarding.cutoverCriteria(), operational.people()])
            .then(([c, p]) => {
                setCriteria(c.cutoverCriteria ?? []);
                setPeople(p.people ?? []);
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
                    <span className="text-sm">Loading cutover tracking…</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full bg-zinc-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <span className="text-sm text-zinc-500">Could not load cutover tracking</span>
                    <button onClick={load} className="text-xs text-zinc-400 underline">Retry</button>
                </div>
            </div>
        );
    }

    const overdueCount = criteria.filter(c => c.effectiveStatus === 'cutover-overdue').length;

    return (
        <div className="h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">

            <PageHeader icon={GitPullRequestArrow} iconClassName="text-sky-400" title="Onboarding" subtitle="Cutover Tracking">
                <button
                    onClick={() => setShowForm(s => !s)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-sky-500 text-zinc-950 font-medium hover:bg-sky-400 transition-colors"
                >
                    <Plus size={13} /> Propose criterion
                </button>
                <button onClick={load} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Refresh">
                    <RefreshCw size={14} className="text-zinc-500" />
                </button>
            </PageHeader>

            {/* ── Content ── */}
            <div className="flex-1 min-h-0 overflow-auto px-6 py-4 flex flex-col gap-3">
                {showForm && <ProposeCutoverCriterionForm people={people} onSubmitted={load} />}

                <div className="flex items-center gap-2">
                    <Clock size={11} className="text-zinc-600" />
                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                        {criteria.length} {criteria.length === 1 ? 'workflow' : 'workflows'} in transition · {overdueCount} cutover-overdue
                    </p>
                </div>

                {criteria.length === 0 ? (
                    <p className="text-sm text-zinc-500 italic">
                        No workflow has a cutover criterion yet — every workflow entering a proving run should get one at onboarding (foundation.md §0).
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {criteria.map(c => <CutoverCriterionCard key={c.id} criterion={c} />)}
                    </div>
                )}
            </div>

            {/* ── Footer ── */}
            <footer className="border-t border-zinc-800/60 px-6 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-sky-500 flex items-center justify-center">
                        <GitPullRequestArrow size={9} className="text-zinc-950" />
                    </div>
                    <span className="text-[10px] text-zinc-600">Vyra Platform v1</span>
                </div>
                <p className="text-[10px] text-zinc-700">Compliance. Handled.</p>
            </footer>
        </div>
    );
}
