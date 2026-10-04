import {
    ProposeCutoverCriterionInput, ProposeBlueprintInput, facilityExists, roleExists, assetExists,
    ProposeHazardInput, ProposeHazardAssessmentInput, ProposeEmergencyPlanInput, hazardExists,
} from './repo';

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const SYSTEMS_OF_RECORD = new Set(['legacy', 'vyra']);
const HAZARD_TYPES = new Set(['fire', 'chemical', 'electrical', 'structural']);
const RATINGS = new Set(['Low', 'Medium', 'High', 'Critical']);
// Same qualitative cadence vocabulary cli/scripts/convert-catalog-seed.ts already
// uses for Schedule.cadenceUnit/cadenceInterval — reused here rather than inventing
// a second frequency vocabulary for EmergencyPlan.drillFrequency.
const DRILL_FREQUENCIES = new Set(['Weekly', 'Fortnightly', 'Monthly', 'Quarterly', 'Half-Yearly', 'Annual']);

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

// Structural validity for POST /onboarding/blueprints — unlike CutoverCriterion,
// a Blueprint references real, already-live nodes (Facility/Role/Asset), so
// validation checks referential existence too, same discipline as enterprise/
// spec.ts's vendorExists/contractExists. This never writes a Blueprint directly
// (see repo.ts's proposeBlueprint) — it only confirms the proposal points at real
// entities, not that the scope itself is sound (a human reviewer's judgment at
// approval).
export const isValidBlueprintProposal = async (input: Partial<ProposeBlueprintInput>): Promise<void> => {
    if (!isNonEmptyString(input.proposedBy)) {
        throw new Error(`proposedBy must be a non-empty string; got ${JSON.stringify(input.proposedBy)}`);
    }
    if (!isNonEmptyString(input.scopeDescription)) {
        throw new Error(`scopeDescription must be a non-empty string; got ${JSON.stringify(input.scopeDescription)}`);
    }
    if (!isNonEmptyString(input.facilityId)) {
        throw new Error(`facilityId must be a non-empty string; got ${JSON.stringify(input.facilityId)}`);
    }
    if (!(await facilityExists(input.facilityId))) {
        throw new Error(`facilityId must reference an existing Facility; got "${input.facilityId}"`);
    }
    if (!Array.isArray(input.roleIds) || input.roleIds.length === 0) {
        throw new Error(`roleIds must be a non-empty array; got ${JSON.stringify(input.roleIds)}`);
    }
    if (!Array.isArray(input.assetIds) || input.assetIds.length === 0) {
        throw new Error(`assetIds must be a non-empty array; got ${JSON.stringify(input.assetIds)}`);
    }
    for (const roleId of input.roleIds) {
        if (!(await roleExists(roleId))) {
            throw new Error(`roleIds must reference existing Roles; got "${roleId}"`);
        }
    }
    for (const assetId of input.assetIds) {
        if (!(await assetExists(assetId))) {
            throw new Error(`assetIds must reference existing Assets; got "${assetId}"`);
        }
    }
};

// Structural validity for POST /onboarding/hazards — never writes a Hazard
// directly (see repo.ts's proposeHazard), so this only confirms the proposal
// points at a real Facility (and, if given, a real Asset) and names a hazardType
// from the fixed vocabulary — not that the hazard itself is a sound call (a
// human reviewer's judgment at approval).
export const isValidHazardProposal = async (input: Partial<ProposeHazardInput>): Promise<void> => {
    if (!isNonEmptyString(input.proposedBy)) {
        throw new Error(`proposedBy must be a non-empty string; got ${JSON.stringify(input.proposedBy)}`);
    }
    if (!isNonEmptyString(input.name)) {
        throw new Error(`name must be a non-empty string; got ${JSON.stringify(input.name)}`);
    }
    if (!HAZARD_TYPES.has(input.hazardType as string)) {
        throw new Error(`hazardType must be one of [${[...HAZARD_TYPES].join(', ')}]; got ${JSON.stringify(input.hazardType)}`);
    }
    if (!isNonEmptyString(input.facilityId)) {
        throw new Error(`facilityId must be a non-empty string; got ${JSON.stringify(input.facilityId)}`);
    }
    if (!(await facilityExists(input.facilityId))) {
        throw new Error(`facilityId must reference an existing Facility; got "${input.facilityId}"`);
    }
    if (input.assetId && !(await assetExists(input.assetId))) {
        throw new Error(`assetId must reference an existing Asset; got "${input.assetId}"`);
    }
};

// Structural validity for POST /onboarding/hazard-assessments — never writes a
// HazardAssessment directly (see repo.ts's proposeHazardAssessment). likelihood/
// severity are checked as 1-5 ints here (the same shape Decision.proposedLikelihood/
// proposedConsequence already use for risk-assessment); score itself is computed
// in Cypher at approval time, not here.
export const isValidHazardAssessmentProposal = async (input: Partial<ProposeHazardAssessmentInput>): Promise<void> => {
    if (!isNonEmptyString(input.proposedBy)) {
        throw new Error(`proposedBy must be a non-empty string; got ${JSON.stringify(input.proposedBy)}`);
    }
    if (!isNonEmptyString(input.hazardId)) {
        throw new Error(`hazardId must be a non-empty string; got ${JSON.stringify(input.hazardId)}`);
    }
    if (!(await hazardExists(input.hazardId))) {
        throw new Error(`hazardId must reference an existing Hazard; got "${input.hazardId}"`);
    }
    const { likelihood, severity } = input;
    if (typeof likelihood !== 'number' || likelihood < 1 || likelihood > 5) {
        throw new Error(`likelihood must be a number between 1 and 5; got ${JSON.stringify(likelihood)}`);
    }
    if (typeof severity !== 'number' || severity < 1 || severity > 5) {
        throw new Error(`severity must be a number between 1 and 5; got ${JSON.stringify(severity)}`);
    }
    if (!RATINGS.has(input.rating as string)) {
        throw new Error(`rating must be one of [${[...RATINGS].join(', ')}]; got ${JSON.stringify(input.rating)}`);
    }
};

// Structural validity for POST /onboarding/emergency-plans — never writes an
// EmergencyPlan directly (see repo.ts's proposeEmergencyPlan), mirrors
// isValidBlueprintProposal's referential-existence discipline for facilityId.
export const isValidEmergencyPlanProposal = async (input: Partial<ProposeEmergencyPlanInput>): Promise<void> => {
    if (!isNonEmptyString(input.proposedBy)) {
        throw new Error(`proposedBy must be a non-empty string; got ${JSON.stringify(input.proposedBy)}`);
    }
    if (!isNonEmptyString(input.facilityId)) {
        throw new Error(`facilityId must be a non-empty string; got ${JSON.stringify(input.facilityId)}`);
    }
    if (!(await facilityExists(input.facilityId))) {
        throw new Error(`facilityId must reference an existing Facility; got "${input.facilityId}"`);
    }
    if (!DRILL_FREQUENCIES.has(input.drillFrequency as string)) {
        throw new Error(`drillFrequency must be one of [${[...DRILL_FREQUENCIES].join(', ')}]; got ${JSON.stringify(input.drillFrequency)}`);
    }
};
