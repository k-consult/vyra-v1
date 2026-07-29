'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    AlertTriangle, RefreshCw, ShieldCheck, ArrowLeft,
    Gauge, TrendingUp, FileText, Lock,
} from 'lucide-react';
import { assurance, CoverageScore, RiskRollup } from '@/lib/api';
import { PropRow } from '@/features/landscape/landscape';

// ── Config ─────────────────────────────────────────────────────────────────────

const RATING_TILE: Record<string, { border: string; bg: string; text: string }> = {
    Critical: { border: 'border-red-700',     bg: 'bg-red-950/50',     text: 'text-red-300'     },
    High:     { border: 'border-orange-700',  bg: 'bg-orange-950/50',  text: 'text-orange-300'  },
    Medium:   { border: 'border-amber-700',   bg: 'bg-amber-950/50',   text: 'text-amber-300'   },
    Low:      { border: 'border-emerald-700', bg: 'bg-emerald-950/50', text: 'text-emerald-300' },
};
const DEFAULT_TILE = { border: 'border-zinc-700', bg: 'bg-zinc-900/50', text: 'text-zinc-300' };

// ── Coverage Score ─────────────────────────────────────────────────────────────

function CoverageStat({ label, total, covered, coveragePercent }: {
    label: string; total: number; covered: number; coveragePercent: number;
}) {
    const healthy = coveragePercent >= 90;
    return (
        <div className={`rounded-xl border ${healthy ? 'border-emerald-800' : 'border-amber-800'} bg-zinc-900 px-5 py-4 flex-1 min-w-[180px]`}>
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${healthy ? 'text-emerald-300' : 'text-amber-300'}`}>{coveragePercent}%</p>
            <p className="text-xs text-zinc-500 mt-1">{covered} of {total} covered</p>
        </div>
    );
}

function CoverageSection({ data }: { data: CoverageScore }) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <Gauge size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Coverage Score</p>
                <p className="text-[10px] text-zinc-700" title={data.scope}>· {data.scope}</p>
            </div>

            <div className="flex gap-3 flex-wrap">
                <CoverageStat label="Requirement Coverage" {...data.requirements} />
                <CoverageStat label="Asset Coverage" {...data.assets} />
                {data.assets.unmappedComplianceArea > 0 && (
                    <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 px-5 py-4 flex-1 min-w-[180px]">
                        <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Unmapped Compliance Area</p>
                        <p className="text-3xl font-bold mt-1 text-zinc-300">{data.assets.unmappedComplianceArea}</p>
                        <p className="text-xs text-zinc-600 mt-1">assets with no compliance-area mapping — a known, documented gap, not a scoring failure</p>
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-zinc-900/60 text-zinc-500">
                            <th className="text-left font-medium px-4 py-2">Compliance Area</th>
                            <th className="text-right font-medium px-4 py-2">Controls</th>
                            <th className="text-right font-medium px-4 py-2">Requirements Covered</th>
                            <th className="text-right font-medium px-4 py-2">Assets</th>
                            <th className="text-right font-medium px-4 py-2">Covered Assets</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.byComplianceArea.map((row, i) => (
                            <tr key={row.complianceAreaId} className={i % 2 === 0 ? 'bg-zinc-950' : 'bg-zinc-900/20'}>
                                <td className="px-4 py-1.5 text-zinc-300">{row.complianceAreaName}</td>
                                <td className="px-4 py-1.5 text-right text-zinc-400 tabular-nums">{row.controls}</td>
                                <td className="px-4 py-1.5 text-right text-zinc-400 tabular-nums">{row.requirementsCovered}</td>
                                <td className="px-4 py-1.5 text-right text-zinc-400 tabular-nums">{row.assets}</td>
                                <td className="px-4 py-1.5 text-right text-zinc-400 tabular-nums">{row.coveredAssets}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

// ── Risk Rollup ────────────────────────────────────────────────────────────────

function RiskRollupSection({ data }: { data: RiskRollup }) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <TrendingUp size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Risk Rollup</p>
            </div>
            <div className="flex gap-3 flex-wrap">
                {data.byRating.map(({ rating, count, avgScore }) => {
                    const t = RATING_TILE[rating] ?? DEFAULT_TILE;
                    return (
                        <div key={rating} className={`rounded-xl border ${t.border} ${t.bg} px-5 py-4 flex-1 min-w-[140px]`}>
                            <p className={`text-[11px] font-bold tracking-widest ${t.text}`}>{rating.toUpperCase()}</p>
                            <p className="text-3xl font-bold mt-1 text-zinc-100">{count}</p>
                            <p className="text-xs text-zinc-500 mt-1">avg residual score {avgScore}</p>
                        </div>
                    );
                })}
                <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 px-5 py-4 flex-1 min-w-[140px]">
                    <p className="text-[11px] font-bold tracking-widest text-zinc-400">OVERALL</p>
                    <p className="text-3xl font-bold mt-1 text-zinc-100">{data.totalRisks}</p>
                    <p className="text-xs text-zinc-500 mt-1">avg residual score {data.avgResidualScore}</p>
                </div>
            </div>
        </section>
    );
}

// ── Evidence ───────────────────────────────────────────────────────────────────

function EvidenceSection({ items }: { items: any[] }) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <FileText size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Evidence · {items.length} artifacts</p>
            </div>
            <div className="max-h-[420px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((item, i) => (
                    <div key={item?.id ?? i} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
                        {item?.id && <p className="text-[11px] font-mono text-zinc-500 mb-2">{item.id}</p>}
                        {Object.entries(item ?? {})
                            .filter(([, v]) => v != null && v !== '')
                            .map(([k, v]) => <PropRow key={k} label={k} value={v} />)}
                    </div>
                ))}
            </div>
        </section>
    );
}

// ── Attestations (blocked) ────────────────────────────────────────────────────

function AttestationsSection() {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <Lock size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Attestations</p>
            </div>
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 px-5 py-4">
                <p className="text-sm text-zinc-400">Not yet available</p>
                <p className="text-xs text-zinc-600 mt-1">
                    Blocked on Phase 4b — the Assurance graph (<code className="text-zinc-500">Audit</code>, <code className="text-zinc-500">AssuranceStatement</code>,{' '}
                    <code className="text-zinc-500">Attestation</code>, <code className="text-zinc-500">EvidencePackage</code>) has no seed data yet.
                    See <code className="text-zinc-500">vyra-implementation-plan.md</code>.
                </p>
            </div>
        </section>
    );
}

// ── Main view ──────────────────────────────────────────────────────────────────

export function AssuranceView() {
    const [coverage, setCoverage]   = useState<CoverageScore | null>(null);
    const [riskRollup, setRiskRollup] = useState<RiskRollup | null>(null);
    const [evidence, setEvidence]   = useState<any[]>([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        Promise.all([assurance.posture(), assurance.evidence()])
            .then(([posture, evd]) => {
                setCoverage(posture.coverage);
                setRiskRollup(posture.riskRollup);
                setEvidence(evd.evidence ?? []);
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
                    <span className="text-sm">Loading assurance posture…</span>
                </div>
            </div>
        );
    }

    if (error || !coverage || !riskRollup) {
        return (
            <div className="h-screen bg-zinc-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <span className="text-sm text-zinc-500">Could not load assurance data</span>
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
                        <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
                            <ShieldCheck size={18} className="text-zinc-950" />
                        </div>
                        <div>
                            <p className="text-base font-semibold leading-tight">VYRA</p>
                            <p className="text-xs text-zinc-500 leading-tight">Assurance &amp; Coverage</p>
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
                <CoverageSection data={coverage} />
                <RiskRollupSection data={riskRollup} />
                <EvidenceSection items={evidence} />
                <AttestationsSection />
            </div>

            {/* ── Footer ── */}
            <footer className="border-t border-zinc-800/60 px-6 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-emerald-500 flex items-center justify-center">
                        <ShieldCheck size={9} className="text-zinc-950" />
                    </div>
                    <span className="text-[10px] text-zinc-600">Vyra Platform v1</span>
                </div>
                <p className="text-[10px] text-zinc-700">Compliance. Handled.</p>
            </footer>
        </div>
    );
}
