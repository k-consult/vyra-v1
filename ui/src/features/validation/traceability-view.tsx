'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import { operational, intelligence } from '@/lib/api';
import { NodeList, CoverageSummary } from './display';

// ── State types ────────────────────────────────────────────────────────────────

type Incident   = { id: string; name: string };
type LayerStatus = 'full' | 'partial' | 'missing';

type TraceData = {
    layers: {
        l1: { status: LayerStatus; incident: Record<string, any> };
        l2: { status: LayerStatus; findings: any[]; risks: any[] };
        l3: { status: LayerStatus; controls: any[]; assets: any[]; vendors: any[] };
        l4: { status: LayerStatus; rcas: any[]; capas: any[]; note: string };
        l5: { status: LayerStatus; regulations: any[]; note: string };
    };
};

// ── Layer count labels ─────────────────────────────────────────────────────────

const layerCountLabel = (key: string, d: TraceData): string => {
    const l = d.layers;
    const pl = (n: number, word: string) => `${n} ${word}${n !== 1 ? 's' : ''}`;
    switch (key) {
        case 'l1': return l.l1.incident ? '1 incident' : '';
        case 'l2': return [pl(l.l2.findings.length, 'finding'), pl(l.l2.risks.length, 'risk')].join(' · ');
        case 'l3': return [pl(l.l3.controls.length, 'control'), pl(l.l3.assets.length, 'asset'), pl(l.l3.vendors.length, 'vendor')].join(' · ');
        case 'l4': return [pl(l.l4.rcas.length, 'RCA'), pl(l.l4.capas.length, 'CAPA')].join(' · ');
        case 'l5': return pl(l.l5.regulations.length, 'regulation');
        default:   return '';
    }
};

// ── Layer definitions ──────────────────────────────────────────────────────────

const LAYERS = [
    { key: 'l1' as const, n: 'L1', label: 'INCIDENT' },
    { key: 'l2' as const, n: 'L2', label: 'RISK & HAZARD' },
    { key: 'l3' as const, n: 'L3', label: 'CONTROL & ASSET' },
    { key: 'l4' as const, n: 'L4', label: 'OBLIGATION' },
    { key: 'l5' as const, n: 'L5', label: 'SOURCE DOCUMENT' },
];

// ── Presentation primitives ────────────────────────────────────────────────────

function StatusDot({ status }: { status: LayerStatus }) {
    if (status === 'full') {
        return (
            <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
                <circle cx="7" cy="7" r="6" fill="#34d399" />
            </svg>
        );
    }
    if (status === 'partial') {
        return (
            <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
                <circle cx="7" cy="7" r="6" stroke="#fbbf24" strokeWidth="1.5" fill="none" />
                <path d="M 7 1 A 6 6 0 0 1 7 13 Z" fill="#fbbf24" />
            </svg>
        );
    }
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
            <circle cx="7" cy="7" r="6" stroke="#f87171" strokeWidth="1.5" fill="none" />
        </svg>
    );
}

const STATUS_LABEL: Record<LayerStatus, { text: string; cls: string }> = {
    full:    { text: 'FOUND',   cls: 'text-emerald-400' },
    partial: { text: 'PARTIAL', cls: 'text-amber-400'   },
    missing: { text: 'MISSING', cls: 'text-red-400'     },
};

function GapWarning({ note }: { note: string }) {
    return (
        <div className="flex items-start gap-2 rounded-md bg-amber-950 border border-amber-800 px-3 py-2 mb-4">
            <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <span className="text-xs text-amber-300">{note}</span>
        </div>
    );
}

function LayerRow({
    n,
    label,
    status,
    countLabel,
    expanded,
    onToggle,
    children,
}: {
    n: string;
    label: string;
    status: LayerStatus;
    countLabel: string;
    expanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    const sl = STATUS_LABEL[status];
    return (
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-900 hover:bg-zinc-800 transition-colors text-left"
            >
                <span className="text-xs font-mono font-semibold text-zinc-500 w-6 shrink-0">{n}</span>
                <span className="text-sm font-semibold text-zinc-200 w-36 shrink-0">{label}</span>
                {countLabel && (
                    <span className="text-xs text-zinc-500 shrink-0">{countLabel}</span>
                )}
                <div className="flex-1 h-px bg-zinc-700 mx-2" />
                <div className="flex items-center gap-2 shrink-0">
                    <StatusDot status={status} />
                    <span className={`text-xs font-semibold ${sl.cls}`}>{sl.text}</span>
                </div>
                <ChevronDown
                    size={14}
                    className={`text-zinc-500 ml-2 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
            </button>
            {expanded && (
                <div className="px-4 py-4 bg-zinc-950 border-t border-zinc-800">
                    {children}
                </div>
            )}
        </div>
    );
}

// ── Layer content ──────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="mb-5 last:mb-0">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">{label}</h3>
            {children}
        </div>
    );
}

function L1Content({ layer }: { layer: TraceData['layers']['l1'] }) {
    return (
        <Section label="Incident">
            <NodeList nodes={layer.incident ? [layer.incident] : []} emptyLabel="No incident data" />
        </Section>
    );
}

function L2Content({ layer }: { layer: TraceData['layers']['l2'] }) {
    return (
        <>
            <Section label="Findings">
                <NodeList nodes={layer.findings} emptyLabel="No findings linked" />
            </Section>
            <Section label="Risks">
                <NodeList nodes={layer.risks} emptyLabel="No risk nodes linked" />
            </Section>
        </>
    );
}

function L3Content({ layer }: { layer: TraceData['layers']['l3'] }) {
    return (
        <>
            <Section label="Controls">
                <NodeList nodes={layer.controls} emptyLabel="No controls linked" />
            </Section>
            <Section label="Assets">
                <NodeList nodes={layer.assets} emptyLabel="No assets linked" />
            </Section>
            <Section label="Vendors">
                <NodeList nodes={layer.vendors} emptyLabel="No vendors linked" />
            </Section>
        </>
    );
}

function L4Content({ layer }: { layer: TraceData['layers']['l4'] }) {
    return (
        <>
            {layer.note && <GapWarning note={layer.note} />}
            <Section label="Root Cause Analysis">
                <NodeList nodes={layer.rcas} emptyLabel="No RCA nodes found" />
            </Section>
            <Section label="Corrective Actions (CAPA)">
                <NodeList nodes={layer.capas} emptyLabel="No CAPA nodes found" />
            </Section>
        </>
    );
}

function L5Content({ layer }: { layer: TraceData['layers']['l5'] }) {
    return (
        <>
            {layer.note && <GapWarning note={layer.note} />}
            <Section label="Governing Regulations">
                <NodeList nodes={layer.regulations} emptyLabel="No regulations linked" />
            </Section>
        </>
    );
}

// ── Orchestration ──────────────────────────────────────────────────────────────

const ALL_KEYS = ['l1', 'l2', 'l3', 'l4', 'l5'] as const;

export function TraceabilityView() {
    const [incidents, setIncidents]   = useState<Incident[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [data, setData]             = useState<TraceData | null>(null);
    const [loading, setLoading]       = useState(false);
    const [expanded, setExpanded]     = useState<Record<string, boolean>>(
        Object.fromEntries(ALL_KEYS.map((k) => [k, true]))
    );

    useEffect(() => {
        operational.incidents().then(({ incidents }) => {
            setIncidents(incidents ?? []);
            if (incidents?.length > 0) setSelectedId(incidents[0].id);
        });
    }, []);

    useEffect(() => {
        if (!selectedId) return;
        setLoading(true);
        setData(null);
        intelligence.reverseTrace(selectedId)
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [selectedId]);

    const toggle = (key: string) =>
        setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

    return (
        <div className="flex flex-col gap-6">
            {/* Selector */}
            <div className="flex items-center gap-3">
                <label className="text-sm text-zinc-400 shrink-0">Incident</label>
                <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                >
                    {incidents.length === 0 && <option value="">Loading…</option>}
                    {incidents.map((inc) => (
                        <option key={inc.id} value={inc.id}>
                            {inc.id} — {inc.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Coverage summary */}
            {data && (() => {
                const counts = LAYERS.reduce(
                    (acc, { key }) => { acc[data.layers[key].status]++; acc.total++; return acc; },
                    { full: 0, partial: 0, missing: 0, total: 0 }
                );
                return <CoverageSummary counts={counts} unit="layers" />;
            })()}

            {/* Layers */}
            {loading && <p className="text-sm text-zinc-500">Loading trace…</p>}
            {!loading && !data && selectedId && (
                <p className="text-sm text-red-400">Could not load trace for {selectedId}</p>
            )}
            {!loading && data && (
                <div className="flex flex-col gap-3">
                    {LAYERS.map(({ key, n, label }) => {
                        const layer = data.layers[key];
                        return (
                            <LayerRow
                                key={key}
                                n={n}
                                label={label}
                                status={layer.status}
                                countLabel={layerCountLabel(key, data)}
                                expanded={expanded[key]}
                                onToggle={() => toggle(key)}
                            >
                                {key === 'l1' && <L1Content layer={data.layers.l1} />}
                                {key === 'l2' && <L2Content layer={data.layers.l2} />}
                                {key === 'l3' && <L3Content layer={data.layers.l3} />}
                                {key === 'l4' && <L4Content layer={data.layers.l4} />}
                                {key === 'l5' && <L5Content layer={data.layers.l5} />}
                            </LayerRow>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
