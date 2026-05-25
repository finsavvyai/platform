# Sprint 45: SAR/STR Report Templates

**Duration**: 2 weeks
**Priority**: MEDIUM
**Closes Gaps**: G11
**Depends On**: S-42 (case management v2 — cases feed into SAR reports)
**Status**: Not Started

---

## Objective

Build jurisdiction-specific Suspicious Activity Report (SAR) / Suspicious Transaction Report (STR) templates. Compliance officers need one-click export of case files for regulatory submission.

## Tasks

### T1: US FinCEN SAR template
- [ ] BSA E-Filing XML format per FinCEN specifications
- [ ] Auto-populate from case data: subject name, DOB, identifiers, transaction details, narrative
- [ ] Fields: Filing institution, subject information, suspicious activity characterization, narrative
- [ ] Generate XML + human-readable PDF preview
- [ ] **File**: `internal/reports/sar_fincen.go` (new, <100 lines)
- [ ] **File**: `internal/reports/sar_fincen_test.go`

### T2: UK NCA SAR template
- [ ] Defence Against Money Laundering (DAML) format
- [ ] Auto-populate from case data
- [ ] **File**: `internal/reports/sar_uk_nca.go` (new, <100 lines)

### T3: EU goAML XML template
- [ ] UNODC goAML XML format used by EU FIUs
- [ ] Schema: `goaml-4.0.xsd` compliant
- [ ] **File**: `internal/reports/sar_goaml.go` (new, <100 lines)

### T4: One-click export from case detail
- [ ] `POST /api/v1/reports/generate` — already exists, wire to real templates
  ```json
  {
      "case_id": "uuid",
      "report_type": "SAR_FINCEN",
      "format": "xml"
  }
  ```
- [ ] Response: download URL for generated report
- [ ] Include: all screening evidence, alert history, analyst notes, disposition, audit trail
- [ ] **File**: `api/handler_reports.go` (modify)

### T5: Report storage and audit
- [ ] Store generated reports in database with hash for integrity
- [ ] Record in audit trail: who generated, when, for which case
- [ ] Reports are immutable once generated
- [ ] **File**: `internal/storage/pgx/report_repo.go` (new, <60 lines)

### T6: Frontend report generation
- [ ] Add "Generate SAR" button to case detail page
- [ ] Jurisdiction selector (US/UK/EU)
- [ ] Preview before download
- [ ] **File**: `web/src/pages/compliance/CaseDetail.tsx` (modify)

## Acceptance Criteria

- [ ] FinCEN SAR XML validates against BSA E-Filing schema
- [ ] UK NCA and goAML templates generate valid output
- [ ] One-click generation from case detail page
- [ ] Reports include all case evidence and audit trail
- [ ] Generated reports stored immutably with integrity hash
