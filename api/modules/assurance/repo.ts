import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';
import log from '../../../lib/log';

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
    try {
        const raw: any = await db().fetch2(LIST_EVIDENCE, {});
        const rows = Array.isArray(raw) ? raw : [raw]; return rows.map((r: any) => r.evidence).filter(Boolean);
    } catch (err: any) {
        log.error('assurance.repo: listEvidence failed', err.message);
        return [];
    }
};

// Coverage Scoring (L6, Phase 4a) — catalog-origin data only. Requirement -> Control and
// Asset -> ComplianceArea are dual-origin relationships (see vyra-graph-spine.md): the 15 legacy
// per-incident Controls carry no BELONGS_TO -> ComplianceArea edge, so an unfiltered query would
// silently exclude them from the denominator rather than the numerator. Filtering explicitly to
// :Catalog/:Enterprise makes that scoping decision visible in the query, not an accident of the data.
const REQUIREMENT_COVERAGE_TOTAL = `
    MATCH (req:Requirement:Catalog)
    OPTIONAL MATCH (req)<-[:IMPLEMENTS]-(ctl:Control:Catalog)
    RETURN
        count(DISTINCT req) AS totalRequirements,
        count(DISTINCT CASE WHEN ctl IS NOT NULL THEN req END) AS coveredRequirements
`;

// unmappedComplianceArea isolates the known Security-category gap (2 of 31 assets, see
// vyra-graph-spine.md's Asset section) as its own bucket rather than folding it into "uncovered".
const ASSET_COVERAGE_TOTAL = `
    MATCH (ast:Asset:Enterprise)
    OPTIONAL MATCH (ast)-[:IN_COMPLIANCE_AREA]->(ca:ComplianceArea)
    OPTIONAL MATCH (ast)-[:COVERED_BY]->(ctl:Control:Catalog)
    RETURN
        count(DISTINCT ast) AS totalAssets,
        count(DISTINCT CASE WHEN ca IS NULL THEN ast END) AS unmappedComplianceArea,
        count(DISTINCT CASE WHEN ctl IS NOT NULL THEN ast END) AS coveredAssets
`;

const REQUIREMENT_COVERAGE_BY_AREA = `
    MATCH (ca:ComplianceArea)
    OPTIONAL MATCH (ca)<-[:BELONGS_TO]-(ctl:Control:Catalog)
    OPTIONAL MATCH (ctl)-[:IMPLEMENTS]->(req:Requirement:Catalog)
    RETURN
        ca.id AS complianceAreaId,
        ca.name AS complianceAreaName,
        count(DISTINCT ctl) AS controls,
        count(DISTINCT req) AS requirementsCovered
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
    try {
        const [reqRaw, astRaw, reqByAreaRaw, astByAreaRaw] = await Promise.all([
            db().fetch2(REQUIREMENT_COVERAGE_TOTAL, {}),
            db().fetch2(ASSET_COVERAGE_TOTAL, {}),
            db().fetch2(REQUIREMENT_COVERAGE_BY_AREA, {}),
            db().fetch2(ASSET_COVERAGE_BY_AREA, {}),
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
                requirementsCovered: r.requirementsCovered,
                assets: a.assets,
                coveredAssets: a.coveredAssets,
            };
        });

        return {
            scope: 'catalog-origin only — legacy (unlabeled) Controls and Assets are excluded, see vyra-implementation-plan.md Phase 4a',
            requirements: {
                total: req.totalRequirements ?? 0,
                covered: req.coveredRequirements ?? 0,
                coveragePercent: pct(req.coveredRequirements ?? 0, req.totalRequirements ?? 0),
            },
            assets: {
                total: ast.totalAssets ?? 0,
                covered: ast.coveredAssets ?? 0,
                unmappedComplianceArea: ast.unmappedComplianceArea ?? 0,
                coveragePercent: pct(ast.coveredAssets ?? 0, ast.totalAssets ?? 0),
            },
            byComplianceArea,
        };
    } catch (err: any) {
        log.error('assurance.repo: getCoverageScore failed', err.message);
        return null;
    }
};

const RISK_ROLLUP = `
    MATCH (r:Risk)
    RETURN r.residualRating AS rating, count(r) AS count, avg(toInteger(r.residualScore)) AS avgScore
    ORDER BY avgScore DESC
`;

export const getRiskRollup = async () => {
    try {
        const raw: any = await db().fetch2(RISK_ROLLUP, {});
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
    } catch (err: any) {
        log.error('assurance.repo: getRiskRollup failed', err.message);
        return null;
    }
};

const LIST_ATTESTATIONS = `
    MATCH (a:Attestation)
    RETURN properties(a) AS attestation
    ORDER BY a.attestedAt DESC
`;

export const listAttestations = async () => {
    try {
        const raw: any = await db().fetch2(LIST_ATTESTATIONS, {});
        const rows = Array.isArray(raw) ? raw : [raw]; return rows.map((r: any) => r.attestation).filter(Boolean);
    } catch (err: any) {
        log.error('assurance.repo: listAttestations failed', err.message);
        return [];
    }
};

const LIST_EVIDENCE_PACKAGES = `
    MATCH (p:EvidencePackage)
    RETURN properties(p) AS evidencePackage
    ORDER BY p.period DESC
`;

export const listEvidencePackages = async () => {
    try {
        const raw: any = await db().fetch2(LIST_EVIDENCE_PACKAGES, {});
        const rows = Array.isArray(raw) ? raw : [raw]; return rows.map((r: any) => r.evidencePackage).filter(Boolean);
    } catch (err: any) {
        log.error('assurance.repo: listEvidencePackages failed', err.message);
        return [];
    }
};

const LIST_ASSURANCE_STATEMENTS = `
    MATCH (s:AssuranceStatement)
    OPTIONAL MATCH (s)-[:COVERS]->(reg:Regulation)
    WITH s, collect(DISTINCT reg.name) AS regulations
    RETURN properties(s) AS statement, regulations
    ORDER BY s.generatedAt DESC
`;

export const listAssuranceStatements = async () => {
    try {
        const raw: any = await db().fetch2(LIST_ASSURANCE_STATEMENTS, {});
        const rows = Array.isArray(raw) ? raw : [raw];
        return rows.filter(Boolean).map((r: any) => ({ ...r.statement, regulations: r.regulations ?? [] }));
    } catch (err: any) {
        log.error('assurance.repo: listAssuranceStatements failed', err.message);
        return [];
    }
};

const LIST_AUDITS = `
    MATCH (a:Audit)
    OPTIONAL MATCH (s:AssuranceStatement)-[:PREPARED_FOR]->(a)
    WITH a, collect(DISTINCT s.id) AS statementIds
    RETURN properties(a) AS audit, statementIds
    ORDER BY a.period DESC
`;

export const listAudits = async () => {
    try {
        const raw: any = await db().fetch2(LIST_AUDITS, {});
        const rows = Array.isArray(raw) ? raw : [raw];
        return rows.filter(Boolean).map((r: any) => ({ ...r.audit, statementIds: r.statementIds ?? [] }));
    } catch (err: any) {
        log.error('assurance.repo: listAudits failed', err.message);
        return [];
    }
};
