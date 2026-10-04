import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

const LIST_ORGANIZATIONS = `
    MATCH (n:Organization)
    RETURN properties(n) AS organization
    ORDER BY n.name
`;

const LIST_ROLES = `
    MATCH (n:Role)
    RETURN properties(n) AS role
    ORDER BY n.name
`;

const LIST_VENDORS = `
    MATCH (n:Vendor)
    RETURN properties(n) AS vendor
    ORDER BY n.name
`;

// WITH before RETURN, not RETURN ... ORDER BY c.name directly — ORDER BY can't
// reference a pre-aggregation variable once collect() is in the RETURN (same
// bug hit in listAssuranceStatements/listAudits/listPeople).
const LIST_CONTRACTS = `
    MATCH (c:Contract)
    OPTIONAL MATCH (c)-[:COVERS]->(fac:Facility)
    WITH c, collect(DISTINCT fac.id) AS facilityIds
    RETURN properties(c) AS contract, facilityIds
    ORDER BY c.name
`;

const TRACE_ORG_CHART = `
    MATCH (org:Organization {id: $id})<-[:BELONGS_TO]-(role:Role)
    OPTIONAL MATCH (role)<-[:HAS_ROLE]-(person:Person)
    RETURN properties(org) AS organization, properties(role) AS role, collect(properties(person)) AS people
    ORDER BY role.name
`;

export const listOrganizations = async () => {
    const raw: any = await db().fetch(LIST_ORGANIZATIONS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.organization).filter(Boolean);
};

export const listRoles = async () => {
    const raw: any = await db().fetch(LIST_ROLES, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.role).filter(Boolean);
};

export const listVendors = async () => {
    const raw: any = await db().fetch(LIST_VENDORS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.vendor).filter(Boolean);
};

export const listContracts = async () => {
    const raw: any = await db().fetch(LIST_CONTRACTS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.contract).map((r: any) => ({
        ...r.contract,
        facilityIds: (r.facilityIds ?? []).filter(Boolean),
    }));
};

export const traceOrgChart = async (organizationId: string) => db().fetch(TRACE_ORG_CHART, { id: organizationId });

const VENDOR_EXISTS = `MATCH (v:Vendor {id: $id}) RETURN count(v) > 0 AS vendorExists`;
export const vendorExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(VENDOR_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.vendorExists);
};

const CONTRACT_EXISTS = `MATCH (c:Contract {id: $id}) RETURN count(c) > 0 AS contractExists`;
export const contractExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(CONTRACT_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.contractExists);
};

const ASSET_EXISTS = `MATCH (a:Asset {id: $id}) RETURN count(a) > 0 AS assetExists`;
export const assetExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(ASSET_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.assetExists);
};

const WARRANTY_EXISTS = `MATCH (w:Warranty {id: $id}) RETURN count(w) > 0 AS warrantyExists`;
export const warrantyExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(WARRANTY_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.warrantyExists);
};

const FACILITY_EXISTS = `MATCH (f:Facility {id: $id}) RETURN count(f) > 0 AS facilityExists`;
export const facilityExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(FACILITY_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.facilityExists);
};

const AUTHORITY_EXISTS = `MATCH (a:Authority {id: $id}) RETURN count(a) > 0 AS authorityExists`;
export const authorityExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(AUTHORITY_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.authorityExists);
};

const PERMIT_EXISTS = `MATCH (p:Permit {id: $id}) RETURN count(p) > 0 AS permitExists`;
export const permitExists = async (id: string): Promise<boolean> => {
    const raw: any = await db().fetch(PERMIT_EXISTS, { id });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(row?.permitExists);
};

export interface ProposeContractChangeInput {
    proposedBy: string;
    proposedServiceType: string;
    proposedSlaResponseTime?: string;
    proposedAmcStartDate?: string;
    proposedAmcExpiryDate?: string;
    proposedVendorId: string;
    proposedCoordinatorRoleId?: string;
    priorContractId?: string;
}

// Writes only a pending Decision — never a Contract. Contracts are an immutable
// source of truth (same append-and-supersede discipline as Regulation); the actual
// Contract node is created only on approval, via intelligence/repo.ts's
// contract-proposal branch — see api/modules/intelligence/repo.ts.
const PROPOSE_CONTRACT_CHANGE = `
    MERGE (d:Decision {id: $id})
    ON CREATE SET
        d += $props,
        d.decidedAt = datetime(),
        d.status = 'pending',
        d.origin = 'human'
    WITH d
    MATCH (src {id: $sourceId})
    MERGE (d)-[:ABOUT]->(src)
    RETURN properties(d) AS decision
`;

export const proposeContractChange = async (input: ProposeContractChangeInput) => {
    const id = `DEC-CONTRACT-${Date.now()}`;
    const sourceId = input.priorContractId ?? input.proposedVendorId;
    const raw: any = await db().exec(PROPOSE_CONTRACT_CHANGE, {
        id,
        sourceId,
        props: {
            type: 'contract-proposal',
            rationale: `Human-proposed ${input.priorContractId ? 'contract amendment' : 'new contract'}`,
            agentId: input.proposedBy,
            autonomyLevel: 0,
            confidence: 1,
            proposedBy: input.proposedBy,
            proposedServiceType: input.proposedServiceType,
            proposedSlaResponseTime: input.proposedSlaResponseTime ?? '',
            proposedAmcStartDate: input.proposedAmcStartDate ?? '',
            proposedAmcExpiryDate: input.proposedAmcExpiryDate ?? '',
            proposedVendorId: input.proposedVendorId,
            proposedCoordinatorRoleId: input.proposedCoordinatorRoleId ?? '',
            priorContractId: input.priorContractId ?? '',
        },
    });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return { decision: row?.decision };
};

const LIST_WARRANTIES = `
    MATCH (w:Warranty)
    RETURN properties(w) AS warranty
    ORDER BY w.name
`;

export const listWarranties = async () => {
    const raw: any = await db().fetch(LIST_WARRANTIES, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.warranty).filter(Boolean);
};

export interface ProposeWarrantyInput {
    proposedBy: string;
    proposedCoverageTerms: string;
    proposedStartDate?: string;
    proposedExpiryDate?: string;
    proposedAssetId: string;
    proposedVendorId: string;
    priorWarrantyId?: string;
}

// Writes only a pending Decision — never a Warranty directly. Warranty is a sibling
// of Contract (domain-extension.md §7.4(d)): same append-and-supersede discipline,
// same propose/approve shape — the real Warranty node is created only on approval,
// via intelligence/repo.ts's warranty-proposal branch. sourceId prefers
// priorWarrantyId (a renewal) over proposedAssetId (a new warranty), mirroring
// proposeContractChange's priorContractId/proposedVendorId fallback exactly.
const PROPOSE_WARRANTY = `
    MERGE (d:Decision {id: $id})
    ON CREATE SET
        d += $props,
        d.decidedAt = datetime(),
        d.status = 'pending',
        d.origin = 'human'
    WITH d
    MATCH (src {id: $sourceId})
    MERGE (d)-[:ABOUT]->(src)
    RETURN properties(d) AS decision
`;

export const proposeWarrantyChange = async (input: ProposeWarrantyInput) => {
    const id = `DEC-WARRANTY-${Date.now()}`;
    const sourceId = input.priorWarrantyId ?? input.proposedAssetId;
    const raw: any = await db().exec(PROPOSE_WARRANTY, {
        id,
        sourceId,
        props: {
            type: 'warranty-proposal',
            rationale: `Human-proposed ${input.priorWarrantyId ? 'warranty renewal' : 'new warranty'}`,
            agentId: input.proposedBy,
            autonomyLevel: 0,
            confidence: 1,
            proposedBy: input.proposedBy,
            proposedCoverageTerms: input.proposedCoverageTerms,
            proposedStartDate: input.proposedStartDate ?? '',
            proposedExpiryDate: input.proposedExpiryDate ?? '',
            proposedAssetId: input.proposedAssetId,
            proposedVendorId: input.proposedVendorId,
            priorWarrantyId: input.priorWarrantyId ?? '',
        },
    });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return { decision: row?.decision };
};

// WITH before RETURN, not RETURN ... ORDER BY p.name directly — ORDER BY can't
// reference a pre-aggregation variable once collect() is in the RETURN (same
// bug avoided in listContracts/listBlueprints).
const LIST_PERMITS = `
    MATCH (p:Permit)
    OPTIONAL MATCH (a:Asset)-[:COVERED_BY_CONSENT]->(p)
    WITH p, collect(DISTINCT a.id) AS assetIds
    RETURN properties(p) AS permit, assetIds
    ORDER BY p.name
`;

export const listPermits = async () => {
    const raw: any = await db().fetch(LIST_PERMITS, {});
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.filter((r: any) => r?.permit).map((r: any) => ({
        ...r.permit,
        assetIds: (r.assetIds ?? []).filter(Boolean),
    }));
};

export interface ProposePermitInput {
    proposedBy: string;
    proposedInstrumentType: string;
    proposedAuthorityId: string;
    proposedFacilityId: string;
    proposedAssetIds: string[];
    proposedIssuedDate?: string;
    proposedExpiryDate?: string;
    proposedRenewalWindowDays?: number;
    priorPermitId?: string;
}

// Writes only a pending Decision — never a Permit directly. Permit is a sibling of
// Contract/Warranty (domain-extension.md §7.4(c)): same append-and-supersede
// discipline, same propose/approve shape — the real Permit node is created only on
// approval, via intelligence/repo.ts's permit-proposal branch. Single Decision type
// regardless of instrumentType (consent/authorization/noc/registration/permit/
// license) — graph.md's 2026-10-03 decision collapsed all six WINAIM concepts into
// one node with an instrumentType discriminator, so there is one proposal shape to
// match, not six. sourceId prefers priorPermitId (a renewal) over proposedFacilityId
// (a new instrument), mirroring proposeContractChange/proposeWarrantyChange's
// prior-id fallback exactly.
const PROPOSE_PERMIT = `
    MERGE (d:Decision {id: $id})
    ON CREATE SET
        d += $props,
        d.decidedAt = datetime(),
        d.status = 'pending',
        d.origin = 'human'
    WITH d
    MATCH (src {id: $sourceId})
    MERGE (d)-[:ABOUT]->(src)
    RETURN properties(d) AS decision
`;

export const proposePermitChange = async (input: ProposePermitInput) => {
    const id = `DEC-PERMIT-${Date.now()}`;
    const sourceId = input.priorPermitId ?? input.proposedFacilityId;
    const raw: any = await db().exec(PROPOSE_PERMIT, {
        id,
        sourceId,
        props: {
            type: 'permit-proposal',
            rationale: `Human-proposed ${input.priorPermitId ? 'permit/license renewal' : 'new permit/license'}`,
            agentId: input.proposedBy,
            autonomyLevel: 0,
            confidence: 1,
            proposedBy: input.proposedBy,
            proposedInstrumentType: input.proposedInstrumentType,
            proposedAuthorityId: input.proposedAuthorityId,
            proposedFacilityId: input.proposedFacilityId,
            proposedAssetIds: input.proposedAssetIds,
            proposedIssuedDate: input.proposedIssuedDate ?? '',
            proposedExpiryDate: input.proposedExpiryDate ?? '',
            proposedRenewalWindowDays: input.proposedRenewalWindowDays ?? null,
            priorPermitId: input.priorPermitId ?? '',
        },
    });
    const row = Array.isArray(raw) ? raw[0] : raw;
    return { decision: row?.decision };
};
