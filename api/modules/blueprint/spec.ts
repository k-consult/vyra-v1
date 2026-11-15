import { AddLevelInput, AddPropertyInput, PropertyDataType } from './repo';
import { labelFromName } from '../../../lib/blueprint/ingest-key';
import { RESERVED_LABELS, UNDELETABLE_LABELS } from '../../../lib/blueprint/reserved';

// Upper case, '_'-delimited — a Property's ingestKey is still the literal CSV
// column header. Levels have no ingestKey of their own (just a `name`).
const INGEST_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

const DATA_TYPES: Set<PropertyDataType> = new Set(['STRING', 'NUMBER', 'DECIMAL']);

export const isValidLevelInput = (input: Partial<AddLevelInput>): void => {
    if (typeof input.name !== 'string' || !input.name.trim()) {
        throw new Error('name is required');
    }
};

export const isValidPropertyInput = (input: Partial<AddPropertyInput>): void => {
    if (typeof input.name !== 'string' || !input.name.trim()) {
        throw new Error('name is required');
    }
    if (typeof input.ingestKey !== 'string' || !INGEST_KEY_PATTERN.test(input.ingestKey)) {
        throw new Error(`ingestKey must be upper case, '_'-delimited (e.g. "SITE_CODE"); got ${JSON.stringify(input.ingestKey)}`);
    }
    if (input.dataType !== undefined && !DATA_TYPES.has(input.dataType)) {
        throw new Error(`dataType must be one of STRING, NUMBER, DECIMAL; got ${JSON.stringify(input.dataType)}`);
    }
    if (input.required !== undefined && typeof input.required !== 'boolean') {
        throw new Error('required must be a boolean');
    }
    if (input.defaultValue !== undefined && typeof input.defaultValue !== 'string') {
        throw new Error('defaultValue must be a string');
    }
};

export const isValidReorderRequest = (input: { orderedIds?: unknown }): void => {
    if (!Array.isArray(input.orderedIds) || !input.orderedIds.every(id => typeof id === 'string')) {
        throw new Error('orderedIds must be an array of Level id strings');
    }
};

// Partial update — Level has no ingestKey, so only name/alias/description are
// checked here. Whether a `name` change is *allowed* (it may move a reserved
// label like "Facility" off of it) is a separate question — isValidLevelNameChange below.
export const isValidLevelUpdateInput = (input: Partial<Pick<AddLevelInput, 'name' | 'alias' | 'description'>>): void => {
    if (input.name !== undefined && (typeof input.name !== 'string' || !input.name.trim())) {
        throw new Error('name must be a non-empty string');
    }
};

export const isValidPropertyUpdateInput = (input: Partial<AddPropertyInput>): void => {
    if (input.name !== undefined && (typeof input.name !== 'string' || !input.name.trim())) {
        throw new Error('name must be a non-empty string');
    }
    if (input.ingestKey !== undefined && !INGEST_KEY_PATTERN.test(input.ingestKey)) {
        throw new Error(`ingestKey must be upper case, '_'-delimited (e.g. "SITE_CODE"); got ${JSON.stringify(input.ingestKey)}`);
    }
    if (input.dataType !== undefined && !DATA_TYPES.has(input.dataType)) {
        throw new Error(`dataType must be one of STRING, NUMBER, DECIMAL; got ${JSON.stringify(input.dataType)}`);
    }
    if (input.required !== undefined && typeof input.required !== 'boolean') {
        throw new Error('required must be a boolean');
    }
    if (input.defaultValue !== undefined && typeof input.defaultValue !== 'string') {
        throw new Error('defaultValue must be a string');
    }
};

// A Level's resolved label (labelFromName) can never move off "Facility" or
// "Asset" once it's on one — every other module already depends on those
// exact labels. Cosmetic edits that don't change the resolved label (casing,
// whitespace, an added article) are still allowed, so this only blocks edits
// that would actually change what gets written to the graph. See
// lib/blueprint/reserved.ts, the single source of truth for this set.
export const isValidLevelNameChange = (currentName: string, newName: string): void => {
    const currentLabel = labelFromName(currentName);
    if (RESERVED_LABELS.has(currentLabel) && labelFromName(newName) !== currentLabel) {
        throw new Error(`"${currentLabel}" is a reserved label and cannot be renamed away from it — other modules depend on this exact label`);
    }
};

// Properties are fully editable — including ingestKey — on every Level, even
// Organisation/Facility/Asset. structure-sync.ts resolves "which property is
// this Facility/Asset's code/name" by a `role` stamp carried on the Property
// node itself (lib/blueprint/reserved.ts's PropertyRole), not by matching a
// literal ingestKey string, so renaming SITE_CODE/ASSET_CODE/etc. never
// breaks ingestion. No property-level rename guard is needed here.

// Organisation/Facility/Asset can never be removed, regardless of their
// current position in the chain — not just "whatever's currently first/last"
// (that was the old rule; replaced because reordering could move one of these
// three off the literal ends while leaving them removable). See
// lib/blueprint/reserved.ts's UNDELETABLE_LABELS, the single source of truth.
export const isValidLevelRemoval = (name: string): void => {
    const label = labelFromName(name);
    if (UNDELETABLE_LABELS.has(label)) {
        throw new Error(`"${label}" cannot be removed — Organisation, Facility, and Asset are permanent anchors of the hierarchy`);
    }
};
