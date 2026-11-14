import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import log from '../../lib/log';

const feedsDir = path.resolve(__dirname, '..', 'feeds', 'csv');
const assuranceDir = path.join(feedsDir, 'assurance');
const edgesDir = path.join(feedsDir, 'edges');

type Row = Record<string, string>;

const readCSV = (relPath: string): Row[] =>
    parse(fs.readFileSync(path.join(feedsDir, relPath), 'utf-8'), { columns: true, skip_empty_lines: true, trim: true }) as Row[];

const writeCSV = (dir: string, fileName: string, rows: Row[]): void => {
    if (!rows.length) { log.warn(`generate-assurance-seed: no rows for ${fileName}`); return; }
    const cols = Object.keys(rows[0]);
    const esc = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c] ?? '')).join(','))];
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), lines.join('\n') + '\n');
    log.info(`generate-assurance-seed: ${fileName} <- ${rows.length} rows`);
};

// incidentTime is "YYYY-MM-DD HH:mm" — add days and keep the same shape for consistency
// with the rest of this dataset's datetime columns (none of which are true ISO strings).
const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr.replace(' ', 'T'));
    d.setUTCDate(d.getUTCDate() + days);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

const quarterOf = (dateStr: string): string => {
    const d = new Date(dateStr.replace(' ', 'T'));
    return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
};

const generate = (): void => {
    const incidents = readCSV('operational/incidents.csv');
    const evidence = readCSV('assurance/evidence.csv');
    const incidentRegulations = readCSV('edges/incident_regulation.csv');
    const incidentFindings = readCSV('edges/incident_finding.csv');
    const findingRcas = readCSV('edges/finding_rca.csv');
    const rcaCapas = readCSV('edges/rca_capa.csv');
    const capaVerifications = readCSV('edges/capa_verification.csv');

    // Posture, per incident, walked from real closure data rather than asserted:
    // Incident -> Finding -> RCA -> CAPA -> Verification. Every CAPA reachable from the
    // incident's findings must have at least one Verification for the posture to read
    // "Compliant" outright — otherwise it surfaces the gap instead of asserting closure.
    const capasVerified = new Set(capaVerifications.map(r => r['capaId']));
    const posturePerIncident = new Map<string, string>();
    for (const incident of incidents) {
        const findingIds = incidentFindings.filter(r => r['incidentId'] === incident['id']).map(r => r['findingId']);
        const rcaIds = findingRcas.filter(r => findingIds.includes(r['findingId'])).map(r => r['rcaId']);
        const capaIds = rcaCapas.filter(r => rcaIds.includes(r['rcaId'])).map(r => r['capaId']);
        const allVerified = capaIds.length > 0 && capaIds.every(id => capasVerified.has(id));
        posturePerIncident.set(incident['id'], allVerified ? 'Compliant' : 'Compliant with open corrective action');
    }

    // ── EvidencePackage — one per Incident, bundling that incident's Evidence ──────────────
    writeCSV(assuranceDir, 'evidence-packages.csv', incidents.map(inc => ({
        id: `EPKG-${inc['id']}`,
        name: `Evidence Package - ${inc['name']}`,
        period: quarterOf(inc['incidentTime']),
        status: 'assembled',
        version: '1.0',
    })));

    // ── Evidence.csv, rewritten in place with packageId (source already == incident id) ────
    writeCSV(assuranceDir, 'evidence.csv', evidence.map(e => ({
        ...e,
        packageId: `EPKG-${e['source']}`,
    })));

    // ── Attestation — one per package, signed by the incident's real reviewer ──────────────
    writeCSV(assuranceDir, 'attestations.csv', incidents.map(inc => ({
        id: `ATT-${inc['id']}`,
        name: `Attestation - ${inc['name']}`,
        attestedBy: inc['reviewedBy'],
        attestedAt: addDays(inc['incidentTime'], 3),
        packageId: `EPKG-${inc['id']}`,
        status: 'attested',
        version: '1.0',
    })));

    // ── AssuranceStatement — one per attestation, posture derived from CAPA closure ────────
    writeCSV(assuranceDir, 'assurance-statements.csv', incidents.map(inc => ({
        id: `ASM-${inc['id']}`,
        name: `Assurance Statement - ${inc['name']}`,
        scope: inc['scope'],
        posture: posturePerIncident.get(inc['id']) ?? 'Unknown',
        generatedAt: addDays(inc['incidentTime'], 5),
        attestationId: `ATT-${inc['id']}`,
        status: 'issued',
        version: '1.0',
    })));

    // ── Audit — one per incident, promoted from the incident's own audit metadata ──────────
    writeCSV(assuranceDir, 'audits.csv', incidents.map(inc => ({
        id: `AUD-${inc['id']}`,
        name: inc['auditType'],
        type: inc['auditType'],
        period: quarterOf(inc['incidentTime']),
        auditor: inc['reviewedBy'],
        status: 'closed',
        version: '1.0',
    })));

    // ── Edges: AssuranceStatement -[:COVERS]-> Regulation, -[:PREPARED_FOR]-> Audit ────────
    writeCSV(edgesDir, 'assurance_statement_regulation.csv', incidentRegulations.map(r => ({
        assuranceStatementId: `ASM-${r['incidentId']}`,
        regulationId: r['regulationId'],
    })));

    writeCSV(edgesDir, 'assurance_statement_audit.csv', incidents.map(inc => ({
        assuranceStatementId: `ASM-${inc['id']}`,
        auditId: `AUD-${inc['id']}`,
    })));
};

generate();
