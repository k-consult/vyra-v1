'use client';

import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { operational } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { LoadingState, ErrorState, RefreshButton } from './shared';

type DocRow = {
    id: string; category: string; documentType: string; year: string; agency: string; asset: string;
    status: string; expectedFileName: string; facilityId: string; facilityName: string | null; authorityName: string | null;
    [k: string]: any;
};

// Matches the six fixed categories the document-catalog CSV always uses
// (.design/track.md gap #22) — anything outside this set (shouldn't happen, but
// isn't assumed impossible) sorts after, alphabetically.
const CATEGORY_ORDER = ['Consents / NOCs', 'Filings', 'Asset Register', 'Vendor AMC', 'Historic Logs', 'Tickets & CAPA'];

// Within these categories the issuing agency is the meaningful third grouping
// (several document types per agency); within these, the specific asset is
// (one piece of equipment can have several document types). The remaining two
// categories (Historic Logs, Tickets & CAPA) have neither axis as dominant, so
// rows list directly under category.
const AGENCY_GROUPED_CATEGORIES = new Set(['Consents / NOCs', 'Filings']);
const ASSET_GROUPED_CATEGORIES = new Set(['Vendor AMC']);

// Asset Register rows (equipment datasheets/certs) aren't tracked documents in
// this view's sense — they belong to Structure, not here.
const EXCLUDED_CATEGORIES = new Set(['Asset Register']);

const NA = 'NA';

const groupBy = <T,>(rows: T[], key: (r: T) => string): Map<string, T[]> => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
        const k = key(row);
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(row);
    }
    return map;
};

const subGroupLabel = (row: DocRow, category: string): string | null => {
    if (AGENCY_GROUPED_CATEGORIES.has(category)) return row.authorityName ?? (row.agency || NA);
    if (ASSET_GROUPED_CATEGORIES.has(category)) return row.asset && row.asset.toLowerCase() !== 'na' ? row.asset : NA;
    return null;
};

// Category is already established by the section this row sits in (every row
// passed in here shares one category) — showing it again per row duplicated the
// section header above.
function DocumentRow({ row }: { row: DocRow }) {
    return (
        <div className="px-3 py-2 flex items-center gap-3 bg-zinc-900/40">
            <p className="flex-1 min-w-0 text-xs text-zinc-200 truncate">{row.documentType}</p>
            <span className="text-[10px] text-zinc-500 shrink-0">{row.authorityName ?? row.agency}</span>
        </div>
    );
}

function CategorySection({ category, rows }: { category: string; rows: DocRow[] }) {
    const needsSubGroup = AGENCY_GROUPED_CATEGORIES.has(category) || ASSET_GROUPED_CATEGORIES.has(category);

    if (!needsSubGroup) {
        return (
            <div className="rounded-lg border border-zinc-800 divide-y divide-zinc-800/60 overflow-hidden">
                {rows.map(row => <DocumentRow key={row.id} row={row} />)}
            </div>
        );
    }

    const bySubGroup = groupBy(rows, r => subGroupLabel(r, category) ?? NA);
    const subGroups = [...bySubGroup.keys()].sort((a, b) => a === NA ? 1 : b === NA ? -1 : a.localeCompare(b));

    return (
        <div className="flex flex-col gap-3">
            {subGroups.map(subGroup => (
                <div key={subGroup} className="flex flex-col gap-1.5">
                    <p className="text-[10px] font-medium text-zinc-500 pl-1">{subGroup}</p>
                    <div className="rounded-lg border border-zinc-800 divide-y divide-zinc-800/60 overflow-hidden">
                        {bySubGroup.get(subGroup)!.map(row => <DocumentRow key={row.id} row={row} />)}
                    </div>
                </div>
            ))}
        </div>
    );
}

function SiteSection({ siteLabel, rows }: { siteLabel: string; rows: DocRow[] }) {
    const byCategory = groupBy(rows, r => r.category || 'Uncategorized');
    const extraCategories = [...byCategory.keys()].filter(c => !CATEGORY_ORDER.includes(c)).sort();
    const categories = [...CATEGORY_ORDER.filter(c => byCategory.has(c)), ...extraCategories];

    return (
        <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-zinc-200">{siteLabel} <span className="text-zinc-600 font-normal">({rows.length})</span></p>
            <div className="flex flex-col gap-4 pl-1">
                {categories.map(category => (
                    <div key={category} className="flex flex-col gap-2">
                        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                            {category} ({byCategory.get(category)!.length})
                        </p>
                        <CategorySection category={category} rows={byCategory.get(category)!} />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function TenantDocumentsView() {
    const [rows, setRows] = useState<DocRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        operational.documentObligations()
            .then((r: any) => setRows(r.documentObligations.filter((row: DocRow) => !EXCLUDED_CATEGORIES.has(row.category))))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    if (loading) return <LoadingState label="Loading documents…" />;
    if (error) return <ErrorState onRetry={load} />;

    const bySite = groupBy(rows, r => r.facilityName ?? r.facilityId ?? 'Unknown site');
    const sites = [...bySite.keys()].sort();

    return (
        <div className="h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">
            <PageHeader icon={FileText} iconClassName="text-sky-400" title="Documents" subtitle={`${rows.length} tracked documents for the active tenant`}>
                <RefreshButton onClick={load} />
            </PageHeader>
            <div className="flex-1 overflow-auto px-6 py-4 flex flex-col gap-6">
                {rows.length === 0 && <p className="text-sm text-zinc-500 italic">No documents uploaded for this tenant yet.</p>}
                {sites.map(site => <SiteSection key={site} siteLabel={site} rows={bySite.get(site)!} />)}
            </div>
        </div>
    );
}
