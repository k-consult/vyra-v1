'use client';

import { useEffect, useState, useMemo } from 'react';
import { AlertTriangle, RefreshCw, ShieldCheck, Clock, CheckCircle2 } from 'lucide-react';
import { execution } from '@/lib/api';
import { PageHeader } from '@/components/page-header';

// ── Types ──────────────────────────────────────────────────────────────────────

export type CalendarTask = {
    taskId: string;
    taskName: string;
    obligationId: string;
    obligationName: string;
    frequency: string;
    status?: string;
    controlId: string;
    controlName: string;
    occurrences: string[];
};

// Same anchor convention as cli/scripts/convert-catalog-seed.ts's parseWeekAnchor —
// naive 7-day blocks from 2026-01-01, not ISO week numbering.
export const CALENDAR_YEAR_START = new Date('2026-01-01T00:00:00.000Z').getTime();
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const TOTAL_WEEKS = 52;

export const weekNumberOf = (isoDate: string): number =>
    Math.floor((new Date(`${isoDate}T00:00:00.000Z`).getTime() - CALENDAR_YEAR_START) / WEEK_MS) + 1;

// ── Config ─────────────────────────────────────────────────────────────────────
//
// Categorical, not ordinal — matches journey/02-catalog-browsing.html's own
// CADENCE_COLOR exactly for Quarterly/Monthly/Annual (cyan/violet/amber); Daily/
// Weekly/Half-Yearly extend the same categorical palette for cadences the mock's
// static sample data never exercised but CPCB's real data does.
const FREQUENCY_COLOR: Record<string, string> = {
    Daily:         '#7dd3fc',
    Weekly:        '#6ee7b7',
    Monthly:       '#c4b5fd',
    Quarterly:     '#67e8f9',
    'Half-Yearly': '#fb923c',
    Annual:        '#fbbf24',
};
const CURRENT_WEEK_COLOR = '#38bdf8';

// Task.frequency holds the source's full descriptive text (e.g. CPCB's "Continuous,
// checked weekly"), not a bare legend word — an exact FREQUENCY_COLOR[frequency]
// lookup would silently miss every real task. Extract the period word instead,
// same resilient-match approach as convert-cpcb-seed.ts's parseFrequency().
const FREQUENCY_WORD = /\b(daily|weekly|monthly|quarterly|half-yearly|annual|annually)\b/i;
const CANONICAL_FREQUENCY: Record<string, string> = { annually: 'Annual', 'half-yearly': 'Half-Yearly' };
export const colorForFrequency = (frequency: string): string => {
    const match = frequency.match(FREQUENCY_WORD);
    if (!match) return '#71717a';
    const word = match[1].toLowerCase();
    const canonical = CANONICAL_FREQUENCY[word] ?? word[0].toUpperCase() + word.slice(1);
    return FREQUENCY_COLOR[canonical] ?? '#71717a';
};

const LEGEND: { label: string; color: string }[] = [
    { label: 'Daily',       color: FREQUENCY_COLOR.Daily },
    { label: 'Weekly',      color: FREQUENCY_COLOR.Weekly },
    { label: 'Monthly',     color: FREQUENCY_COLOR.Monthly },
    { label: 'Quarterly',   color: FREQUENCY_COLOR.Quarterly },
    { label: 'Half-Yearly', color: FREQUENCY_COLOR['Half-Yearly'] },
    { label: 'Annual',      color: FREQUENCY_COLOR.Annual },
    { label: 'Current week', color: CURRENT_WEEK_COLOR },
];

const WEEKS = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Sparse month labels over the 52-week axis — same projection
// journey/02-catalog-browsing.html's renderCalGrid uses: each month's 1st maps to
// a week number, and only that week's header cell carries the name.
const MONTH_LABEL_BY_WEEK: Record<number, string> = Object.fromEntries(
    MONTH_NAMES.map((name, i) => [weekNumberOf(new Date(Date.UTC(2026, i, 1)).toISOString().slice(0, 10)), name])
);

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

function WorklistRow({ task, date, urgent }: { task: CalendarTask; date: string; urgent: boolean }) {
    return (
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-zinc-800/60 last:border-b-0">
            <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-100 truncate" title={`${task.obligationName}\n${task.controlName} · ${task.frequency}`}>
                    {task.obligationName}
                </p>
                <p className="text-[11px] text-zinc-500 truncate">{task.controlName}</p>
            </div>
            <span className={`text-xs font-medium tabular-nums shrink-0 ${urgent ? 'text-red-400' : 'text-amber-400'}`}>
                {formatDate(date)}
            </span>
        </div>
    );
}

// ── Main view ──────────────────────────────────────────────────────────────────

// embedded: rendered inside another page's own shell (e.g. Catalog's Calendar
// tab) — skips the outer page frame, PageHeader, and footer, which the host
// page already provides, so the two don't stack. Still the standalone page at
// /calendar when embedded is false (default).
//
// controlIds: when given, the calendar is scoped to only the tasks implementing
// one of these Controls — how Catalog's own facet rail (Jurisdiction/Authority/
// Year/Control Mechanism) reaches into the embedded calendar. Undefined means
// unfiltered, same as the standalone /calendar page.
export function CalendarView({ embedded = false, controlIds }: { embedded?: boolean; controlIds?: Set<string> } = {}) {
    const [allTasks, setAllTasks] = useState<CalendarTask[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(false);
    const [hover, setHover]     = useState<Hover | null>(null);
    // Embedded (Catalog) is a static reference view — there is no enterprise
    // mapping yet for "who owes this by when", so the Worklist's overdue/due-soon
    // framing doesn't apply there; it goes straight to the 52-week template.
    // Worklist remains on the standalone /calendar page.
    const [calView, setCalView] = useState<'worklist' | 'grid'>(embedded ? 'grid' : 'worklist');

    const today = useMemo(() => new Date(), []);
    const todayWeek = useMemo(() => Math.min(TOTAL_WEEKS, Math.max(1, weekNumberOf(today.toISOString().slice(0, 10)))), [today]);

    const load = () => {
        setLoading(true);
        setError(false);
        execution.calendar(TOTAL_WEEKS)
            .then((r: any) => setAllTasks(r.calendar))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    const tasks = useMemo(() => {
        if (!allTasks) return null;
        return controlIds ? allTasks.filter(t => controlIds.has(t.controlId)) : allTasks;
    }, [allTasks, controlIds]);

    useEffect(load, []);

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

    const frameClass = embedded ? 'flex-1 min-h-0 flex flex-col overflow-hidden' : 'h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100';

    if (loading) {
        return (
            <div className={`${frameClass} items-center justify-center`}>
                <div className="flex items-center gap-3 text-zinc-500">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-sm">Loading 52-week calendar…</span>
                </div>
            </div>
        );
    }

    if (error || !tasks) {
        return (
            <div className={`${frameClass} items-center justify-center`}>
                <div className="flex flex-col items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <span className="text-sm text-zinc-500">Could not load calendar data</span>
                    <button onClick={load} className="text-xs text-zinc-400 underline">Retry</button>
                </div>
            </div>
        );
    }

    const viewToggle = (
        <div className="flex items-center gap-1 rounded-md border border-zinc-800 p-0.5">
            {([
                { key: 'worklist' as const, label: 'Worklist (preview)' },
                { key: 'grid' as const, label: '52-Week Grid (template)' },
            ]).map(v => (
                <button
                    key={v.key}
                    onClick={() => setCalView(v.key)}
                    className={`px-2.5 py-1 rounded text-[11px] transition-colors ${calView === v.key ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    {v.label}
                </button>
            ))}
        </div>
    );

    return (
        <div className={frameClass}>

            {embedded ? (
                <div className="px-6 py-3 border-b border-zinc-800/60 shrink-0 flex items-center justify-end">
                    <button onClick={load} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Refresh">
                        <RefreshCw size={14} className="text-zinc-500" />
                    </button>
                </div>
            ) : (
                <PageHeader icon={ShieldCheck} iconClassName="text-emerald-400" title="52-Week Compliance Calendar">
                    {viewToggle}
                    <button onClick={load} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Refresh">
                        <RefreshCw size={14} className="text-zinc-500" />
                    </button>
                </PageHeader>
            )}

            {/* ── Preview-only disclaimer — journey/02-catalog-browsing.html's own
                 cal-worklist-note: overdue/due-soon implies someone, somewhere, owes
                 this by a date, which only exists once this catalog is mapped to an
                 enterprise. This view's dates are the regulation's recurrence
                 template, not a live per-site assignment. ── */}
            {calView === 'worklist' && (
                <div className="text-[11px] text-zinc-500 bg-white/[0.02] border-b border-zinc-800/60 px-5 py-2.5 leading-relaxed shrink-0">
                    Preview only — a ranked worklist (overdue / due-soon) means <em className="text-zinc-400 italic">someone, somewhere, owes this by a date</em>, which only exists once this catalog is mapped to an enterprise. Cadence and next-due here reflect each regulation&apos;s own recurrence template, not a live per-site assignment. The real worklist lives in <b className="text-zinc-400 font-semibold">Obligation View</b> (Stage 4), where this same 52-week template is superimposed with actual facility/role assignments and live status.
                </div>
            )}

            {/* ── Worklist ── */}
            {calView === 'worklist' && (
                <section className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
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
                        <div className="grid gap-4 md:grid-cols-2">
                            {overdue.length > 0 && (
                                <div className="rounded-lg border border-red-900/50 bg-red-950/10 overflow-hidden self-start">
                                    <div className="px-3 py-2 border-b border-red-900/40 flex items-center gap-1.5">
                                        <AlertTriangle size={12} className="text-red-400" />
                                        <p className="text-[11px] font-semibold text-red-300 uppercase tracking-wider">Overdue · {overdue.length}</p>
                                    </div>
                                    {overdue.map(({ task, date }) => (
                                        <WorklistRow key={task.taskId} task={task} date={date} urgent />
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
                                        <WorklistRow key={task.taskId} task={task} date={date} urgent={false} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}

            {calView === 'grid' && (
                <div className="flex-1 min-h-0 overflow-auto px-5 py-4 flex flex-col gap-4">
                    {/* ── Legend — plain row of dots, no box, no icon, matching the mock ── */}
                    <div className="flex items-center gap-4 flex-wrap">
                        {LEGEND.map(({ label, color }) => (
                            <div key={label} className="flex items-center gap-1.5">
                                <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: color }} />
                                <span className="text-[11px] text-zinc-400">{label}</span>
                            </div>
                        ))}
                    </div>

                    {/* ── Matrix — a grey card (journey/02-catalog-browsing.html's
                         cal-grid-wrap), dots on a week axis (not shaded cells), flat
                         row background, sparse month labels, highlighted current week ── */}
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-x-auto">
                        <table className="border-collapse text-[9px] w-full">
                            <thead>
                                <tr>
                                    <th className="sticky left-0 z-20 bg-zinc-900 text-left px-3 py-2.5 border-b border-r border-zinc-800 min-w-[240px] max-w-[240px] text-zinc-200 font-normal">
                                        Obligation
                                    </th>
                                    {WEEKS.map(week => (
                                        <th
                                            key={week}
                                            title={`Week ${week} · ${weekStartOf(week)}`}
                                            className={`font-normal py-2.5 border-b border-r border-zinc-800/60 text-[9px] uppercase tracking-wide w-[22px] ${week === todayWeek ? 'bg-sky-500/10 text-sky-300' : 'text-zinc-500'}`}
                                        >
                                            {MONTH_LABEL_BY_WEEK[week] ?? ''}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map(task => {
                                    const weekMap = presence.get(task.taskId) ?? new Map<number, string[]>();
                                    return (
                                        <tr key={task.taskId}>
                                            <td
                                                title={`${task.obligationName}\n${task.controlName} · ${task.frequency}`}
                                                className="sticky left-0 z-10 bg-zinc-900 text-zinc-300 px-3 py-1.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[240px] border-b border-r border-zinc-800/60"
                                            >
                                                {task.obligationName}
                                            </td>
                                            {WEEKS.map(week => {
                                                const dates = weekMap.get(week);
                                                const isToday = week === todayWeek;
                                                return (
                                                    <td
                                                        key={week}
                                                        className={`p-0 w-[22px] h-[24px] text-center align-middle border-b border-r border-zinc-800/60 ${isToday ? 'bg-sky-500/10' : ''}`}
                                                        onMouseEnter={e => dates && setHover({ x: e.clientX, y: e.clientY, task, week, dates })}
                                                        onMouseLeave={() => setHover(null)}
                                                    >
                                                        {dates && (
                                                            <span
                                                                className="inline-block w-[7px] h-[7px] rounded-full"
                                                                style={{ backgroundColor: colorForFrequency(task.frequency) }}
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
                    <p className="text-center text-[9.5px] text-sky-300">
                        Today · week {todayWeek} of 52 ({today.toDateString()})
                    </p>
                </div>
            )}

            {/* ── Footer — host page (Catalog) already has one when embedded ── */}
            {!embedded && (
                <footer className="border-t border-zinc-800/60 px-6 py-2.5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-emerald-500 flex items-center justify-center">
                            <ShieldCheck size={9} className="text-zinc-950" />
                        </div>
                        <span className="text-[10px] text-zinc-600">Vyra Platform v1</span>
                    </div>
                    <p className="text-[10px] text-zinc-700">Compliance. Handled.</p>
                </footer>
            )}

            {/* ── Hover tooltip ── */}
            {hover && (
                <div
                    className="fixed z-50 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-2xl pointer-events-none max-w-xs"
                    style={{ left: hover.x + 14, top: hover.y + 14 }}
                >
                    <p className="text-xs font-semibold text-zinc-100">{hover.task.obligationName}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{hover.task.controlName}</p>
                    <p className="text-[11px] text-zinc-500 mt-1">Week {hover.week} · {hover.task.frequency}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{hover.dates.join(', ')}</p>
                </div>
            )}
        </div>
    );
}
