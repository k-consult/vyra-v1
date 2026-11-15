'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Building2, ChevronDown, Layers, RefreshCw, Server } from 'lucide-react';
import { getActiveTenant } from '@/lib/active-tenant';

export type Facility = { id: string; name: string; [k: string]: any };
export type Asset = { id: string; name: string; code?: string; facilityId?: string; buildingId?: string; zoneId?: string; roomId?: string; category?: string; assetType?: string; [k: string]: any };

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

// Groups a facility's assets by building → zone/floor → room, so the tree
// mirrors the location hierarchy the structure-sync CSV carries rather than a
// flat list. Assets missing a level (blank buildingId/zoneId/roomId) sit
// directly under the level above — a real, common case for a small site, not
// an error.
function groupByLocation(assets: Asset[]): Map<string, Map<string, Map<string, Asset[]>>> {
    const byBuilding = new Map<string, Map<string, Map<string, Asset[]>>>();
    for (const a of assets) {
        const building = a.buildingId || '—';
        const zone = a.zoneId || '—';
        const room = a.roomId || '—';
        if (!byBuilding.has(building)) byBuilding.set(building, new Map());
        const byZone = byBuilding.get(building)!;
        if (!byZone.has(zone)) byZone.set(zone, new Map());
        const byRoom = byZone.get(zone)!;
        if (!byRoom.has(room)) byRoom.set(room, []);
        byRoom.get(room)!.push(a);
    }
    return byBuilding;
}

// One facility's structure tree — Facility → Building → Zone/Floor → Room →
// Asset. Shared by the onboarding wizard's Structure stage and the tenant
// Structure screen, so both read the same location hierarchy the same way.
export function FacilityTree({ facility, assets }: { facility: Facility; assets: Asset[] }) {
    const [open, setOpen] = useState(true);
    const byBuilding = groupByLocation(assets);
    const hasLocationLevels = byBuilding.size > 1 || [...byBuilding.values()].some(z => z.size > 1 || [...z.values()].some(r => r.size > 1));

    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
            <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
                <Building2 size={13} className="text-sky-400" />
                <span className="text-sm text-zinc-200">{facility.name}</span>
                <span className="text-[10px] font-mono text-zinc-600">{facility.id}</span>
                <span className="ml-auto text-[10px] text-zinc-500">{assets.length} asset{assets.length === 1 ? '' : 's'}</span>
            </button>
            {open && assets.length > 0 && (
                <div className="border-t border-zinc-800 px-3 py-2 flex flex-col gap-2.5">
                    {[...byBuilding.entries()].map(([building, byZone]) => (
                        <div key={building} className="flex flex-col gap-1.5 pl-2">
                            {hasLocationLevels && building !== '—' && (
                                <div className="flex items-center gap-2">
                                    <Layers size={11} className="text-zinc-500" />
                                    <span className="text-xs text-zinc-400 font-medium">{building}</span>
                                </div>
                            )}
                            {[...byZone.entries()].map(([zone, byRoom]) => (
                                <div key={zone} className="flex flex-col gap-1.5 pl-4">
                                    {hasLocationLevels && zone !== '—' && (
                                        <span className="text-[11px] text-zinc-500">{zone}</span>
                                    )}
                                    {[...byRoom.entries()].map(([room, roomAssets]) => (
                                        <div key={room} className="flex flex-col gap-1 pl-4">
                                            {hasLocationLevels && room !== '—' && (
                                                <span className="text-[10.5px] text-zinc-600">{room}</span>
                                            )}
                                            {roomAssets.map(a => (
                                                <div key={a.id} className="flex items-center gap-2 pl-2 py-0.5">
                                                    <Server size={12} className="text-zinc-500" />
                                                    <span className="text-xs text-zinc-300">{a.name}</span>
                                                    {a.code && <span className="text-[10px] font-mono text-zinc-600">{a.code}</span>}
                                                    {a.category && <span className="text-[10px] text-zinc-600">{a.category}</span>}
                                                    {a.assetType && <span className="text-[10px] text-zinc-700">{a.assetType}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
