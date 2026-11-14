// Maps the free-text job titles found in the legacy manufacturing/pharma dataset
// (Incident/CAPA/Verification/Risk/Task owner & reviewer fields) onto the 16 seeded
// enterprise Roles, which come from a different vertical (Industrial Parks/Warehouse/
// 3PL — cli/feeds/csv/enterprise/roles.csv). No title matches a Role name exactly, so
// every entry below is a functional-domain judgment call (department/business-unit
// equivalence), not a string match — each is commented with its justification.
// Titles with no defensible equivalent are deliberately left unmapped.
export const TITLE_TO_ROLE: Record<string, string> = {
    // Both are regional/corporate-level EHS oversight roles.
    'Corporate EHS': 'ROLE-004', // EHS Manager (Regional)

    // Closest engineering-tier Facilities Management role to a plant/site engineer.
    'Facility Engineer': 'ROLE-009', // MEP / Utilities Engineer

    // Only Compliance-department role seeded; both titles are compliance leadership.
    'Compliance Lead': 'ROLE-015', // Regional Compliance Head
    'Compliance Manager': 'ROLE-015', // Regional Compliance Head

    // Only Operations-department role seeded; both are site/ops leadership.
    'Operations Director': 'ROLE-001', // Warehouse Operations Manager

    // Nearest compliance/quality-oversight role — no dedicated QA role is seeded.
    'QA Director': 'ROLE-015', // Regional Compliance Head

    // 'QA Executive' has no defensible equivalent among the 16 seeded Roles —
    // intentionally left unmapped, same discipline as the platform's other
    // documented-absence gaps (e.g. the 2 unmapped Security assets).
};

// Separate map for Incident.escalationPath segments — a distinct free-text
// vocabulary from Person job titles (though a few terms overlap). Same rule:
// map only where a real functional-domain equivalent exists among the 16
// seeded Roles; leave the rest unmapped rather than guess. Titles with no
// seeded equivalent at all (Plant Director/Head, Engineering Director,
// Production Supervisor, CIO, IT Security Lead, OT Security Manager, and the
// plant-floor QA Head/Officer/Supervisor/Utilities tiers) are deliberately
// absent — there is no Engineering, IT/OT-security, or plant-leadership role
// seeded, and physical Security (ROLE-013) is not the same domain as IT/OT
// cybersecurity.
export const ESCALATION_TITLE_TO_ROLE: Record<string, string> = {
    'Facility Engineer': 'ROLE-009', // MEP / Utilities Engineer
    'Utility Engineer': 'ROLE-009', // MEP / Utilities Engineer
    'EHS Head': 'ROLE-004', // EHS Manager (Regional)
    'EHS Manager': 'ROLE-004', // EHS Manager (Regional) — direct functional match
    'Shift Supervisor': 'ROLE-002', // Shift Warehouse Supervisor
    'Corporate Risk Office': 'ROLE-014', // Insurance & Risk Compliance Manager
    'Corporate Quality': 'ROLE-015', // Regional Compliance Head — corporate-level quality/compliance oversight
    'QA Director': 'ROLE-015', // Regional Compliance Head — nearest compliance/quality leadership role
};
