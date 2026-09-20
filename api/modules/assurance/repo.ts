import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

const LIST_EVIDENCE = `
    MATCH (n:Evidence)
    RETURN properties(n) AS evidence
    ORDER BY n.collectedAt DESC
`;

export const listEvidence = async () => {
    const raw: any = await db().fetch(LIST_EVIDENCE, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.evidence).filter(Boolean);
};

// Coverage Scoring (L6, Phase 4a) — catalog-origin data only. Obligation -> Control and
// Asset -> ComplianceArea are dual-origin relationships (see graph.md): the 15 legacy
// per-incident Controls carry no BELONGS_TO -> ComplianceArea edge, so an unfiltered query would
// silently exclude them from the denominator rather than the numerator. Filtering explicitly to
// :Catalog/:Enterprise makes that scoping decision visible in the query, not an accident of the data.
const OBLIGATION_COVERAGE_TOTAL = `
    MATCH (req:Obligation:Catalog)
    OPTIONAL MATCH (req)<-[:IMPLEMENTS]-(ctl:Control:Catalog)
    RETURN
        count(DISTINCT req) AS totalObligations,
        count(DISTINCT CASE WHEN ctl IS NOT NULL THEN req END) AS coveredObligations
`;

// unmappedComplianceArea isolates the known Security-category gap (2 of 31 assets, see
// graph.md's Asset section) as its own bucket rather than folding it into "uncovered".
const ASSET_COVERAGE_TOTAL = `
    MATCH (ast:Asset:Enterprise)
    OPTIONAL MATCH (ast)-[:IN_COMPLIANCE_AREA]->(ca:ComplianceArea)
    OPTIONAL MATCH (ast)-[:COVERED_BY]->(ctl:Control:Catalog)
    RETURN
        count(DISTINCT ast) AS totalAssets,
        count(DISTINCT CASE WHEN ca IS NULL THEN ast END) AS unmappedComplianceArea,
        count(DISTINCT CASE WHEN ctl IS NOT NULL THEN ast END) AS coveredAssets
`;

const OBLIGATION_COVERAGE_BY_AREA = `
    MATCH (ca:ComplianceArea)
    OPTIONAL MATCH (ca)<-[:BELONGS_TO]-(ctl:Control:Catalog)
    OPTIONAL MATCH (ctl)-[:IMPLEMENTS]->(req:Obligation:Catalog)
    RETURN
        ca.id AS complianceAreaId,
        ca.name AS complianceAreaName,
        count(DISTINCT ctl) AS controls,
        count(DISTINCT req) AS obligationsCovered
    ORDER BY ca.name
`;

const ASSET_COVERAGE_BY_AREA = `
    MATCH (ca:ComplianceArea)
    OPTIONAL MATCH (ca)<-[:IN_COMPLIANCE_AREA]-(ast:Asset:Enterprise)
    OPTIONAL MATCH (ast)-[:COVERED_BY]->(ctl:Control:Catalog)
    RETURN
        ca.id AS complianceAreaId,
        count(DISTINCT ast) AS assets,
        count(DISTINCT CASE WHEN ctl IS NOT NULL THEN ast END) AS coveredAssets
    ORDER BY ca.id
`;

const pct = (numerator: number, denominator: number): number =>
    denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;

const round1 = (n: number): number => Math.round(n * 10) / 10;

export const getCoverageScore = async () => {
    const [reqRaw, astRaw, reqByAreaRaw, astByAreaRaw] = await Promise.all([
        db().fetch(OBLIGATION_COVERAGE_TOTAL, {}),
        db().fetch(ASSET_COVERAGE_TOTAL, {}),
        db().fetch(OBLIGATION_COVERAGE_BY_AREA, {}),
        db().fetch(ASSET_COVERAGE_BY_AREA, {}),
    ]);

    const req: any = Array.isArray(reqRaw) ? reqRaw[0] : reqRaw;
    const ast: any = Array.isArray(astRaw) ? astRaw[0] : astRaw;
    const reqByArea: any[] = Array.isArray(reqByAreaRaw) ? reqByAreaRaw : [reqByAreaRaw];
    const astByArea: any[] = Array.isArray(astByAreaRaw) ? astByAreaRaw : [astByAreaRaw];

    const assetsById = new Map(astByArea.filter(Boolean).map((r: any) => [r.complianceAreaId, r]));

    const byComplianceArea = reqByArea.filter(Boolean).map((r: any) => {
        const a = assetsById.get(r.complianceAreaId) ?? { assets: 0, coveredAssets: 0 };
        return {
            complianceAreaId: r.complianceAreaId,
            complianceAreaName: r.complianceAreaName,
            controls: r.controls,
            obligationsCovered: r.obligationsCovered,
            assets: a.assets,
            coveredAssets: a.coveredAssets,
        };
    });

    return {
        scope: 'catalog-origin only — legacy (unlabeled) Controls and Assets are excluded, see plan.md Phase 4a',
        obligations: {
            total: req.totalObligations ?? 0,
            covered: req.coveredObligations ?? 0,
            coveragePercent: pct(req.coveredObligations ?? 0, req.totalObligations ?? 0),
        },
        assets: {
            total: ast.totalAssets ?? 0,
            covered: ast.coveredAssets ?? 0,
            unmappedComplianceArea: ast.unmappedComplianceArea ?? 0,
            coveragePercent: pct(ast.coveredAssets ?? 0, ast.totalAssets ?? 0),
        },
        byComplianceArea,
    };
};

const RISK_ROLLUP = `
    MATCH (r:Risk)
    RETURN r.residualRating AS rating, count(r) AS count, avg(toInteger(r.residualScore)) AS avgScore
    ORDER BY avgScore DESC
`;

export const getRiskRollup = async () => {
    const raw: any = await db().fetch(RISK_ROLLUP, {});
    const rows: any[] = Array.isArray(raw) ? raw : [raw];
    const byRating = rows.filter(Boolean).map(r => ({
        rating: r.rating,
        count: r.count,
        avgScore: r.avgScore != null ? Math.round(r.avgScore * 10) / 10 : 0,
    }));
    const totalRisks = byRating.reduce((sum, r) => sum + r.count, 0);
    const weightedSum = byRating.reduce((sum, r) => sum + r.avgScore * r.count, 0);
    return {
        byRating,
        totalRisks,
        avgResidualScore: totalRisks > 0 ? round1(weightedSum / totalRisks) : 0,
    };
};

// origin distinguishes Phase 4b's unlabeled synthetic batch from Phase 8's live
// assurance-intelligence agent proposals (labels() always includes the plain node label
// plus :AgentProposed when the agent created it — see api/modules/intelligence/repo.ts's
// APPROVE_ASSURANCE_PACKAGE).
const originOf = (labels: string[]): 'agent-proposed' | 'synthetic' =>
    labels.includes('AgentProposed') ? 'agent-proposed' : 'synthetic';

const LIST_ATTESTATIONS = `
    MATCH (a:Attestation)
    RETURN properties(a) AS attestation, labels(a) AS labels
    ORDER BY a.attestedAt DESC
`;

export const listAttestations = async () => {
    const raw: any = await db().fetch(LIST_ATTESTATIONS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.attestation).map((r: any) => ({ ...r.attestation, origin: originOf(r.labels ?? []) }));
};

const LIST_EVIDENCE_PACKAGES = `
    MATCH (p:EvidencePackage)
    RETURN properties(p) AS evidencePackage, labels(p) AS labels
    ORDER BY p.period DESC
`;

export const listEvidencePackages = async () => {
    const raw: any = await db().fetch(LIST_EVIDENCE_PACKAGES, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.evidencePackage).map((r: any) => ({ ...r.evidencePackage, origin: originOf(r.labels ?? []) }));
};

const LIST_ASSURANCE_STATEMENTS = `
    MATCH (s:AssuranceStatement)
    OPTIONAL MATCH (s)-[:COVERS]->(reg:Regulation)
    WITH s, collect(DISTINCT reg.name) AS regulations
    RETURN properties(s) AS statement, regulations, labels(s) AS labels
    ORDER BY s.generatedAt DESC
`;

export const listAssuranceStatements = async () => {
    const raw: any = await db().fetch(LIST_ASSURANCE_STATEMENTS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter(Boolean).map((r: any) => ({ ...r.statement, regulations: r.regulations ?? [], origin: originOf(r.labels ?? []) }));
};

const LIST_AUDITS = `
    MATCH (a:Audit)
    OPTIONAL MATCH (s:AssuranceStatement)-[:PREPARED_FOR]->(a)
    WITH a, collect(DISTINCT s.id) AS statementIds
    RETURN properties(a) AS audit, statementIds, labels(a) AS labels
    ORDER BY a.period DESC
`;

export const listAudits = async () => {
    const raw: any = await db().fetch(LIST_AUDITS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter(Boolean).map((r: any) => ({ ...r.audit, statementIds: r.statementIds ?? [], origin: originOf(r.labels ?? []) }));
};
