'use client';

import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

export function Dialog({
    open,
    onClose,
    title,
    icon: Icon,
    headerActions,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    icon?: React.ComponentType<{ size?: number; className?: string }>;
    headerActions?: React.ReactNode;
    children: React.ReactNode;
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div
                className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 shrink-0">
                    <div className="flex items-center gap-2">
                        {Icon && <Icon size={14} className="text-zinc-400" />}
                        <p className="text-sm font-semibold text-zinc-100">{title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {headerActions}
                        <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">{children}</div>
            </div>
        </div>
    );
}

// Stacks above Dialog (z-60 > z-50) so it can confirm a destructive action taken
// from inside one, without the caller needing to coordinate z-index itself.
export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    danger,
    busy,
    onConfirm,
    onCancel,
}: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    if (!open) return null;

    // Portaled to body — a caller rendering this from inside a <tr> (e.g. a
    // per-row delete confirmation) would otherwise land a <div> as a direct
    // child of <tr>, which is invalid HTML and trips React hydration.
    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70" onClick={onCancel}>
            <div
                className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl p-4 flex flex-col gap-3"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2">
                    {danger && <AlertTriangle size={15} className="text-red-500 shrink-0" />}
                    <p className="text-sm font-semibold text-zinc-100">{title}</p>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{message}</p>
                <div className="flex justify-end gap-2 mt-1">
                    <button
                        onClick={onCancel}
                        disabled={busy}
                        className="text-xs px-3 py-1.5 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={busy}
                        className={`text-xs px-3 py-1.5 rounded font-medium disabled:opacity-60 ${
                            danger ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-emerald-600 text-zinc-950 hover:bg-emerald-500'
                        }`}
                    >
                        {busy ? 'Working…' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
