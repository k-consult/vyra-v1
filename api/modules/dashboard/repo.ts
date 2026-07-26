import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';
import log from '../../../lib/log';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

// fetch2 unwraps single-record results via flattenWhenScalar — normalise here
const toRow = (raw: any): Record<string, number> => {
    const row = Array.isArray(raw) ? raw[0] : raw;
    return row ?? {};
};

const COUNT_INCIDENTS = `
    MATCH (n:Incident)
    RETURN count(n) AS total,
        sum(CASE WHEN n.riskRating = 'Critical' THEN 1 ELSE 0 END) AS critical,
        sum(CASE WHEN n.status <> 'closed'      THEN 1 ELSE 0 END) AS open
`;
const COUNT_REGULATIONS   = `MATCH (n:Regulation)   RETURN count(n) AS total`;
const COUNT_FACILITIES    = `MATCH (n:Facility)     RETURN count(n) AS total`;
const COUNT_ASSETS        = `MATCH (n:Asset)        RETURN count(n) AS total`;
const COUNT_VENDORS       = `MATCH (n:Vendor)       RETURN count(n) AS total`;
const COUNT_CONTROLS      = `MATCH (n:Control)      RETURN count(n) AS total`;
const COUNT_TASKS = `
    MATCH (n:Task)
    RETURN count(n) AS total,
        sum(CASE WHEN n.status =  'closed' THEN 1 ELSE 0 END) AS closed,
        sum(CASE WHEN n.status <> 'closed' THEN 1 ELSE 0 END) AS open
`;
const COUNT_EVIDENCE      = `MATCH (n:Evidence)     RETURN count(n) AS total`;
const COUNT_RISKS = `
    MATCH (n:Risk)
    RETURN count(n) AS total,
        sum(CASE WHEN n.inherentRating = 'Critical' THEN 1 ELSE 0 END) AS critical,
        sum(CASE WHEN n.inherentRating = 'High'     THEN 1 ELSE 0 END) AS high
`;
const COUNT_FINDINGS = `
    MATCH (n:Finding)
    RETURN count(n) AS total,
        sum(CASE WHEN n.severity = 'Critical'  THEN 1 ELSE 0 END) AS critical,
        sum(CASE WHEN n.status   <> 'closed'   THEN 1 ELSE 0 END) AS open
`;
const COUNT_RCAS          = `MATCH (n:RCA)          RETURN count(n) AS total`;
const COUNT_DECISIONS     = `MATCH (n:Decision)     RETURN count(n) AS total`;
const COUNT_CAPAS = `
    MATCH (n:CAPA)
    RETURN count(n) AS total,
        sum(CASE WHEN n.status <> 'closed' THEN 1 ELSE 0 END) AS open
`;
const COUNT_VERIFICATIONS = `MATCH (n:Verification) RETURN count(n) AS total`;
const COUNT_ORGANIZATIONS     = `MATCH (n:Organization)     RETURN count(n) AS total`;
const COUNT_ROLES             = `MATCH (n:Role)             RETURN count(n) AS total`;
const COUNT_COMPLIANCE_AREAS  = `MATCH (n:ComplianceArea)   RETURN count(n) AS total`;
const COUNT_SIGNALS           = `MATCH (n:Signal)           RETURN count(n) AS total`;

const posture = (
    risks: Record<string, number>,
    findings: Record<string, number>,
    capas: Record<string, number>,
    incidents: Record<string, number>,
): string => {
    if (risks.critical > 0 || findings.critical > 0) return 'critical';
    if (risks.high > 0 || capas.open > 0 || findings.open > 0) return 'at-risk';
    if (incidents.open > 0) return 'controlled';
    return 'healthy';
};

export const getLandscape = async () => {
    try {
        const [
            incRaw, regRaw, facRaw, astRaw, vndRaw, ctlRaw,
            tskRaw, evdRaw, rskRaw, fndRaw, rcaRaw, decRaw, capRaw, verRaw,
            orgRaw, roleRaw, caRaw, sigRaw,
        ] = await Promise.all([
            db().fetch2(COUNT_INCIDENTS,    {}),
            db().fetch2(COUNT_REGULATIONS,  {}),
            db().fetch2(COUNT_FACILITIES,   {}),
            db().fetch2(COUNT_ASSETS,       {}),
            db().fetch2(COUNT_VENDORS,      {}),
            db().fetch2(COUNT_CONTROLS,     {}),
            db().fetch2(COUNT_TASKS,        {}),
            db().fetch2(COUNT_EVIDENCE,     {}),
            db().fetch2(COUNT_RISKS,        {}),
            db().fetch2(COUNT_FINDINGS,     {}),
            db().fetch2(COUNT_RCAS,         {}),
            db().fetch2(COUNT_DECISIONS,    {}),
            db().fetch2(COUNT_CAPAS,        {}),
            db().fetch2(COUNT_VERIFICATIONS,{}),
            db().fetch2(COUNT_ORGANIZATIONS,{}),
            db().fetch2(COUNT_ROLES,        {}),
            db().fetch2(COUNT_COMPLIANCE_AREAS, {}),
            db().fetch2(COUNT_SIGNALS,      {}),
        ]);

        const inc = toRow(incRaw);
        const rsk = toRow(rskRaw);
        const fnd = toRow(fndRaw);
        const cap = toRow(capRaw);

        return {
            incidents:     { total: inc.total ?? 0, critical: inc.critical ?? 0, open: inc.open ?? 0 },
            regulations:   { total: toRow(regRaw).total ?? 0 },
            facilities:    { total: toRow(facRaw).total ?? 0 },
            assets:        { total: toRow(astRaw).total ?? 0 },
            vendors:       { total: toRow(vndRaw).total ?? 0 },
            controls:      { total: toRow(ctlRaw).total ?? 0 },
            tasks:         { total: toRow(tskRaw).total ?? 0, open: toRow(tskRaw).open ?? 0, closed: toRow(tskRaw).closed ?? 0 },
            evidence:      { total: toRow(evdRaw).total ?? 0 },
            risks:         { total: rsk.total ?? 0, critical: rsk.critical ?? 0, high: rsk.high ?? 0 },
            findings:      { total: fnd.total ?? 0, critical: fnd.critical ?? 0, open: fnd.open ?? 0 },
            rcas:          { total: toRow(rcaRaw).total ?? 0 },
            decisions:     { total: toRow(decRaw).total ?? 0 },
            capas:         { total: cap.total ?? 0, open: cap.open ?? 0 },
            verifications: { total: toRow(verRaw).total ?? 0 },
            organizations: { total: toRow(orgRaw).total ?? 0 },
            roles:         { total: toRow(roleRaw).total ?? 0 },
            complianceAreas: { total: toRow(caRaw).total ?? 0 },
            signals:       { total: toRow(sigRaw).total ?? 0 },
            posture:       posture(rsk, fnd, cap, inc),
            updatedAt:     new Date().toISOString(),
        };
    } catch (err: any) {
        log.error('dashboard.repo: getLandscape failed', err.message);
        return null;
    }
};
