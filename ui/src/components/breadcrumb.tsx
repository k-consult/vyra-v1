import Link from 'next/link';
import { ChevronRight, ShieldCheck } from 'lucide-react';

type Crumb = { label: string; href?: string };

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
    return (
        <nav className="flex items-center gap-1.5 text-xs text-zinc-500 mb-6">
            <Link href="/" className="flex items-center gap-1.5 hover:text-zinc-300 transition-colors">
                <ShieldCheck size={12} className="text-emerald-500" />
                <span>Home</span>
            </Link>
            {crumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5">
                    <ChevronRight size={11} className="text-zinc-700" />
                    {crumb.href
                        ? <Link href={crumb.href} className="hover:text-zinc-300 transition-colors">{crumb.label}</Link>
                        : <span className="text-zinc-300">{crumb.label}</span>}
                </span>
            ))}
        </nav>
    );
}
