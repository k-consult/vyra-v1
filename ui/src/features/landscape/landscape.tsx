'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
    AlertTriangle, BookOpen, Building2, Package, Server,
    Shield, ListChecks, FileText, TrendingUp, Search,
    GitBranch, Wrench, CheckCircle2, ArrowRight,
    RefreshCw, ShieldCheck, Activity, Scale, X, ChevronRight,
    Radio, Layers, Users, UserCog,
} from 'lucide-react';
import { dashboard, knowledge, operational, assurance, intelligence, execution, catalog, enterprise } from '@/lib/api';
import { formatValue } from '@/features/validation/display';

// ── Types ──────────────────────────────────────────────────────────────────────

type Posture = 'critical' | 'at-risk' | 'controlled' | 'healthy';

type LandscapeData = {
    incidents:     { total: number; critical: number; open: number };
    regulations:   { total: number };
    facilities:    { total: number };
    assets:        { total: number };
    vendors:       { total: number };
    controls:      { total: number };
    tasks:         { total: number; open: number; closed: number };
    evidence:      { total: number };
    risks:         { total: number; critical: number; high: number };
    findings:      { total: number; critical: number; open: number };
    rcas:          { total: number };
    decisions:     { total: number };
    capas:         { total: number; open: number };
    verifications: { total: number };
    organizations:   { total: number };
    roles:           { total: number };
    complianceAreas: { total: number };
    signals:         { total: number };
    posture:       Posture;
    updatedAt:     string;
};

type DrillKey =
    | 'incidents' | 'regulations' | 'facilities' | 'assets' | 'vendors'
    | 'controls' | 'tasks' | 'evidence' | 'risks' | 'findings'
    | 'rcas' | 'decisions' | 'capas' | 'verifications'
    | 'organizations' | 'roles' | 'complianceAreas' | 'signals';

type Health = 'critical' | 'warn' | 'ok' | 'neutral';

// ── Drill fetch helpers ────────────────────────────────────────────────────────

const extractList = (wrapper: any, outerKey: string, innerKey?: string): any[] => {
    const raw = wrapper?.[outerKey];
    if (raw == null) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return innerKey ? arr.map((x: any) => x[innerKey] ?? x).filter(Boolean) : arr.filter(Boolean);
};

const DRILL_FETCHERS: Record<DrillKey, () => Promise<any[]>> = {
    incidents:     () => operational.incidents().then(r => extractList(r, 'incidents')),
    regulations:   () => knowledge.regulations().then(r => extractList(r, 'regulations')),
    facilities:    () => operational.facilities().then(r => extractList(r, 'facilities')),
    assets:        () => operational.assets().then(r => extractList(r, 'assets', 'asset')),
    vendors:       () => operational.vendors().then(r => extractList(r, 'vendors')),
    controls:      () => knowledge.controls().then(r => extractList(r, 'controls')),
    tasks:         () => execution.tasks().then(r => extractList(r, 'tasks', 'task')),
    evidence:      () => assurance.evidence().then(r => extractList(r, 'evidence')),
    risks:         () => intelligence.risks().then(r => extractList(r, 'risks', 'risk')),
    findings:      () => intelligence.findings().then(r => extractList(r, 'findings', 'finding')),
    rcas:          () => intelligence.rcas().then(r => extractList(r, 'rcas')),
    decisions:     () => intelligence.decisions().then(r => extractList(r, 'decisions', 'decision')),
    capas:         () => execution.capas().then(r => extractList(r, 'capas')),
    verifications: () => execution.verifications().then(r => extractList(r, 'verifications')),
    organizations:   () => enterprise.organizations().then(r => extractList(r, 'organizations')),
    roles:           () => enterprise.roles().then(r => extractList(r, 'roles')),
    complianceAreas: () => catalog.complianceAreas().then(r => extractList(r, 'complianceAreas')),
    signals:         () => operational.signals().then(r => extractList(r, 'signals', 'signal')),
};

// ── Config ─────────────────────────────────────────────────────────────────────

const POSTURE_CFG: Record<Posture, { label: string; sub: string; border: string; bg: string; text: string; dot: string }> = {
    critical:   { label: 'CRITICAL',   sub: 'Immediate attention required',       border: 'border-red-700',     bg: 'bg-red-950/50',     text: 'text-red-300',     dot: 'bg-red-400'     },
    'at-risk':  { label: 'AT RISK',    sub: 'Elevated risk — action needed',      border: 'border-amber-700',   bg: 'bg-amber-950/50',   text: 'text-amber-300',   dot: 'bg-amber-400'   },
    controlled: { label: 'CONTROLLED', sub: 'Managed — monitor open items',       border: 'border-sky-700',     bg: 'bg-sky-950/50',     text: 'text-sky-300',     dot: 'bg-sky-400'     },
    healthy:    { label: 'HEALTHY',    sub: 'All controls operating effectively', border: 'border-emerald-700', bg: 'bg-emerald-950/50', text: 'text-emerald-300', dot: 'bg-emerald-400' },
};

const HEALTH_STYLE: Record<Health, { border: string; count: string; hover: string }> = {
    critical: { border: 'border-red-800',     count: 'text-red-300',     hover: 'hover:border-red-600'     },
    warn:     { border: 'border-amber-800',   count: 'text-amber-300',   hover: 'hover:border-amber-600'   },
    ok:       { border: 'border-emerald-800', count: 'text-emerald-300', hover: 'hover:border-emerald-600' },
    neutral:  { border: 'border-zinc-700',    count: 'text-zinc-200',    hover: 'hover:border-zinc-500'    },
};

export const BADGE_COLORS: Record<string, string> = {
    Critical: 'bg-red-900 text-red-300 border-red-700',
    High:     'bg-orange-900 text-orange-300 border-orange-700',
    Medium:   'bg-amber-900 text-amber-300 border-amber-700',
    Low:      'bg-emerald-900 text-emerald-300 border-emerald-700',
    closed:   'bg-emerald-900 text-emerald-300 border-emerald-700',
    open:     'bg-zinc-800 text-zinc-300 border-zinc-600',
    collected:'bg-sky-900 text-sky-300 border-sky-700',
    active:   'bg-sky-900 text-sky-300 border-sky-700',
    inactive: 'bg-zinc-800 text-zinc-400 border-zinc-600',
    'under-review': 'bg-amber-900 text-amber-300 border-amber-700',
};

const BADGE_FIELDS = new Set(['status', 'riskRating', 'severity', 'priority', 'inherentRating', 'residualRating', 'riskTier']);

// ── Shared display ─────────────────────────────────────────────────────────────

export function PropRow({ label, value }: { label: string; value: any }) {
    const formatted = formatValue(value);
    if (!formatted) return null;
    const isBadge = BADGE_FIELDS.has(label) && !!BADGE_COLORS[formatted];
    return (
        <div className="flex gap-3 py-1 border-b border-zinc-800/60 items-center">
            <span className="text-zinc-500 min-w-[120px] shrink-0 text-xs">{label}</span>
            {isBadge
                ? <span className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium ${BADGE_COLORS[formatted]}`}>{formatted}</span>
                : <span className="text-zinc-300 text-xs break-words">{formatted}</span>}
        </div>
    );
}

// ── Node card ─────────────────────────────────────────────────────────────────

function NodeCard({
    icon: Icon, label, count, sub, health = 'neutral', drillKey, onDrill,
}: {
    icon: React.ElementType;
    label: string;
    count: number;
    sub?: string;
    health?: Health;
    drillKey: DrillKey;
    onDrill: (key: DrillKey, label: string) => void;
}) {
    const h = HEALTH_STYLE[health];
    return (
        <button
            onClick={() => onDrill(drillKey, label)}
            className={`w-[108px] h-[108px] flex flex-col justify-between rounded-xl border ${h.border} ${h.hover} bg-zinc-900 px-3 py-2.5 text-left transition-colors cursor-pointer shrink-0`}
        >
            <div className="flex items-center justify-between">
                <Icon size={13} className="text-zinc-500" />
                <ChevronRight size={10} className="text-zinc-700" />
            </div>
            <div>
                <p className={`text-xl font-bold leading-none ${h.count}`}>{count}</p>
                <p className="text-[11px] text-zinc-400 mt-1 leading-tight">{label}</p>
                {sub && <p className="text-[10px] text-zinc-600 leading-tight">{sub}</p>}
            </div>
        </button>
    );
}

function RowArrow() {
    return <ArrowRight size={13} className="text-zinc-700 shrink-0 self-center" />;
}

// ── Layer row ─────────────────────────────────────────────────────────────────

function LayerRow({ n, label, desc, children }: {
    n: string;
    label: string;
    desc: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
            <div className="w-24 shrink-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-zinc-600">{n}</span>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</span>
                </div>
                <p className="text-[10px] text-zinc-600 mt-0.5 leading-tight">{desc}</p>
            </div>
            <div className="w-px h-12 bg-zinc-800 shrink-0" />
            <div className="flex items-center gap-2 flex-1 min-w-0">
                {children}
            </div>
        </div>
    );
}

// ── Drill drawer ───────────────────────────────────────────────────────────────

export function DrillDrawer({ title, items, loading, onClose }: {
    title: string; items: any[]; loading: boolean; onClose: () => void;
}) {
    return (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-zinc-950 border-l border-zinc-800 flex flex-col shadow-2xl z-50">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
                <div>
                    <p className="text-sm font-semibold text-zinc-100">{title}</p>
                    {!loading && <p className="text-xs text-zinc-500 mt-0.5">{items.length} record{items.length !== 1 ? 's' : ''}</p>}
                </div>
                <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors">
                    <X size={14} className="text-zinc-400" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
                {loading && (
                    <div className="flex items-center gap-2 text-zinc-500 text-sm">
                        <RefreshCw size={13} className="animate-spin" /> Loading…
                    </div>
                )}
                {!loading && items.length === 0 && <p className="text-sm text-zinc-500 italic">No records found</p>}
                {!loading && items.length > 0 && (
                    <div className="flex flex-col gap-3">
                        {items.map((item, i) => (
                            <div key={item?.id ?? i} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
                                {item?.id && <p className="text-[11px] font-mono text-zinc-500 mb-2">{item.id}</p>}
                                {Object.entries(item ?? {})
                                    .filter(([, v]) => v != null && v !== '')
                                    .map(([k, v]) => <PropRow key={k} label={k} value={v} />)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main view ──────────────────────────────────────────────────────────────────

export function LandscapeView() {
    const [data, setData]             = useState<LandscapeData | null>(null);
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState(false);
    const [drill, setDrill]           = useState<{ key: DrillKey; label: string } | null>(null);
    const [drillItems, setDrillItems] = useState<any[]>([]);
    const [drillLoading, setDrillLoading] = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        dashboard.landscape()
            .then(setData)
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const openDrill = useCallback((key: DrillKey, label: string) => {
        setDrill({ key, label });
        setDrillItems([]);
        setDrillLoading(true);
        DRILL_FETCHERS[key]()
            .then(setDrillItems)
            .catch(() => setDrillItems([]))
            .finally(() => setDrillLoading(false));
    }, []);

    const closeDrill = useCallback(() => setDrill(null), []);

    if (loading) {
        return (
            <div className="h-screen bg-zinc-950 flex items-center justify-center">
                <div className="flex items-center gap-3 text-zinc-500">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-sm">Loading compliance landscape…</span>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="h-screen bg-zinc-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <span className="text-sm text-zinc-500">Could not load landscape data</span>
                    <button onClick={load} className="text-xs text-zinc-400 underline">Retry</button>
                </div>
            </div>
        );
    }

    const p = POSTURE_CFG[data.posture];

    const nc = (key: DrillKey, icon: React.ElementType, label: string, count: number, opts?: { sub?: string; health?: Health }) => (
        <NodeCard key={key} icon={icon} label={label} count={count}
            sub={opts?.sub} health={opts?.health} drillKey={key} onDrill={openDrill} />
    );

    const metrics = [
        { label: 'Incidents',  value: data.incidents.total,  accent: data.incidents.open > 0    ? 'text-sky-400'   : 'text-zinc-100' },
        { label: 'Risks',      value: data.risks.total,      accent: data.risks.critical > 0    ? 'text-red-400'   : data.risks.high > 0 ? 'text-amber-400' : 'text-zinc-100' },
        { label: 'Findings',   value: data.findings.total,   accent: data.findings.critical > 0 ? 'text-red-400'   : data.findings.open > 0 ? 'text-amber-400' : 'text-zinc-100' },
        { label: 'Open CAPAs', value: data.capas.open,       accent: data.capas.open > 0        ? 'text-amber-400' : 'text-emerald-400' },
        { label: 'Controls',   value: data.controls.total,   accent: 'text-zinc-100' },
        { label: 'Tasks Open', value: data.tasks.open,       accent: data.tasks.open > 0        ? 'text-amber-400' : 'text-emerald-400' },
    ];

    const criticalItems = [
        { dot: 'bg-red-500',   count: data.risks.critical,    label: 'critical risks'    },
        { dot: 'bg-red-500',   count: data.findings.critical, label: 'critical findings' },
        { dot: 'bg-amber-500', count: data.capas.open,        label: 'open CAPAs'        },
        { dot: 'bg-sky-500',   count: data.incidents.open,    label: 'open incidents'    },
    ];

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
                            <p className="text-xs text-zinc-500 leading-tight">Compliance Handled.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-5">
                        <div className="hidden sm:flex items-center gap-1.5 text-sm text-zinc-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Live · {new Date(data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <button onClick={load} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Refresh">
                            <RefreshCw size={14} className="text-zinc-500" />
                        </button>
                        <nav className="hidden md:flex items-center gap-5 text-sm text-zinc-400">
                            <Link href="/validation/lifecycle"    className="hover:text-zinc-100 transition-colors">Lifecycle</Link>
                            <Link href="/validation/traceability" className="hover:text-zinc-100 transition-colors">Traceability</Link>
                            <Link href="/calendar"                className="hover:text-zinc-100 transition-colors">Calendar</Link>
                            <Link href="/assurance"               className="hover:text-zinc-100 transition-colors">Assurance</Link>
                            <Link href="/intelligence"             className="hover:text-zinc-100 transition-colors">Intelligence</Link>
                            <Link href="/enterprise/contracts"     className="hover:text-zinc-100 transition-colors">Contracts</Link>
                            <Link href="/simulator"                className="hover:text-zinc-100 transition-colors">Simulator</Link>
                        </nav>
                    </div>
                </div>
            </header>

            {/* ── Info band: posture + metrics ── */}
            <div className="border-b border-zinc-800/60 shrink-0">
            <div className="flex gap-4 px-6 py-5">
                <div className={`rounded-xl border ${p.border} ${p.bg} px-5 py-4 flex flex-col gap-2.5 w-56 shrink-0`}>
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${p.dot} animate-pulse shrink-0`} />
                        <span className={`text-xs font-bold tracking-widest ${p.text}`}>{p.label}</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-tight">{p.sub}</p>
                    <div className="flex flex-col gap-1.5">
                        {criticalItems.map(({ dot, count, label }) => (
                            <div key={label} className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${count > 0 ? dot : 'bg-zinc-700'}`} />
                                <span className={`text-sm font-semibold tabular-nums ${count > 0 ? 'text-zinc-200' : 'text-zinc-600'}`}>{count}</span>
                                <span className={`text-xs ${count > 0 ? 'text-zinc-400' : 'text-zinc-700'}`}>{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex-1 grid grid-cols-6 rounded-xl border border-zinc-800 overflow-hidden">
                    {metrics.map(({ label, value, accent }, i) => (
                        <div key={label} className={`flex flex-col items-center justify-center py-5 ${i < metrics.length - 1 ? 'border-r border-zinc-800/60' : ''}`}>
                            <p className={`text-3xl font-bold ${accent}`}>{value}</p>
                            <p className="text-[11px] text-zinc-500 mt-1 uppercase tracking-wider text-center leading-tight">{label}</p>
                        </div>
                    ))}
                </div>
            </div>
            </div>

            {/* ── Landscape ── */}
            <div className="flex-1 min-h-0 px-6 py-4 flex flex-col gap-2.5 overflow-auto">
                <div className="flex items-center gap-2 mb-1 shrink-0">
                    <Activity size={11} className="text-zinc-600" />
                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                        Compliance Knowledge Graph · click any node to drill down
                    </p>
                </div>

                <LayerRow n="L1" label="Trigger" desc="Events entering the system">
                    {nc('incidents', AlertTriangle, 'Incidents', data.incidents.total, {
                        sub: data.incidents.open > 0 ? `${data.incidents.open} open` : 'all closed',
                        health: data.incidents.open > 0 ? (data.incidents.critical > 0 ? 'critical' : 'warn') : 'ok',
                    })}
                    <RowArrow />
                    {nc('signals', Radio, 'Signals', data.signals.total)}
                </LayerRow>

                <LayerRow n="L2" label="Scope & Obligation" desc="Regulatory mapping to assets">
                    {nc('regulations', Scale,     'Regulations', data.regulations.total)}
                    <RowArrow />
                    {nc('complianceAreas', Layers, 'Compliance Areas', data.complianceAreas.total)}
                    <RowArrow />
                    {nc('facilities',  Building2, 'Facilities',  data.facilities.total)}
                    <RowArrow />
                    {nc('assets',      Server,    'Assets',      data.assets.total)}
                    <RowArrow />
                    {nc('vendors',     Package,   'Vendors',     data.vendors.total)}
                </LayerRow>

                <LayerRow n="L3" label="Enterprise Context" desc="Who is responsible">
                    {nc('organizations', Users,   'Organizations', data.organizations.total)}
                    <RowArrow />
                    {nc('roles',         UserCog, 'Roles',         data.roles.total)}
                </LayerRow>

                <LayerRow n="L4" label="Control Execution" desc="Controls spawn tasks and evidence">
                    {nc('controls', Shield,     'Controls', data.controls.total)}
                    <RowArrow />
                    {nc('tasks',    ListChecks, 'Tasks',    data.tasks.total, {
                        sub: data.tasks.open > 0 ? `${data.tasks.open} open` : 'all closed',
                        health: data.tasks.open > 0 ? 'warn' : 'ok',
                    })}
                    <RowArrow />
                    {nc('evidence', FileText, 'Evidence', data.evidence.total, { health: 'ok' })}
                </LayerRow>

                <LayerRow n="L5" label="Intelligence" desc="Risk scoring → findings → RCA → decisions">
                    {nc('risks', TrendingUp, 'Risks', data.risks.total, {
                        sub: data.risks.critical > 0 ? `${data.risks.critical} critical` : data.risks.high > 0 ? `${data.risks.high} high` : undefined,
                        health: data.risks.critical > 0 ? 'critical' : data.risks.high > 0 ? 'warn' : 'ok',
                    })}
                    <RowArrow />
                    {nc('findings', Search, 'Findings', data.findings.total, {
                        sub: data.findings.open > 0 ? `${data.findings.open} open` : 'all closed',
                        health: data.findings.critical > 0 ? 'critical' : data.findings.open > 0 ? 'warn' : 'ok',
                    })}
                    <RowArrow />
                    {nc('rcas',      GitBranch, 'RCA',       data.rcas.total)}
                    <RowArrow />
                    {nc('decisions', BookOpen,  'Decisions', data.decisions.total)}
                </LayerRow>

                <LayerRow n="L6" label="Remediation & Closure" desc="CAPAs verified before closure">
                    {nc('capas', Wrench, 'CAPAs', data.capas.total, {
                        sub: data.capas.open > 0 ? `${data.capas.open} open` : 'all closed',
                        health: data.capas.open > 0 ? 'warn' : 'ok',
                    })}
                    <RowArrow />
                    {nc('verifications', CheckCircle2, 'Verifications', data.verifications.total, { health: 'ok' })}
                </LayerRow>
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

            {/* ── Drill drawer ── */}
            {drill && (
                <>
                    <div className="fixed inset-0 bg-zinc-950/60 z-40" onClick={closeDrill} />
                    <DrillDrawer title={drill.label} items={drillItems} loading={drillLoading} onClose={closeDrill} />
                </>
            )}
        </div>
    );
}
