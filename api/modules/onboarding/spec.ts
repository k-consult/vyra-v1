import { ProposeCutoverCriterionInput, ProposeBlueprintInput, facilityExists, roleExists, assetExists } from './repo';

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
