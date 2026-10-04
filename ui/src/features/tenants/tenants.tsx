'use client';

import { useState } from 'react';
import { Building2, Plus, X } from 'lucide-react';
import { tenants, Tenant } from '@/lib/api';

const NAME_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;

function formatCreatedAt(createdAt: any): string {
    if (!createdAt) return '';
    if (typeof createdAt === 'string') return createdAt;
    const { year, month, day, hour, minute } = createdAt;
    if (year == null) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`;
}

function TenantRow({ tenant }: { tenant: Tenant }) {
    return (
        <div className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-2 flex flex-col gap-1">
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
                        Creates a dedicated database, scaffolds its feeds folder, and loads the full catalog into it. Run a separate process (its own DB_NAME) to open the new tenant.
                    </p>

                    <div className="border-t border-zinc-800 pt-2 flex flex-col gap-2">
                        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                            Provisioned Tenants {list.length > 0 && `(${list.length})`}
                        </p>
                        {loadingList && <p className="text-[11px] text-zinc-600">Loading…</p>}
                        {!loadingList && list.length === 0 && <p className="text-[11px] text-zinc-600">None yet.</p>}
                        {list.map(t => <TenantRow key={t.name} tenant={t} />)}
                    </div>
                </div>
            )}
        </div>
    );
}
