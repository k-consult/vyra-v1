// A Property's ingestKey is upper-case, '_'-delimited (e.g. 'BUSINESS_UNIT') —
// still needed as the literal CSV column header. Levels no longer carry one
// (see labelFromName below); this stays purely for camelFromIngestKey.
const labelFromIngestKey = (ingestKey: string): string =>
    ingestKey
        .toLowerCase()
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');

// Same split, but the first word stays lower-case — a Property's ingestKey
// becomes the node property name it's actually stored under (graph-spine's
// camelCase convention), e.g. 'ASSET_WEIGHT' -> 'assetWeight'.
export const camelFromIngestKey = (ingestKey: string): string => {
    const label = labelFromIngestKey(ingestKey);
    return label.charAt(0).toLowerCase() + label.slice(1);
};

// A Level has no ingestKey — just a display `name` — so the Neo4j label the
// Ingester creates at that depth is derived straight from it: strip anything
// that isn't a letter/digit, split on whitespace, PascalCase each word. e.g.
// "Business Unit" -> "BusinessUnit", "Zone 3" -> "Zone3". The Ingester and the
// blueprint API must derive the exact same label — shared here so cli/ and
// api/ never drift into two different casing rules.
export const labelFromName = (name: string): string =>
    name
        .trim()
        .split(/\s+/)
        .map(word => word.replace(/[^a-zA-Z0-9]/g, ''))
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
