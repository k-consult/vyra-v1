import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import log from '../../lib/log';

const sourcePath = path.resolve(__dirname, '..', '..', '.design', '__ref', 'synthetic-data', 'data.csv');
const outDir = path.resolve(__dirname, '..', 'feeds', 'csv', 'catalog');

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

const slugJurisdiction = (name: string): string => `JUR-${name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;

// 13_Schedule_Rules' Frequency is a qualitative label, not a numeric cadence — this is a direct
// translation of that label, not fabricated data. Only 'Fixed' schedule-type rows use this map;
// 'Triggered' rows (event/sensor/risk/AI-driven) have no periodic cadence and are excluded.
const FREQUENCY_CADENCE: Record<string, { cadenceUnit: string; cadenceInterval: number }> = {
    Hourly: { cadenceUnit: 'hour', cadenceInterval: 1 },
    Daily: { cadenceUnit: 'day', cadenceInterval: 1 },
    Weekly: { cadenceUnit: 'week', cadenceInterval: 1 },
    Fortnightly: { cadenceUnit: 'week', cadenceInterval: 2 },
    Monthly: { cadenceUnit: 'month', cadenceInterval: 1 },
    Quarterly: { cadenceUnit: 'month', cadenceInterval: 3 },
    'Half-Yearly': { cadenceUnit: 'month', cadenceInterval: 6 },
    Annual: { cadenceUnit: 'month', cadenceInterval: 12 },
};

// "Week NN" -> naive 7-day blocks from 2026-01-01 (not ISO week numbering, which would put
// Week 01 in late Dec 2025 since Jan 1 2026 falls on a Thursday).
const CALENDAR_YEAR_START = '2026-01-01T00:00:00.000Z';

const parseWeekAnchor = (anchorWeek: string): string => {
    const match = anchorWeek.match(/Week (\d+)/);
    if (!match) throw new Error(`unrecognised anchor week: ${anchorWeek}`);
    const weekNumber = Number(match[1]);
    const anchor = new Date(CALENDAR_YEAR_START);
    anchor.setUTCDate(anchor.getUTCDate() + 7 * (weekNumber - 1));
    return anchor.toISOString().slice(0, 10);
};

const writeCSV = (fileName: string, rows: Row[]): void => {
    if (!rows.length) { log.warn(`convert-catalog-seed: no rows for ${fileName}`); return; }
    const cols = Object.keys(rows[0]);
    const esc = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c] ?? '')).join(','))];
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, fileName), lines.join('\n') + '\n');
    log.info(`convert-catalog-seed: ${fileName} <- ${rows.length} rows`);
};

const convert = (): void => {
    const raw = fs.readFileSync(sourcePath, 'utf-8');

    const authorityRows = extractWorksheet(raw, '02_Regulatory_Authorities');
    const regulationRows = extractWorksheet(raw, '03_Regulations');
    const standardRows = extractWorksheet(raw, '04_Standards');
    const clauseRows = extractWorksheet(raw, '05_Clauses');
    const obligationRows = extractWorksheet(raw, '06_Obligations');
    const complianceAreaRows = extractWorksheet(raw, '07_Compliance_Areas');
    const controlRows = extractWorksheet(raw, '08_Operational_Controls');
    const taskMasterRows = extractWorksheet(raw, '09_Task_Master');
    const scheduleRuleRows = extractWorksheet(raw, '13_Schedule_Rules');

    const jurisdictionNames = new Set<string>([
        ...authorityRows.map(r => r['Jurisdiction']),
        ...regulationRows.map(r => r['Jurisdiction']),
    ]);

    writeCSV('jurisdictions.csv', Array.from(jurisdictionNames).map(name => ({
        id: slugJurisdiction(name),
        name,
        region: name,
        code: name,
    })));

    writeCSV('authorities.csv', authorityRows.map(r => ({
        id: r['AuthorityID'],
        name: r['Name'],
        abbreviation: r['Abbreviation'],
        authorityType: r['Type'],
        jurisdictionId: slugJurisdiction(r['Jurisdiction']),
        description: r['Description'],
    })));

    writeCSV('regulations.csv', regulationRows.map(r => ({
        id: r['RegulationID'],
        name: r['Name'],
        authorityId: r['AuthorityID'],
        jurisdictionId: slugJurisdiction(r['Jurisdiction']),
        effectiveDate: r['Effective Date'],
        effectiveFrom: r['Effective Date'],
        catalogVersion: '1.0',
        description: r['Description'],
    })));

    writeCSV('standards.csv', standardRows.map(r => ({
        id: r['StandardID'],
        name: r['Name'],
        body: r['Issuing Body'],
        version: r['Version'],
        description: r['Description'],
    })));

    writeCSV('clauses.csv', clauseRows.map(r => ({
        id: r['ClauseID'],
        name: r['Title'],
        clauseRef: r['Clause Number'],
        text: r['Clause Text (Synthetic)'],
        regulationId: r['Source Type'] === 'REG' ? r['Source ID'] : '',
        standardId: r['Source Type'] === 'STD' ? r['Source ID'] : '',
        catalogVersion: '1.0',
    })));

    writeCSV('requirements.csv', obligationRows.map(r => ({
        id: r['ObligationID'],
        name: r['Description'],
        obligationType: r['Obligation Type'],
        clauseId: r['ClauseID'],
        mandatory: r['Mandatory (Y/N)'],
        catalogVersion: '1.0',
    })));

    writeCSV('complianceAreas.csv', complianceAreaRows.map(r => ({
        id: r['ComplianceAreaID'],
        name: r['Name'],
        description: r['Description'],
    })));

    writeCSV('controls.csv', controlRows.map(r => ({
        id: r['ControlID'],
        name: r['Name'],
        controlType: r['Control Type'],
        description: r['Description'],
        complianceAreaId: r['ComplianceAreaID'],
        riskId: r['RiskID'],
        requirementId: r['Primary ObligationID(s)'],
        clauseId: r['ClauseID'],
        standardId: r['StandardID'],
        regulationId: r['RegulationID'],
        authorityId: r['AuthorityID'],
    })));

    // 09_Task_Master is a 39-column denormalized rollup — deliberately kept thin here rather
    // than ingested as-is (see entity-alignment.md). Only the fields the graph needs: what the
    // task is, which Control it implements, and its display frequency.
    writeCSV('tasks.csv', taskMasterRows.map(r => ({
        id: r['TaskID'],
        name: r['Task Name'],
        controlId: r['Control ID'],
        frequency: r['Frequency'],
        priority: r['Priority'],
    })));

    const fixedScheduleRows = scheduleRuleRows.filter(r => r['Schedule Type'] === 'Fixed');
    writeCSV('schedules.csv', fixedScheduleRows.map(r => {
        const cadence = FREQUENCY_CADENCE[r['Frequency']];
        if (!cadence) throw new Error(`no cadence mapping for frequency: ${r['Frequency']}`);
        return {
            id: `SCH-${r['TaskID']}`,
            name: `Schedule - ${r['TaskID']}`,
            taskId: r['TaskID'],
            cadenceUnit: cadence.cadenceUnit,
            cadenceInterval: String(cadence.cadenceInterval),
            anchorDate: parseWeekAnchor(r['Anchor Week/Date']),
        };
    }));
};

convert();
