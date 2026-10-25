'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Check, Plus, X } from 'lucide-react';
import { tenants, Tenant, DocumentCatalogSummary } from '@/lib/api';
import { getActiveTenant, setActiveTenant } from '@/lib/active-tenant';

const NAME_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;

function formatCreatedAt(createdAt: any): string {
    if (!createdAt) return '';
    if (typeof createdAt === 'string') return createdAt;
    const { year, month, day, hour, minute } = createdAt;
    if (year == null) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`;
}

function TenantRow({ tenant, active, onActivate }: { tenant: Tenant; active: boolean; onActivate: () => void }) {
    const [uploading, setUploading] = useState(false);
    const [summary, setSummary] = useState<DocumentCatalogSummary | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setUploadError(null);
        setSummary(null);
        tenants.uploadDocumentCatalog(tenant.name, file)
            .then(({ summary }) => setSummary(summary))
            .catch((err: any) => setUploadError(err.message))
            .finally(() => { setUploading(false); if (fileInput.current) fileInput.current.value = ''; });
    };

    return (
        <div className={`rounded border px-2.5 py-2 flex flex-col gap-1 ${active ? 'border-sky-600 bg-sky-950/20' : 'border-zinc-800 bg-zinc-900'}`}>
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-200">{tenant.name}</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {tenant.status}
                </span>
            </div>
            <p className="text-[10px] font-mono text-zinc-500">{tenant.database}</p>
            <p className="text-[10px] text-zinc-600">
                {tenant.authoritiesLoaded?.join(', ') || 'no authorities'} · {formatCreatedAt(tenant.createdAt)}
            </p>

            <button
                onClick={onActivate}
                disabled={active}
                className={`flex items-center gap-1 text-[10px] w-fit mt-0.5 ${active ? 'text-sky-400' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
                {active ? <><Check size={11} /> Viewing this tenant</> : 'View this tenant'}
            </button>

            <div className="border-t border-zinc-800 pt-1.5 mt-0.5 flex flex-col gap-1">
                <label className="text-[10px] text-sky-400 hover:text-sky-300 cursor-pointer w-fit">
                    {uploading ? 'Uploading…' : 'Upload document catalog'}
                    <input
                        ref={fileInput}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        disabled={uploading}
                        onChange={onFileChange}
                    />
                </label>
                {uploadError && <p className="text-[10px] text-red-400">{uploadError}</p>}
                {summary && (
                    <p className="text-[10px] text-zinc-500">
                        {summary.facilitiesCreated} facilities · {summary.assetsCreated} assets · {summary.documentObligationsCreated} documents
                        {summary.unmappedAgencies.length > 0 && (
                            <span className="text-amber-400"> · unmapped agencies: {summary.unmappedAgencies.join(', ')}</span>
                        )}
                    </p>
                )}
            </div>
        </div>
    );
}

export function TenantProvisionEntryPoint() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [list, setList] = useState<Tenant[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [activeTenant, setActiveTenantState] = useState<string | null>(null);

    // Read after mount, not during render — localStorage is unavailable during SSR
    // and reading it synchronously in render would mismatch the server-rendered HTML.
    useEffect(() => { setActiveTenantState(getActiveTenant()); }, []);

    // Switches which tenant every view reads from, at runtime (api/API.ts's
    // onRequest hook reads X-Tenant per request — no API restart needed). Reloading
    // is the simplest way to make every already-mounted view refetch under the new
    // tenant rather than wiring cache invalidation through every feature component.
    const activate = (tenantName: string | null) => {
        setActiveTenant(tenantName);
        window.location.reload();
    };

    const loadList = () => {
        setLoadingList(true);
        tenants.list()
            .then(({ tenants: rows }) => setList(rows))
            .catch((err: any) => setError(err.message))
            .finally(() => setLoadingList(false));
    };

    const toggle = () => {
        setOpen(v => {
            const next = !v;
            if (next) {
                setError(null);
                loadList();
            }
            return next;
        });
    };

    const submit = () => {
        setSubmitting(true);
        setError(null);
        tenants.provision({ name })
            .then(() => {
                setName('');
                loadList();
            })
            .catch((err: any) => setError(err.message))
            .finally(() => setSubmitting(false));
    };

    return (
        <div className="fixed top-4 right-4 z-50">
            <button
                onClick={toggle}
                title="Tenants"
                className="flex items-center justify-center w-8 h-8 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-colors"
            >
                {open ? <X size={14} /> : <Plus size={14} />}
            </button>

            {open && (
                <div className="mt-2 w-80 rounded-lg border border-zinc-800 bg-zinc-950 p-3 flex flex-col gap-3 shadow-xl max-h-[80vh] overflow-y-auto">
                    <p className="flex items-center gap-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                        <Building2 size={12} /> New Tenant
                    </p>
                    <input
                        value={name}
                        onChange={e => setName(e.target.value.toLowerCase())}
                        placeholder="customer name (lowercase, no spaces)"
                        className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200"
                    />
                    {error && <p className="text-[11px] text-red-400">{error}</p>}
                    <button
                        onClick={submit}
                        disabled={submitting || !NAME_PATTERN.test(name)}
                        className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-zinc-950 disabled:opacity-40"
                    >
                        {submitting ? 'Provisioning…' : 'Create tenant'}
                    </button>
                    <p className="text-[10px] text-zinc-600">
                        Creates a dedicated database, scaffolds its feeds folder, and loads the full catalog into it.
                    </p>

                    <div className="border-t border-zinc-800 pt-2 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                                Provisioned Tenants {list.length > 0 && `(${list.length})`}
                            </p>
                            {activeTenant && (
                                <button onClick={() => activate(null)} className="text-[10px] text-zinc-500 hover:text-zinc-300 underline">
                                    Back to default
                                </button>
                            )}
                        </div>
                        {loadingList && <p className="text-[11px] text-zinc-600">Loading…</p>}
                        {!loadingList && list.length === 0 && <p className="text-[11px] text-zinc-600">None yet.</p>}
                        {list.map(t => (
                            <TenantRow key={t.name} tenant={t} active={t.name === activeTenant} onActivate={() => activate(t.name)} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
