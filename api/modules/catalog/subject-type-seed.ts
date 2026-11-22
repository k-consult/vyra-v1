import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import * as R from 'ramda';

// catalog-sync.ts's CSV replay is the only mechanism that seeds a newly-provisioned
// tenant's SubjectType vocabulary (provisionTenant -> runCatalogSync, tenants/repo.ts)
// — a live Neo4j write alone (repo.ts's addSubjectType/updateSubjectType/
// retireSubjectType) is invisible to any tenant provisioned afterwards, same bug
// class the tenant-replication fix (repo.ts's replicateToTenants) closed for
// *already-registered* tenants. This keeps the CSV seed itself in sync so a future
// provisioning run picks up every admin change too.
const SEED_PATH = path.resolve(__dirname, '../../../cli/feeds/csv/catalog/cpcb/subjectTypes.csv');
const COLUMNS = ['id', 'name', 'bindsAt', 'description', 'status'];

const escapeCsvField = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export interface SubjectTypeSeedPatch {
    id: string;
    name?: string;
    bindsAt?: string;
    description?: string;
    status?: string;
}

// Rewrites the whole file on every call — the dataset is a handful of rows, so a
// full read-merge-write is simpler than an in-place line edit and never leaves a
// half-written file on a crash mid-write (fs.writeFileSync is one syscall for a file
// this size). A 'status' column missing on the 11 original rows (no status until
// this registry existed) is backfilled to 'active' on first touch, matching the
// Cypher side's own coalesce(status, 'active').
export const upsertSubjectTypeSeedRow = (patch: SubjectTypeSeedPatch): void => {
    const content = fs.readFileSync(SEED_PATH, 'utf-8').replace(/^﻿/, '');
    const existing: Record<string, string>[] = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    // Explicit Record<string, string>[] annotation — spreading a generic Record-typed
    // row loses its index signature otherwise, and TS infers the narrowest literal
    // shape it saw assigned (just `{ status: string }`), rejecting `row.id` below.
    const backfilled: Record<string, string>[] = existing.map((row) => ({ ...row, status: row.status || 'active' }));

    const patchFields: Record<string, string> = R.fromPairs(
        R.filter(([, v]) => v !== undefined, R.toPairs(patch as unknown as Record<string, string>)),
    );
    const found = backfilled.some((row) => row.id === patch.id);
    const merged: Record<string, string>[] = found
        ? backfilled.map((row) => (row.id === patch.id ? { ...row, ...patchFields } : row))
        : [...backfilled, { bindsAt: '', description: '', status: 'active', ...patchFields }];

    const lines = [
        COLUMNS.join(','),
        ...merged.map((row) => COLUMNS.map((c) => escapeCsvField(row[c])).join(',')),
    ];
    fs.writeFileSync(SEED_PATH, `${lines.join('\n')}\n`);
};
