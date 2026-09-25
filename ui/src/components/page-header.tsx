import type { ReactNode } from 'react';

// Replaces the brand-square + "← Landscape" header every feature screen used to
// carry on its own — NavShell now owns brand and navigation once, globally.
export function PageHeader({ icon: Icon, iconClassName, title, subtitle, children }: {
    icon: React.ElementType;
    iconClassName: string;
    title: string;
    subtitle?: string;
    children?: ReactNode;
}) {
    return (
        <header className="border-b border-zinc-800/60 shrink-0">
            <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-2.5 min-w-0">
                    <Icon size={16} className={`${iconClassName} shrink-0`} />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-100 leading-tight truncate">{title}</p>
                        {subtitle && <p className="text-[11px] text-zinc-500 leading-tight truncate">{subtitle}</p>}
                    </div>
                </div>
                {children && <div className="flex items-center gap-3 shrink-0">{children}</div>}
            </div>
        </header>
    );
}
