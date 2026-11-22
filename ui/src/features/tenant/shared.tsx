'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Building2, ChevronDown, ChevronRight, Layers, RefreshCw, Server } from 'lucide-react';
import { getActiveTenant } from '@/lib/active-tenant';
import type { StructureTreeNode } from '@/lib/api';

export function LoadingState({ label }: { label: string }) {
    return (
        <div className="h-full bg-zinc-950 flex items-center justify-center">
            <div className="flex items-center gap-3 text-zinc-500">
                <RefreshCw size={16} className="animate-spin" />
                <span className="text-sm">{label}</span>
            </div>
        </div>
    );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="h-full bg-zinc-950 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <AlertTriangle size={20} className="text-amber-500" />
                <span className="text-sm text-zinc-500">Could not load data</span>
                <button onClick={onRetry} className="text-xs text-zinc-400 underline">Retry</button>
            </div>
        </div>
    );
}

export function RefreshButton({ onClick }: { onClick: () => void }) {
    return (
        <button onClick={onClick} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Refresh">
            <RefreshCw size={14} className="text-zinc-500" />
        </button>
    );
}

// Generic toolbar dropdown — one menu item today (Upload document), more land
// here later without changing how the button opens/closes.
export function ToolbarMenu({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-colors"
            >
                <Icon size={13} />
                {label}
                <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div onClick={() => setOpen(false)} className="absolute right-0 mt-1 w-56 rounded-lg border border-zinc-800 bg-zinc-950 p-1.5 flex flex-col gap-0.5 shadow-xl z-10">
                    {children}
                </div>
            )}
        </div>
    );
}

// Wraps any tenant-feed multipart upload (document-catalog, structure, ...)
// behind any trigger element. Requires an active tenant, since every upload
// endpoint is tenant-scoped by name, not by the X-Tenant header every read
// already uses. `upload` is the specific tenants.upload* function to call —
// generalized once a third call site (onboarding's Structure stage) needed
// the same control with a different endpoint/summary shape.
export function UploadTrigger<T>({ className, children, upload, onUploaded }: {
    className?: string;
    children: ReactNode;
    upload: (tenant: string, file: File) => Promise<{ summary: T }>;
    onUploaded?: (summary: T) => void;
}) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const tenant = getActiveTenant();

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!tenant) { setError('Select a tenant first'); return; }
        setUploading(true);
        setError(null);
        upload(tenant, file)
            .then(({ summary }) => onUploaded?.(summary))
            .catch((err: any) => setError(err.message))
            .finally(() => { setUploading(false); if (fileInput.current) fileInput.current.value = ''; });
    };

    return (
        <label className={className} title={!tenant ? 'Select a tenant first' : undefined}>
            {uploading ? 'Uploading…' : children}
            <input
                ref={fileInput}
                type="file"
                accept=".csv"
                className="hidden"
                disabled={uploading}
                onChange={onFileChange}
            />
            {error && <span className="block text-[10px] text-red-400 mt-1">{error}</span>}
        </label>
    );
}

// Exported for the onboarding wizard's Obligation Mapping tree (onboarding.tsx),
// which walks this same StructureTreeNode shape but needs its own node renderer
// (classification status, inline confirm/override, nested Obligation rows).
export const iconForLabel = (label: string) => {
    if (label === 'Facility') return Building2;
    if (label === 'Asset') return Server;
    return Layers;
};

// Type (blueprint level) is colored by label, not by tree depth — a tenant's
// real structure can skip levels on some branches (e.g. an Asset sitting
// directly under Building on one site but under Zone on another), so the
// same label can occur at different depths. Colors are assigned once per
// render by first-encounter order over the whole tree, shared between every
// row and the Legend via the same buildTypeColors call, so a Type badge's
// color always matches its legend chip regardless of where in the tree it sits.
// Deliberately no green/red hues here — those are reserved for the
// Classification chips (CLASSIFIED_CHIP/UNCLASSIFIED_CHIP below) and a
// default 7-level blueprint uses every palette entry, so any overlap would
// make some Type collide with Classification's color exactly like the old
// sky-colored Classified chip collided with a sky-colored Organisation chip.
const TYPE_PALETTE = ['#38bdf8', '#a78bfa', '#fb923c', '#f472b6', '#facc15', '#22d3ee', '#94a3b8'];
function buildTypeColors(nodes: StructureTreeNode[], acc = new Map<string, string>()): Map<string, string> {
    for (const n of nodes) {
        if (!acc.has(n.label)) acc.set(n.label, TYPE_PALETTE[acc.size % TYPE_PALETTE.length]);
        buildTypeColors(n.children, acc);
    }
    return acc;
}

// Shared chip styling between the Legend and every row's own badges, so a
// color/style only has to be defined once to look identical in both places.
const typeChipStyle = (color: string): React.CSSProperties => ({
    borderColor: `${color}60`,
    backgroundColor: `${color}1a`,
    color,
});
const CLASSIFIED_CHIP = 'text-[10px] rounded border border-emerald-700/60 bg-emerald-950/30 text-emerald-400 px-1.5 py-0.5';
const UNCLASSIFIED_CHIP = 'flex items-center gap-1 text-[10px] rounded border border-red-700/60 bg-red-950/30 text-red-400 px-1.5 py-0.5';

// Legend, in two rows: Blueprint shows the tenant's actual level hierarchy as
// chained chips (buildTypeColors walks the tree top-down, so insertion order
// already is the hierarchy order — Organisation > Facility > ... > Asset,
// whatever this tenant's blueprint actually declares); Classification shows
// the two states every Asset row can carry. Render once above InstanceTree,
// not per-row.
export function StructureLegend({ nodes }: { nodes: StructureTreeNode[] }) {
    const colors = Array.from(buildTypeColors(nodes).entries());
    if (!colors.length) return null;
    return (
        <div className="flex flex-col gap-1.5 text-[11px]">
            <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-zinc-500 font-medium shrink-0">Blueprint:</span>
                {colors.map(([label, color], i) => (
                    <span key={label} className="flex items-center gap-1.5">
                        <span className="text-[10px] rounded border px-1.5 py-0.5" style={typeChipStyle(color)}>{label}</span>
                        {i < colors.length - 1 && <ChevronRight size={10} className="text-zinc-600" />}
                    </span>
                ))}
            </div>
            <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 font-medium shrink-0">Classification:</span>
                <span className={CLASSIFIED_CHIP}>Classified</span>
                <span className={UNCLASSIFIED_CHIP}><AlertTriangle size={9} /> Needs classification</span>
            </div>
        </div>
    );
}

// Hover tooltip picks up whatever the row itself doesn't show — the row now
// shows only Blueprint (Type) and Category, so Code, Asset type and
// Classification all moved here, explicitly labeled; never the raw node id
// (an internal key, not something a reviewer needs); plus any other raw
// property a custom blueprint Level/Property added, so a tenant-defined
// field stays discoverable without needing its own chip. Returns lines, not
// a joined string — rendered as separate <p>s by the fixed-position tooltip
// below, the same idiom calendar.tsx/catalog.tsx already use instead of the
// native `title` attribute (browser-imposed delay, invisible to
// screenshot/automation capture).
const TOOLTIP_HANDLED_FIELDS = new Set(['id', 'name', 'description', 'code', 'assetType', 'subjectType', 'category', 'createdAt', 'syncedAt', 'sourceRevision']);
function describeNode(node: StructureTreeNode): string[] {
    const n = node.node;
    const lines: string[] = [];
    if (n.description) lines.push(n.description);
    if (n.code) lines.push(`Code: ${n.code}`);
    if (n.assetType) lines.push(`Asset type: ${n.assetType}`);
    if (node.label === 'Asset') lines.push(`Classification: ${n.subjectType ?? 'Unclassified'}`);
    for (const [key, value] of Object.entries(n)) {
        if (TOOLTIP_HANDLED_FIELDS.has(key) || value == null || typeof value === 'object') continue;
        lines.push(`${key}: ${value}`);
    }
    return lines;
}

// One node in the tenant's blueprint-driven instance tree, rendered at
// whatever depth its TenantBlueprint declares — not hardcoded to
// Facility→Building→Zone/Floor→Room→Asset the way this used to be.
//
// Two lines per row: identity (icon, name, child count) on top; tags beneath
// it, indented under the name — only Blueprint (Type) and Category, the two
// critical-at-a-glance attributes. Everything else (code, assetType,
// Classification) is real but secondary, surfaced on hover via describeNode
// instead of competing for space on every row.
function InstanceNode({ node, typeColors }: { node: StructureTreeNode; typeColors: Map<string, string> }) {
    const [open, setOpen] = useState(true);
    const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
    const Icon = iconForLabel(node.label);
    const hasChildren = node.children.length > 0;
    const typeColor = typeColors.get(node.label) ?? '#94a3b8';
    const tooltipLines = describeNode(node);

    return (
        <div className="flex flex-col gap-1">
            <button
                onClick={() => hasChildren && setOpen(v => !v)}
                onMouseMove={e => setHover({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover(null)}
                className="w-full flex flex-col items-start gap-1 px-2 py-1.5 text-left"
            >
                <div className="w-full flex items-center gap-1.5">
                    <Icon size={12} className="text-zinc-500 shrink-0" />
                    <span className="text-xs text-zinc-300 truncate">{node.node.name}</span>
                    {hasChildren && <span className="ml-auto text-[10px] text-zinc-500 shrink-0">{node.children.length}</span>}
                </div>
                <div className="flex items-center gap-1.5 pl-[18px] flex-wrap">
                    <span className="text-[10px] rounded border px-1.5 py-0.5 shrink-0" style={typeChipStyle(typeColor)}>
                        {node.label}
                    </span>
                    {node.node.category && (
                        <span className="text-[10px] rounded border border-zinc-800 bg-zinc-900/60 text-zinc-500 px-1 shrink-0">{node.node.category}</span>
                    )}
                </div>
            </button>
            {hover && (
                <div
                    className="fixed z-50 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-2xl pointer-events-none max-w-xs"
                    style={{ left: hover.x + 14, top: hover.y + 14 }}
                >
                    <p className="text-xs font-semibold text-zinc-100">{node.node.name}</p>
                    {tooltipLines.map((line, i) => (
                        <p key={i} className="text-[11px] text-zinc-400 mt-0.5">{line}</p>
                    ))}
                </div>
            )}
            {open && hasChildren && (
                <div className="flex flex-col gap-1 pl-5 ml-1.5 border-l border-zinc-800/60">
                    {node.children.map(child => <InstanceNode key={child.node.id} node={child} typeColors={typeColors} />)}
                </div>
            )}
        </div>
    );
}

// Renders the tenant's full blueprint-driven structure tree — whatever depth
// and labels the active TenantBlueprint declares. Shared by the onboarding
// wizard's Structure stage and the tenant Structure screen.
export function InstanceTree({ nodes }: { nodes: StructureTreeNode[] }) {
    if (!nodes.length) {
        return <p className="text-sm text-zinc-500 italic">No structure for this tenant yet — upload an asset register to begin.</p>;
    }
    const typeColors = buildTypeColors(nodes);
    return (
        <div className="flex flex-col gap-2">
            {nodes.map(n => (
                <div key={n.node.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1">
                    <InstanceNode node={n} typeColors={typeColors} />
                </div>
            ))}
        </div>
    );
}
