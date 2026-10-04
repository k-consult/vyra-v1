import { clauseExists, ProposeObligationInput, reportExists, authorityExists, ProposeReportSubmissionInput } from './repo';

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

// Structural validity for POST /catalog/report-submissions — never writes a
// ReportSubmission directly (see repo.ts's proposeReportSubmission), so this only
// confirms the proposal references a real Report and Authority, not that the
// filing itself was handled correctly (a human reviewer's judgment at approval).
export const isValidReportSubmissionProposal = async (input: Partial<ProposeReportSubmissionInput>): Promise<void> => {
    if (!isNonEmptyString(input.proposedBy)) {
        throw new Error(`proposedBy must be a non-empty string; got ${JSON.stringify(input.proposedBy)}`);
    }
    if (!isNonEmptyString(input.reportId)) {
        throw new Error(`reportId must be a non-empty string; got ${JSON.stringify(input.reportId)}`);
    }
    if (!(await reportExists(input.reportId))) {
        throw new Error(`reportId must reference an existing Report; got "${input.reportId}"`);
    }
    if (!isNonEmptyString(input.authorityId)) {
        throw new Error(`authorityId must be a non-empty string; got ${JSON.stringify(input.authorityId)}`);
    }
    if (!(await authorityExists(input.authorityId))) {
        throw new Error(`authorityId must reference an existing Authority; got "${input.authorityId}"`);
    }
    if (!isNonEmptyString(input.periodCovered)) {
        throw new Error(`periodCovered must be a non-empty string; got ${JSON.stringify(input.periodCovered)}`);
    }
};
