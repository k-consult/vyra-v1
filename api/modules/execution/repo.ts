import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

const LIST_CAPAS = `
    MATCH (n:CAPA)
    RETURN properties(n) AS capa
    ORDER BY n.dueDate
`;

const LIST_VERIFICATIONS = `
    MATCH (n:Verification)
    RETURN properties(n) AS verification
    ORDER BY n.id
`;

export const listCapas = async () => {
    const raw: any = await db().fetch(LIST_CAPAS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.capa).filter(Boolean);
};

export const listVerifications = async () => {
    const raw: any = await db().fetch(LIST_VERIFICATIONS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.verification).filter(Boolean);
};

export const listPrograms = async () => {
    const cypher = `MATCH (p:Program) RETURN properties(p) AS program ORDER BY p.name`;
    return db().fetch(cypher, {});
};

export const listTasks = async (workflowId?: string) => {
    const cypher = workflowId
        ? `MATCH (t:Task)-[:PART_OF]->(w:Workflow {id: $id}) RETURN properties(t) AS task`
        : `MATCH (t:Task) RETURN properties(t) AS task LIMIT 200`;
    return db().fetch(cypher, { id: workflowId });
};

const UPDATE_TASK_STATUS = `
    MATCH (t:Task {id: $id})
    SET t.status = $status, t.statusUpdatedAt = datetime()
    RETURN properties(t) AS task
`;

export const updateTaskStatus = async (id: string, status: string) => {
    const raw: any = await db().exec(UPDATE_TASK_STATUS, { id, status });
    const row = Array.isArray(raw) ? raw[0] : raw;
    if (!row?.task) throw new Error(`Task not found: ${id}`);
    return row.task;
};

export interface Cadence {
    cadenceUnit: 'hour' | 'day' | 'week' | 'month';
    cadenceInterval: number;
    anchorDate: string;
}

const unitInDays: Record<Cadence['cadenceUnit'], number> = { hour: 1 / 24, day: 1, week: 7, month: 30 };

// Pure function — no DB call. Occurrence dates for a cadence within a horizon.
export const computeWindow = (cadence: Cadence, horizonWeeks: number): string[] => {
    const stepDays = unitInDays[cadence.cadenceUnit] * cadence.cadenceInterval;
    const horizonDays = horizonWeeks * 7;
    const anchor = new Date(cadence.anchorDate);

    const occurrences: string[] = [];
    for (let offset = 0; offset <= horizonDays; offset += stepDays) {
        const occurrence = new Date(anchor);
        occurrence.setDate(occurrence.getDate() + offset);
        occurrences.push(occurrence.toISOString().slice(0, 10));
    }
    // Sub-day cadences (e.g. hour) step faster than this window's day-level granularity —
    // dedupe so a task isn't reported as due dozens of times on the same calendar day.
    return Array.from(new Set(occurrences));
};

// Task -[:IMPLEMENTS]-> Control -[:IMPLEMENTS]-> Obligation — same chain
// graph.md's Execution Traceability pattern walks; every :Catalog-origin Task
// carries the full chain, which is the only source this calendar reads from.
const TASK_CALENDAR = `
    MATCH (s:Schedule)-[:APPLIES_TO]->(t:Task)-[:IMPLEMENTS]->(c:Control)-[:IMPLEMENTS]->(o:Obligation)
    RETURN properties(s) AS schedule, properties(t) AS task, properties(c) AS control, properties(o) AS obligation
    ORDER BY s.anchorDate
`;

export const fetchTaskCalendar = async (horizonWeeks = 52) => {
    const raw: any = await db().fetch(TASK_CALENDAR, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter(Boolean).map((r: any) => {
        const cadence: Cadence = {
            cadenceUnit: r.schedule.cadenceUnit,
            cadenceInterval: Number(r.schedule.cadenceInterval),
            anchorDate: r.schedule.anchorDate,
        };
        return {
            taskId: r.task.id,
            taskName: r.task.name,
            frequency: r.task.frequency,
            status: r.task.status,
            controlId: r.control.id,
            controlName: r.control.name,
            obligationId: r.obligation.id,
            obligationName: r.obligation.name,
            occurrences: computeWindow(cadence, horizonWeeks),
        };
    });
};
