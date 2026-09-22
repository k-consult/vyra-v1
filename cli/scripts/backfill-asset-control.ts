import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { DB } from '../../lib/graph-db';
import { config } from '../../lib/config';
import log from '../../lib/log';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

// Derived edge, not a CSV-embedded FK — Asset and Control never share a row.
// Both point at the same ComplianceArea taxonomy, so the join is real, not fabricated.
// Idempotent (MERGE) — safe to rerun after any catalog-sync/enterprise-sync.
// confidence: 0.6 is a fixed constant — taxonomy-only inference via shared
// ComplianceArea, not a validated per-asset review, so a middling rather than
// high confidence is the honest value to stamp.
const BACKFILL_ASSET_CONTROL = `
    MATCH (a:Asset)-[:IN_COMPLIANCE_AREA]->(ca:ComplianceArea)<-[:BELONGS_TO]-(ctl:Control)
    MERGE (a)-[r:COVERED_BY]->(ctl)
    SET r.origin = 'inferred', r.confidence = 0.6, r.derivedAt = datetime()
    RETURN count(*) AS edgesCreated
`;

async function main() {
    log.info('backfill-asset-control: deriving Asset -[:COVERED_BY]-> Control via shared ComplianceArea...');
    const raw: any = await db().exec(BACKFILL_ASSET_CONTROL, {});
    const row = Array.isArray(raw) ? raw[0] : raw;
    log.info(`backfill-asset-control: +${row?.edgesCreated ?? 0} COVERED_BY edges`);
    await DB.closeAll();
}

main().catch(err => {
    log.error('backfill-asset-control: failed', err.message);
    process.exit(1);
});
