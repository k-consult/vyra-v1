'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

// Real build of the JTBD nav-shell mockup — grouped by the 7-layer operating
// model's persona/JTBD (foundation.md), not by graph domain. Only two states
// remain today (live / no screen yet) — move #2 eliminated "split needed" by
// giving Ops Supervisor and Risk Manager their own screens.

type NavLink = { kind: 'link'; label: string; href: string };
type NavGap  = { kind: 'gap'; label: string; note: string };
type NavRow = NavLink | NavGap;
type NavGroup = { layer: string; persona: string; items: NavRow[] };

const GROUPS: NavGroup[] = [
    { layer: 'L1', persona: 'Catalog Admin', items: [
        { kind: 'link', label: 'Regulations & Standards', href: '/knowledge' },
        { kind: 'link', label: 'Contracts & SOPs', href: '/enterprise/contracts' },
    ] },
    { layer: 'L2', persona: 'Ops Admin', items: [
        { kind: 'gap', label: 'Applicability Scoping', note: 'No screen yet — data only via Landscape drill-down' },
        { kind: 'gap', label: 'Obligation Linkage', note: 'No screen yet — data only via Landscape drill-down' },
    ] },
    { layer: 'L3', persona: 'Planner', items: [
        { kind: 'link', label: '52-Week Calendar', href: '/calendar' },
        { kind: 'gap', label: 'Location + Role Assignment', note: 'Role data is live in the graph — no screen surfaces it yet' },
    ] },
    { layer: 'L5', persona: 'Ops Supervisor', items: [
        { kind: 'link', label: 'Deviation Alerts', href: '/ops-supervisor' },
        { kind: 'gap', label: 'Escalation Paths', note: 'ESCALATES_TO edges exist on Incident — no route reads them yet' },
    ] },
    { layer: 'L6', persona: 'Compliance Mgmt', items: [
        { kind: 'link', label: 'Coverage Scoring', href: '/assurance' },
        { kind: 'link', label: 'Audit-Ready Export', href: '/assurance' },
    ] },
    { layer: 'L7', persona: 'Risk Manager', items: [
        { kind: 'link', label: 'Residual Risk Score', href: '/risk-manager' },
        { kind: 'gap', label: 'Scenario Simulation', note: 'Not built (Gap #7) — /simulator is a different, test-data tool' },
    ] },
];

const CROSS_CUTTING: NavRow[] = [
    { kind: 'link', label: 'Landscape', href: '/' },
    { kind: 'link', label: 'Decision Gate · L4 Review', href: '/intelligence' },
    { kind: 'link', label: 'Validation — Lifecycle', href: '/validation/lifecycle' },
    { kind: 'link', label: 'Validation — Traceability', href: '/validation/traceability' },
];

const OTHER: NavRow[] = [
    { kind: 'link', label: 'Simulator (test-data tool)', href: '/simulator' },
];

const isActive = (pathname: string, href: string): boolean =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

function NavRowView({ row, active }: { row: NavRow; active: boolean }) {
    if (row.kind === 'gap') {
        return (
            <span
                title={row.note}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-zinc-600 cursor-default"
            >
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 shrink-0" />
                {row.label}
            </span>
        );
    }
    return (
        <Link
            href={row.href}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs border transition-colors ${
                active
                    ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                    : 'text-zinc-400 border-transparent hover:bg-zinc-900 hover:text-zinc-100'
            }`}
        >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-sky-400' : 'bg-emerald-600'}`} />
            {row.label}
        </Link>
    );
}

function NavGroupView({ layer, persona, items, pathname }: NavGroup & { pathname: string }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 px-2.5 mb-0.5">
                <span className="text-[9px] font-mono text-zinc-700">{layer}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{persona}</span>
            </div>
            {items.map(item => (
                <NavRowView key={item.label} row={item} active={item.kind === 'link' && isActive(pathname, item.href)} />
            ))}
        </div>
    );
}

function NavSection({ title, items, pathname }: { title: string; items: NavRow[]; pathname: string }) {
    return (
        <div className="flex flex-col gap-1 pt-2 border-t border-zinc-800/60">
            <div className="px-2.5 mb-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{title}</span>
            </div>
            {items.map(item => (
                <NavRowView key={item.label} row={item} active={item.kind === 'link' && isActive(pathname, item.href)} />
            ))}
        </div>
    );
}

export function NavShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex h-screen bg-zinc-950 text-zinc-100">
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

                <nav className="flex-1 px-3 py-3 flex flex-col gap-4">
                    {GROUPS.map(group => (
                        <NavGroupView key={group.persona} {...group} pathname={pathname} />
                    ))}
                    <NavSection title="Cross-cutting" items={CROSS_CUTTING} pathname={pathname} />
                    <NavSection title="Other" items={OTHER} pathname={pathname} />
                </nav>
            </aside>

            <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
        </div>
    );
}
