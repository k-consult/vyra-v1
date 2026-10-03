'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, BookOpen } from 'lucide-react';

// Trimmed to a single entry point (2026-10-03, go-live customer track) — every
// other screen this nav used to list (Landscape, Calendar, Decision Gate,
// Assurance, Onboarding, ...) is still live and reachable by its own URL; this
// only removes the sidebar links, it deletes no routes and no pages.

const isActive = (pathname: string): boolean =>
    pathname === '/catalog' || pathname.startsWith('/catalog/');

export function NavShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const active = isActive(pathname);

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
                </nav>
            </aside>

            <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
        </div>
    );
}
