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
