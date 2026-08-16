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

const GET_DECISION = `
    MATCH (d:Decision {id: $id})
    RETURN properties(d) AS decision
`;

export const getDecision = async (id: string) => {
    try {
        const raw: any = await db().fetch2(GET_DECISION, { id });
        const row = Array.isArray(raw) ? raw[0] : raw;
        return row?.decision ?? null;
    } catch (err: any) {
        log.error(`intelligence.repo: getDecision failed ${id}`, err.message);
        return null;
    }
};

// Phase 7 — Human-in-the-Loop Decision Gate. Reject is type-agnostic (just a status
// flip); approve branches on Decision.type since control-recommendation and
// deviation-assessment each resolve to a different graph write (see
// .design/7-human-in-the-loop-decision-gate-plan.md). REVIEWED_BY is only merged when
// reviewedBy resolves to a real seeded Person — no auth exists yet, so this stays
// honest-but-informal rather than fabricating attribution.
const REJECT_DECISION = `
    MATCH (d:Decision {id: $id})
    SET d.status = 'rejected',
        d.reviewedAt = datetime(),
        d.reviewedBy = $reviewedBy,
        d.reviewNote = $reviewNote
    WITH d
    OPTIONAL MATCH (p:Person {id: $reviewedBy})
    FOREACH (_ IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (d)-[:REVIEWED_BY]->(p))
    RETURN properties(d) AS decision
`;

// New Control gets :AgentProposed alongside :Control — a fourth origin category next
// to :Catalog/:Enterprise/unlabeled-legacy (same structural-label reasoning as Phase
// 0.5's :Catalog convention). getCoverageScore() already filters to Control:Catalog
// explicitly, so this is excluded from the coverage percentage with no further change.
const APPROVE_CONTROL_RECOMMENDATION = `
    MATCH (d:Decision {id: $id})-[:ABOUT]->(req:Requirement)
    MERGE (ctl:Control:AgentProposed {id: $controlId})
    ON CREATE SET
        ctl.name = 'Proposed Control - ' + coalesce(req.name, req.id),
        ctl.controlType = coalesce(d.recommendedControlType, 'UNKNOWN'),
        ctl.description = d.rationale,
        ctl.status = 'proposed',
        ctl.createdAt = datetime()
    MERGE (ctl)-[:IMPLEMENTS]->(req)
    SET d.status = 'approved',
        d.reviewedAt = datetime(),
        d.reviewedBy = $reviewedBy,
        d.reviewNote = $reviewNote
    WITH d, ctl
    OPTIONAL MATCH (p:Person {id: $reviewedBy})
    FOREACH (_ IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (d)-[:REVIEWED_BY]->(p))
    RETURN properties(d) AS decision, properties(ctl) AS control
`;

// Forks on whether the signal's asset had Control coverage, visible via the linked
// Task's controlIds (Phase 3's createSignal already resolves this at signal-time).
// Covered: AGAINST each real Control. Uncovered: ABOUT the Signal instead — records the
// deviation honestly rather than fabricating a Control link that doesn't exist. UNWIND
// (not FOREACH) is used for the per-controlId MATCH since FOREACH cannot contain a
// MATCH clause; the [null] sentinel keeps a single pass through the uncovered branch
// when controlIds is empty.
const APPROVE_DEVIATION_ASSESSMENT = `
    MATCH (d:Decision {id: $id})-[:ABOUT]->(sig:Signal)
    OPTIONAL MATCH (sig)-[:HAS_TASK]->(tsk:Task)
    WITH d, sig, reduce(ids = [], t IN collect(DISTINCT tsk) | ids + coalesce(t.controlIds, [])) AS controlIds
    MERGE (f:Finding:AgentProposed {id: $findingId})
    ON CREATE SET
        f.name = 'Deviation - ' + coalesce(sig.type, 'UNKNOWN'),
        f.severity = 'UNKNOWN',
        f.detectedAt = datetime(),
        f.status = 'open'
    WITH d, sig, f, controlIds
    UNWIND (CASE WHEN size(controlIds) = 0 THEN [null] ELSE controlIds END) AS cid
    OPTIONAL MATCH (ctl:Control {id: cid})
    FOREACH (_ IN CASE WHEN ctl IS NOT NULL THEN [1] ELSE [] END | MERGE (f)-[:AGAINST]->(ctl))
    FOREACH (_ IN CASE WHEN cid IS NULL THEN [1] ELSE [] END | MERGE (f)-[:ABOUT]->(sig))
    WITH DISTINCT d, f
    SET d.status = 'approved',
        d.reviewedAt = datetime(),
        d.reviewedBy = $reviewedBy,
        d.reviewNote = $reviewNote
    WITH d, f
    OPTIONAL MATCH (p:Person {id: $reviewedBy})
    FOREACH (_ IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (d)-[:REVIEWED_BY]->(p))
    RETURN properties(d) AS decision, properties(f) AS finding
`;

export const resolveDecision = async (
    id: string,
    type: string,
    action: 'approve' | 'reject',
    reviewedBy?: string,
    reviewNote?: string
) => {
    const params = { id, reviewedBy: reviewedBy ?? null, reviewNote: reviewNote ?? null };
    try {
        if (action === 'reject') {
            const raw: any = await db().exec2(REJECT_DECISION, params);
            const row = Array.isArray(raw) ? raw[0] : raw;
            return { decision: row?.decision };
        }
        if (type === 'control-recommendation') {
            const raw: any = await db().exec2(APPROVE_CONTROL_RECOMMENDATION, { ...params, controlId: `CTL-${id}` });
            const row = Array.isArray(raw) ? raw[0] : raw;
            if (!row?.decision) throw new Error(`Decision ${id} has no linked Requirement to approve`);
            return { decision: row.decision, control: row.control };
        }
        if (type === 'deviation-assessment') {
            const raw: any = await db().exec2(APPROVE_DEVIATION_ASSESSMENT, { ...params, findingId: `FND-${id}` });
            const row = Array.isArray(raw) ? raw[0] : raw;
            if (!row?.decision) throw new Error(`Decision ${id} has no linked Signal to approve`);
            return { decision: row.decision, finding: row.finding };
        }
        throw new Error(`Unknown decision type: ${type}`);
    } catch (err: any) {
        log.error(`intelligence.repo: resolveDecision failed ${id}`, err.message);
        throw err;
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
