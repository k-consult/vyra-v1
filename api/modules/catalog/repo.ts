import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';
import log from '../../../lib/log';

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

const TRACE_REQUIREMENTS = `
    MATCH (reg:Regulation:Catalog {id: $id})-[:ISSUED_BY]->(auth:Authority)
    WITH reg
    MATCH (reg)<-[:BELONGS_TO]-(cls:Clause)<-[:DEFINED_BY]-(req:Requirement)
    RETURN properties(reg) AS regulation, properties(cls) AS clause, properties(req) AS requirement
    ORDER BY cls.clauseRef
`;

export const listRegulations = async () => {
    try {
        const raw: any = await db().fetch2(LIST_REGULATIONS, {});
        const rows = Array.isArray(raw) ? raw : [raw];
        return rows.map((r: any) => r.regulation).filter(Boolean);
    } catch (err: any) {
        log.error('catalog.repo: listRegulations failed', err.message);
        return [];
    }
};

export const listAuthorities = async () => {
    try {
        const raw: any = await db().fetch2(LIST_AUTHORITIES, {});
        const rows = Array.isArray(raw) ? raw : [raw];
        return rows.map((r: any) => r.authority).filter(Boolean);
    } catch (err: any) {
        log.error('catalog.repo: listAuthorities failed', err.message);
        return [];
    }
};

export const traceRequirements = async (regulationId: string) => {
    try {
        return await db().fetch2(TRACE_REQUIREMENTS, { id: regulationId });
    } catch (err: any) {
        log.error('catalog.repo: traceRequirements failed', err.message);
        return [];
    }
};

export interface Cadence {
    cadenceUnit: 'day' | 'week' | 'month';
    cadenceInterval: number;
    anchorDate: string;
}

const unitInDays: Record<Cadence['cadenceUnit'], number> = { day: 1, week: 7, month: 30 };

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
    return occurrences;
};
