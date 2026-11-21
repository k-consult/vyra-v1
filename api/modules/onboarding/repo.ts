import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';
import { listSubjectTypes } from '../catalog/repo';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

// 'cutover-overdue' is never stored — derived live from dueBy vs now(), the same
// discipline Coverage Scoring already uses (a live Cypher CASE, not a stamped
// field). foundation.md §0: "a first-class, queryable cutover-overdue state."
const LIST_CUTOVER_CRITERIA = `
    MATCH (c:CutoverCriterion)
    RETURN properties(c) AS criterion,
           CASE WHEN c.status = 'proving' AND c.dueBy < datetime() THEN 'cutover-overdue' ELSE c.status END AS effectiveStatus
    ORDER BY c.dueBy
`;

export const listCutoverCriteria = async () => {
    const raw: any = await db().fetch(LIST_CUTOVER_CRITERIA, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.criterion).map((r: any) => ({
        ...r.criterion,
        effectiveStatus: r.effectiveStatus,
    }));
};

export interface ProposeCutoverCriterionInput {
    proposedBy: string;
    workflowName: string;
    criterionDescription: string;
    systemOfRecord: 'legacy' | 'vyra';
    agreementRateTarget: number;
    dueBy: string;
}

// Writes only a pending Decision — never a CutoverCriterion directly. The real node
// is created on approval by intelligence/repo.ts's cutover-criterion-proposal
// branch (same discipline as enterprise/repo.ts's proposeContractChange). No ABOUT
// edge: no real Workflow node exists yet to point at (graph.md's CutoverCriterion
// entry) — every other Decision-write path in this codebase merges one against a
// real source node; this is a deliberate, documented exception, not an oversight.
const PROPOSE_CUTOVER_CRITERION = `
    MERGE (d:Decision {id: $id})
    ON CREATE SET
        d += $props,
        d.decidedAt = datetime(),
        d.status = 'pending',
        d.origin = 'human'
    RETURN properties(d) AS decision
`;

export const proposeCutoverCriterion = async (input: ProposeCutoverCriterionInput) => {
    const id = `DEC-CUTOVER-${Date.now()}`;
    const raw: any = await db().exec(PROPOSE_CUTOVER_CRITERION, {
        id,
        props: {
            type: 'cutover-criterion-proposal',
            rationale: `Human-proposed cutover criterion for "${input.workflowName}"`,
            agentId: input.proposedBy,
            autonomyLevel: 0,
            confidence: 1,
            proposedBy: input.proposedBy,
            workflowName: input.workflowName,
            criterionDescription: input.criterionDescription,
            systemOfRecord: input.systemOfRecord,
            agreementRateTarget: input.agreementRateTarget,
            dueBy: input.dueBy,
        },
    });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return { decision: row?.decision };
};

const FACILITY_EXISTS = `MATCH (f:Facility {id: $id}) RETURN count(f) > 0 AS facilityExists`;
export const facilityExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(FACILITY_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.facilityExists);
};

const ROLE_EXISTS = `MATCH (r:Role {id: $id}) RETURN count(r) > 0 AS roleExists`;
export const roleExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(ROLE_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.roleExists);
};

const ASSET_EXISTS = `MATCH (a:Asset {id: $id}) RETURN count(a) > 0 AS assetExists`;
export const assetExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(ASSET_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.assetExists);
};

const HAZARD_EXISTS = `MATCH (h:Hazard {id: $id}) RETURN count(h) > 0 AS hazardExists`;
export const hazardExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(HAZARD_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.hazardExists);
};

const LIST_BLUEPRINTS = `
    MATCH (bp:Blueprint)
    OPTIONAL MATCH (bp)-[:ABOUT]->(f:Facility)
    OPTIONAL MATCH (bp)-[:COVERS]->(r:Role)
    OPTIONAL MATCH (bp)-[:COVERS]->(a:Asset)
    RETURN properties(bp) AS blueprint,
           f.name AS facilityName,
           collect(DISTINCT r.id) AS roleIds,
           collect(DISTINCT a.id) AS assetIds,
           bp.createdAt AS createdAt
    ORDER BY createdAt DESC
`;

export const listBlueprints = async () => {
    const raw: any = await db().fetch(LIST_BLUEPRINTS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.blueprint).map((r: any) => ({
        ...r.blueprint,
        facilityName: r.facilityName,
        roleIds: (r.roleIds ?? []).filter(Boolean),
        assetIds: (r.assetIds ?? []).filter(Boolean),
    }));
};

export interface ProposeBlueprintInput {
    proposedBy: string;
    facilityId: string;
    scopeDescription: string;
    roleIds: string[];
    assetIds: string[];
}

// Writes only a pending Decision — never a Blueprint directly. The real node is
// created on approval by intelligence/repo.ts's blueprint-proposal branch (same
// discipline as CutoverCriterion/Contract above). Unlike CutoverCriterion, a
// Blueprint references real, already-live nodes (Facility/Role/Asset), so it gets
// a real ABOUT edge — foundation.md §2's "the blueprint is inferred and proposed,
// never self-asserted," ratified through this same Decision gate. facilityId is
// read back off d (not passed as a second top-level param) so the Facility this
// proposal is ABOUT is always the one just stored in props — one source of truth.
const PROPOSE_BLUEPRINT = `
    MERGE (d:Decision {id: $id})
    ON CREATE SET
        d += $props,
        d.decidedAt = datetime(),
        d.status = 'pending',
        d.origin = 'human'
    WITH d
    MATCH (f:Facility {id: d.facilityId})
    MERGE (d)-[:ABOUT]->(f)
    RETURN properties(d) AS decision
`;

export const proposeBlueprint = async (input: ProposeBlueprintInput) => {
    const id = `DEC-BLUEPRINT-${Date.now()}`;
    const raw: any = await db().exec(PROPOSE_BLUEPRINT, {
        id,
        props: {
            type: 'blueprint-proposal',
            rationale: `Human-proposed enterprise blueprint for facility "${input.facilityId}"`,
            agentId: input.proposedBy,
            autonomyLevel: 0,
            confidence: 1,
            proposedBy: input.proposedBy,
            facilityId: input.facilityId,
            scopeDescription: input.scopeDescription,
            roleIds: input.roleIds,
            assetIds: input.assetIds,
        },
    });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return { decision: row?.decision };
};

const LIST_HAZARDS = `
    MATCH (h:Hazard)
    RETURN properties(h) AS hazard
    ORDER BY h.createdAt DESC
`;

export const listHazards = async () => {
    const raw: any = await db().fetch(LIST_HAZARDS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.hazard).map((r: any) => r.hazard);
};

export interface ProposeHazardInput {
    proposedBy: string;
    name: string;
    hazardType: string;
    description: string;
    facilityId: string;
    assetId?: string;
}

// Writes only a pending Decision — never a Hazard directly. The real node is
// created on approval by intelligence/repo.ts's hazard-proposal branch (same
// discipline as Blueprint/Contract above). Scoped to Facility like Blueprint,
// since every Hazard is at minimum site-located even when it also names a
// specific Asset (domain-extension.md §8.4(a)).
const PROPOSE_HAZARD = `
    MERGE (d:Decision {id: $id})
    ON CREATE SET
        d += $props,
        d.decidedAt = datetime(),
        d.status = 'pending',
        d.origin = 'human'
    WITH d
    MATCH (f:Facility {id: d.facilityId})
    MERGE (d)-[:ABOUT]->(f)
    RETURN properties(d) AS decision
`;

export const proposeHazard = async (input: ProposeHazardInput) => {
    const id = `DEC-HAZARD-${Date.now()}`;
    const raw: any = await db().exec(PROPOSE_HAZARD, {
        id,
        props: {
            type: 'hazard-proposal',
            rationale: `Human-proposed hazard "${input.name}" at facility "${input.facilityId}"`,
            agentId: input.proposedBy,
            autonomyLevel: 0,
            confidence: 1,
            proposedBy: input.proposedBy,
            name: input.name,
            hazardType: input.hazardType,
            description: input.description,
            facilityId: input.facilityId,
            assetId: input.assetId ?? '',
        },
    });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return { decision: row?.decision };
};

const LIST_HAZARD_ASSESSMENTS = `
    MATCH (hsa:HazardAssessment)
    RETURN properties(hsa) AS assessment
    ORDER BY hsa.assessedAt DESC
`;

export const listHazardAssessments = async () => {
    const raw: any = await db().fetch(LIST_HAZARD_ASSESSMENTS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.assessment).map((r: any) => r.assessment);
};

export interface ProposeHazardAssessmentInput {
    proposedBy: string;
    hazardId: string;
    name?: string;
    likelihood: number;
    severity: number;
    rating: string;
}

// Writes only a pending Decision — never a HazardAssessment directly. The real
// node is created on approval by intelligence/repo.ts's hazard-assessment-proposal
// branch. likelihood/severity are carried as proposed values; score is computed
// in Cypher at approval time (likelihood x severity), never trusted as arithmetic
// from the proposer — same discipline Risk already uses for proposedLikelihood/
// proposedConsequence.
const PROPOSE_HAZARD_ASSESSMENT = `
    MERGE (d:Decision {id: $id})
    ON CREATE SET
        d += $props,
        d.decidedAt = datetime(),
        d.status = 'pending',
        d.origin = 'human'
    WITH d
    MATCH (h:Hazard {id: d.hazardId})
    MERGE (d)-[:ABOUT]->(h)
    RETURN properties(d) AS decision
`;

export const proposeHazardAssessment = async (input: ProposeHazardAssessmentInput) => {
    const id = `DEC-HAZASSESS-${Date.now()}`;
    const raw: any = await db().exec(PROPOSE_HAZARD_ASSESSMENT, {
        id,
        props: {
            type: 'hazard-assessment-proposal',
            rationale: `Human-proposed hazard assessment for hazard "${input.hazardId}"`,
            agentId: input.proposedBy,
            autonomyLevel: 0,
            confidence: 1,
            proposedBy: input.proposedBy,
            hazardId: input.hazardId,
            name: input.name ?? '',
            proposedLikelihood: input.likelihood,
            proposedSeverity: input.severity,
            proposedRating: input.rating,
        },
    });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return { decision: row?.decision };
};

const LIST_EMERGENCY_PLANS = `
    MATCH (ep:EmergencyPlan)
    RETURN properties(ep) AS plan
    ORDER BY ep.createdAt DESC
`;

export const listEmergencyPlans = async () => {
    const raw: any = await db().fetch(LIST_EMERGENCY_PLANS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.plan).map((r: any) => r.plan);
};

export interface ProposeEmergencyPlanInput {
    proposedBy: string;
    facilityId: string;
    name?: string;
    drillFrequency: string;
}

// Writes only a pending Decision — never an EmergencyPlan directly. The real
// node is created on approval by intelligence/repo.ts's emergency-plan-proposal
// branch (same discipline as Blueprint above, which this mirrors exactly: scoped
// to one Facility, real ABOUT edge since Facility already exists live).
const PROPOSE_EMERGENCY_PLAN = `
    MERGE (d:Decision {id: $id})
    ON CREATE SET
        d += $props,
        d.decidedAt = datetime(),
        d.status = 'pending',
        d.origin = 'human'
    WITH d
    MATCH (f:Facility {id: d.facilityId})
    MERGE (d)-[:ABOUT]->(f)
    RETURN properties(d) AS decision
`;

export const proposeEmergencyPlan = async (input: ProposeEmergencyPlanInput) => {
    const id = `DEC-EMERGENCYPLAN-${Date.now()}`;
    const raw: any = await db().exec(PROPOSE_EMERGENCY_PLAN, {
        id,
        props: {
            type: 'emergency-plan-proposal',
            rationale: `Human-proposed emergency plan for facility "${input.facilityId}"`,
            agentId: input.proposedBy,
            autonomyLevel: 0,
            confidence: 1,
            proposedBy: input.proposedBy,
            facilityId: input.facilityId,
            name: input.name ?? '',
            drillFrequency: input.drillFrequency,
        },
    });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return { decision: row?.decision };
};

// Onboarding's "Obligation Mapping" stage — the user-facing wrapper around the
// subject-type-proposal Decision queue (intelligence/repo.ts). A tenant admin
// should never need to know what a SubjectType is; they need "here's my asset,
// here's what it's obligated to do." previewSubjectTypeId resolves to whichever
// SubjectType is actually relevant right now — the confirmed OF_TYPE one once
// classified, or the agent's still-pending proposal beforehand — so a reviewer
// sees the obligations a pending proposal would unlock *before* approving it,
// not just after. BINDS_TO_TYPE is the live Obligation->SubjectType edge from
// applicability.md step 2 (cli/semantic-contract/contracts/v2.ts).
// Reclassification (reclassifyAsset below) supersedes rather than mutates a prior
// Decision — same append-and-supersede discipline as Contract/Permit/Warranty — so
// an Asset can carry more than one subject-type-proposal Decision over its
// lifetime. Only the active (non-superseded) one is "the" current classification;
// without this filter, a reclassified Asset would duplicate here, once per
// Decision it ever had.
const LIST_OBLIGATION_MAPPINGS = `
    MATCH (a:Asset)
    OPTIONAL MATCH (d:Decision {type: 'subject-type-proposal'})-[:ABOUT]->(a)
        WHERE d.supersededBy IS NULL OR d.supersededBy = ''
    OPTIONAL MATCH (a)-[:OF_TYPE]->(resolvedSt:SubjectType)
    WITH a, d, resolvedSt, coalesce(resolvedSt.id, d.proposedSubjectTypeId) AS previewSubjectTypeId
    OPTIONAL MATCH (previewSt:SubjectType {id: previewSubjectTypeId})
    OPTIONAL MATCH (obl:Obligation)-[:BINDS_TO_TYPE]->(previewSt)
    RETURN properties(a) AS asset, properties(d) AS decision, properties(resolvedSt) AS resolvedSubjectType,
           properties(previewSt) AS previewSubjectType, collect(DISTINCT properties(obl)) AS obligations
    ORDER BY asset.category, asset.name
`;

export type ObligationMappingStatus = 'unclassified' | 'pending' | 'classified' | 'none' | 'rejected';

export const listObligationMappings = async () => {
    const raw: any = await db().fetch(LIST_OBLIGATION_MAPPINGS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.asset).map((r: any) => {
        const status: ObligationMappingStatus = !r.decision ? 'unclassified'
            : r.decision.status === 'pending' ? 'pending'
            : r.decision.status === 'rejected' ? 'rejected'
            : r.resolvedSubjectType ? 'classified' : 'none';
        // A rejected proposal has nothing to preview — it won't resolve on its own,
        // and showing the agent's old (rejected) guess as if it still applied would
        // misrepresent a reviewer's own call as a live recommendation.
        const showPreview = status !== 'rejected';
        return {
            asset: r.asset,
            status,
            decisionId: r.decision?.id ?? null,
            previewSubjectType: showPreview ? (r.previewSubjectType ?? null) : null,
            obligations: showPreview ? (r.obligations ?? []).filter(Boolean) : [],
        };
    });
};

// Reclassify an Asset that already has a resolved subject-type-proposal Decision
// (classified/none/rejected) — a correction made after the fact, not a fresh
// agent proposal. Never mutates the prior Decision or OF_TYPE edge in place:
// creates a brand-new Decision (origin: 'human', pre-resolved to 'approved' since
// the reviewer is both proposer and approver in one action), marks the prior
// Decision superseded (mirrors Contract/Permit/Warranty's prior.supersededBy —
// never deleted, so the full history of what this asset was classified as, and
// when, stays queryable), and swaps the OF_TYPE edge. The $subjectTypeOverride
// literal "none" OPTIONAL MATCHes nothing, so it falls through to the same
// documented-absence path (RESULTED_IN the Asset, no OF_TYPE edge) the original
// approval flow already uses — no special-casing here either.
const RECLASSIFY_SUBJECT_TYPE = `
    MATCH (a:Asset {id: $assetId})
    OPTIONAL MATCH (prior:Decision {type: 'subject-type-proposal'})-[:ABOUT]->(a)
        WHERE prior.supersededBy IS NULL OR prior.supersededBy = ''
    OPTIONAL MATCH (a)-[priorEdge:OF_TYPE]->(:SubjectType)
    DELETE priorEdge
    WITH a, prior
    MERGE (d:Decision {id: $id})
    ON CREATE SET
        d += $props,
        d.decidedAt = datetime(),
        d.reviewedAt = datetime(),
        d.priorDecisionId = coalesce(prior.id, '')
    MERGE (d)-[:ABOUT]->(a)
    WITH a, d, prior
    FOREACH (_ IN CASE WHEN prior IS NOT NULL THEN [1] ELSE [] END | SET prior.supersededBy = d.id)
    WITH a, d
    OPTIONAL MATCH (st:SubjectType {id: $subjectTypeOverride})
    FOREACH (_ IN CASE WHEN st IS NOT NULL THEN [1] ELSE [] END | MERGE (a)-[:OF_TYPE]->(st))
    FOREACH (_ IN CASE WHEN st IS NOT NULL THEN [1] ELSE [] END | MERGE (d)-[:RESULTED_IN]->(st))
    FOREACH (_ IN CASE WHEN st IS NULL THEN [1] ELSE [] END | MERGE (d)-[:RESULTED_IN]->(a))
    WITH a, d, st
    OPTIONAL MATCH (p:Person {id: $reviewedBy})
    FOREACH (_ IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (d)-[:REVIEWED_BY]->(p))
    RETURN properties(d) AS decision, properties(a) AS asset, properties(st) AS subjectType
`;

export interface ReclassifyAssetInput {
    assetId: string;
    subjectTypeOverride: string;
    reviewedBy?: string;
    reviewNote?: string;
}

export const reclassifyAsset = async (input: ReclassifyAssetInput) => {
    const id = `DEC-${input.assetId}-RECLASSIFY-${Date.now()}`;
    const raw: any = await db().exec(RECLASSIFY_SUBJECT_TYPE, {
        id,
        assetId: input.assetId,
        subjectTypeOverride: input.subjectTypeOverride,
        reviewedBy: input.reviewedBy ?? null,
        props: {
            type: 'subject-type-proposal',
            rationale: 'Manually reclassified by reviewer',
            agentId: input.reviewedBy || 'unattributed',
            origin: 'human',
            autonomyLevel: 0,
            confidence: 1,
            sourceId: input.assetId,
            proposedSubjectTypeId: input.subjectTypeOverride,
            resolvedSubjectTypeId: input.subjectTypeOverride,
            overridden: false,
            status: 'approved',
            reviewedBy: input.reviewedBy ?? null,
            reviewNote: input.reviewNote ?? null,
        },
    });
    const row = Array.isArray(raw) ? raw[0] : raw;
    if (!row?.asset) throw new Error(`Asset ${input.assetId} not found`);
    return { decision: row.decision, asset: row.asset, subjectType: row.subjectType };
};

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

// Minimal duplicate of agents/runtime/index.ts's reasonWithLLM — this is the
// one place the API talks to the local model directly, for Annotate's
// "Invoke model" button: a synchronous, read-only preview for a single Asset
// that writes nothing to the graph (the human still has to click Save, which
// goes through reclassifyAsset above). Duplicated rather than imported from
// agents/, per this codebase's cross-workspace isolation convention —
// agents/tools/graph-read.ts's fetchAgreementRate duplicates the same way in
// the other direction (architecture.md:59).
const askModel = async (prompt: string): Promise<{ rationale: string; confidence: number; proposedSubjectTypeId: string }> => {
    const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            stream: false,
            format: 'json',
            messages: [{
                role: 'user',
                content: `${prompt}\n\nRespond with ONLY a JSON object of the form `
                    + `{"rationale": string, "confidence": number between 0 and 1, `
                    + `"proposedSubjectTypeId": one of the listed ids, or the literal string "none" if no candidate applies}. No other text.`,
            }],
        }),
    });
    if (!res.ok) throw new Error(`onboarding.repo: Ollama request failed: ${res.status} ${await res.text()}`);
    const data: any = await res.json();
    const parsed = JSON.parse(data?.message?.content ?? '{}');
    return {
        rationale: String(parsed.rationale ?? 'UNKNOWN'),
        confidence: Number(parsed.confidence ?? 0),
        proposedSubjectTypeId: String(parsed.proposedSubjectTypeId ?? 'none'),
    };
};

const GET_ASSET = `MATCH (a:Asset {id: $id}) RETURN properties(a) AS asset`;

// Same prompt shape as applicability-intelligence/index.ts's `reason` step,
// against one caller-chosen Asset instead of the full unclassified-assets
// observe loop — Annotate's per-row "Invoke model" when a reviewer wants a
// fresh read rather than picking from the dropdown themselves.
export const suggestClassification = async (assetId: string) => {
    const raw: any = await db().fetch(GET_ASSET, { id: assetId });
    const row = Array.isArray(raw) ? raw[0] : raw;
    const asset = row?.asset;
    if (!asset) throw new Error(`Asset ${assetId} not found`);

    const subjectTypes = await listSubjectTypes();
    const candidates = subjectTypes.filter((st: any) => st.bindsAt === 'Asset');
    const candidateList = candidates.map((st: any) => `${st.id}: ${st.name}`).join('\n');

    return askModel(
        `A tenant Asset needs to be classified against the regulatory SubjectType vocabulary:\n` +
        `Asset: "${asset.name}" (category: ${asset.category ?? 'UNKNOWN'}, assetType: ${asset.assetType ?? 'UNKNOWN'})\n` +
        `Candidate SubjectTypes (id: name):\n${candidateList}\n\n` +
        `Propose, in one or two sentences, which SubjectType this Asset is regulated as, if any.`
    );
};
