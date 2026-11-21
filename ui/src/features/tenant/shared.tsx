'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Building2, ChevronDown, Layers, RefreshCw, Server } from 'lucide-react';
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

// One node in the tenant's blueprint-driven instance tree, rendered at
// whatever depth its TenantBlueprint declares — not hardcoded to
// Facility→Building→Zone/Floor→Room→Asset the way this used to be.
function InstanceNode({ node }: { node: StructureTreeNode }) {
    const [open, setOpen] = useState(true);
    const Icon = iconForLabel(node.label);
    const hasChildren = node.children.length > 0;

    return (
        <div className="flex flex-col gap-1">
            <button
                onClick={() => hasChildren && setOpen(v => !v)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
            >
                <Icon size={12} className="text-zinc-500" />
                <span className="text-xs text-zinc-300">{node.node.name}</span>
                {node.node.code && <span className="text-[10px] font-mono text-zinc-600">{node.node.code}</span>}
                {node.node.category && <span className="text-[10px] text-zinc-600">{node.node.category}</span>}
                {node.node.assetType && <span className="text-[10px] text-zinc-700">{node.node.assetType}</span>}
                {node.node.subjectType && (
                    <span className="text-[10px] rounded border border-sky-800/60 bg-sky-950/40 text-sky-400 px-1">{node.node.subjectType}</span>
                )}
                <span className="text-[10px] font-mono text-zinc-700">{node.label}</span>
                {hasChildren && <span className="ml-auto text-[10px] text-zinc-500">{node.children.length}</span>}
            </button>
            {open && hasChildren && (
                <div className="flex flex-col gap-1 pl-5 ml-1.5 border-l border-zinc-800/60">
                    {node.children.map(child => <InstanceNode key={child.node.id} node={child} />)}
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
    return (
        <div className="flex flex-col gap-2">
            {nodes.map(n => (
                <div key={n.node.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1">
                    <InstanceNode node={n} />
                </div>
            ))}
        </div>
    );
}
