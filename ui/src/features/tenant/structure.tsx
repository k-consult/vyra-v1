'use client';

import { useEffect, useState } from 'react';
import { Building2, Settings2, Upload } from 'lucide-react';
import { blueprint, tenants, type StructureTreeNode } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { LoadingState, ErrorState, RefreshButton, ToolbarMenu, UploadTrigger, InstanceTree, StructureLegend } from './shared';

export function TenantStructureView() {
    const [tree, setTree] = useState<StructureTreeNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        blueprint.structureTree()
            .then(({ tree }) => setTree(tree))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    if (loading) return <LoadingState label="Loading structure…" />;
    if (error) return <ErrorState onRetry={load} />;

    return (
        <div className="h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">
            <PageHeader icon={Building2} iconClassName="text-sky-400" title="Structure" subtitle="Facilities and assets for the active tenant">
                <ToolbarMenu label="Manage structure" icon={Settings2}>
                    <UploadTrigger
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-zinc-300 hover:bg-zinc-800 cursor-pointer w-full"
                        upload={tenants.uploadDocumentCatalog}
                        onUploaded={load}
                    >
                        <Upload size={13} /> Upload document
                    </UploadTrigger>
                </ToolbarMenu>
                <RefreshButton onClick={load} />
            </PageHeader>
            <div className="flex-1 overflow-auto px-6 py-4 flex flex-col gap-3">
                <StructureLegend nodes={tree} />
                <InstanceTree nodes={tree} />
            </div>
        </div>
    );
}
