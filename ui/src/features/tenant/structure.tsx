'use client';

import { useEffect, useState } from 'react';
import { Building2, ChevronDown, ChevronRight, Server, Settings2, Upload } from 'lucide-react';
import { operational } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { LoadingState, ErrorState, RefreshButton, ToolbarMenu, UploadDocumentTrigger } from './shared';

type Facility = { id: string; name: string; [k: string]: any };
type Asset = { id: string; name: string; facilityId?: string; assetType?: string; [k: string]: any };

export function TenantStructureView() {
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const load = () => {
        setLoading(true);
        setError(false);
        Promise.all([operational.facilities(), operational.assets()])
            .then(([f, a]) => { setFacilities(f.facilities); setAssets(a.assets); })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const toggle = (id: string) => setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    if (loading) return <LoadingState label="Loading structure…" />;
    if (error) return <ErrorState onRetry={load} />;

    return (
        <div className="h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">
            <PageHeader icon={Building2} iconClassName="text-sky-400" title="Structure" subtitle="Facilities and assets for the active tenant">
                <ToolbarMenu label="Manage structure" icon={Settings2}>
                    <UploadDocumentTrigger
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-zinc-300 hover:bg-zinc-800 cursor-pointer w-full"
                        onUploaded={load}
                    >
                        <Upload size={13} /> Upload document
                    </UploadDocumentTrigger>
                </ToolbarMenu>
                <RefreshButton onClick={load} />
            </PageHeader>
            <div className="flex-1 overflow-auto px-6 py-4 flex flex-col gap-2">
                {facilities.length === 0 && <p className="text-sm text-zinc-500 italic">No facilities for this tenant.</p>}
                {facilities.map(f => {
                    const children = assets.filter(a => a.facilityId === f.id);
                    const isOpen = expanded.has(f.id);
                    return (
                        <div key={f.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40">
                            <button onClick={() => toggle(f.id)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
                                {children.length > 0
                                    ? (isOpen ? <ChevronDown size={13} className="text-zinc-500" /> : <ChevronRight size={13} className="text-zinc-500" />)
                                    : <span className="w-[13px]" />}
                                <Building2 size={13} className="text-sky-400" />
                                <span className="text-sm text-zinc-200">{f.name}</span>
                                <span className="text-[10px] font-mono text-zinc-600">{f.id}</span>
                                <span className="ml-auto text-[10px] text-zinc-500">{children.length} asset{children.length !== 1 ? 's' : ''}</span>
                            </button>
                            {isOpen && children.length > 0 && (
                                <div className="border-t border-zinc-800 px-3 py-2 flex flex-col gap-1.5">
                                    {children.map(a => (
                                        <div key={a.id} className="flex items-center gap-2 pl-6 py-1">
                                            <Server size={12} className="text-zinc-500" />
                                            <span className="text-xs text-zinc-300">{a.name}</span>
                                            {a.assetType && <span className="text-[10px] text-zinc-600">{a.assetType}</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
