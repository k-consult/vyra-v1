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

export const getPosture = async () => {
    try {
        const cypher = `
            MATCH (req:Requirement)
            OPTIONAL MATCH (req)<-[:IMPLEMENTS]-(ctl:Control)
            OPTIONAL MATCH (ctl)<-[:AGAINST]-(fnd:Finding {status: 'open'})
            RETURN
                count(DISTINCT req) AS totalRequirements,
                count(DISTINCT ctl) AS controlledRequirements,
                count(DISTINCT fnd) AS openFindings
        `;
        return await db().fetch2(cypher, {});
    } catch (err: any) {
        log.error('assurance.repo: getPosture failed', err.message);
        return [];
    }
};

export const listAttestations = async () => {
    try {
        const cypher = `MATCH (a:Attestation) RETURN properties(a) AS attestation ORDER BY a.attestedAt DESC LIMIT 50`;
        return await db().fetch2(cypher, {});
    } catch (err: any) {
        log.error('assurance.repo: listAttestations failed', err.message);
        return [];
    }
};
