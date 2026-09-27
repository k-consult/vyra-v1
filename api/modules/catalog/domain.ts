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
