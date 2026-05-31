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
