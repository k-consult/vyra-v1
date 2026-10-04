import {
    vendorExists, contractExists, assetExists, warrantyExists, ProposeContractChangeInput, ProposeWarrantyInput,
    facilityExists, authorityExists, permitExists, ProposePermitInput,
} from './repo';

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const INSTRUMENT_TYPES = new Set(['consent', 'authorization', 'noc', 'registration', 'permit', 'license']);

// Structural validity for POST /enterprise/contracts — this never writes a Contract
// directly (see repo.ts's proposeContractChange), so validation only needs to
// confirm the proposal references real entities, not that the terms themselves
// are well-formed business data (that's a human reviewer's judgment at approval).
export const isValid = async (input: Partial<ProposeContractChangeInput>): Promise<void> => {
    if (!isNonEmptyString(input.proposedBy)) {
        throw new Error(`proposedBy must be a non-empty string; got ${JSON.stringify(input.proposedBy)}`);
    }
    if (!isNonEmptyString(input.proposedServiceType)) {
        throw new Error(`proposedServiceType must be a non-empty string; got ${JSON.stringify(input.proposedServiceType)}`);
    }
    if (!isNonEmptyString(input.proposedVendorId)) {
        throw new Error(`proposedVendorId must be a non-empty string; got ${JSON.stringify(input.proposedVendorId)}`);
    }
    if (!(await vendorExists(input.proposedVendorId))) {
        throw new Error(`proposedVendorId must reference an existing Vendor; got "${input.proposedVendorId}"`);
    }
    if (input.priorContractId !== undefined && !(await contractExists(input.priorContractId))) {
        throw new Error(`priorContractId must reference an existing Contract; got "${input.priorContractId}"`);
    }
};

// Structural validity for POST /enterprise/warranties — this never writes a
// Warranty directly (see repo.ts's proposeWarrantyChange), so validation only
// confirms the proposal references real entities, same discipline as isValid
// above for Contract.
export const isValidWarrantyProposal = async (input: Partial<ProposeWarrantyInput>): Promise<void> => {
    if (!isNonEmptyString(input.proposedBy)) {
        throw new Error(`proposedBy must be a non-empty string; got ${JSON.stringify(input.proposedBy)}`);
    }
    if (!isNonEmptyString(input.proposedCoverageTerms)) {
        throw new Error(`proposedCoverageTerms must be a non-empty string; got ${JSON.stringify(input.proposedCoverageTerms)}`);
    }
    if (!isNonEmptyString(input.proposedAssetId)) {
        throw new Error(`proposedAssetId must be a non-empty string; got ${JSON.stringify(input.proposedAssetId)}`);
    }
    if (!(await assetExists(input.proposedAssetId))) {
        throw new Error(`proposedAssetId must reference an existing Asset; got "${input.proposedAssetId}"`);
    }
    if (!isNonEmptyString(input.proposedVendorId)) {
        throw new Error(`proposedVendorId must be a non-empty string; got ${JSON.stringify(input.proposedVendorId)}`);
    }
    if (!(await vendorExists(input.proposedVendorId))) {
        throw new Error(`proposedVendorId must reference an existing Vendor; got "${input.proposedVendorId}"`);
    }
    if (input.priorWarrantyId !== undefined && !(await warrantyExists(input.priorWarrantyId))) {
        throw new Error(`priorWarrantyId must reference an existing Warranty; got "${input.priorWarrantyId}"`);
    }
};

// Structural validity for POST /enterprise/permits — this never writes a Permit
// directly (see repo.ts's proposePermitChange), so validation confirms the
// proposal references real entities and names a valid instrumentType, same
// discipline as isValid/isValidWarrantyProposal above. proposedAssetIds is
// required non-empty — graph.md's Permit entry: "the edge that lets a Permit
// renewal or amendment identify which Assets it covers... required, not optional."
export const isValidPermitProposal = async (input: Partial<ProposePermitInput>): Promise<void> => {
    if (!isNonEmptyString(input.proposedBy)) {
        throw new Error(`proposedBy must be a non-empty string; got ${JSON.stringify(input.proposedBy)}`);
    }
    if (!INSTRUMENT_TYPES.has(input.proposedInstrumentType as string)) {
        throw new Error(`proposedInstrumentType must be one of [${[...INSTRUMENT_TYPES].join(', ')}]; got ${JSON.stringify(input.proposedInstrumentType)}`);
    }
    if (!isNonEmptyString(input.proposedAuthorityId)) {
        throw new Error(`proposedAuthorityId must be a non-empty string; got ${JSON.stringify(input.proposedAuthorityId)}`);
    }
    if (!(await authorityExists(input.proposedAuthorityId))) {
        throw new Error(`proposedAuthorityId must reference an existing Authority; got "${input.proposedAuthorityId}"`);
    }
    if (!isNonEmptyString(input.proposedFacilityId)) {
        throw new Error(`proposedFacilityId must be a non-empty string; got ${JSON.stringify(input.proposedFacilityId)}`);
    }
    if (!(await facilityExists(input.proposedFacilityId))) {
        throw new Error(`proposedFacilityId must reference an existing Facility; got "${input.proposedFacilityId}"`);
    }
    if (!Array.isArray(input.proposedAssetIds) || input.proposedAssetIds.length === 0) {
        throw new Error(`proposedAssetIds must be a non-empty array; got ${JSON.stringify(input.proposedAssetIds)}`);
    }
    for (const assetId of input.proposedAssetIds) {
        if (!(await assetExists(assetId))) {
            throw new Error(`proposedAssetIds must reference existing Assets; got "${assetId}"`);
        }
    }
    if (input.priorPermitId !== undefined && !(await permitExists(input.priorPermitId))) {
        throw new Error(`priorPermitId must reference an existing Permit; got "${input.priorPermitId}"`);
    }
};
