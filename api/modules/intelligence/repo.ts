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

// Marker labels aren't the entity's real type — strip them so origin/result surface
// the same label a human would use ("Requirement", not "Requirement:Catalog").
const MARKER_LABELS = new Set(['Catalog', 'Enterprise', 'AgentProposed']);
const primaryLabel = (labels: string[] | null | undefined): string | null =>
    labels?.find((l) => !MARKER_LABELS.has(l)) ?? labels?.[0] ?? null;

const LIST_DECISIONS = `
    MATCH (d:Decision)
    OPTIONAL MATCH (d)-[:ABOUT]->(origin)
    OPTIONAL MATCH (d)-[:RESULTED_IN]->(result)
    RETURN properties(d) AS decision,
           labels(origin) AS originLabels, properties(origin) AS origin,
           labels(result) AS resultLabels, properties(result) AS result
    ORDER BY d.decidedAt DESC LIMIT 100
`;

export const listDecisions = async () => {
    try {
        const raw: any = await db().fetch2(LIST_DECISIONS, {});
        const rows = Array.isArray(raw) ? raw : [raw];
        return rows.filter((r: any) => r?.decision).map((r: any) => ({
            ...r.decision,
            origin: r.origin ? { ...r.origin, label: primaryLabel(r.originLabels) } : null,
            result: r.result ? { ...r.result, label: primaryLabel(r.resultLabels) } : null,
        }));
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
    MERGE (d)-[:RESULTED_IN]->(ctl)
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
    MERGE (d)-[:RESULTED_IN]->(f)
    SET d.status = 'approved',
        d.reviewedAt = datetime(),
        d.reviewedBy = $reviewedBy,
        d.reviewNote = $reviewNote
    WITH d, f
    OPTIONAL MATCH (p:Person {id: $reviewedBy})
    FOREACH (_ IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (d)-[:REVIEWED_BY]->(p))
    RETURN properties(d) AS decision, properties(f) AS finding
`;

// Risk gets :AgentProposed alongside :Risk — same fourth-origin convention as
// Control:AgentProposed. inherentScore/residualScore are computed here in Cypher from the
// Decision's own proposed values (never trusted from the LLM as arithmetic) — the agent's
// own likelihood x consequence convention, not a fit to the legacy 7-incident scores (see
// vyra-implementation-plan.md Phase 8). residual == inherent at proposal time: no CAPA has
// closed yet for a newly-scored Finding, so there is no mitigation to discount.
const APPROVE_RISK_ASSESSMENT = `
    MATCH (d:Decision {id: $id})-[:ABOUT]->(f:Finding)
    MERGE (r:Risk:AgentProposed {id: $riskId})
    ON CREATE SET
        r.name = 'Risk - ' + coalesce(f.name, f.id),
        r.inherentLikelihood = toInteger(d.proposedLikelihood),
        r.inherentConsequence = toInteger(d.proposedConsequence),
        r.inherentScore = toInteger(d.proposedLikelihood) * toInteger(d.proposedConsequence),
        r.inherentRating = coalesce(d.proposedRating, 'UNKNOWN'),
        r.residualLikelihood = toInteger(d.proposedLikelihood),
        r.residualConsequence = toInteger(d.proposedConsequence),
        r.residualScore = toInteger(d.proposedLikelihood) * toInteger(d.proposedConsequence),
        r.residualRating = coalesce(d.proposedRating, 'UNKNOWN'),
        r.findingId = f.id,
        r.status = 'proposed',
        r.createdAt = datetime()
    MERGE (r)-[:RAISED_BY]->(f)
    MERGE (d)-[:RESULTED_IN]->(r)
    SET d.status = 'approved',
        d.reviewedAt = datetime(),
        d.reviewedBy = $reviewedBy,
        d.reviewNote = $reviewNote
    WITH d, r
    OPTIONAL MATCH (p:Person {id: $reviewedBy})
    FOREACH (_ IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (d)-[:REVIEWED_BY]->(p))
    RETURN properties(d) AS decision, properties(r) AS risk
`;

// Assembles the Audit-Ready Export chain (EvidencePackage/Attestation/AssuranceStatement/
// Audit) for one Incident, live — the agent-driven replacement for
// cli/scripts/generate-assurance-seed.ts going forward. IDs reuse that script's natural
// EPKG-{incidentId}/ATT-{incidentId}/ASM-{incidentId}/AUD-{incidentId} shape (1:1 with the
// Incident, not the proposal event); :AgentProposed is what distinguishes a live-approved
// chain from Phase 4b's unlabeled synthetic one, so there is no id collision. Re-matches
// the same unbundled-Evidence set fetchUnbundledEvidenceIncidents saw at observe time,
// rather than trusting a possibly-stale list carried on the Decision. posture comes from
// d.proposedPosture (computed at observe time from real CAPA/Verification state, not
// LLM-decided — see agents/agents/assurance/index.ts). period is passed in as a param
// (Cypher has no clean quarter function) rather than hardcoded. RESULTED_IN points only at
// Audit, the top of the chain, not all 4 nodes — the rest are already reachable from it via
// PREPARED_FOR/DERIVED_FROM/BACKED_BY/PART_OF, so linking all 4 would be redundant.
const APPROVE_ASSURANCE_PACKAGE = `
    MATCH (d:Decision {id: $id})-[:ABOUT]->(inc:Incident)
    MATCH (inc)-[:HAS_TASK]->(:Task)<-[:PRODUCED_BY]-(ev:Evidence)
    WHERE NOT (ev)-[:PART_OF]->(:EvidencePackage)
    WITH d, inc, collect(DISTINCT ev) AS evidenceList
    MERGE (pkg:EvidencePackage:AgentProposed {id: $packageId})
    ON CREATE SET pkg.name = 'Evidence Package - ' + inc.name, pkg.period = $period, pkg.status = 'assembled', pkg.createdAt = datetime()
    WITH d, inc, pkg, evidenceList
    FOREACH (e IN evidenceList | MERGE (e)-[:PART_OF]->(pkg))
    MERGE (att:Attestation:AgentProposed {id: $attestationId})
    ON CREATE SET att.name = 'Attestation - ' + inc.name, att.attestedBy = $reviewedBy, att.attestedAt = datetime(), att.status = 'attested'
    MERGE (att)-[:BACKED_BY]->(pkg)
    MERGE (asm:AssuranceStatement:AgentProposed {id: $statementId})
    ON CREATE SET asm.name = 'Assurance Statement - ' + inc.name, asm.scope = inc.scope, asm.posture = d.proposedPosture, asm.generatedAt = datetime(), asm.status = 'issued'
    MERGE (asm)-[:DERIVED_FROM]->(att)
    MERGE (aud:Audit:AgentProposed {id: $auditId})
    ON CREATE SET aud.name = inc.auditType, aud.type = inc.auditType, aud.period = $period, aud.auditor = inc.reviewedBy, aud.status = 'closed'
    MERGE (asm)-[:PREPARED_FOR]->(aud)
    WITH d, inc, asm, aud
    MERGE (d)-[:RESULTED_IN]->(aud)
    OPTIONAL MATCH (inc)-[:GOVERNED_BY]->(reg:Regulation)
    FOREACH (r IN CASE WHEN reg IS NOT NULL THEN [reg] ELSE [] END | MERGE (asm)-[:COVERS]->(r))
    SET d.status = 'approved',
        d.reviewedAt = datetime(),
        d.reviewedBy = $reviewedBy,
        d.reviewNote = $reviewNote
    WITH d
    OPTIONAL MATCH (p:Person {id: $reviewedBy})
    FOREACH (_ IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (d)-[:REVIEWED_BY]->(p))
    RETURN properties(d) AS decision
`;

// YYYY-Qn off an incidentTime-shaped "YYYY-MM-DD HH:mm" string — same derivation
// cli/scripts/generate-assurance-seed.ts's quarterOf() uses, ported to JS since this is a
// live API path rather than a batch script.
const quarterOf = (dateStr: string): string => {
    const d = new Date(dateStr.replace(' ', 'T'));
    return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
};

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
        if (type === 'risk-assessment') {
            const raw: any = await db().exec2(APPROVE_RISK_ASSESSMENT, { ...params, riskId: `RSK-${id}` });
            const row = Array.isArray(raw) ? raw[0] : raw;
            if (!row?.decision) throw new Error(`Decision ${id} has no linked Finding to approve`);
            return { decision: row.decision, risk: row.risk };
        }
        if (type === 'assurance-package-proposal') {
            const incRaw: any = await db().fetch2(
                `MATCH (:Decision {id: $id})-[:ABOUT]->(inc:Incident) RETURN properties(inc) AS incident`,
                { id }
            );
            const incRow = Array.isArray(incRaw) ? incRaw[0] : incRaw;
            const incidentId = incRow?.incident?.id;
            if (!incidentId) throw new Error(`Decision ${id} has no linked Incident to approve`);
            const period = quarterOf(incRow.incident.incidentTime);
            const raw: any = await db().exec2(APPROVE_ASSURANCE_PACKAGE, {
                ...params,
                packageId: `EPKG-${incidentId}`,
                attestationId: `ATT-${incidentId}`,
                statementId: `ASM-${incidentId}`,
                auditId: `AUD-${incidentId}`,
                period,
            });
            const row = Array.isArray(raw) ? raw[0] : raw;
            if (!row?.decision) throw new Error(`Decision ${id} has no unbundled Evidence to approve`);
            return { decision: row.decision };
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
