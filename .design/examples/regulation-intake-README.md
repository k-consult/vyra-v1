# Regulation Intake Template — How to Fill This In

Two files, opened in Excel/Google Sheets:

- **`regulation-intake-regulations.csv`** — one row per law/rule you know.
- **`regulation-intake-requirements.csv`** — one row per obligation that law imposes. Most laws need several rows here. Link a row back to its law using the **exact same text** in the `REGULATION_NAME` column as you used in the Regulations sheet — spelling must match.

These use standard GRC terminology (Obligation, Clause, Mandatory/Conditional, Preventive/Detective, Jurisdiction) — the same language you already use day to day. Nothing here requires knowledge of databases, ids, or systems. If you don't know an answer, write `not sure` — that's a valid, trackable answer, not something to leave blank or guess at.

Each file already has one law filled in completely as a worked example (the Water (Prevention and Control of Pollution) Act, 1974), using real content already live in the system — copy that pattern for your own rows below it.

## `regulation-intake-regulations.csv` — columns

| Column | What to write |
|---|---|
| REGULATION_NAME | Full name of the law/rule (e.g. "Water (Prevention and Control of Pollution) Act, 1974") |
| YEAR | Year it came into force, or the year of the version you're describing |
| JURISDICTION | Country/state this law applies in (e.g. "India", "Karnataka") |
| REGULATORY_AUTHORITY | The body that administers/enforces it (e.g. "State Pollution Control Board") |
| APPLICABILITY_SCOPE | In plain words, what kind of business/site this law applies to |
| APPLICABILITY_TRIGGER | The specific fact about a site that switches this law on for them. Repeat the previous column if they're the same thing. |
| GOVERNING_INSTRUMENT_PERMIT | The main license/consent/registration/authorization tied to this law, if there is one. Write "none" if there isn't. |

## `regulation-intake-requirements.csv` — columns

| Column | What to write |
|---|---|
| REGULATION_NAME | Must exactly match a row in the Regulations sheet |
| CLAUSE_SECTION_REFERENCE | The specific section, rule, or clause this obligation comes from (e.g. "Section 25/26", "Rule 6", "Schedule III"). If several obligations share the same section, repeat it on each of their rows. Write "not sure" if you only know the law, not the exact section. |
| CLAUSE_SECTION_TEXT_OPTIONAL | The actual wording of that section, if you have it handy. "not sure" is fine — this is a bonus for traceability, not a requirement. |
| OBLIGATION_DESCRIPTION | One sentence: what the business must actually do or maintain |
| APPLICABLE_TO_REGULATED_SUBJECT | The specific thing/place/entity this obligation binds to — name it concretely (e.g. "Sewage Treatment Plant (STP)", "Site (whole facility)", "Organization (the legal entity)", "DG Set") |
| OBLIGATION_TYPE | `Mandatory`, `Conditional` (applies only in some circumstances), or `Advisory` (recommended, not legally required) |
| CONTROL_TYPE | `Preventive` (maintains a standing condition so a breach never occurs — e.g. keeping a permit valid, keeping equipment calibrated) or `Detective` (checks after the fact that something is within limits — e.g. lab-testing effluent, emissions testing) |
| COMPLIANCE_FREQUENCY | How often this is checked or done, in plain words (e.g. "Monthly", "Every 6 months", "Only at permit renewal") |
| EVIDENCE_VERIFICATION_METHOD | What record proves this was done (e.g. "External lab report", "Logbook entry", "Signed document") |
| ACCOUNTABLE_ROLE | Job title that normally owns this (e.g. "Site EHS Coordinator") |
| NON_COMPLIANCE_CONSEQUENCE | Optional. The usual consequence/escalation if this is found not met. `not sure` is fine. |
| REPORTING_OBLIGATION | `Yes` or `No` — does this require filing a statutory return/report? |
| REPORT_NAME | If Yes: the name of the filing (e.g. "Form V — Annual Environmental Statement"). `none` if No. |
| REPORTING_AUTHORITY | If Yes: which authority receives it |
| REPORTING_FREQUENCY | If Yes: how often, or what triggers filing it |
