import { DB } from '../../lib/graph-db';
import { config } from '../../lib/config';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

// "Uncontrolled" — no Control implements this Requirement yet. That's the actual
// signal control-intelligence needs; a plain unfiltered list would recommend
// controls for requirements that already have one.
export const fetchRequirements = async (regulationId?: string) => {
    const cypher = regulationId
        ? `MATCH (reg:Regulation {id: $id})<-[:BELONGS_TO]-(:Clause)<-[:DEFINED_BY]-(req:Requirement)
           WHERE NOT (req)<-[:IMPLEMENTS]-(:Control)
           RETURN properties(req) AS requirement`
        : `MATCH (req:Requirement)
           WHERE NOT (req)<-[:IMPLEMENTS]-(:Control)
           RETURN properties(req) AS requirement LIMIT 100`;
    const args = regulationId ? { id: regulationId } : {};
    const raw: any = await db().fetch2(cypher, args);
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.requirement).filter(Boolean);
};

export const fetchControlsForRequirement = async (requirementId: string) => {
    const cypher = `
        MATCH (req:Requirement {id: $id})<-[:IMPLEMENTS]-(ctl:Control)
        RETURN properties(ctl) AS control
    `;
    const raw: any = await db().fetch2(cypher, { id: requirementId });
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.control).filter(Boolean);
};

// Signals not yet reasoned about — no Decision ABOUT them yet. Joined with the
// emitting Asset (context: category/complianceAreaId) and any auto-created Task
// (HAS_TASK, written live by the events sink when the asset is covered) so the
// agent can tell "covered asset, follow-up already scheduled" from "coverage gap".
export const fetchUnassessedSignals = async () => {
    const cypher = `
        MATCH (s:Signal)
        WHERE NOT (:Decision)-[:ABOUT]->(s)
        OPTIONAL MATCH (s)-[:EMITTED_BY]->(ast:Asset)
        OPTIONAL MATCH (s)-[:HAS_TASK]->(tsk:Task)
        RETURN properties(s) AS signal, properties(ast) AS asset, collect(DISTINCT tsk.id) AS taskIds
        LIMIT 100
    `;
    const raw: any = await db().fetch2(cypher, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.signal).map((r: any) => ({
        ...r.signal,
        asset: r.asset ?? null,
        taskIds: (r.taskIds ?? []).filter(Boolean),
    }));
};

// Findings with no Risk scoring them yet, AND no Decision already proposed for them —
// the Risk check alone isn't enough for idempotency, since a Risk only exists after
// approval (like Control:AgentProposed / Finding:AgentProposed); without the Decision
// check a re-run before approval would re-observe and re-reason over the same Finding
// every time. Same no-Decision filter fetchUnassessedSignals already uses. Joined with
// the Finding's Control (via AGAINST) for reasoning context.
export const fetchUnscoredFindings = async () => {
    const cypher = `
        MATCH (f:Finding)
        WHERE NOT (:Risk)-[:RAISED_BY]->(f) AND NOT (:Decision)-[:ABOUT]->(f)
        OPTIONAL MATCH (f)-[:AGAINST]->(ctl:Control)
        RETURN properties(f) AS finding, properties(ctl) AS control
        LIMIT 100
    `;
    const raw: any = await db().fetch2(cypher, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.finding).map((r: any) => ({ ...r.finding, control: r.control ?? null }));
};

// Incidents whose Evidence hasn't been bundled into an EvidencePackage yet, AND has no
// Decision already proposed for it — same no-Decision idempotency guard as
// fetchUnscoredFindings, since the EvidencePackage only exists after approval. There is no
// direct Incident -> EvidencePackage edge in the schema — the real path is
// Incident -[:HAS_TASK]-> Task <-[:PRODUCED_BY]- Evidence. allCapasVerified walks the same
// Incident -> Finding -> RCA -> CAPA chain cli/scripts/generate-assurance-seed.ts already
// proved (checked against Verification via CLOSES), computed here off live graph state
// instead of CSV joins — the deterministic posture fact, not left to the LLM.
export const fetchUnbundledEvidenceIncidents = async () => {
    const cypher = `
        MATCH (inc:Incident)-[:HAS_TASK]->(tsk:Task)<-[:PRODUCED_BY]-(ev:Evidence)
        WHERE NOT (ev)-[:PART_OF]->(:EvidencePackage) AND NOT (:Decision)-[:ABOUT]->(inc)
        WITH inc, collect(DISTINCT properties(ev)) AS evidence
        OPTIONAL MATCH (inc)-[:HAS_FINDING]->(:Finding)-[:ANALYSED_BY]->(:RCA)-[:REQUIRES_CAPA]->(capa:CAPA)
        WITH inc, evidence, collect(DISTINCT capa.id) AS capaIds
        OPTIONAL MATCH (capa2:CAPA)<-[:CLOSES]-(:Verification) WHERE capa2.id IN capaIds
        WITH inc, evidence, capaIds, collect(DISTINCT capa2.id) AS verifiedCapaIds
        RETURN properties(inc) AS incident, evidence, size(capaIds) AS capaCount,
               (size(capaIds) > 0 AND size(capaIds) = size(verifiedCapaIds)) AS allCapasVerified
        LIMIT 50
    `;
    const raw: any = await db().fetch2(cypher, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.incident).map((r: any) => ({
        ...r.incident,
        capaCount: Number(r.capaCount ?? 0),
        evidence: r.evidence ?? [],
        allCapasVerified: Boolean(r.allCapasVerified),
    }));
};

export const traceForward = async (regulationId: string) => {
    const cypher = `
        MATCH path = (:Regulation {id: $id})<-[:BELONGS_TO]-(:Clause)<-[:DEFINED_BY]-(:Requirement)<-[:IMPLEMENTS]-(:Control)
        RETURN path LIMIT 50
    `;
    const raw: any = await db().fetch2(cypher, { id: regulationId });
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.path).filter(Boolean);
};
