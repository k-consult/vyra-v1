import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export interface ParseResult {
    feedFile: string;
    rows: Record<string, any>[];
    errors: string[];
}

export const parseCSV = (feedPath: string, validateNodeColumns = true): ParseResult => {
    const feedFile = path.basename(feedPath);

    if (!fs.existsSync(feedPath)) {
        return { feedFile, rows: [], errors: [`not found: ${feedPath}`] };
    }

    try {
        const rows = parse(fs.readFileSync(feedPath, 'utf-8'), {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        }) as Record<string, any>[];

        const errors: string[] = [];
        if (validateNodeColumns && rows.length > 0) {
            const cols = Object.keys(rows[0]);
            if (!cols.includes('id'))   errors.push(`missing required column 'id'`);
            if (!cols.includes('name')) errors.push(`missing required column 'name'`);
        }

        return { feedFile, rows, errors };
    } catch (err: any) {
        return { feedFile, rows: [], errors: [err.message] };
    }
};
