import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

const LIST_REGULATIONS = `
    MATCH (n:Regulation:Catalog)
    RETURN properties(n) AS regulation
    ORDER BY n.name
`;

const LIST_AUTHORITIES = `
    MATCH (n:Authority)
    RETURN properties(n) AS authority
    ORDER BY n.name
`;

const LIST_COMPLIANCE_AREAS = `
    MATCH (n:ComplianceArea)
    RETURN properties(n) AS complianceArea
    ORDER BY n.name
`;

const TRACE_OBLIGATIONS = `
    MATCH (reg:Regulation:Catalog {id: $id})-[:ISSUED_BY]->(auth:Authority)
    WITH reg
    MATCH (reg)<-[:BELONGS_TO]-(cls:Clause)<-[:DEFINED_BY]-(req:Obligation)
    RETURN properties(reg) AS regulation, properties(cls) AS clause, properties(req) AS obligation
    ORDER BY cls.clauseRef
`;

export const listRegulations = async () => {
    const raw: any = await db().fetch(LIST_REGULATIONS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.regulation).filter(Boolean);
};

export const listAuthorities = async () => {
    const raw: any = await db().fetch(LIST_AUTHORITIES, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.authority).filter(Boolean);
};

export const listComplianceAreas = async () => {
    const raw: any = await db().fetch(LIST_COMPLIANCE_AREAS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.complianceArea).filter(Boolean);
};

export const traceObligations = async (regulationId: string) => db().fetch(TRACE_OBLIGATIONS, { id: regulationId });

export interface Cadence {
    cadenceUnit: 'hour' | 'day' | 'week' | 'month';
    cadenceInterval: number;
    anchorDate: string;
}

const unitInDays: Record<Cadence['cadenceUnit'], number> = { hour: 1 / 24, day: 1, week: 7, month: 30 };

// Pure function — no DB call. Occurrence dates for a cadence within a horizon, per roadmap.md Phase 1.
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

const TASK_CALENDAR = `
    MATCH (s:Schedule)-[:APPLIES_TO]->(t:Task)-[:IMPLEMENTS]->(c:Control)
    RETURN properties(s) AS schedule, properties(t) AS task, properties(c) AS control
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
            occurrences: computeWindow(cadence, horizonWeeks),
        };
    });
};
