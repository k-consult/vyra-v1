'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, BookOpen, FileText, Scale, Layers, RefreshCw, Rocket, Brain } from 'lucide-react';
import { TenantManagementDialog } from '@/features/tenants/tenants';
import { getActiveTenant } from '@/lib/active-tenant';
import { tenants } from '@/lib/api';

// Trimmed to a single entry point (2026-10-03, go-live customer track) — every
// other screen this nav used to list (Landscape, Calendar, Decision Gate,
// Assurance, ...) is still live and reachable by its own URL; this only removes
// the sidebar links, it deletes no routes and no pages. Onboarding was relisted
// 2026-11-15 as the Tenant section's first item, once /onboarding became the
// 4-stage onboarding wizard rather than the old flat Blueprint/CutoverCriterion
// propose/approve page.
//
// "Tenant" (added for the per-tenant Structure/Documents/Obligations views) is the
// first entry with sub-items — a plain non-collapsing section, not a generic
// nav-config structure, since exactly one item needs this shape.

const isActive = (pathname: string): boolean =>
    pathname === '/catalog' || pathname.startsWith('/catalog/');

const TENANT_CATALOG_HREF = '/tenant/catalog';

// Blueprint/Structure dropped as standalone links (2026-11-21) — both fold into
// Onboarding now: Blueprint as its own first stage (2026-11-22, carrying the
// schema's Export/Restore actions), Structure as the "Upload Structure" stage.
// This only removes the sidebar shortcuts — /tenant/blueprint and
// /tenant/structure still work as routes. Intelligence relisted here — it
// previously had no sidebar entry at all.
const TENANT_SUB_LINKS = [
    { href: '/onboarding',          label: 'Onboarding',    icon: Rocket },
    { href: '/tenant/documents',    label: 'Documents',     icon: FileText },
    { href: '/tenant/obligations',  label: 'Obligations',   icon: Scale },
    { href: '/intelligence',        label: 'Intelligence',  icon: Brain },
];

export function NavShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const active = isActive(pathname);
    const [tenantsOpen, setTenantsOpen] = useState(false);
    const [activeTenant, setActiveTenant] = useState<string | null>(null);
    const [syncingCatalog, setSyncingCatalog] = useState(false);
    const catalogLinkActive = pathname === TENANT_CATALOG_HREF || pathname.startsWith(`${TENANT_CATALOG_HREF}/`);

    // Read after mount, not during render — localStorage is unavailable during SSR.
    useEffect(() => { setActiveTenant(getActiveTenant()); }, []);

    // One-shot re-sync against Central straight from the sidebar, without having to
    // open the Catalog screen first — same POST /tenants/:name/catalog/sync the
    // screen's own Refresh button calls when tenantScoped.
    const handleSyncCatalog = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!activeTenant || syncingCatalog) return;
        setSyncingCatalog(true);
        try {
            await tenants.syncCatalog(activeTenant);
        } finally {
            setSyncingCatalog(false);
        }
    };

    return (
        <div className="flex h-screen bg-zinc-950 text-zinc-100">
            <TenantManagementDialog open={tenantsOpen} onClose={() => setTenantsOpen(false)} />
            <aside className="w-64 shrink-0 border-r border-zinc-800/60 flex flex-col overflow-y-auto">
                <div className="flex items-center gap-2.5 px-4 py-4 border-b border-zinc-800/60 shrink-0">
                    <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center shrink-0">
                        <ShieldCheck size={15} className="text-zinc-950" />
                    </div>
                    <div>
                        <p className="text-sm font-bold leading-tight">VYRA</p>
                        <p className="text-[10px] text-zinc-600 leading-tight">Compliance. Handled.</p>
                    </div>
                </div>

                <nav className="flex-1 px-3 py-3">
                    <Link
                        href="/catalog"
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs border transition-colors ${
                            active
                                ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                                : 'text-zinc-400 border-transparent hover:bg-zinc-900 hover:text-zinc-100'
                        }`}
                    >
                        <BookOpen size={13} className={active ? 'text-sky-400' : 'text-emerald-500'} />
                        Catalog
                    </Link>

                    <button
                        onClick={() => setTenantsOpen(true)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs border border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition-colors text-left"
                    >
                        <Layers size={13} className="text-emerald-500" />
                        Tenants
                    </button>

                    <p className="px-2.5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider">
                        {activeTenant ? (
                            <span className="text-sky-400">TENANT: {activeTenant}</span>
                        ) : (
                            <span className="text-zinc-600">Tenant</span>
                        )}
                    </p>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                            <Link
                                href={TENANT_CATALOG_HREF}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs border transition-colors flex-1 ${
                                    catalogLinkActive
                                        ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                                        : 'text-zinc-400 border-transparent hover:bg-zinc-900 hover:text-zinc-100'
                                }`}
                            >
                                <BookOpen size={13} className={catalogLinkActive ? 'text-sky-400' : 'text-zinc-500'} />
                                Catalog
                            </Link>
                            <button
                                onClick={handleSyncCatalog}
                                disabled={!activeTenant || syncingCatalog}
                                title="Sync with central"
                                className="p-1.5 rounded-md hover:bg-zinc-900 disabled:opacity-30 transition-colors shrink-0"
                            >
                                <RefreshCw size={12} className={`text-zinc-500 ${syncingCatalog ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                        {TENANT_SUB_LINKS.map(({ href, label, icon: Icon }) => {
                            const linkActive = pathname === href || pathname.startsWith(`${href}/`);
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs border transition-colors ${
                                        linkActive
                                            ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                                            : 'text-zinc-400 border-transparent hover:bg-zinc-900 hover:text-zinc-100'
                                    }`}
                                >
                                    <Icon size={13} className={linkActive ? 'text-sky-400' : 'text-zinc-500'} />
                                    {label}
                                </Link>
                            );
                        })}
                    </div>
                </nav>
            </aside>

            <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
        </div>
    );
}
