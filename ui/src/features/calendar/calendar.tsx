'use client';

import { useEffect, useState, useMemo } from 'react';
import { AlertTriangle, RefreshCw, ShieldCheck, Grid3x3, Clock, ChevronDown, CheckCircle2 } from 'lucide-react';
import { catalog, execution } from '@/lib/api';
import { PageHeader } from '@/components/page-header';

// ── Types ──────────────────────────────────────────────────────────────────────

export type CalendarTask = {
    taskId: string;
    taskName: string;
    frequency: string;
    status?: string;
    controlId: string;
    controlName: string;
    occurrences: string[];
};

const TASK_STATUSES = ['open', 'in-progress', 'done', 'closed'] as const;

// Same anchor convention as cli/scripts/convert-catalog-seed.ts's parseWeekAnchor —
// naive 7-day blocks from 2026-01-01, not ISO week numbering.
export const CALENDAR_YEAR_START = new Date('2026-01-01T00:00:00.000Z').getTime();
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const TOTAL_WEEKS = 52;

export const weekNumberOf = (isoDate: string): number =>
    Math.floor((new Date(`${isoDate}T00:00:00.000Z`).getTime() - CALENDAR_YEAR_START) / WEEK_MS) + 1;

// ── Config ─────────────────────────────────────────────────────────────────────
//
// Single-hue (blue) ordinal ramp — order encodes recurrence density (frequent →
// rare), not arbitrary category identity. Validated with the dataviz skill's
// validate_palette.js against this app's actual dark surface (#09090b, Tailwind
// zinc-950): `--ordinal --mode dark --surface "#09090b"` — all checks pass
// (monotone lightness, adjacent ΔL ≥ 0.06, light-end contrast 2.45:1). The two
// lowest-volume frequencies (Hourly: 1 task, Fortnightly: 1 task) share their
// nearest neighbor's step rather than each claiming a dedicated one — 8 discrete
// steps don't fit this ramp's usable dark-mode band (100–600) with a legal gap,
// per the skill's ordinal spacing rule.
const FREQUENCY_COLOR: Record<string, string> = {
    Hourly:        '#cde2fb',
    Daily:         '#cde2fb',
    Weekly:        '#9ec5f4',
    Fortnightly:   '#9ec5f4',
    Monthly:       '#6da7ec',
    Quarterly:     '#3987e5',
    'Half-Yearly': '#256abf',
    Annual:        '#184f95',
};

const LEGEND: { label: string; color: string }[] = [
    { label: 'Hourly / Daily',        color: '#cde2fb' },
    { label: 'Weekly / Fortnightly',  color: '#9ec5f4' },
    { label: 'Monthly',               color: '#6da7ec' },
    { label: 'Quarterly',             color: '#3987e5' },
    { label: 'Half-Yearly',           color: '#256abf' },
    { label: 'Annual',                color: '#184f95' },
];

const WEEKS = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);
const QUARTER_WEEKS = new Set([13, 26, 39, 52]);

const weekStartOf = (week: number): string =>
    new Date(CALENDAR_YEAR_START + (week - 1) * WEEK_MS).toISOString().slice(0, 10);

type Hover = { x: number; y: number; task: CalendarTask; week: number; dates: string[] };

// ── Worklist ───────────────────────────────────────────────────────────────────
// Ranks tasks by urgency instead of requiring a full 52-week grid scan — derived
// entirely from data already fetched (occurrences + status), no new API calls.

const DUE_SOON_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

const isOpenStatus = (status?: string): boolean => !['done', 'closed'].includes(status ?? 'open');

const formatDate = (isoDate: string): string =>
    new Date(`${isoDate}T00:00:00.000Z`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' });

type WorklistEntry = { task: CalendarTask; date: string };

function WorklistRow({ task, date, urgent, onStatusChange }: {
    task: CalendarTask; date: string; urgent: boolean; onStatusChange: (status: string) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-zinc-800/60 last:border-b-0">
            <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-100 truncate">{task.taskName}</p>
                <p className="text-[11px] text-zinc-500 truncate">{task.controlName}</p>
            </div>
            <span className={`text-xs font-medium tabular-nums shrink-0 ${urgent ? 'text-red-400' : 'text-amber-400'}`}>
                {formatDate(date)}
            </span>
            <select
                value={task.status ?? 'open'}
                onChange={e => onStatusChange(e.target.value)}
                className="shrink-0 text-[11px] bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-zinc-400"
            >
                {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
        </div>
    );
}

// ── Main view ──────────────────────────────────────────────────────────────────

export function CalendarView() {
    const [tasks, setTasks]     = useState<CalendarTask[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(false);
    const [hover, setHover]     = useState<Hover | null>(null);
    const [showGrid, setShowGrid] = useState(false);

    const today = useMemo(() => new Date(), []);

    const load = () => {
        setLoading(true);
        setError(false);
        catalog.calendar(TOTAL_WEEKS)
            .then(r => setTasks(r.calendar))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const updateStatus = (taskId: string, status: string) => {
        execution.updateTaskStatus(taskId, status)
            .then(() => setTasks(prev => prev && prev.map(t => (t.taskId === taskId ? { ...t, status } : t))))
            .catch(() => setError(true));
    };

    // taskId -> week -> occurrence dates that week
    const presence = useMemo(() => {
        const map = new Map<string, Map<number, string[]>>();
        for (const task of tasks ?? []) {
            const weekMap = new Map<number, string[]>();
            for (const date of task.occurrences) {
                const week = weekNumberOf(date);
                if (week < 1 || week > TOTAL_WEEKS) continue;
                (weekMap.get(week) ?? weekMap.set(week, []).get(week)!).push(date);
            }
            map.set(task.taskId, weekMap);
        }
        return map;
    }, [tasks]);

    const { overdue, dueSoon } = useMemo(() => {
        const overdueList: WorklistEntry[] = [];
        const dueSoonList: WorklistEntry[] = [];
        const todayMs = today.getTime();

        for (const task of tasks ?? []) {
            if (!task.occurrences.length) continue;
            const sorted = [...task.occurrences].sort();
            const past = sorted.filter(d => new Date(`${d}T00:00:00.000Z`).getTime() <= todayMs);
            const future = sorted.filter(d => new Date(`${d}T00:00:00.000Z`).getTime() > todayMs);

            if (past.length && isOpenStatus(task.status)) {
                overdueList.push({ task, date: past[past.length - 1] });
                continue;
            }
            if (future.length) {
                const nextMs = new Date(`${future[0]}T00:00:00.000Z`).getTime();
                if (nextMs - todayMs <= DUE_SOON_WINDOW_MS) dueSoonList.push({ task, date: future[0] });
            }
        }

        overdueList.sort((a, b) => a.date.localeCompare(b.date));
        dueSoonList.sort((a, b) => a.date.localeCompare(b.date));
        return { overdue: overdueList, dueSoon: dueSoonList };
    }, [tasks, today]);

    if (loading) {
        return (
            <div className="h-full bg-zinc-950 flex items-center justify-center">
                <div className="flex items-center gap-3 text-zinc-500">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-sm">Loading 52-week calendar…</span>
                </div>
            </div>
        );
    }

    if (error || !tasks) {
        return (
            <div className="h-full bg-zinc-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <span className="text-sm text-zinc-500">Could not load calendar data</span>
                    <button onClick={load} className="text-xs text-zinc-400 underline">Retry</button>
                </div>
            </div>
        );
    }

    const cellBorder = (week: number) =>
        QUARTER_WEEKS.has(week) ? 'border-r border-zinc-700' : 'border-r border-zinc-800/50';

    return (
        <div className="h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">

            <PageHeader icon={ShieldCheck} iconClassName="text-emerald-400" title="52-Week Compliance Calendar">
                <button onClick={load} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Refresh">
                    <RefreshCw size={14} className="text-zinc-500" />
                </button>
            </PageHeader>

            {/* ── Worklist ── */}
            <section className="px-6 py-5 border-b border-zinc-800/60 shrink-0">
                <div className="flex items-center gap-2 mb-4">
                    <Clock size={11} className="text-zinc-600" />
                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                        Week {weekNumberOf(today.toISOString().slice(0, 10))} of 52
                    </p>
                    <span className="text-zinc-700">·</span>
                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                        {overdue.length} overdue · {dueSoon.length} due in the next 14 days
                    </p>
                </div>

                {overdue.length === 0 && dueSoon.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-zinc-500 py-6 border border-dashed border-zinc-800 rounded-lg">
                        <CheckCircle2 size={15} className="text-emerald-500" />
                        All caught up — nothing overdue or due in the next 14 days.
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 max-h-[42vh] overflow-y-auto">
                        {overdue.length > 0 && (
                            <div className="rounded-lg border border-red-900/50 bg-red-950/10 overflow-hidden self-start">
                                <div className="px-3 py-2 border-b border-red-900/40 flex items-center gap-1.5">
                                    <AlertTriangle size={12} className="text-red-400" />
                                    <p className="text-[11px] font-semibold text-red-300 uppercase tracking-wider">Overdue · {overdue.length}</p>
                                </div>
                                {overdue.map(({ task, date }) => (
                                    <WorklistRow key={task.taskId} task={task} date={date} urgent onStatusChange={s => updateStatus(task.taskId, s)} />
                                ))}
                            </div>
                        )}
                        {dueSoon.length > 0 && (
                            <div className="rounded-lg border border-amber-900/40 bg-amber-950/10 overflow-hidden self-start">
                                <div className="px-3 py-2 border-b border-amber-900/30 flex items-center gap-1.5">
                                    <Clock size={12} className="text-amber-400" />
                                    <p className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">Due soon · {dueSoon.length}</p>
                                </div>
                                {dueSoon.map(({ task, date }) => (
                                    <WorklistRow key={task.taskId} task={task} date={date} urgent={false} onStatusChange={s => updateStatus(task.taskId, s)} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <button
                    onClick={() => setShowGrid(v => !v)}
                    className="mt-4 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                    <ChevronDown size={13} className={`transition-transform ${showGrid ? 'rotate-180' : ''}`} />
                    {showGrid ? 'Hide full 52-week grid' : 'View full 52-week grid'}
                </button>
            </section>

            {showGrid && (
                <>
                    {/* ── Info + legend ── */}
                    <div className="px-6 py-2.5 border-b border-zinc-800/60 shrink-0 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Grid3x3 size={11} className="text-zinc-600" />
                            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                                {tasks.length} scheduled tasks × 52 weeks · hover a cell for details
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Frequency</span>
                            {LEGEND.map(({ label, color }) => (
                                <div key={label} className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                                    <span className="text-[10px] text-zinc-500">{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Matrix ── */}
                    <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
                        <table className="border-collapse text-[9px]">
                            <thead>
                                <tr>
                                    <th className="sticky left-0 top-0 z-20 bg-zinc-950 text-left px-3 py-1.5 border-b border-r border-zinc-700 min-w-[240px] max-w-[240px]">
                                        Task
                                    </th>
                                    {WEEKS.map(week => (
                                        <th
                                            key={week}
                                            title={`Week ${week} · ${weekStartOf(week)}`}
                                            className={`sticky top-0 z-10 bg-zinc-950 text-zinc-500 font-normal py-1.5 border-b border-zinc-700 ${cellBorder(week)} w-[20px]`}
                                        >
                                            {week}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map((task, ti) => {
                                    const weekMap = presence.get(task.taskId) ?? new Map<number, string[]>();
                                    const rowShade = ti % 2 === 0 ? 'bg-zinc-950' : 'bg-zinc-900/30';
                                    return (
                                        <tr key={task.taskId} className="group">
                                            <td
                                                title={`${task.controlName} · ${task.frequency}`}
                                                className={`sticky left-0 z-10 ${rowShade} group-hover:bg-zinc-800 text-zinc-300 px-3 py-1 border-r border-b border-zinc-700 whitespace-nowrap overflow-hidden text-ellipsis max-w-[240px]`}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className="overflow-hidden text-ellipsis">{task.taskName}</span>
                                                    <select
                                                        value={task.status ?? 'open'}
                                                        onChange={e => updateStatus(task.taskId, e.target.value)}
                                                        onClick={e => e.stopPropagation()}
                                                        className="shrink-0 text-[9px] bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-zinc-400"
                                                    >
                                                        {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                            </td>
                                            {WEEKS.map(week => {
                                                const dates = weekMap.get(week);
                                                return (
                                                    <td
                                                        key={week}
                                                        className={`${rowShade} group-hover:bg-zinc-800/60 border-b border-zinc-800/50 ${cellBorder(week)} p-0 w-[20px] h-[20px]`}
                                                        onMouseEnter={e => dates && setHover({ x: e.clientX, y: e.clientY, task, week, dates })}
                                                        onMouseLeave={() => setHover(null)}
                                                    >
                                                        {dates && (
                                                            <div
                                                                className="w-full h-full rounded-[2px] m-[2px]"
                                                                style={{ backgroundColor: FREQUENCY_COLOR[task.frequency] ?? '#71717a', width: 'calc(100% - 4px)', height: 'calc(100% - 4px)' }}
                                                            />
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

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

            {/* ── Hover tooltip ── */}
            {hover && (
                <div
                    className="fixed z-50 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-2xl pointer-events-none max-w-xs"
                    style={{ left: hover.x + 14, top: hover.y + 14 }}
                >
                    <p className="text-xs font-semibold text-zinc-100">{hover.task.taskName}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{hover.task.controlName}</p>
                    <p className="text-[11px] text-zinc-500 mt-1">Week {hover.week} · {hover.task.frequency}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{hover.dates.join(', ')}</p>
                </div>
            )}
        </div>
    );
}
