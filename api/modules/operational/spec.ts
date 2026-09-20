import { assetExists, CreateSignalInput } from './repo';

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

// Structural validity for POST /operational/signals — required fields, then referential
// existence of assetId (graph.md: a Signal must EMITTED_BY a real Asset). Defaults for
// optional fields (name/source/timestamp/payload) stay in repo.ts's own construction —
// that's the write's concern, not the gate deciding whether the write may proceed.
export const isValid = async (input: Partial<CreateSignalInput>): Promise<void> => {
    if (!isNonEmptyString(input.id)) {
        throw new Error(`id must be a non-empty string; got ${JSON.stringify(input.id)}`);
    }
    if (!isNonEmptyString(input.type)) {
        throw new Error(`type must be a non-empty string; got ${JSON.stringify(input.type)}`);
    }
    if (!isNonEmptyString(input.assetId)) {
        throw new Error(`assetId must be a non-empty string; got ${JSON.stringify(input.assetId)}`);
    }
    if (!(await assetExists(input.assetId))) {
        throw new Error(`assetId must reference an existing Asset; got "${input.assetId}"`);
    }
};
