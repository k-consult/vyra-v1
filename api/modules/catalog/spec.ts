import {
    clauseExists,
    ProposeObligationInput,
    reportExists,
    authorityExists,
    ProposeReportSubmissionInput,
    subjectTypeExists,
    AddSubjectTypeInput,
    UpdateSubjectTypeInput,
    getSubjectTypeUsage,
} from './repo';

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

// 'General' (added 2026-11-22) is deliberately not one of Organisation/Facility/
// Asset — it names no tenant node type, so a General-bound SubjectType is never a
// valid OF_TYPE target; it's descriptive catalog vocabulary only (e.g. Deep Burial
// Pit, Hazardous Waste Yard — real regulated concepts that aren't literally a
// tenant's physical Asset/Facility/Organisation). `onboarding/repo.ts`'s and
// `agents/tools/graph-read.ts`'s classification-candidate queries already filter to
// `bindsAt = 'Asset'` specifically, so General rows were already excluded from every
// classification flow before this change — adding the value here doesn't touch them.
const SUBJECT_TYPE_BINDS_AT = ['Organisation', 'Facility', 'Asset', 'General'];

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

// Structural validity for POST /catalog/subject-types — a direct admin write (no
// Decision gate; subtype-registry-plan.md's scoped-down 2026-11-22 decision), so this
// is the only gate: id must be unused (collision is a real error, not a retry
// duplicate — the admin chooses a meaningful id like ST-FIRE_SYSTEM), bindsAt must be
// one of the tenant node types a SubjectType can resolve to.
export const isValidNewSubjectType = async (input: Partial<AddSubjectTypeInput>): Promise<void> => {
    if (!isNonEmptyString(input.id)) {
        throw new Error(`id must be a non-empty string; got ${JSON.stringify(input.id)}`);
    }
    if (await subjectTypeExists(input.id)) {
        throw new Error(`id already in use by an existing SubjectType: "${input.id}"`);
    }
    if (!isNonEmptyString(input.name)) {
        throw new Error(`name must be a non-empty string; got ${JSON.stringify(input.name)}`);
    }
    if (!SUBJECT_TYPE_BINDS_AT.includes(input.bindsAt as string)) {
        throw new Error(`bindsAt must be one of [${SUBJECT_TYPE_BINDS_AT.join(', ')}]; got ${JSON.stringify(input.bindsAt)}`);
    }
};

// Structural validity for PATCH /catalog/subject-types/:id. id stays immutable
// always. bindsAt ("Category" in the UI) was immutable always too until 2026-11-22
// — reclassifying Deep Burial Pit/Hazardous Waste Yard off "Asset" needed a real
// edit path. Reversing that immutability safely means gating it exactly like retire
// does: usage must be zero (no Obligation.BINDS_TO_TYPE, no tenant Asset.OF_TYPE) —
// otherwise a category change would silently strand live references the same way an
// unguarded retire would (subtype-registry-plan.md decision 5's own rationale,
// applied here to edits instead of retire).
export const isValidSubjectTypeUpdate = async (id: string, input: Partial<UpdateSubjectTypeInput>): Promise<void> => {
    if (!isNonEmptyString(input.name)) {
        throw new Error(`name must be a non-empty string; got ${JSON.stringify(input.name)}`);
    }
    if (input.bindsAt !== undefined) {
        if (!SUBJECT_TYPE_BINDS_AT.includes(input.bindsAt)) {
            throw new Error(`bindsAt must be one of [${SUBJECT_TYPE_BINDS_AT.join(', ')}]; got ${JSON.stringify(input.bindsAt)}`);
        }
        const usage = await getSubjectTypeUsage(id);
        if (usage.obligationCount > 0 || usage.assetCount > 0) {
            throw new Error(`category cannot be changed while in use: ${usage.obligationCount} obligation(s) bind to it, ${usage.assetCount} asset(s) are classified under it`);
        }
    }
};
