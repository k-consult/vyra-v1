import { ProposeCutoverCriterionInput } from './repo';

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const SYSTEMS_OF_RECORD = new Set(['legacy', 'vyra']);

// Structural validity for POST /onboarding/cutover-criteria — this never writes a
// CutoverCriterion directly (see repo.ts's proposeCutoverCriterion), so validation
// only needs to confirm the proposal is well-formed, not that the criterion itself
// is achievable (that's a human reviewer's judgment at approval).
export const isValid = (input: Partial<ProposeCutoverCriterionInput>): void => {
    if (!isNonEmptyString(input.proposedBy)) {
        throw new Error(`proposedBy must be a non-empty string; got ${JSON.stringify(input.proposedBy)}`);
    }
    if (!isNonEmptyString(input.workflowName)) {
        throw new Error(`workflowName must be a non-empty string; got ${JSON.stringify(input.workflowName)}`);
    }
    if (!isNonEmptyString(input.criterionDescription)) {
        throw new Error(`criterionDescription must be a non-empty string; got ${JSON.stringify(input.criterionDescription)}`);
    }
    if (!SYSTEMS_OF_RECORD.has(input.systemOfRecord as string)) {
        throw new Error(`systemOfRecord must be one of [legacy, vyra]; got ${JSON.stringify(input.systemOfRecord)}`);
    }
    const target = input.agreementRateTarget;
    if (typeof target !== 'number' || target < 0 || target > 1) {
        throw new Error(`agreementRateTarget must be a number between 0 and 1; got ${JSON.stringify(target)}`);
    }
    if (!isNonEmptyString(input.dueBy) || Number.isNaN(Date.parse(input.dueBy))) {
        throw new Error(`dueBy must be a parseable date string; got ${JSON.stringify(input.dueBy)}`);
    }
};
