import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';
import log from '../../../lib/log';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

export const listFindings = async () => {
    try {
        const cypher = `MATCH (f:Finding) RETURN properties(f) AS finding ORDER BY f.severity, f.detectedAt DESC LIMIT 200`;
        const raw: any = await db().fetch2(cypher, {});
        const rows = Array.isArray(raw) ? raw : [raw]; return rows.map((r: any) => r.finding).filter(Boolean);
    } catch (err: any) {
        log.error('intelligence.repo: listFindings failed', err.message);
        return [];
    }
};

export const listRisks = async () => {
    try {
        const cypher = `MATCH (r:Risk) RETURN properties(r) AS risk ORDER BY r.inherentScore DESC LIMIT 200`;
        const raw: any = await db().fetch2(cypher, {});
        const rows = Array.isArray(raw) ? raw : [raw]; return rows.map((r: any) => r.risk).filter(Boolean);
    } catch (err: any) {
        log.error('intelligence.repo: listRisks failed', err.message);
        return [];
    }
};

const LIST_RCAS = `
    MATCH (n:RCA)
    RETURN properties(n) AS rca
    ORDER BY n.analysedAt DESC
`;

export const listRcas = async () => {
    try {
        const raw: any = await db().fetch2(LIST_RCAS, {});
        const rows = Array.isArray(raw) ? raw : [raw]; return rows.map((r: any) => r.rca).filter(Boolean);
    } catch (err: any) {
        log.error('intelligence.repo: listRcas failed', err.message);
        return [];
    }
};

export const listDecisions = async () => {
    try {
        const cypher = `MATCH (d:Decision) RETURN properties(d) AS decision ORDER BY d.decidedAt DESC LIMIT 100`;
        const raw: any = await db().fetch2(cypher, {});
        const rows = Array.isArray(raw) ? raw : [raw]; return rows.map((r: any) => r.decision).filter(Boolean);
    } catch (err: any) {
        log.error('intelligence.repo: listDecisions failed', err.message);
        return [];
    }
};

const GET_REVERSE_TRACE = `
    MATCH (inc:Incident {id: $id})
    OPTIONAL MATCH (inc)-[:GOVERNED_BY]->(reg:Regulation)
    OPTIONAL MATCH (inc)-[:INVOLVES]->(ast:Asset)-[:SUPPLIED_BY]->(vnd:Vendor)
    OPTIONAL MATCH (inc)-[:FAILED_AGAINST]->(ctl:Control)
    OPTIONAL MATCH (inc)-[:HAS_FINDING]->(fnd:Finding)
    OPTIONAL MATCH (fnd)-[:AGAINST]->(fctl:Control)
    OPTIONAL MATCH (fnd)<-[:RAISED_BY]-(rsk:Risk)
    OPTIONAL MATCH (fnd)-[:ANALYSED_BY]->(rca:RCA)
    OPTIONAL MATCH (rca)-[:REQUIRES_CAPA]->(capa:CAPA)
    RETURN
        properties(inc)                    AS incident,
        collect(DISTINCT properties(reg))  AS regulations,
        collect(DISTINCT properties(ast))  AS assets,
        collect(DISTINCT properties(vnd))  AS vendors,
        collect(DISTINCT properties(ctl))  AS incidentControls,
        collect(DISTINCT properties(fnd))  AS findings,
        collect(DISTINCT properties(fctl)) AS findingControls,
        collect(DISTINCT properties(rsk))  AS risks,
        collect(DISTINCT properties(rca))  AS rcas,
        collect(DISTINCT properties(capa)) AS capas
`;

const layerStatus = (a: any[], b: any[]): 'full' | 'partial' | 'missing' => {
    if (a.length > 0 && b.length > 0) return 'full';
    if (a.length > 0 || b.length > 0) return 'partial';
    return 'missing';
};

export const getReverseTrace = async (id: string) => {
    try {
        const raw = await db().fetch2(GET_REVERSE_TRACE, { id });
        // fetch2 unwraps single-record results to a plain object via flattenWhenScalar
        const r = Array.isArray(raw) ? raw[0] : raw;
        if (!r?.incident) return null;
        const controls = [...r.incidentControls, ...r.findingControls].filter(
            (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i
        );
        return {
            layers: {
                l1: {
                    status: r.incident ? 'full' : 'missing',
                    incident: r.incident,
                },
                l2: {
                    status: layerStatus(r.findings, r.risks),
                    findings: r.findings,
                    risks: r.risks,
                },
                l3: {
                    status: layerStatus(controls, r.assets),
                    controls,
                    assets: r.assets,
                    vendors: r.vendors,
                },
                l4: {
                    status: 'partial',
                    rcas: r.rcas,
                    capas: r.capas,
                    note: 'Requirement nodes not loaded — forward obligation trace unavailable',
                },
                l5: {
                    status: 'partial',
                    regulations: r.regulations,
                    note: 'No clause/section/page references in current graph',
                },
            },
        };
    } catch (err: any) {
        log.error(`intelligence.repo: getReverseTrace failed ${id}`, err.message);
        return null;
    }
};
