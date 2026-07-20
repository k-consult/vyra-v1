# Consolidated Compliance Data — Entity Schema

**Source:** `.design/synthetic-data/data.csv`
**Format:** single CSV, 22 worksheets delimited by `--- WORKSHEET: <name> ---` markers. Each worksheet's header row = entity properties.

Raw extraction only — no mapping to the Vyra graph model performed here.

---

## 01_Business_Scenario (42 rows)

Key-value metadata sheet (workbook description), not a row-per-entity table.

- `Field, Value, Value2, Value3`

---

## 02_Regulatory_Authorities (8 rows)

ID prefix: `AUTH-`

- `AuthorityID, Name, Abbreviation, Jurisdiction, Type, Description`

---

## 03_Regulations (11 rows)

ID prefix: `REG-`

- `RegulationID, Name, AuthorityID, Jurisdiction, Effective Date, Description`

---

## 04_Standards (10 rows)

ID prefix: `STD-`

- `StandardID, Name, Issuing Body, Version, Description`

---

## 05_Clauses (34 rows)

ID prefix: `CL-`

- `ClauseID, Source Type, Source ID, Clause Number, Title, Clause Text (Synthetic)`

---

## 06_Obligations (34 rows)

ID prefix: `OBL-`

- `ObligationID, ClauseID, Description, Obligation Type, Mandatory (Y/N)`

---

## 07_Compliance_Areas (10 rows)

ID prefix: `CA-`

- `ComplianceAreaID, Name, Description`

---

## 08_Operational_Controls (30 rows)

ID prefix: `CTRL-`

- `ControlID, Name, ComplianceAreaID, Control Type, Description, RiskID, Primary ObligationID(s), ClauseID, StandardID, RegulationID, AuthorityID`

---

## 09_Task_Master (60 rows)

ID prefix: `TASK-`. Widest table — denormalized rollup of area/control/obligation/clause/authority/regulation/standard/risk/hazard/org/spatial/scheduling/checklist/evidence columns.

- `TaskID, Task Name, Compliance Area, Control ID, Obligation ID, Clause ID, Authority ID, Regulation ID, Standard ID, Risk ID, Hazard, Business Unit, Department, Responsible Role ID, Assigned User, Approval Authority, Frequency, Schedule Type, Calendar Rule, Due Date, SLA, Escalation Rule, Site, Building, Floor, Zone, Area, Process, Asset ID, Equipment, Checklist ID, Inspection Form, SOP Reference, Template ID, Evidence Type, Digital Signature Required (Y/N), Execution Method, Priority, Duration (min), Output Type`

---

## 10_Organization_Mapping (16 rows)

- `Company, Business Unit, Department, RoleID, Role Title, Approval Authority (Y/N)`

---

## 11_Spatial_Mapping (100 rows)

- `Company, SiteID, Site Name, BuildingID, Building Name, Floor, ZoneID, Zone Name, RoomID, Room Name`

---

## 12_Checklist_Template_Mapping (20 rows)

ID prefix: `CHK-`

- `ChecklistID, Name, Type, ComplianceAreaID, Linked Task IDs`

---

## 13_Schedule_Rules (60 rows)

- `TaskID, Frequency, Schedule Type, Calendar Rule, Anchor Week/Date, Trigger Condition, SLA, Escalation Rule`

---

## 14_52Wk_Calendar (60 rows)

- `TaskID, Task Name, Frequency, Week01 … Week52` (56 columns total)

---

## 15_Traceability_Matrix (60 rows)

Pure join table linking Task → Control → Obligation → Clause → Standard → Regulation → Authority → ComplianceArea → Risk.

- `TaskID, ControlID, ObligationID, ClauseID, StandardID, RegulationID, AuthorityID, ComplianceAreaID, RiskID`

---

## 16_Relationship_Matrix (778 rows)

Generic edge list — `(From_ID, From_Type) -[Relationship]-> (To_ID, To_Type)`.

- `From_ID, From_Type, Relationship, To_ID, To_Type, Relationship_Category, Cardinality`

**Observed `From_Type` values:** Authority, BusinessUnit, Clause, Company, ComplianceArea, Control, Obligation, REG, Regulation, Risk, Role, STD, Site, Standard, Task, Vendor

**Observed `To_Type` values:** Asset, Building, Checklist, Clause, Control, InsuranceClause, Obligation, Regulation, Role, Site, Task

**Observed `Relationship_Category` values:** Operational, Organizational, Spatial, Traceability

**Observed `Cardinality` values:** 1:1, 1:N, N:1

**Observed `Relationship` values (20):** contains, creates, defines, evidenced_by, governed_by_clause, governs, hosts_asset, implemented_by, issues, mitigated_by, operates, oversees, performed_at, performed_in, referenced_by, responsible_for, satisfied_by, services, supports_clause, uses_asset

---

## 17_Risk_Register (16 rows)

ID prefix: `RISK-`

- `RiskID, Name, Category, Likelihood, Impact, Risk Level`

---

## 18_Roles_Master (16 rows)

ID prefix matches `RoleID` used elsewhere.

- `RoleID, Title, Business Unit, Department, Approval Authority (Y/N)`

---

## 19_Asset_Equipment_Master (31 rows)

ID prefix: `AST-` (per RelationshipMatrix `Asset` type)

- `AssetID, Name, Category, Type, SiteID, BuildingID, ZoneID, RoomID`

---

## 20_Vendor_Master (12 rows)

- `VendorID, Vendor Name, Service Type, Sites Covered, Contract Reference, SLA (Response Time), AMC Start Date, AMC Expiry Date, Internal Coordinator (RoleID)`

---

## 21_Insurance_Risk_Clauses (15 rows)

- `ClauseRefID, Linked RiskID, Insurer Requirement / Warranty, Policy / Clause Reference, Linked ControlID, Compliance Basis, Premium Impact if Non-Conformant`

---

## 22_Data_Dictionary (52 rows)

Meta-sheet describing every field used across the other worksheets — not an entity itself.

- `Field Name, Worksheet(s), Data Type, Description, Allowed Values, Relationship Purpose`
