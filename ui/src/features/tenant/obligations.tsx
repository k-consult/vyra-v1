'use client';

import { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { operational } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/features/landscape/landscape';
import { LoadingState, ErrorState, RefreshButton } from './shared';

type DocRow = { id: string; category: string; documentType: string; expectedFileName: string; year: string; status: string; facilityName: string | null; authorityName: string | null; [k: string]: any };

// Rows whose Agency is "NA" or didn't resolve to a seeded Authority (surfaced as a
// warning at ingest time, not silently dropped — cli/orchestration/document-catalog-sync.ts)
// land here rather than disappearing from the authority-mapped view.
const UNMAPPED_LABEL = 'Unmapped / Internal';

const groupByAuthority = (rows: DocRow[]): Map<string, DocRow[]> => {
    const map = new Map<string, DocRow[]>();
    for (const row of rows) {
        const key = row.authorityName ?? UNMAPPED_LABEL;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(row);
    }
    return map;
};

export function TenantObligationsView() {
    const [rows, setRows] = useState<DocRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        operational.documentObligations()
            .then((r: any) => setRows(r.documentObligations))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    if (loading) return <LoadingState label="Loading obligations…" />;
    if (error) return <ErrorState onRetry={load} />;

    const byAuthority = groupByAuthority(rows);
    const authorities = [...byAuthority.keys()].sort((a, b) =>
        a === UNMAPPED_LABEL ? 1 : b === UNMAPPED_LABEL ? -1 : a.localeCompare(b));

    return (
        <div className="h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">
            <PageHeader icon={Scale} iconClassName="text-sky-400" title="Obligations" subtitle="Document obligations mapped to their regulatory authority">
                <RefreshButton onClick={load} />
            </PageHeader>
            <div className="flex-1 overflow-auto px-6 py-4 flex flex-col gap-5">
                {rows.length === 0 && <p className="text-sm text-zinc-500 italic">No obligations for this tenant yet.</p>}
                {authorities.map(authority => {
                    const authorityRows = byAuthority.get(authority)!;
                    const pending = authorityRows.filter(r => r.status === 'Pending').length;
                    return (
                        <div key={authority} className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">{authority}</p>
                                <span className="text-[10px] text-zinc-600">
                                    {authorityRows.length} obligation{authorityRows.length !== 1 ? 's' : ''}
                                    {pending > 0 ? ` · ${pending} pending` : ''}
                                </span>
                            </div>
                            <div className="rounded-lg border border-zinc-800 divide-y divide-zinc-800/60 overflow-hidden">
                                {authorityRows.map(row => (
                                    <div key={row.id} className="px-3 py-2 flex items-center gap-3 bg-zinc-900/40">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-zinc-200 truncate">{row.documentType}</p>
                                            <p className="text-[10px] font-mono text-zinc-600 truncate">{row.expectedFileName}</p>
                                            <p className="text-[10px] text-zinc-600 truncate">
                                                {row.category} · {row.facilityName ?? row.facilityId} · {row.year}
                                            </p>
                                        </div>
                                        <Badge value={row.status} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
