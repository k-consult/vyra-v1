import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import log from '../../lib/log';

const sourcePath = path.resolve(__dirname, '..', '..', '.design', 'synthetic-data', 'data.csv');
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
};

convert();
