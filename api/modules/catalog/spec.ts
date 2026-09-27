import { clauseExists, ProposeObligationInput } from './repo';

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

// Structural validity for POST /catalog/obligations — this never writes an
// Obligation directly (see repo.ts's proposeObligation), so validation only needs
// to confirm the proposal references a real Clause, not that the obligation text
// itself is well-formed (that's a human reviewer's judgment at approval).
export const isValid = async (input: Partial<ProposeObligationInput>): Promise<void> => {
    if (!isNonEmptyString(input.proposedBy)) {
        throw new Error(`proposedBy must be a non-empty string; got ${JSON.stringify(input.proposedBy)}`);
    }
    if (!isNonEmptyString(input.proposedName)) {
        throw new Error(`proposedName must be a non-empty string; got ${JSON.stringify(input.proposedName)}`);
    }
    if (!isNonEmptyString(input.clauseId)) {
        throw new Error(`clauseId must be a non-empty string; got ${JSON.stringify(input.clauseId)}`);
    }
    if (!(await clauseExists(input.clauseId))) {
        throw new Error(`clauseId must reference an existing Clause; got "${input.clauseId}"`);
    }
};
