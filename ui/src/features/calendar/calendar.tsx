'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, ShieldCheck, CalendarDays, ArrowLeft } from 'lucide-react';
import { catalog } from '@/lib/api';
import { DrillDrawer } from '@/features/landscape/landscape';

// ── Types ──────────────────────────────────────────────────────────────────────

export type CalendarTask = {
    taskId: string;
    taskName: string;
    frequency: string;
    controlId: string;
    controlName: string;
    occurrences: string[];
};

type WeekItem = { task: CalendarTask; date: string };

// Same anchor convention as cli/scripts/convert-catalog-seed.ts's parseWeekAnchor —
// naive 7-day blocks from 2026-01-01, not ISO week numbering.
export const CALENDAR_YEAR_START = new Date('2026-01-01T00:00:00.000Z').getTime();
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const TOTAL_WEEKS = 52;

export const weekNumberOf = (isoDate: string): number =>
    Math.floor((new Date(`${isoDate}T00:00:00.000Z`).getTime() - CALENDAR_YEAR_START) / WEEK_MS) + 1;

const FREQUENCY_COLORS: Record<string, string> = {
    Hourly:       'bg-fuchsia-900 text-fuchsia-300 border-fuchsia-700',
    Daily:        'bg-rose-900 text-rose-300 border-rose-700',
    Weekly:       'bg-sky-900 text-sky-300 border-sky-700',
    Fortnightly:  'bg-cyan-900 text-cyan-300 border-cyan-700',
    Monthly:      'bg-emerald-900 text-emerald-300 border-emerald-700',
    Quarterly:    'bg-amber-900 text-amber-300 border-amber-700',
    'Half-Yearly':'bg-orange-900 text-orange-300 border-orange-700',
    Annual:       'bg-violet-900 text-violet-300 border-violet-700',
};

// ── Main view ──────────────────────────────────────────────────────────────────

export function CalendarView() {
    const [tasks, setTasks]     = useState<CalendarTask[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(false);
    const [drillTask, setDrillTask] = useState<CalendarTask | null>(null);

    const load = () => {
        setLoading(true);
        setError(false);
        catalog.calendar(TOTAL_WEEKS)
            .then(r => setTasks(r.calendar))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const weeks = useMemo(() => {
        const buckets: WeekItem[][] = Array.from({ length: TOTAL_WEEKS }, () => []);
        for (const task of tasks ?? []) {
            for (const date of task.occurrences) {
                const week = weekNumberOf(date);
                if (week >= 1 && week <= TOTAL_WEEKS) buckets[week - 1].push({ task, date });
            }
        }
        return buckets;
    }, [tasks]);

    const openDrill = useCallback((task: CalendarTask) => setDrillTask(task), []);
    const closeDrill = useCallback(() => setDrillTask(null), []);

    if (loading) {
        return (
            <div className="h-screen bg-zinc-950 flex items-center justify-center">
                <div className="flex items-center gap-3 text-zinc-500">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-sm">Loading 52-week calendar…</span>
                </div>
            </div>
        );
    }

    if (error || !tasks) {
        return (
            <div className="h-screen bg-zinc-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <span className="text-sm text-zinc-500">Could not load calendar data</span>
                    <button onClick={load} className="text-xs text-zinc-400 underline">Retry</button>
                </div>
            </div>
        );
    }

    const drillItems = drillTask ? [{
        id: drillTask.taskId,
        name: drillTask.taskName,
        control: drillTask.controlName,
        frequency: drillTask.frequency,
        occurrences: drillTask.occurrences.join(', '),
    }] : [];

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">

            {/* ── Header ── */}
            <header className="border-b border-zinc-800/60 shrink-0">
                <div className="flex items-center justify-between px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
                            <ShieldCheck size={18} className="text-zinc-950" />
                        </div>
                        <div>
                            <p className="text-base font-semibold leading-tight">VYRA</p>
                            <p className="text-xs text-zinc-500 leading-tight">52-Week Compliance Calendar</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-5">
                        <button onClick={load} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Refresh">
                            <RefreshCw size={14} className="text-zinc-500" />
                        </button>
                        <Link href="/calendar/matrix" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
                            Matrix view (v2)
                        </Link>
                        <Link href="/" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
                            <ArrowLeft size={13} /> Landscape
                        </Link>
                    </div>
                </div>
            </header>

            <div className="px-6 py-3 border-b border-zinc-800/60 shrink-0 flex items-center gap-2">
                <CalendarDays size={11} className="text-zinc-600" />
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                    {tasks.length} scheduled tasks · click any task to see its control &amp; full occurrence list
                </p>
            </div>

            {/* ── Weeks ── */}
            <div className="flex-1 min-h-0 overflow-auto px-6 py-4 flex flex-col gap-1.5">
                {weeks.map((items, i) => {
                    const week = i + 1;
                    const weekStart = new Date(CALENDAR_YEAR_START + i * WEEK_MS).toISOString().slice(0, 10);
                    return (
                        <div key={week} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-2">
                            <div className="w-24 shrink-0">
                                <p className="text-[10px] font-mono text-zinc-600">Week {String(week).padStart(2, '0')}</p>
                                <p className="text-[10px] text-zinc-600">{weekStart}</p>
                            </div>
                            <div className="w-px h-8 bg-zinc-800 shrink-0" />
                            <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
                                {items.length === 0 && <span className="text-[11px] text-zinc-700 italic">—</span>}
                                {items.map(({ task, date }) => (
                                    <button
                                        key={`${task.taskId}-${date}`}
                                        onClick={() => openDrill(task)}
                                        className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] transition-opacity hover:opacity-80 ${FREQUENCY_COLORS[task.frequency] ?? 'bg-zinc-800 text-zinc-300 border-zinc-600'}`}
                                        title={task.controlName}
                                    >
                                        {task.taskName}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Footer ── */}
            <footer className="border-t border-zinc-800/60 px-6 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-emerald-500 flex items-center justify-center">
                        <ShieldCheck size={9} className="text-zinc-950" />
                    </div>
                    <span className="text-[10px] text-zinc-600">Vyra Platform v1</span>
                </div>
                <p className="text-[10px] text-zinc-700">Compliance. Handled.</p>
            </footer>

            {/* ── Drill drawer ── */}
            {drillTask && (
                <>
                    <div className="fixed inset-0 bg-zinc-950/60 z-40" onClick={closeDrill} />
                    <DrillDrawer title={drillTask.taskName} items={drillItems} loading={false} onClose={closeDrill} />
                </>
            )}
        </div>
    );
}
