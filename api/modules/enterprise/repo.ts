import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';
import log from '../../../lib/log';

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
    try {
        const raw: any = await db().fetch2(LIST_ORGANIZATIONS, {});
        const rows = Array.isArray(raw) ? raw : [raw];
        return rows.map((r: any) => r.organization).filter(Boolean);
    } catch (err: any) {
        log.error('enterprise.repo: listOrganizations failed', err.message);
        return [];
    }
};

export const listRoles = async () => {
    try {
        const raw: any = await db().fetch2(LIST_ROLES, {});
        const rows = Array.isArray(raw) ? raw : [raw];
        return rows.map((r: any) => r.role).filter(Boolean);
    } catch (err: any) {
        log.error('enterprise.repo: listRoles failed', err.message);
        return [];
    }
};

export const listVendors = async () => {
    try {
        const raw: any = await db().fetch2(LIST_VENDORS, {});
        const rows = Array.isArray(raw) ? raw : [raw];
        return rows.map((r: any) => r.vendor).filter(Boolean);
    } catch (err: any) {
        log.error('enterprise.repo: listVendors failed', err.message);
        return [];
    }
};

export const listContracts = async () => {
    try {
        const raw: any = await db().fetch2(LIST_CONTRACTS, {});
        const rows = Array.isArray(raw) ? raw : [raw];
        return rows.filter((r: any) => r?.contract).map((r: any) => ({
            ...r.contract,
            facilityIds: (r.facilityIds ?? []).filter(Boolean),
        }));
    } catch (err: any) {
        log.error('enterprise.repo: listContracts failed', err.message);
        return [];
    }
};

export const traceOrgChart = async (organizationId: string) => {
    try {
        return await db().fetch2(TRACE_ORG_CHART, { id: organizationId });
    } catch (err: any) {
        log.error('enterprise.repo: traceOrgChart failed', err.message);
        return [];
    }
};
