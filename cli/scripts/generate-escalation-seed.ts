import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import log from '../../lib/log';
import { ESCALATION_TITLE_TO_ROLE } from './lib/title-role-map';

const feedsDir = path.resolve(__dirname, '..', 'feeds', 'csv');
const edgesDir = path.join(feedsDir, 'edges');

type Row = Record<string, string>;

const readCSV = (relPath: string): Row[] =>
    parse(fs.readFileSync(path.join(feedsDir, relPath), 'utf-8'), { columns: true, skip_empty_lines: true, trim: true }) as Row[];

const writeCSV = (dir: string, fileName: string, rows: Row[]): void => {
    if (!rows.length) { log.warn(`generate-escalation-seed: no rows for ${fileName}`); return; }
    const cols = Object.keys(rows[0]);
    const esc = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c] ?? '')).join(','))];
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), lines.join('\n') + '\n');
    log.info(`generate-escalation-seed: ${fileName} <- ${rows.length} rows`);
};

const generate = (): void => {
    const incidents = readCSV('operational/incidents.csv');

    const edgeRows: Row[] = [];
    for (const incident of incidents) {
        const segments = (incident.escalationPath ?? '').split('→').map(s => s.trim()).filter(Boolean);

        // `order` is the segment's original 1-based position in the free-text chain,
        // not renumbered when a hop is unmapped — a gap in the sequence (e.g. 1, 3
        // with no 2) is itself the documented signal of an unmapped hop, never
        // silently collapsed to look like a complete chain.
        segments.forEach((title, index) => {
            const roleId = ESCALATION_TITLE_TO_ROLE[title];
            if (roleId) {
                edgeRows.push({ incidentId: incident.id, roleId, order: String(index + 1) });
            }
        });
    }

    writeCSV(edgesDir, 'incident_escalation.csv', edgeRows);
};

generate();
