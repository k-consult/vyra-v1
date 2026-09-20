const isOptionalString = (v: unknown): boolean => v === undefined || v === null || typeof v === 'string';

// Structural validity for POST /intelligence/decisions/:id/{approve,reject} — the id itself
// is a route param (Fastify already guarantees it's present); referential existence of the
// Decision is checked by the caller via getDecision, since the route needs the fetched
// decision either way to evaluate isApprovable/isRejectable below.
export const isValid = (input: Record<string, unknown>): void => {
    if (!isOptionalString(input.reviewedBy)) {
        throw new Error(`reviewedBy must be a string when provided; got ${JSON.stringify(input.reviewedBy)}`);
    }
    if (!isOptionalString(input.reviewNote)) {
        throw new Error(`reviewNote must be a string when provided; got ${JSON.stringify(input.reviewNote)}`);
    }
};

// DecisionIsApprovableSpecification / DecisionIsRejectableSpecification (domain.md, Intelligence
// subdomain) — both actions share the same pending-only gate today: a Decision resolves exactly once.
export const isApprovable = (decision: { status: string }): boolean => decision.status === 'pending';
export const isRejectable = (decision: { status: string }): boolean => decision.status === 'pending';
