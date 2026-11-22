// Pure Knowledge-domain Specifications (domain.md) — no I/O, no DB, testable with
// plain objects. Adapters (repo.ts) fetch the data; these predicates decide.

export interface CatalogFact {
    supersededBy?: string;
}

// CatalogFactIsCurrentSpecification
export const isCurrent = (fact: CatalogFact): boolean => !fact.supersededBy;

export interface ControlRow {
    obligationId?: string;
}

// ControlImplementsObligationSpecification
export const implementsObligation = (control: ControlRow, obligation: { id: string }): boolean =>
    control.obligationId === obligation.id;

export const hasImplementingControl = (obligation: { id: string }, controls: ControlRow[]): boolean =>
    controls.some((control) => implementsObligation(control, obligation));

export interface SubjectTypeRow {
    status?: string;
}

// SubjectTypeIsRetiredSpecification — status is unset on every seeded row
// (cli/semantic-contract/contracts/v2.ts's baseProps carries the field, but the CSV
// feed never populated it), so unset must read as active, not retired.
export const isRetired = (subjectType: SubjectTypeRow): boolean => subjectType.status === 'retired';
