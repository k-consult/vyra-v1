'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, TrendingUp, FlaskConical } from 'lucide-react';
import { intelligence } from '@/lib/api';
import { PropRow } from '@/features/landscape/landscape';
import { PageHeader } from '@/components/page-header';

// ── Residual Risk Score ──────────────────────────────────────────────────────────
// Relocated from intelligence.tsx's Risks tab — same data, persona-framed under
// Risk Manager (L7) rather than buried in the Decision Gate.

function ResidualRiskScorePanel({ items }: { items: any[] }) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <TrendingUp size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Residual Risk Score</p>
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

// ── Scenario Simulation (not yet built) ──────────────────────────────────────────

function ScenarioSimulationStub() {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <FlaskConical size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Scenario Simulation</p>
            </div>
            <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-3">
                <p className="text-xs text-zinc-500">
                    Not yet built — &quot;what happens if this control fails&quot; reasoning across risk, control, and
                    signal intelligence doesn&apos;t exist yet (Gap #7). <Link href="/simulator" className="underline hover:text-zinc-300">/simulator</Link> is
                    a different, test-data generation tool, not this.
                </p>
            </div>
        </section>
    );
}

// ── Main view ──────────────────────────────────────────────────────────────────

export function RiskManagerView() {
    const [risks, setRisks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        intelligence.risks()
            .then((r: any) => setRisks(r.risks ?? []))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    if (loading) {
        return (
            <div className="h-full bg-zinc-950 flex items-center justify-center">
                <div className="flex items-center gap-3 text-zinc-500">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-sm">Loading risk data…</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full bg-zinc-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <span className="text-sm text-zinc-500">Could not load Risk Manager data</span>
                    <button onClick={load} className="text-xs text-zinc-400 underline">Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">

            <PageHeader icon={TrendingUp} iconClassName="text-orange-400" title="Risk Manager" subtitle="Residual Risk Score & Scenario Simulation">
                <button onClick={load} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Refresh">
                    <RefreshCw size={14} className="text-zinc-500" />
                </button>
            </PageHeader>

            {/* ── Content ── */}
            <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
                <div className="flex flex-col gap-6">
                    <ResidualRiskScorePanel items={risks} />
                    <ScenarioSimulationStub />
                </div>
            </div>

            {/* ── Footer ── */}
            <footer className="border-t border-zinc-800/60 px-6 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-orange-500 flex items-center justify-center">
                        <TrendingUp size={9} className="text-zinc-950" />
                    </div>
                    <span className="text-[10px] text-zinc-600">Vyra Platform v1</span>
                </div>
                <p className="text-[10px] text-zinc-700">Compliance. Handled.</p>
            </footer>
        </div>
    );
}
