import { ProvisionTenantInput } from './repo';

// Neo4j database names: ASCII letter first, then letters/digits/dots/dashes, case-
// insensitive (lowercased internally), max 63 chars. Capped well under that here
// since the actual database name is `grc-tenant-${name}`, not `name` alone.
const TENANT_NAME_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;
const RESERVED_NAMES = new Set(['system', 'neo4j']);

export const isValidTenantProvisionRequest = (input: Partial<ProvisionTenantInput>): void => {
    const { name } = input;
    if (typeof name !== 'string' || !TENANT_NAME_PATTERN.test(name)) {
        throw new Error(`name must be lowercase letters/digits/hyphens, starting with a letter, 1-40 chars; got ${JSON.stringify(name)}`);
    }
    if (RESERVED_NAMES.has(name)) {
        throw new Error(`name must not be a reserved word [${[...RESERVED_NAMES].join(', ')}]; got "${name}"`);
    }
};
