import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { v2 } from '../semantic-contract';
import { parseCSV } from '../parser';
import { buildIR, compile } from '../compiler';
import { GraphEdge, GraphNode } from '../compiler/types';
import { project } from '../projection';
import { run } from '../runtime';
import { dumpIR, spotCheck } from '../observability';
import { config } from '../../lib/config';
import { DB } from '../../lib/graph-db';
import log from '../../lib/log';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const dumpArg = args.find(a => a.startsWith('--dump-ir='));
const dumpIRPath = dumpArg ? dumpArg.split('=')[1] : null;

// A customer's own document-tracking spreadsheet, not a standard authority board —
// --file selects the uploaded CSV directly rather than a cli/feeds/csv/<authority>/
// folder convention. DB_NAME (same env var catalog-sync.ts reads) targets the tenant.
const fileArg = args.find(a => a.startsWith('--file='));
if (!fileArg) {
    log.error('[document-catalog-sync] --file=<path> is required — the uploaded document-catalog CSV.');
    process.exit(1);
}
const feedPath = fileArg.split('=')[1];
const summaryPath = `${feedPath}.summary.json`;

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

const slug = (s: string): string =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');

const NA_SENTINEL = 'na';
// "All Assets" shows up on rows that cover a whole facility (e.g. a site-wide
// inspection log), not one piece of equipment — not a real Asset either.
const ASSET_SENTINELS = new Set([NA_SENTINEL, 'all assets']);

const FETCH_AUTHORITY_ABBREVIATIONS = `
    MATCH (a:Authority)
    WHERE a.abbreviation IS NOT NULL
    RETURN a.id AS id, a.abbreviation AS abbreviation
`;

// Agencies in the customer's own spreadsheet (e.g. "SPCB") are abbreviations, not
// Authority ids — resolved against the tenant's already-seeded catalog boards rather
// than assumed to match. Unmapped, non-"NA" agencies are reported, not silently
// dropped (the compiler/runtime would otherwise just drop the dangling edge with no
// trace — fine for the "NA" sentinel, not fine for a real mismatch on a first
// customer's data).
const resolveAuthorityIds = async (): Promise<Map<string, string>> => {
    const raw: any = await db().fetch(FETCH_AUTHORITY_ABBREVIATIONS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    const map = new Map<string, string>();
    for (const row of rows) {
        if (row?.abbreviation && row?.id) map.set(String(row.abbreviation).toLowerCase().trim(), row.id);
    }
    return map;
};

interface SummaryResult {
    facilitiesCreated: number;
    assetsCreated: number;
    documentObligationsCreated: number;
    unmappedAgencies: string[];
    rowsSkipped: number;
}

async function main() {
    log.info(`Vyra Document Catalog Sync v${v2.version}`);
    log.info(`Database : ${config.db.twin.database} @ ${config.db.twin.uri}`);
    log.info(`File     : ${feedPath}`);
    log.info(`Mode     : ${isDryRun ? 'dry-run (no Neo4j writes)' : 'full'}`);

    const { rows, errors } = parseCSV(feedPath, false);
    if (errors.length) errors.forEach(e => log.warn(`[parser] ${path.basename(feedPath)}: ${e}`));
    if (!rows.length) {
        log.error(`[document-catalog-sync] no rows parsed from ${feedPath}`);
        process.exit(1);
    }

    const authorityIdByAbbreviation = await resolveAuthorityIds();
    const unmappedAgencies = new Set<string>();
    let rowsSkipped = 0;

    // Org structure extraction — dedupe (Site Code, Site Name) pairs into Facility rows,
    // and (Site Code, Asset) pairs into Asset rows (skipping the NA/All-Assets
    // sentinels, which aren't real equipment).
    const facilityById = new Map<string, Record<string, any>>();
    const assetById = new Map<string, Record<string, any>>();
    const documentRows: Record<string, any>[] = [];

    for (const row of rows) {
        const siteCode = String(row['Site Code'] ?? '').trim();
        if (!siteCode) { rowsSkipped++; continue; }

        if (!facilityById.has(siteCode)) {
            facilityById.set(siteCode, { id: siteCode, name: String(row['Site Name'] ?? siteCode).trim() });
        }

        const agency = String(row['Agency'] ?? '').trim();
        const agencyKey = agency.toLowerCase();
        let authorityId = '';
        if (agencyKey && agencyKey !== NA_SENTINEL) {
            const resolved = authorityIdByAbbreviation.get(agencyKey);
            if (resolved) authorityId = resolved;
            else unmappedAgencies.add(agency);
        }

        const category = String(row['Category'] ?? '').trim();
        const documentType = String(row['Document Type'] ?? '').trim();
        const year = String(row['Year'] ?? '').trim();
        const asset = String(row['Asset'] ?? '').trim();

        // Asset id is facility-scoped — "STP" at ROH-BLR-01 and "STP" at ROH-MYS-01
        // are two different physical pumps, not one node shared across sites.
        let assetId = '';
        const assetKey = asset.toLowerCase();
        if (assetKey && !ASSET_SENTINELS.has(assetKey)) {
            assetId = `${slug(siteCode)}-${slug(asset)}`;
            const assetMapKey = `${siteCode}::${assetKey}`;
            if (!assetById.has(assetMapKey)) {
                assetById.set(assetMapKey, { id: assetId, name: asset, facilityId: siteCode });
            }
        }

        // Asset disambiguates rows that otherwise share (site, category, documentType,
        // year) — e.g. "Equipment-Datasheet" is filed once per piece of equipment
        // (STP, DG-01, Boiler-01), not once per site. Omitting it silently merged
        // those distinct rows into one node via MERGE's id-based upsert.
        documentRows.push({
            id: `${slug(siteCode)}-${slug(category)}-${slug(documentType)}-${slug(asset || NA_SENTINEL)}-${slug(year)}`,
            name: asset && asset.toLowerCase() !== NA_SENTINEL
                ? `${documentType} (${asset}) — ${siteCode} (${year})`
                : `${documentType} — ${siteCode} (${year})`,
            category,
            documentType,
            year,
            agency,
            asset,
            expectedFileName: String(row['Expected File Name'] ?? '').trim(),
            status: String(row['Status'] ?? '').trim(),
            actualFileName: String(row['Actual File Name'] ?? '').trim(),
            notes: String(row['Notes'] ?? '').trim(),
            facilityId: siteCode,
            authorityId,
            assetId,
        });
    }

    if (rowsSkipped) log.warn(`[document-catalog-sync] skipped ${rowsSkipped} row(s) missing Site Code`);
    if (unmappedAgencies.size) log.warn(`[document-catalog-sync] unmapped agencies (no matching Authority.abbreviation): ${[...unmappedAgencies].join(', ')}`);

    const facilityRows = Array.from(facilityById.values());
    const assetRows = Array.from(assetById.values());
    const facilityCompiled = compile(v2, 'Facility', facilityRows, path.basename(feedPath));
    const assetCompiled = compile(v2, 'Asset', assetRows, path.basename(feedPath));
    const documentCompiled = compile(v2, 'DocumentObligation', documentRows, path.basename(feedPath));

    const allNodes: GraphNode[] = [...facilityCompiled.nodes, ...assetCompiled.nodes, ...documentCompiled.nodes];
    const allEdges: GraphEdge[] = [...facilityCompiled.edges, ...assetCompiled.edges, ...documentCompiled.edges];

    const ir = buildIR(v2.version, allNodes, allEdges);
    spotCheck(ir);

    if (dumpIRPath) {
        dumpIR(ir, dumpIRPath);
        log.info(`[observability] IR dumped → ${dumpIRPath}`);
    }

    const summary: SummaryResult = {
        facilitiesCreated: facilityRows.length,
        assetsCreated: assetRows.length,
        documentObligationsCreated: documentRows.length,
        unmappedAgencies: [...unmappedAgencies],
        rowsSkipped,
    };

    if (isDryRun) {
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
        log.info(`[document-catalog-sync] dry-run complete — no Neo4j writes`);
        return;
    }

    const projection = project(ir);
    log.info(`[projection] ${projection.nodeBatches.length} node batches, ${projection.edgeBatches.length} edge batches (CSVs in cli/out/ for debug)`);

    await run(projection, { originLabel: 'Tenant', sourceRevision: v2.version });
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    await DB.closeAll();
}

main().catch(err => {
    log.error(`[document-catalog-sync] pipeline failed: ${err.message}`);
    process.exit(1);
});
