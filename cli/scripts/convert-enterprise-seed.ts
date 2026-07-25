import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import log from '../../lib/log';

const sourcePath = path.resolve(__dirname, '..', '..', '.design', '__ref', 'synthetic-data', 'data.csv');
const outDir = path.resolve(__dirname, '..', 'feeds', 'csv', 'enterprise');

type Row = Record<string, string>;

const extractWorksheet = (raw: string, name: string): Row[] => {
    const marker = `--- WORKSHEET: ${name} ---`;
    const start = raw.indexOf(marker);
    if (start < 0) throw new Error(`worksheet not found: ${name}`);
    const bodyStart = raw.indexOf('\n', start) + 1;
    const nextMarker = raw.indexOf('--- WORKSHEET:', bodyStart);
    const body = raw.slice(bodyStart, nextMarker < 0 ? undefined : nextMarker).trim();
    return parse(body, { columns: true, skip_empty_lines: true, trim: true }) as Row[];
};

const slug = (...parts: string[]): string =>
    parts.map(p => p.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')).join('__');

const orgId = (company: string, businessUnit: string, department: string): string =>
    `ORG-${slug(company, businessUnit, department)}`;

const writeCSV = (fileName: string, rows: Row[]): void => {
    if (!rows.length) { log.warn(`convert-enterprise-seed: no rows for ${fileName}`); return; }
    const cols = Object.keys(rows[0]);
    const esc = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c] ?? '')).join(','))];
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, fileName), lines.join('\n') + '\n');
    log.info(`convert-enterprise-seed: ${fileName} <- ${rows.length} rows`);
};

const convert = (): void => {
    const raw = fs.readFileSync(sourcePath, 'utf-8');

    const orgMappingRows = extractWorksheet(raw, '10_Organization_Mapping');
    const spatialRows = extractWorksheet(raw, '11_Spatial_Mapping');
    const rolesRows = extractWorksheet(raw, '18_Roles_Master');
    const assetRows = extractWorksheet(raw, '19_Asset_Equipment_Master');

    // ── Organization — dedupe Company/BusinessUnit/Department combos ──────
    const orgCombos = new Map<string, { company: string; businessUnit: string; department: string }>();
    for (const r of orgMappingRows) {
        const company = r['Company'];
        const businessUnit = r['Business Unit'];
        const department = r['Department'];
        orgCombos.set(orgId(company, businessUnit, department), { company, businessUnit, department });
    }

    writeCSV('organizations.csv', Array.from(orgCombos.entries()).map(([id, o]) => ({
        id,
        name: `${o.businessUnit} - ${o.department}`,
        company: o.company,
    })));

    // RoleID → org combo, sourced from the same worksheet that carries both.
    const roleToOrg = new Map<string, string>();
    for (const r of orgMappingRows) {
        roleToOrg.set(r['RoleID'], orgId(r['Company'], r['Business Unit'], r['Department']));
    }

    writeCSV('roles.csv', rolesRows.map(r => ({
        id: r['RoleID'],
        name: r['Title'],
        businessUnit: r['Business Unit'],
        department: r['Department'],
        approvalAuthority: r['Approval Authority (Y/N)'],
        organizationId: roleToOrg.get(r['RoleID']) ?? '',
    })));

    // ── Facility — dedupe to Site granularity; Building/Zone/Room live on Asset ──
    const sites = new Map<string, { company: string; siteName: string }>();
    for (const r of spatialRows) {
        sites.set(r['SiteID'], { company: r['Company'], siteName: r['Site Name'] });
    }

    writeCSV('facilities.csv', Array.from(sites.entries()).map(([id, s]) => ({
        id,
        name: s.siteName,
        company: s.company,
    })));

    writeCSV('assets.csv', assetRows.map(r => ({
        id: r['AssetID'],
        name: r['Name'],
        assetType: r['Type'],
        category: r['Category'],
        facilityId: r['SiteID'],
        buildingId: r['BuildingID'],
        zoneId: r['ZoneID'],
        roomId: r['RoomID'],
    })));
};

convert();
