# Sprint 45: SAR/STR Report Templates

**Duration**: 2 weeks
**Priority**: MEDIUM
**Closes Gaps**: G11
**Depends On**: S-42 (case management v2 — cases feed into SAR reports)
**Status**: Complete

---

## Objective

Build jurisdiction-specific Suspicious Activity Report (SAR) / Suspicious Transaction Report (STR) templates. Compliance officers need one-click export of case files for regulatory submission.

## Tasks

### T1: US FinCEN SAR template
- [x] BSA E-Filing XML format per FinCEN specifications
- [x] Auto-populate from case data: subject name, DOB, identifiers, transaction details, narrative
- [x] Fields: Filing institution, subject information, suspicious activity characterization, narrative
- [x] Generate XML + human-readable PDF preview
- [x] **File**: `internal/reports/sar_fincen.go` (new, <100 lines)
- [x] **File**: `internal/reports/sar_fincen_test.go`

### T2: UK NCA SAR template
- [x] Defence Against Money Laundering (DAML) format
- [x] Auto-populate from case data
- [x] **File**: `internal/reports/sar_uk_nca.go` (new, <100 lines)

### T3: EU goAML XML template
- [x] UNODC goAML XML format used by EU FIUs
- [x] Schema: `goaml-4.0.xsd` compliant
- [x] **File**: `internal/reports/sar_goaml.go` (new, <100 lines)

### T4: One-click export from case detail
- [x] `POST /api/v1/reports/generate` — already exists, wire to real templates
  ```json
  {
      "case_id": "uuid",
      "report_type": "SAR_FINCEN",
      "format": "xml"
  }
  ```
- [x] Response: download URL for generated report
- [x] Include: all screening evidence, alert history, analyst notes, disposition, audit trail
- [x] **File**: `api/handler_reports.go` (modify)

### T5: Report storage and audit
- [x] Store generated reports in database with hash for integrity
- [x] Record in audit trail: who generated, when, for which case
- [x] Reports are immutable once generated
- [x] **File**: `internal/storage/pgx/report_repo.go` (new, <60 lines)

### T6: Frontend report generation
- [x] Add "Generate SAR" button to case detail page
- [x] Jurisdiction selector (US/UK/EU)
- [x] Preview before download
- [x] **File**: `web/src/pages/compliance/CaseDetail.tsx` (modify)

## Acceptance Criteria

- [x] FinCEN SAR XML validates against BSA E-Filing schema
- [x] UK NCA and goAML templates generate valid output
- [x] One-click generation from case detail page
- [x] Reports include all case evidence and audit trail
- [x] Generated reports stored immutably with integrity hash
