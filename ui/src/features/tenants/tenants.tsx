'use client';

import { useEffect, useState } from 'react';
import { Building2, Check, Plus, Power, Trash2 } from 'lucide-react';
import { tenants, Tenant } from '@/lib/api';
import { getActiveTenant, setActiveTenant } from '@/lib/active-tenant';
import { Dialog, ConfirmDialog } from '@/components/dialog';

const NAME_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;

function formatCreatedAt(createdAt: any): string {
    if (!createdAt) return '';
    if (typeof createdAt === 'string') return createdAt;
    const { year, month, day, hour, minute } = createdAt;
    if (year == null) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`;
}

function NewTenantForm({ onCreated, onCancel }: { onCreated: (name: string) => void; onCancel: () => void }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = () => {
        setSubmitting(true);
        setError(null);
        tenants.provision({ name, description: description || undefined })
            .then(() => {
                onCreated(name);
                setName('');
                setDescription('');
            })
            .catch((err: any) => setError(err.message))
            .finally(() => setSubmitting(false));
    };

    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 flex flex-col gap-2 mb-3">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">New Tenant</p>
            <input
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase())}
                placeholder="customer name (lowercase, no spaces)"
                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200"
            />
            <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="description (optional)"
                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200"
            />
            {error && <p className="text-[11px] text-red-400">{error}</p>}
            <div className="flex gap-2">
                <button
                    onClick={submit}
                    disabled={submitting || !NAME_PATTERN.test(name)}
                    className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-zinc-950 disabled:opacity-40"
                >
                    {submitting ? 'Provisioning…' : 'Create tenant'}
                </button>
                <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded border border-zinc-800 text-zinc-400">
                    Cancel
                </button>
            </div>
            <p className="text-[10px] text-zinc-600">
                Creates a dedicated database, scaffolds its feeds folder, and loads the full catalog into it.
            </p>
        </div>
    );
}

function TenantTableRow({
    tenant,
    active,
    onActivate,
    onDeleted,
}: {
    tenant: Tenant;
    active: boolean;
    onActivate: () => void;
    onDeleted: () => void;
}) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // The active tenant can't reach this point (delete is disabled below), so no
    // other mounted view is reading from the database being dropped — refetching
    // this dialog's own list is enough, no full page reload needed.
    const onConfirmDelete = () => {
        setDeleting(true);
        setError(null);
        tenants.remove(tenant.name)
            .then(() => {
                setDeleting(false);
                setConfirmOpen(false);
                onDeleted();
            })
            .catch((err: any) => { setError(err.message); setDeleting(false); setConfirmOpen(false); });
    };

    return (
        <tr className={`border-b border-zinc-800/60 ${active ? 'bg-sky-950/20' : ''}`}>
            <td className="px-3 py-2 align-top">
                <p className="text-xs font-medium text-zinc-200">{tenant.name}</p>
                <p className="text-[10px] font-mono text-zinc-600">{tenant.database}</p>
            </td>
            <td className="px-3 py-2 align-top text-xs text-zinc-400">{tenant.description || <span className="text-zinc-600">—</span>}</td>
            <td className="px-3 py-2 align-top text-xs text-zinc-400">
                {tenant.authoritiesLoaded?.length ? tenant.authoritiesLoaded.join(', ') : <span className="text-zinc-600">none</span>}
            </td>
            <td className="px-3 py-2 align-top">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                    {tenant.status}
                </span>
                <p className="text-[10px] text-zinc-600 mt-1">{formatCreatedAt(tenant.createdAt)}</p>
            </td>
            <td className="px-3 py-2 align-top">
                <div className="flex flex-col gap-1.5 items-start">
                    <button
                        onClick={onActivate}
                        disabled={active}
                        className={`flex items-center gap-1 text-[11px] ${active ? 'text-sky-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                        {active ? <Check size={11} /> : <Power size={11} />} {active ? 'Active' : 'Activate'}
                    </button>
                    <button
                        onClick={() => setConfirmOpen(true)}
                        disabled={deleting || active}
                        title={active ? 'Active tenant cannot be deleted' : undefined}
                        className="flex items-center gap-1 text-[11px] text-red-500/80 hover:text-red-400 disabled:opacity-40"
                    >
                        <Trash2 size={11} /> {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                    {error && <p className="text-[10px] text-red-400">{error}</p>}
                </div>
            </td>

            <ConfirmDialog
                open={confirmOpen}
                title={`Delete tenant "${tenant.name}"?`}
                message="This drops its Neo4j database and removes it from the registry. All data for this tenant is permanently gone — this cannot be undone."
                confirmLabel="Delete tenant"
                danger
                busy={deleting}
                onConfirm={onConfirmDelete}
                onCancel={() => setConfirmOpen(false)}
            />
        </tr>
    );
}

export function TenantManagementDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [list, setList] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [activeTenant, setActiveTenantState] = useState<string | null>(null);

    // Read after mount, not during render — localStorage is unavailable during SSR.
    useEffect(() => { setActiveTenantState(getActiveTenant()); }, []);

    const loadList = () => {
        setLoading(true);
        setLoadError(null);
        tenants.list()
            .then(({ tenants: rows }) => setList(rows))
            .catch((err: any) => setLoadError(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => { if (open) loadList(); }, [open]);

    // Switches which tenant every view reads from, at runtime (api/API.ts's
    // onRequest hook reads X-Tenant per request — no API restart needed). Reloading
    // is the simplest way to make every already-mounted view refetch under the new
    // tenant rather than wiring cache invalidation through every feature component.
    const activate = (tenantName: string | null) => {
        setActiveTenant(tenantName);
        window.location.reload();
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Tenants"
            icon={Building2}
            headerActions={
                <button
                    onClick={() => setCreating((v) => !v)}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
                >
                    <Plus size={12} /> New Tenant
                </button>
            }
        >
            {/* Switches straight to the new tenant on creation, same as activate()
                does for an existing one — otherwise the active tenant stays
                whatever it was before, and every view (Onboarding's Blueprint
                stage included) keeps reading that tenant's data, which looks
                exactly like the new tenant's structure "copied" from the old one. */}
            {creating && <NewTenantForm onCreated={(name) => { setCreating(false); activate(name); }} onCancel={() => setCreating(false)} />}

            {activeTenant && (
                <button onClick={() => activate(null)} className="text-[10px] text-zinc-500 hover:text-zinc-300 underline mb-2">
                    Back to default tenant
                </button>
            )}

            {loading && <p className="text-xs text-zinc-500">Loading…</p>}
            {loadError && <p className="text-xs text-red-400">{loadError}</p>}
            {!loading && !loadError && list.length === 0 && <p className="text-xs text-zinc-500">No tenants provisioned yet.</p>}

            {!loading && list.length > 0 && (
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-zinc-800 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Description</th>
                            <th className="px-3 py-2">Regulation</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.map((t) => (
                            <TenantTableRow
                                key={t.name}
                                tenant={t}
                                active={t.name === activeTenant}
                                onActivate={() => activate(t.name)}
                                onDeleted={loadList}
                            />
                        ))}
                    </tbody>
                </table>
            )}
        </Dialog>
    );
}
