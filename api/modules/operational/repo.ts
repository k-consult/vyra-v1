import * as R from 'ramda';
import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';
import log from '../../../lib/log';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

const LIST_FACILITIES = `
    MATCH (n:Facility)
    RETURN properties(n) AS facility
    ORDER BY n.name
`;

const LIST_VENDORS = `
    MATCH (n:Vendor)
    RETURN properties(n) AS vendor
    ORDER BY n.name
`;

export const listFacilities = async () => {
    try {
        const raw: any = await db().fetch2(LIST_FACILITIES, {});
        const rows = Array.isArray(raw) ? raw : [raw]; return rows.map((r: any) => r.facility).filter(Boolean);
    } catch (err: any) {
        log.error('operational.repo: listFacilities failed', err.message);
        return [];
    }
};

export const listVendors = async () => {
    try {
        const raw: any = await db().fetch2(LIST_VENDORS, {});
        const rows = Array.isArray(raw) ? raw : [raw]; return rows.map((r: any) => r.vendor).filter(Boolean);
    } catch (err: any) {
        log.error('operational.repo: listVendors failed', err.message);
        return [];
    }
};

const LIST_PEOPLE = `
    MATCH (p:Person)
    OPTIONAL MATCH (p)-[:WORKS_AT]->(fac:Facility)
    WITH p, collect(DISTINCT fac.id) AS facilityIds
    RETURN properties(p) AS person, facilityIds
    ORDER BY p.name
`;

export const listPeople = async () => {
    try {
        const raw: any = await db().fetch2(LIST_PEOPLE, {});
        const rows = Array.isArray(raw) ? raw : [raw];
        return rows.filter((r: any) => r?.person).map((r: any) => ({ ...r.person, facilityIds: r.facilityIds ?? [] }));
    } catch (err: any) {
        log.error('operational.repo: listPeople failed', err.message);
        return [];
    }
};

const LIST_INCIDENTS = `
    MATCH (inc:Incident)
    RETURN properties(inc) AS incident
    ORDER BY inc.incidentTime DESC
`;

export const listIncidents = async () => {
    try {
        const raw: any = await db().fetch2(LIST_INCIDENTS, {});
        const rows = Array.isArray(raw) ? raw : [raw];
        return rows.map((r: any) => r.incident).filter(Boolean);
    } catch (err: any) {
        log.error('operational.repo: listIncidents failed', err.message);
        return [];
    }
};

export const listAssets = async () => {
    try {
        const cypher = `MATCH (a:Asset) RETURN properties(a) AS asset ORDER BY a.name LIMIT 200`;
        return await db().fetch2(cypher, {});
    } catch (err: any) {
        log.error('operational.repo: listAssets failed', err.message);
        return [];
    }
};

export const listSignals = async (assetId?: string) => {
    try {
        const cypher = assetId
            ? `MATCH (a:Asset {id: $id})<-[:EMITTED_BY]-(s:Signal) RETURN properties(s) AS signal ORDER BY s.timestamp DESC LIMIT 100`
            : `MATCH (s:Signal) RETURN properties(s) AS signal ORDER BY s.timestamp DESC LIMIT 100`;
        return await db().fetch2(cypher, { id: assetId });
    } catch (err: any) {
        log.error('operational.repo: listSignals failed', err.message);
        return [];
    }
};

export interface CreateSignalInput {
    id: string;
    name?: string;
    type: string;
    source?: string;
    timestamp?: string;
    payload?: string;
    assetId: string;
}

const guardSignalInput = (input: Partial<CreateSignalInput>): CreateSignalInput => {
    if (!input.id || !input.assetId || !input.type) {
        throw new Error('Signal requires id, assetId, and type');
    }
    return {
        id: input.id,
        name: R.defaultTo(input.id, input.name),
        type: input.type,
        source: R.defaultTo('UNKNOWN', input.source),
        timestamp: R.defaultTo(new Date().toISOString(), input.timestamp),
        payload: R.defaultTo('', input.payload),
        assetId: input.assetId,
    };
};

// First non-CLI write path: writes directly via lib/graph-db, bypassing the CSV pipeline.
// Auto-creates a Task in the same round trip, resolving Control/Requirement coverage
// through Asset -[:COVERED_BY]-> Control (see cli/scripts/backfill-asset-control.ts) and
// the responsible Person through Facility (falls back to 'UNKNOWN' if nobody WORKS_AT
// that facility). WORKS_AT is many-valued (cli/scripts/generate-person-seed.ts) — a
// facility can have more than one Person, so the match is collapsed to one deterministic
// row (lowest person.id) before the Task is written, rather than left to arbitrary order.
const CREATE_SIGNAL_AND_TASK = `
    MATCH (a:Asset {id: $assetId})
    MERGE (s:Signal {id: $signalId})
    ON CREATE SET s += $signalProps, s.createdAt = datetime(), s.status = 'new'
    MERGE (s)-[:EMITTED_BY]->(a)
    WITH s, a
    OPTIONAL MATCH (a)-[:LOCATED_AT]->(fac:Facility)<-[:WORKS_AT]-(person:Person)
    WITH s, a, person ORDER BY person.id LIMIT 1
    OPTIONAL MATCH (a)-[:COVERED_BY]->(ctl:Control)-[:IMPLEMENTS]->(req:Requirement)
    WITH s, a, person, collect(DISTINCT ctl.id) AS controlIds, collect(DISTINCT req.id) AS requirementIds
    MERGE (t:Task {id: $taskId})
    ON CREATE SET
        t.name = $taskName,
        t.owner = coalesce(person.name, 'UNKNOWN'),
        t.priority = 'Medium',
        t.frequency = 'signal-driven',
        t.evidenceRequired = 'yes',
        t.status = 'open',
        t.createdAt = datetime(),
        t.controlIds = controlIds,
        t.requirementIds = requirementIds
    MERGE (s)-[:HAS_TASK]->(t)
    RETURN properties(s) AS signal, properties(t) AS task
`;

export const createSignal = async (input: Partial<CreateSignalInput>) => {
    const signal = guardSignalInput(input);
    const taskId = `TSK-${signal.id}`;
    const raw: any = await db().exec2(CREATE_SIGNAL_AND_TASK, {
        assetId: signal.assetId,
        signalId: signal.id,
        signalProps: { name: signal.name, type: signal.type, source: signal.source, timestamp: signal.timestamp, payload: signal.payload, assetId: signal.assetId },
        taskId,
        taskName: `Respond to ${signal.type} signal on ${signal.assetId}`,
    });
    const row = Array.isArray(raw) ? raw[0] : raw;
    if (!row?.signal) throw new Error(`Asset ${signal.assetId} not found`);
    return row;
};

const GET_LIFECYCLE = `
    MATCH (inc:Incident {id: $id})
    OPTIONAL MATCH (inc)-[:OCCURRED_AT]->(fac:Facility)
    OPTIONAL MATCH (inc)-[:GOVERNED_BY]->(reg:Regulation)
    OPTIONAL MATCH (inc)-[:FAILED_AGAINST]->(ctl:Control)
    OPTIONAL MATCH (inc)-[:HAS_TASK]->(tsk:Task)
    OPTIONAL MATCH (inc)-[:INVOLVES]->(ast:Asset)-[:SUPPLIED_BY]->(vnd:Vendor)
    OPTIONAL MATCH (inc)-[:HAS_FINDING]->(fnd:Finding)
    OPTIONAL MATCH (fnd)-[:AGAINST]->(fctl:Control)
    OPTIONAL MATCH (fnd)<-[:RAISED_BY]-(rsk:Risk)
    OPTIONAL MATCH (fnd)-[:ANALYSED_BY]->(rca:RCA)
    OPTIONAL MATCH (rca)-[:REQUIRES_CAPA]->(capa:CAPA)
    OPTIONAL MATCH (ver:Verification)-[:CLOSES]->(capa)
    OPTIONAL MATCH (evd:Evidence) WHERE evd.source = $id
    RETURN
        properties(inc)            AS incident,
        collect(DISTINCT properties(fac))  AS facilities,
        collect(DISTINCT properties(reg))  AS regulations,
        collect(DISTINCT properties(ctl))  AS controls,
        collect(DISTINCT properties(tsk))  AS tasks,
        collect(DISTINCT properties(ast))  AS assets,
        collect(DISTINCT properties(vnd))  AS vendors,
        collect(DISTINCT properties(fnd))  AS findings,
        collect(DISTINCT properties(fctl)) AS findingControls,
        collect(DISTINCT properties(rsk))  AS risks,
        collect(DISTINCT properties(rca))  AS rcas,
        collect(DISTINCT properties(capa)) AS capas,
        collect(DISTINCT properties(ver))  AS verifications,
        collect(DISTINCT properties(evd))  AS evidence
`;

export const getLifecycle = async (id: string) => {
    try {
        const raw = await db().fetch2(GET_LIFECYCLE, { id });
        // fetch2 unwraps single-record results to a plain object via flattenWhenScalar
        const row = Array.isArray(raw) ? raw[0] : raw;
        return row?.incident ? row : null;
    } catch (err: any) {
        log.error(`operational.repo: getLifecycle failed ${id}`, err.message);
        return null;
    }
};
