import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import log from '../../lib/log';

const feedsDir = path.resolve(__dirname, '..', 'feeds', 'csv');
const operationalDir = path.join(feedsDir, 'operational');
const edgesDir = path.join(feedsDir, 'edges');

type Row = Record<string, string>;

const readCSV = (relPath: string): Row[] =>
    parse(fs.readFileSync(path.join(feedsDir, relPath), 'utf-8'), { columns: true, skip_empty_lines: true, trim: true }) as Row[];

const writeCSV = (dir: string, fileName: string, rows: Row[]): void => {
    if (!rows.length) { log.warn(`generate-person-seed: no rows for ${fileName}`); return; }
    const cols = Object.keys(rows[0]);
    const esc = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c] ?? '')).join(','))];
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), lines.join('\n') + '\n');
    log.info(`generate-person-seed: ${fileName} <- ${rows.length} rows`);
};

const slugName = (name: string): string => `PER-${name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;

// "Name - Role Title" is the only shape these free-text fields ever take across the
// legacy dataset (verified: 7 distinct names, all "Full Name - Title"). Splits on the
// first " - " only, so a title containing " - " itself wouldn't break the name.
const splitNameTitle = (raw: string): { name: string; title: string } => {
    const idx = raw.indexOf(' - ');
    return idx < 0
        ? { name: raw.trim(), title: '' }
        : { name: raw.slice(0, idx).trim(), title: raw.slice(idx + 3).trim() };
};

const generate = (): void => {
    const incidents = readCSV('operational/incidents.csv');
    const capas = readCSV('execution/capas.csv');
    const verifications = readCSV('execution/verifications.csv');
    const risks = readCSV('intelligence/risks.csv');
    const tasks = readCSV('execution/tasks.csv');

    const people = new Map<string, { title: string }>();
    const facilitiesByName = new Map<string, Set<string>>();

    const addPerson = (raw: string | undefined, facilityId?: string): void => {
        if (!raw || raw === 'UNKNOWN') return;
        const { name, title } = splitNameTitle(raw);
        if (!people.has(name)) people.set(name, { title });
        if (facilityId) {
            if (!facilitiesByName.has(name)) facilitiesByName.set(name, new Set());
            facilitiesByName.get(name)!.add(facilityId);
        }
    };

    // Only Incident rows carry a real facilityId — every person appears at 2-4
    // facilities with equal frequency (verified: no single "home" facility is
    // actually supported by the data), so WORKS_AT is modeled many-valued via
    // an edges CSV rather than forcing one embedded-FK pick per person.
    incidents.forEach(i => { addPerson(i.capturedBy, i.facilityId); addPerson(i.reviewedBy, i.facilityId); });
    capas.forEach(c => addPerson(c.owner));
    verifications.forEach(v => addPerson(v.verifiedBy));
    risks.forEach(r => addPerson(r.owner));
    tasks.forEach(t => addPerson(t.owner));

    // roleId intentionally left blank: none of these free-text titles (e.g. "QA
    // Executive", "Corporate EHS") match any of the 16 seeded enterprise Roles —
    // that catalog is from a different vertical (Industrial Parks/Warehouse/3PL).
    // Forcing a match would be a guess; HAS_ROLE simply doesn't fire for these rows.
    writeCSV(operationalDir, 'people.csv', Array.from(people.entries()).map(([name, { title }]) => ({
        id: slugName(name),
        name,
        roleTitle: title,
        email: '',
        roleId: '',
        facilityId: '',
        status: 'active',
        version: '1.0',
    })));

    const edgeRows: Row[] = [];
    for (const [name, facilityIds] of facilitiesByName) {
        for (const facilityId of facilityIds) {
            edgeRows.push({ personId: slugName(name), facilityId });
        }
    }
    writeCSV(edgesDir, 'person_facility.csv', edgeRows);
};

generate();
