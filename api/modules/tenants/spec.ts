import { ProvisionTenantInput, tenantExists } from './repo';

// Neo4j database names: ASCII letter first, then letters/digits/dots/dashes, case-
// insensitive (lowercased internally), max 63 chars. Capped well under that here
// since the actual database name is `grc-tenant-${name}`, not `name` alone.
const TENANT_NAME_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;
const RESERVED_NAMES = new Set(['system', 'neo4j']);

const MAX_DESCRIPTION_LENGTH = 280;

// Async — same shape as operational/spec.ts's isValid: structural checks first
// (cheap, no DB hit), then a referential-existence check against the registry.
// `DB.createDB`'s `CREATE DATABASE ... IF NOT EXISTS` silently no-ops for a name
// that's already provisioned — re-provisioning an existing name would reuse
// that database's existing Levels/Properties (and everything else in it)
// untouched, which would look exactly like a brand-new tenant "inheriting" a
// dirty blueprint from nowhere. Fail fast instead of merging into it.
export const isValidTenantProvisionRequest = async (input: Partial<ProvisionTenantInput>): Promise<void> => {
    const { name, description } = input;
    if (typeof name !== 'string' || !TENANT_NAME_PATTERN.test(name)) {
        throw new Error(`name must be lowercase letters/digits/hyphens, starting with a letter, 1-40 chars; got ${JSON.stringify(name)}`);
    }
    if (RESERVED_NAMES.has(name)) {
        throw new Error(`name must not be a reserved word [${[...RESERVED_NAMES].join(', ')}]; got "${name}"`);
    }
    if (description !== undefined && (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH)) {
        throw new Error(`description must be a string of at most ${MAX_DESCRIPTION_LENGTH} chars`);
    }
    if (await tenantExists(name)) {
        throw new Error(`a tenant named "${name}" already exists — choose a different name, or delete it first`);
    }
};
