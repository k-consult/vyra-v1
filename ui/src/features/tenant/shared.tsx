'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export function LoadingState({ label }: { label: string }) {
    return (
        <div className="h-full bg-zinc-950 flex items-center justify-center">
            <div className="flex items-center gap-3 text-zinc-500">
                <RefreshCw size={16} className="animate-spin" />
                <span className="text-sm">{label}</span>
            </div>
        </div>
    );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="h-full bg-zinc-950 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <AlertTriangle size={20} className="text-amber-500" />
                <span className="text-sm text-zinc-500">Could not load data</span>
                <button onClick={onRetry} className="text-xs text-zinc-400 underline">Retry</button>
            </div>
        </div>
    );
}

export function RefreshButton({ onClick }: { onClick: () => void }) {
    return (
        <button onClick={onClick} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Refresh">
            <RefreshCw size={14} className="text-zinc-500" />
        </button>
    );
}
