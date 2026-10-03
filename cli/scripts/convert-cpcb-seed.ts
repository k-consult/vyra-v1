import fs from 'fs';
import path from 'path';
import log from '../../lib/log';

const sourcePath = path.resolve(__dirname, '..', '..', '.design', '__ref', 'synthetic-data', 'cpcb_spo_map.json');
// Each regulatory board/authority gets its own folder under catalog/ — cli/orchestration/
// catalog-sync.ts's --authority flag selects which one to ingest. Filenames inside are a
// fixed convention (authorities.csv, regulations.csv, ...), not board-specific names.
const outDir = path.resolve(__dirname, '..', 'feeds', 'csv', 'catalog', 'cpcb');

type Row = Record<string, string>;

interface CpcbObligation {
    obligation_id: string;
    spo: { subject: string; predicate: string; object: string };
    description: string;
    frequency: string;
    data_collection_method: string;
    evidence_type: string;
    responsible_role: string;
    capa_trigger: string;
    report_type: string;
    report_authority: string;
    report_cadence: string;
}

interface CpcbAct {
    act_code: string;
    act_name: string;
    year: number;
    administering_authority: string;
    primary_instrument: string;
    applicability_trigger: string;
    applicable_to: string;
    obligations: CpcbObligation[];
}

const writeCSV = (fileName: string, rows: Row[]): void => {
    if (!rows.length) { log.warn(`convert-cpcb-seed: no rows for ${fileName}`); return; }
    const cols = Object.keys(rows[0]);
    const esc = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c] ?? '')).join(','))];
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, fileName), lines.join('\n') + '\n');
    log.info(`convert-cpcb-seed: ${fileName} <- ${rows.length} rows`);
};

// tags is a pipe-delimited CSV cell — split into a real string[] at compile time by
// v2.ts's `{ mapTo: 'tags', isArray: true }` PropMap. Backs the catalog_search
// full-text index (cli/projection/index.ts). No tag value here may contain '|'.
const tagStr = (tags: (string | undefined | null)[]): string => tags.filter((t): t is string => Boolean(t)).join('|');

// Five real regulatory bodies behind the CPCB data's noisy administering_authority
// strings ("CPCB / SPCB", "SPCB (authorization) / CPCB (policy)", "ULB / SPCB
// oversight", ...) — hand-curated rather than string-parsed, same precedent as
// convert-catalog-seed.ts's FREQUENCY_CADENCE lookup: a small, real lookup table
// beats a brittle parser for five known entities.
const AUTH_CPCB = 'AUTH-009';
const AUTH_SPCB = 'AUTH-010';
const AUTH_MOEFCC = 'AUTH-011';
const AUTH_CGWA = 'AUTH-012';
const AUTH_ULB = 'AUTH-013';

const AUTHORITY_ROWS: Row[] = [
    { id: AUTH_CPCB, name: 'Central Pollution Control Board', abbreviation: 'CPCB', authorityType: 'National Regulator', jurisdictionId: 'JUR-INDIA', description: 'National apex body for pollution control; administers EPR portals (plastic, e-waste, battery) and sets national policy under HWM/BMW Rules.' },
    { id: AUTH_SPCB, name: 'State Pollution Control Board', abbreviation: 'SPCB', authorityType: 'State Regulator', jurisdictionId: 'JUR-INDIA', description: 'State-level operational authority issuing CTE/CTO consents and Rule 6/Rule 10 authorizations, the primary regulator for most CPCB-administered obligations.' },
    { id: AUTH_MOEFCC, name: 'Ministry of Environment, Forest and Climate Change', abbreviation: 'MoEFCC', authorityType: 'National Regulator', jurisdictionId: 'JUR-INDIA', description: 'Administers the Environment (Protection) Act 1986, the umbrella statute enabling every subordinate CPCB rule.' },
    { id: AUTH_CGWA, name: 'Central Ground Water Authority', abbreviation: 'CGWA', authorityType: 'National Regulator', jurisdictionId: 'JUR-INDIA', description: 'Issues groundwater extraction No-Objection Certificates and receives periodic bore-well compliance reporting.' },
    { id: AUTH_ULB, name: 'Urban Local Body', abbreviation: 'ULB', authorityType: 'Local Authority', jurisdictionId: 'JUR-INDIA', description: 'Municipal authority overseeing Solid Waste Management and Construction & Demolition Waste Management Rules compliance.' },
];
const ABBR_BY_AUTH_ID: Record<string, string> = Object.fromEntries(AUTHORITY_ROWS.map(a => [a.id, a.abbreviation]));

// This board's ingest is self-contained: Jurisdiction and ComplianceArea are shared
// reference taxonomies (not CPCB-specific), but since each authority folder is
// ingested independently via --authority, the folder carries the minimal rows its
// own data references. MERGE-by-id makes this safe to repeat across future boards —
// redefining JUR-INDIA identically elsewhere is a harmless no-op, not a collision.
const JURISDICTION_ROWS: Row[] = [
    { id: 'JUR-INDIA', name: 'India', region: 'India', code: 'India' },
];
const COMPLIANCE_AREA_ROWS: Row[] = [
    { id: 'CA-006', name: 'Waste Management', description: 'Segregation, storage, and licensed disposal of general and hazardous waste.' },
    { id: 'CA-008', name: 'Environmental Compliance', description: 'Effluent, emissions, and environmental permit conformance.' },
];

// One operationally-relevant authority per act (the body an enterprise actually
// files with day to day), and one reused ComplianceArea per act (CA-006/CA-008
// above) rather than inventing new areas for this pass.
const ACT_META: Record<string, { authorityId: string; complianceAreaId: string }> = {
    WATER_ACT_1974: { authorityId: AUTH_SPCB, complianceAreaId: 'CA-008' },
    AIR_ACT_1981: { authorityId: AUTH_SPCB, complianceAreaId: 'CA-008' },
    EPA_1986: { authorityId: AUTH_MOEFCC, complianceAreaId: 'CA-008' },
    HWM_RULES_2016: { authorityId: AUTH_SPCB, complianceAreaId: 'CA-006' },
    SWM_RULES_2016: { authorityId: AUTH_ULB, complianceAreaId: 'CA-006' },
    NOISE_RULES_2000: { authorityId: AUTH_SPCB, complianceAreaId: 'CA-008' },
    PWM_RULES_2016: { authorityId: AUTH_CPCB, complianceAreaId: 'CA-006' },
    EWASTE_RULES_2022: { authorityId: AUTH_CPCB, complianceAreaId: 'CA-006' },
    BATTERY_RULES_2022: { authorityId: AUTH_CPCB, complianceAreaId: 'CA-006' },
    BMW_RULES_2016: { authorityId: AUTH_SPCB, complianceAreaId: 'CA-006' },
    CD_RULES_2016: { authorityId: AUTH_ULB, complianceAreaId: 'CA-006' },
};

// CPCB's own predicate legend (meta.spo_predicate_legend in the source file) is the
// closest thing to a controlType mapping it carries: subjectTo/generates describe
// after-the-fact verification (Detective); requiresCheck/requires describe
// maintaining a standing condition (Preventive).
const CONTROL_TYPE_BY_PREDICATE: Record<string, string> = {
    subjectTo: 'Detective',
    generates: 'Detective',
    requiresCheck: 'Preventive',
    requires: 'Preventive',
};

// report_type values that are purely internal (an NC log feeding some other,
// already-captured filing) rather than a distinct external statutory report —
// these obligations get no Report/REQUIRES_FILING edge, same "documented absence"
// discipline as the unmapped Security-category assets elsewhere in this catalog.
const isInternalOnlyReport = (reportType: string): boolean => reportType.startsWith('Internal NC log');

const AUTHORITY_BY_REPORT_AUTHORITY: Record<string, string> = {
    SPCB: AUTH_SPCB,
    CGWA: AUTH_CGWA,
    ULB: AUTH_ULB,
    CPCB: AUTH_CPCB,
    'CPCB (EPR portal)': AUTH_CPCB,
};

const PERIOD_WORDS: Record<string, { cadenceUnit: string; cadenceInterval: string }> = {
    Weekly: { cadenceUnit: 'week', cadenceInterval: '1' },
    Monthly: { cadenceUnit: 'month', cadenceInterval: '1' },
    Quarterly: { cadenceUnit: 'month', cadenceInterval: '3' },
    'Half-Yearly': { cadenceUnit: 'month', cadenceInterval: '6' },
    Annual: { cadenceUnit: 'month', cadenceInterval: '12' },
};

interface ParsedCadence {
    cadenceUnit: string;
    cadenceInterval: string;
    triggerCondition: string;
}

// CPCB's report_cadence text conflates two real but different things: a periodic
// filing schedule ("Quarterly") and an event trigger ("90-120 days pre-expiry") —
// and sometimes both at once ("Quarterly / at NOC renewal"). This splits them
// rather than storing one ambiguous string; cadenceRaw (caller-side) keeps the
// original text so nothing is lost if this parse is ever wrong.
const parseCadence = (raw: string): ParsedCadence => {
    const deadlineMatch = raw.match(/^(\w[\w-]*)\s*\(by ([^)]+)\)$/);
    if (deadlineMatch) {
        const period = PERIOD_WORDS[deadlineMatch[1]];
        if (period) return { ...period, triggerCondition: `statutory deadline: ${deadlineMatch[2]}` };
    }

    if (raw.includes(' / ')) {
        const [periodPart, eventPart] = raw.split(' / ').map(s => s.trim());
        const period = PERIOD_WORDS[periodPart];
        if (period) return { ...period, triggerCondition: eventPart };
    }

    const period = PERIOD_WORDS[raw];
    if (period) return { ...period, triggerCondition: '' };

    // Pure event trigger, no periodic component: "As required at renewal",
    // "90-120 days pre-expiry", "Prior to expiry", "At project completion".
    return { cadenceUnit: '', cadenceInterval: '', triggerCondition: raw };
};

const FREQUENCY_WORD = /\b(daily|weekly|monthly|quarterly|half-yearly|annually|annual)\b/i;
const FREQUENCY_ALIASES: Record<string, { cadenceUnit: string; cadenceInterval: string }> = {
    daily: { cadenceUnit: 'day', cadenceInterval: '1' },
    weekly: { cadenceUnit: 'week', cadenceInterval: '1' },
    monthly: { cadenceUnit: 'month', cadenceInterval: '1' },
    quarterly: { cadenceUnit: 'month', cadenceInterval: '3' },
    'half-yearly': { cadenceUnit: 'month', cadenceInterval: '6' },
    annually: { cadenceUnit: 'month', cadenceInterval: '12' },
    annual: { cadenceUnit: 'month', cadenceInterval: '12' },
};

// An Obligation's own check frequency (e.g. "Monthly", "Continuous, checked
// weekly") — distinct from Report.cadence, which is the filing cadence. This is
// what drives the Calendar view (Schedule -[:APPLIES_TO]-> Task -[:IMPLEMENTS]->
// Control). Only obligations whose frequency names a clear calendar period get a
// Schedule; event/validity-driven ones ("Per consent validity (1-5 yr cycle)",
// "At replacement (~1x/year per battery bank)") correctly get none — same
// Fixed-vs-Triggered split convert-catalog-seed.ts already uses, not a gap.
const parseFrequency = (raw: string): { cadenceUnit: string; cadenceInterval: string } | null => {
    const match = raw.match(FREQUENCY_WORD);
    return match ? FREQUENCY_ALIASES[match[1].toLowerCase()] : null;
};

const SCHEDULE_ANCHOR = '2026-01-01';

const convert = (): void => {
    const raw = fs.readFileSync(sourcePath, 'utf-8');
    const data: { cpcb_regulatory_spo_map: CpcbAct[] } = JSON.parse(raw);
    const acts = data.cpcb_regulatory_spo_map;

    writeCSV('authorities.csv', AUTHORITY_ROWS);
    writeCSV('jurisdictions.csv', JURISDICTION_ROWS);
    writeCSV('complianceAreas.csv', COMPLIANCE_AREA_ROWS);

    writeCSV('regulations.csv', acts.map(act => ({
        id: act.act_code,
        name: act.act_name,
        authorityId: ACT_META[act.act_code].authorityId,
        jurisdictionId: 'JUR-INDIA',
        effectiveDate: `${act.year}-01-01`,
        effectiveFrom: `${act.year}-01-01`,
        catalogVersion: '1.0',
        supersededBy: '',
        description: act.applicability_trigger,
        tags: tagStr(['CPCB', ABBR_BY_AUTH_ID[ACT_META[act.act_code].authorityId], 'India']),
    })));

    // CPCB's data has no clause-level granularity — one synthetic Clause per act,
    // carrying the act's real primary_instrument text as its clauseRef, same
    // honesty discipline as convert-catalog-seed.ts's "Synthetic clause text" rows.
    writeCSV('clauses.csv', acts.map(act => ({
        id: `CLA-${act.act_code}`,
        name: act.primary_instrument,
        clauseRef: act.primary_instrument,
        text: `Synthetic clause representing ${act.act_name}'s operative instrument requirement: ${act.primary_instrument}.`,
        regulationId: act.act_code,
        standardId: '',
        catalogVersion: '1.0',
        sourceDocumentId: `${act.act_code}-DOC`,
        sourceAnchor: act.primary_instrument,
        tags: tagStr(['CPCB', act.act_code]),
    })));

    // Dedupe Report rows on the full (report_type, report_authority, report_cadence)
    // tuple, not report_type alone — the same report_type string ("CTO compliance
    // report") genuinely recurs at different cadences across obligations in the
    // source data, so collapsing on name alone would silently misstate frequency.
    const reportIdByTuple = new Map<string, string>();
    const reportRows: Row[] = [];
    let reportSeq = 0;

    const reportIdFor = (ob: CpcbObligation): string | null => {
        if (isInternalOnlyReport(ob.report_type)) return null;
        const key = `${ob.report_type}|${ob.report_authority}|${ob.report_cadence}`;
        const existing = reportIdByTuple.get(key);
        if (existing) return existing;
        reportSeq += 1;
        const id = `RPT-CPCB-${String(reportSeq).padStart(2, '0')}`;
        reportIdByTuple.set(key, id);
        const authorityId = AUTHORITY_BY_REPORT_AUTHORITY[ob.report_authority];
        if (!authorityId) throw new Error(`convert-cpcb-seed: no Authority mapped for report_authority "${ob.report_authority}" (obligation ${ob.obligation_id})`);
        const cadence = parseCadence(ob.report_cadence);
        reportRows.push({
            id,
            name: ob.report_type,
            reportType: 'statutory',
            authorityId,
            cadenceUnit: cadence.cadenceUnit,
            cadenceInterval: cadence.cadenceInterval,
            triggerCondition: cadence.triggerCondition,
            cadenceRaw: ob.report_cadence,
            tags: tagStr(['CPCB', 'statutory', ABBR_BY_AUTH_ID[authorityId]]),
        });
        return id;
    };

    const obligationRows: Row[] = [];
    const controlRows: Row[] = [];
    const taskRows: Row[] = [];
    const scheduleRows: Row[] = [];

    for (const act of acts) {
        const meta = ACT_META[act.act_code];
        for (const ob of act.obligations) {
            const reportId = reportIdFor(ob);

            obligationRows.push({
                id: ob.obligation_id,
                name: ob.description,
                obligationType: 'Mandatory',
                clauseId: `CLA-${act.act_code}`,
                mandatory: 'Y',
                catalogVersion: '1.0',
                sourceDocumentId: `${act.act_code}-DOC`,
                sourceAnchor: act.primary_instrument,
                reportId: reportId ?? '',
                tags: tagStr(['CPCB', ob.spo.subject, ob.spo.predicate, 'Mandatory']),
            });

            const controlType = CONTROL_TYPE_BY_PREDICATE[ob.spo.predicate];
            if (!controlType) throw new Error(`convert-cpcb-seed: no controlType mapped for predicate "${ob.spo.predicate}" (obligation ${ob.obligation_id})`);

            controlRows.push({
                id: `CTRL-${ob.obligation_id}`,
                name: `${ob.spo.subject} — ${ob.spo.object}`,
                controlType,
                description: ob.description,
                complianceAreaId: meta.complianceAreaId,
                riskId: '',
                obligationId: ob.obligation_id,
                clauseId: `CLA-${act.act_code}`,
                standardId: '',
                regulationId: act.act_code,
                authorityId: meta.authorityId,
                tags: tagStr(['CPCB', controlType]),
            });

            // The Obligation's own check frequency drives the Calendar view — distinct
            // from the Report's filing cadence above. status: 'open' when a real
            // Schedule exists (Fixed, same convention as convert-catalog-seed.ts),
            // 'closed' when the frequency is event/validity-driven with no clean
            // period (no Schedule row, nothing to show in the calendar grid for it).
            const taskId = `TSK-${ob.obligation_id}`;
            const frequencyCadence = parseFrequency(ob.frequency);
            taskRows.push({
                id: taskId,
                name: ob.description,
                controlId: `CTRL-${ob.obligation_id}`,
                frequency: ob.frequency,
                priority: 'High',
                evidenceRequired: 'yes',
                evidenceMethod: ob.data_collection_method,
                owner: ob.responsible_role,
                status: frequencyCadence ? 'open' : 'closed',
            });
            if (frequencyCadence) {
                scheduleRows.push({
                    id: `SCH-${ob.obligation_id}`,
                    name: `Schedule - ${taskId}`,
                    taskId,
                    cadenceUnit: frequencyCadence.cadenceUnit,
                    cadenceInterval: frequencyCadence.cadenceInterval,
                    anchorDate: SCHEDULE_ANCHOR,
                });
            }
        }
    }

    writeCSV('reports.csv', reportRows);
    writeCSV('obligations.csv', obligationRows);
    writeCSV('controls.csv', controlRows);
    writeCSV('tasks.csv', taskRows);
    writeCSV('schedules.csv', scheduleRows);

    const skipped = acts.flatMap(a => a.obligations).filter(ob => isInternalOnlyReport(ob.report_type)).length;
    const scheduled = scheduleRows.length;
    log.info(`convert-cpcb-seed: ${acts.length} acts, ${obligationRows.length} obligations, ${controlRows.length} controls, ${reportRows.length} reports, ${taskRows.length} tasks (${scheduled} scheduled, ${taskRows.length - scheduled} event/validity-driven — no Schedule) (${skipped} obligations have no external filing — internal NC log only)`);
};

convert();
