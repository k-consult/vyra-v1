'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronDown, RefreshCw } from 'lucide-react';
import { tenants, DocumentCatalogSummary } from '@/lib/api';
import { getActiveTenant } from '@/lib/active-tenant';

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

// Wraps the existing document-catalog upload (the only upload path today —
// /tenants/:name/document-catalog) behind any trigger element. Requires an
// active tenant, since the endpoint is tenant-scoped by name, not by the
// X-Tenant header every read already uses.
export function UploadDocumentTrigger({ className, children, onUploaded }: {
    className?: string;
    children: ReactNode;
    onUploaded?: (summary: DocumentCatalogSummary) => void;
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
        tenants.uploadDocumentCatalog(tenant, file)
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
