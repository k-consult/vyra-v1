'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, FileText, Upload } from 'lucide-react';
import { operational } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { LoadingState, ErrorState, RefreshButton, UploadDocumentTrigger } from './shared';

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

// Landing grid — one tile per document type, independent of how many sites
// contribute rows to it. Clicking the tile drills into CategoryDetailView;
// the per-tile upload trigger is a separate element so it never fires that
// navigation (see UploadDocumentTrigger usage below).
function CategoryGrid({ rows, onSelect, onUploaded }: { rows: DocRow[]; onSelect: (category: string) => void; onUploaded: () => void }) {
    const byCategory = groupBy(rows, r => r.category || 'Uncategorized');
    const known = CATEGORY_ORDER.filter(c => !EXCLUDED_CATEGORIES.has(c));
    const extra = [...byCategory.keys()].filter(c => !CATEGORY_ORDER.includes(c) && !EXCLUDED_CATEGORIES.has(c)).sort();
    const categories = [...known, ...extra];

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map(category => {
                const count = byCategory.get(category)?.length ?? 0;
                return (
                    <div key={category} className="rounded-lg border border-zinc-800 bg-zinc-900/40 flex flex-col overflow-hidden">
                        <button
                            onClick={() => onSelect(category)}
                            className="flex-1 flex flex-col items-start gap-1.5 px-3.5 py-3 text-left hover:bg-zinc-900 transition-colors"
                        >
                            <FileText size={14} className="text-sky-400" />
                            <span className="text-sm text-zinc-200">{category}</span>
                            <span className="text-[11px] text-zinc-500">{count} document{count !== 1 ? 's' : ''}</span>
                        </button>
                        <div className="border-t border-zinc-800 px-3.5 py-2">
                            <UploadDocumentTrigger
                                className="flex items-center gap-1.5 text-[11px] text-sky-400 hover:text-sky-300 cursor-pointer w-fit"
                                onUploaded={onUploaded}
                            >
                                <Upload size={11} /> Upload
                            </UploadDocumentTrigger>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function SiteCategoryBlock({ siteLabel, category, rows }: { siteLabel: string; category: string; rows: DocRow[] }) {
    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-zinc-200">{siteLabel} <span className="text-zinc-600 font-normal">({rows.length})</span></p>
            <CategorySection category={category} rows={rows} />
        </div>
    );
}

function CategoryDetailView({ category, rows }: { category: string; rows: DocRow[] }) {
    const bySite = groupBy(rows, r => r.facilityName ?? r.facilityId ?? 'Unknown site');
    const sites = [...bySite.keys()].sort();

    return (
        <div className="flex flex-col gap-5">
            {rows.length === 0 && <p className="text-sm text-zinc-500 italic">No documents uploaded for this type yet.</p>}
            {sites.map(site => <SiteCategoryBlock key={site} siteLabel={site} category={category} rows={bySite.get(site)!} />)}
        </div>
    );
}

export function TenantDocumentsView() {
    const [rows, setRows] = useState<DocRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

    const categoryRows = selectedCategory ? rows.filter(r => r.category === selectedCategory) : [];

    return (
        <div className="h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">
            <PageHeader
                icon={FileText}
                iconClassName="text-sky-400"
                title={selectedCategory ?? 'Documents'}
                subtitle={selectedCategory ? `${categoryRows.length} tracked documents` : `${rows.length} tracked documents for the active tenant`}
            >
                {selectedCategory && (
                    <button onClick={() => setSelectedCategory(null)} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200">
                        <ArrowLeft size={13} /> All document types
                    </button>
                )}
                <RefreshButton onClick={load} />
            </PageHeader>
            <div className="flex-1 overflow-auto px-6 py-4">
                {selectedCategory
                    ? <CategoryDetailView category={selectedCategory} rows={categoryRows} />
                    : <CategoryGrid rows={rows} onSelect={setSelectedCategory} onUploaded={load} />}
            </div>
        </div>
    );
}
