import { vendorExists, contractExists, ProposeContractChangeInput } from './repo';

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

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
