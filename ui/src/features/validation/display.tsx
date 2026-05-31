// Shared display primitives for validation views

import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

// ── DateTime formatter ─────────────────────────────────────────────────────────

export const formatValue = (v: any): string => {
    if (v == null) return '';
    // Neo4j DateTime objects arrive as plain objects with year/month/day
    if (typeof v === 'object' && 'year' in v && 'month' in v && 'day' in v) {
        const p = (n: number) => String(n).padStart(2, '0');
        const date = `${v.year}-${p(v.month)}-${p(v.day)}`;
        return 'hour' in v ? `${date} ${p(v.hour)}:${p(v.minute)}` : date;
    }
    return String(v);
};

// ── Compliance status badges ───────────────────────────────────────────────────

const BADGE_FIELDS = new Set([
    'status', 'riskRating', 'severity', 'priority',
    'inherentRating', 'residualRating',
]);

const BADGE_COLORS: Record<string, string> = {
    // Risk / severity levels
    Critical:       'bg-red-900 text-red-300 border-red-700',
    High:           'bg-orange-900 text-orange-300 border-orange-700',
    Medium:         'bg-amber-900 text-amber-300 border-amber-700',
    Low:            'bg-emerald-900 text-emerald-300 border-emerald-700',
    // Lifecycle statuses
    closed:         'bg-emerald-900 text-emerald-300 border-emerald-700',
    open:           'bg-zinc-800 text-zinc-300 border-zinc-600',
    collected:      'bg-sky-900 text-sky-300 border-sky-700',
    active:         'bg-sky-900 text-sky-300 border-sky-700',
    inactive:       'bg-zinc-800 text-zinc-400 border-zinc-600',
    'under-review': 'bg-amber-900 text-amber-300 border-amber-700',
    partial:        'bg-amber-900 text-amber-300 border-amber-700',
    compliant:      'bg-emerald-900 text-emerald-300 border-emerald-700',
    'non-compliant':'bg-red-900 text-red-300 border-red-700',
};

function StatusBadge({ value }: { value: string }) {
    const cls = BADGE_COLORS[value] ?? 'bg-zinc-800 text-zinc-300 border-zinc-600';
    return (
        <span className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none ${cls}`}>
            {value}
        </span>
    );
}

// ── PropRow ────────────────────────────────────────────────────────────────────

export function PropRow({ label, value }: { label: string; value: any }) {
    const formatted = formatValue(value);
    if (!formatted) return null;
    const isBadge = BADGE_FIELDS.has(label) && BADGE_COLORS[formatted] !== undefined;
    return (
        <div className="flex gap-3 text-sm py-1 border-b border-zinc-800 items-center">
            <span className="text-zinc-500 min-w-[140px] shrink-0">{label}</span>
            {isBadge
                ? <StatusBadge value={formatted} />
                : <span className="text-zinc-200 break-words">{formatted}</span>}
        </div>
    );
}

// ── NodeCard / NodeList ────────────────────────────────────────────────────────

export function NodeCard({ node, title }: { node: Record<string, any>; title?: string }) {
    const entries = Object.entries(node).filter(([, v]) => v != null && v !== '');
    return (
        <div className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3">
            {title && <p className="text-xs font-mono text-zinc-500 mb-2">{title}</p>}
            {entries.map(([k, v]) => (
                <PropRow key={k} label={k} value={v} />
            ))}
        </div>
    );
}

export function NodeList({ nodes, emptyLabel }: { nodes: any[]; emptyLabel: string }) {
    if (nodes.length === 0)
        return <p className="text-sm text-zinc-500 italic">{emptyLabel}</p>;
    return (
        <div className="flex flex-col gap-3">
            {nodes.map((n, i) => (
                <NodeCard key={n.id ?? i} node={n} title={n.id ?? `item ${i + 1}`} />
            ))}
        </div>
    );
}

// ── Coverage summary bar ───────────────────────────────────────────────────────

type Counts = { full: number; partial: number; missing: number; total: number };

export function CoverageSummary({ counts, unit }: { counts: Counts; unit: string }) {
    return (
        <div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs">
            <span className="text-zinc-500">{counts.total} {unit}</span>
            <div className="w-px h-3 bg-zinc-700" />
            <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 size={11} /> {counts.full} found
            </span>
            <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle size={11} /> {counts.partial} partial
            </span>
            <span className="flex items-center gap-1 text-red-400">
                <XCircle size={11} /> {counts.missing} missing
            </span>
        </div>
    );
}
