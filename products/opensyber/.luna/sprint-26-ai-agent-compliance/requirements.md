# Sprint 26: AI Agent Compliance (OASF 1.0) -- Requirements

**Scope**: OpenSyber / Sprint 26 AI Agent Compliance
**Sprint Duration**: 2 weeks (estimated)
**Author**: Luna Design Architect Agent
**Date**: 2026-03-07
**Based on**: revised-roadmap-2026.md, Sprint 24/25 architecture

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Context](#project-context)
3. [Functional Requirements](#functional-requirements)
4. [Non-Functional Requirements](#non-functional-requirements)
5. [User Stories](#user-stories)
6. [Technical Constraints](#technical-constraints)
7. [Schema Changes](#schema-changes)
8. [Out of Scope](#out-of-scope)
9. [Success Metrics](#success-metrics)

---

## Executive Summary

Sprint 26 establishes the **OpenSyber AI Agent Security Framework (OASF) 1.0** -- the first compliance framework purpose-built for AI coding agent governance. Enterprises need to answer "Do our AI agents comply with our security policies?" and no existing framework (SOC2, ISO 27001, NIST CSF) has AI-agent-specific controls. OpenSyber defines and enforces them.

### Key Deliverables

1. **OASF 1.0 Framework**: 15 security controls for AI agent governance
2. **Evidence Collection Engine**: Auto-map agent activity logs to OASF controls
3. **Compliance Score**: Per-org percentage of OASF controls passing
4. **Compliance Report**: PDF/HTML evidence report for SOC2 auditors
5. **Framework Mapping**: OASF to SOC2 CC6.x, ISO 27001 A.12, NIST CSF PR.AC-4
6. **Compliance Dashboard**: Real-time view of control status and evidence

### Business Value

- Differentiator: First platform with AI agent compliance reporting
- Enterprise conversion: CISOs can use OASF reports in SOC2 audits
- Category definition: Publishing OASF as open standard establishes thought leadership
- Revenue: Compliance features gate behind Team/Enterprise plans

---

## Project Context

### Dependencies on Prior Sprints

| Sprint | Dependency | Tables/Features Used |
|--------|-----------|---------------------|
| Sprint 23 | OpenAgent extension data | `agent_activity` table (file_read, bash_exec events) |
| Sprint 24 | Agent security platform | `agent_policies`, `agent_policy_violations`, `cspm_findings`, `alert_channels` |
| Sprint 24 | Risk scoring | `agent_risk_snapshots` (combined risk scores) |
| Sprint 25 | Attack graph | `assets`, `asset_relations`, `attack_path_snapshots` |
| Sprint 8 | RBAC | `organizations`, `orgMembers` + permission system |

### Existing Permissions

The `compliance.view` and `compliance.generate` permissions already exist in the RBAC system. All viewers can read compliance data; security/admin/owner roles can generate reports and trigger assessments.

---

## Functional Requirements

### FR-1: OASF 1.0 Control Definitions

Define 15 controls across 4 domains. Each control has:

- **Control ID**: OASF-XX format
- **Domain**: Monitoring, Access Control, Data Protection, Governance
- **Title**: Human-readable name
- **Description**: What the control requires
- **Evidence query**: How to check if it passes (SQL/logic against existing data)
- **SOC2 mapping**: Which SOC2 CC control(s) it maps to
- **ISO 27001 mapping**: Which ISO control(s) it maps to
- **NIST CSF mapping**: Which NIST subcategory it maps to

#### Domain 1: Monitoring (OASF-01 to OASF-04)

| ID | Title | Evidence Logic |
|----|-------|---------------|
| OASF-01 | All AI agent sessions are monitored and logged | agent_activity records exist for all active agents in last 24h |
| OASF-02 | Agent activity is reviewed by a human within 24 hours | policy_violations have acknowledged=true within 24h of creation |
| OASF-03 | Real-time alerts configured for critical agent events | alert_channels exist with minSeverity=critical and isActive=true |
| OASF-04 | Agent risk scores tracked over time | agent_risk_snapshots exist for the last 30 days |

#### Domain 2: Access Control (OASF-05 to OASF-08)

| ID | Title | Evidence Logic |
|----|-------|---------------|
| OASF-05 | Agents cannot access production secrets without approval | agent_policies exist with ruleType=file_pattern targeting secret paths |
| OASF-06 | Agent sessions are isolated from production environments | agent_activity shows no production path access (configurable patterns) |
| OASF-07 | Agent permissions follow least privilege | RBAC roles assigned; no agents running with owner role |
| OASF-08 | Agent credential rotation enforced | cloud_accounts have lastScanAt within policy window |

#### Domain 3: Data Protection (OASF-09 to OASF-12)

| ID | Title | Evidence Logic |
|----|-------|---------------|
| OASF-09 | Secret detection active on all agent file operations | agent_activity.secretsCount tracking is enabled (records exist) |
| OASF-10 | Sensitive file access is logged and auditable | agent_activity records with risk=critical/high exist for file_read ops |
| OASF-11 | Cloud misconfiguration monitoring active | cspm_findings exist with recent scan runs (last 7 days) |
| OASF-12 | Agent blast radius is assessed | attack_path_snapshots exist for org with recent computation |

#### Domain 4: Governance (OASF-13 to OASF-15)

| ID | Title | Evidence Logic |
|----|-------|---------------|
| OASF-13 | Agent security policies are defined and enforced | agent_policies.isActive=true exist (minimum 3 policies) |
| OASF-14 | Compliance assessments run regularly | compliance_assessments with status=completed in last 30 days |
| OASF-15 | Compliance evidence is retained for audit | evidence_items exist and are linked to controls |

### FR-2: Evidence Collection Engine

- **Automated evidence gathering**: On-demand or scheduled assessment that queries all 15 control evidence conditions
- **Evidence snapshots**: Freeze evidence at assessment time for auditability
- **Evidence linking**: Each evidence item references the control, the data source table, and a sample of supporting records
- **Evidence freshness**: Track when evidence was last collected; stale evidence (>7 days) triggers warnings

### FR-3: Compliance Assessment

- **Assessment creation**: Trigger a compliance assessment for an org
- **Assessment execution**: Run all 15 control checks, collect evidence, compute scores
- **Control status**: Each control is `passing`, `failing`, `partial`, or `not_applicable`
- **Partial pass**: Some controls support partial (e.g., 8/10 policies active = partial)
- **Overall score**: Percentage of controls passing (0-100)
- **Grade**: A+ (100), A (93-99), B (80-92), C (65-79), D (50-64), F (<50)

### FR-4: Compliance Dashboard

- **Overview widget**: Overall compliance score + grade on org dashboard
- **Control list**: All 15 controls with pass/fail status, last evidence date
- **Trend chart**: Compliance score over last 90 days
- **Drill-down**: Click a control to see evidence items, supporting data
- **Framework filter**: View by SOC2/ISO27001/NIST mapping

### FR-5: Compliance Report Generation

- **Format**: HTML report stored in R2 (same pattern as Sprint 24 agent reports)
- **Content**: Cover page, executive summary, control-by-control evidence, mappings
- **Branding**: "Your AI Agent Compliance Report -- [Org Name] -- [Date]"
- **SOC2 evidence**: Each control section shows SOC2 CC mapping + evidence
- **Download**: Available as HTML with print-to-PDF support
- **History**: List past reports, download by ID

### FR-6: Framework Mapping Table

- **SOC2 Trust Services Criteria**: Map OASF controls to CC6.1-CC6.8 (Logical Access)
- **ISO 27001:2022**: Map to A.5-A.8 controls (Information Security)
- **NIST CSF 2.0**: Map to PR.AC, PR.DS, DE.CM subcategories
- **Static mapping**: Stored as constants, not in DB (immutable for v1.0)
- **Exportable**: API endpoint returns the full mapping table

### FR-7: Plan Enforcement

| Feature | Free | Pro | Team | Enterprise |
|---------|------|-----|------|-----------|
| View compliance score | No | No | Yes | Yes |
| Run assessment | No | No | Yes (monthly) | Yes (daily) |
| Generate report | No | No | Yes (1/month) | Yes (unlimited) |
| SOC2/ISO mapping | No | No | No | Yes |
| Framework export | No | No | No | Yes |

---

## Non-Functional Requirements

### NFR-1: Performance

- Assessment execution must complete in <10 seconds for orgs with <1000 agent activities
- Compliance dashboard loads in <2 seconds
- Report generation completes in <5 seconds

### NFR-2: Security

- All compliance endpoints require auth + RBAC (compliance.view / compliance.generate)
- Compliance data scoped to org_id (multi-tenant isolation)
- Evidence items cannot be modified after creation (immutable audit trail)
- Report access restricted to org members

### NFR-3: Reliability

- Assessment failures do not affect other platform features
- Partial assessment results are saved (failed controls marked as `error`)
- Evidence collection retries on transient DB errors

### NFR-4: Auditability

- All assessment runs are logged with actorId, timestamp, results
- Evidence items retain source query metadata
- Reports are stored immutably in R2

### NFR-5: Testing

- 100% coverage on compliance scoring logic (critical path)
- >=90% coverage on evidence collection service
- >=85% coverage on API routes
- Tests for all 15 control evidence evaluators

---

## User Stories

### US-1: CISO Compliance Overview

**As a** CISO viewing the dashboard,
**I want to** see the overall AI agent compliance score,
**so that** I know whether our agents meet security policies.

**Acceptance criteria**:
- Compliance score widget on dashboard shows score (0-100) + grade
- Widget shows count of passing/failing/partial controls
- Click-through navigates to compliance detail page

### US-2: Security Engineer Assessment

**As a** security engineer,
**I want to** trigger a compliance assessment,
**so that** I get fresh evidence for our SOC2 audit.

**Acceptance criteria**:
- "Run Assessment" button triggers evaluation of all 15 controls
- Assessment completes in <10 seconds
- Results show per-control status with evidence links

### US-3: Auditor Report

**As a** security team member preparing for SOC2,
**I want to** generate a compliance report,
**so that** I can provide evidence to our auditor.

**Acceptance criteria**:
- Report includes all 15 controls with evidence
- Each control shows SOC2 CC mapping
- Report is downloadable as HTML (print-to-PDF)
- Report header shows org name and date

### US-4: Control Drill-Down

**As a** security engineer investigating a failing control,
**I want to** see the specific evidence items for that control,
**so that** I can remediate the issue.

**Acceptance criteria**:
- Clicking a control shows evidence details
- Evidence includes data source, query result count, sample records
- Failing controls show remediation guidance

### US-5: Framework Mapping View

**As an** enterprise customer,
**I want to** view OASF controls mapped to SOC2/ISO/NIST,
**so that** I can align with my existing compliance program.

**Acceptance criteria**:
- Mapping table shows OASF control, SOC2 CC, ISO 27001, NIST CSF columns
- Filter by framework
- Exportable as JSON

---

## Technical Constraints

### Existing Infrastructure

- **Database**: Cloudflare D1 (SQLite) -- all new tables use Drizzle ORM
- **API**: Hono on Cloudflare Workers -- max 200 lines per route file
- **Frontend**: Next.js 16 with server components -- proxy routes pattern
- **Auth**: Clerk JWT + RBAC middleware
- **Storage**: R2 for report files
- **Testing**: Vitest with mock DB pattern (createMockDb + _setSelectResults)

### Patterns to Follow

- Route: `new Hono()` with `dbMiddleware, authMiddleware, resolveOrgContext, loadPlanConfig`
- Tests: Mock auth/RBAC/plan middleware, use `_setSelectResults` for DB queries
- Proxy: Next.js `app/api/proxy/` route calls API with Clerk token
- Dashboard: Server components fetch data, client components for interactivity
- Reports: HTML generation stored in R2, same pattern as `agent-report-export.ts`

### File Size Constraint

All source files must be under 200 lines. The evidence collection logic for 15 controls will need to be split across multiple files.

---

## Schema Changes

### New Tables

1. **compliance_controls** -- Static control definitions (seeded, not user-created)
2. **compliance_assessments** -- Assessment runs per org
3. **compliance_assessment_results** -- Per-control results within an assessment
4. **evidence_items** -- Evidence collected for each control

### New Migration

- File: `packages/db/migrations/0013_ai_agent_compliance.sql`
- Creates 4 tables with indexes
- No existing table modifications required

### New Permissions

No new permissions needed. Existing `compliance.view` and `compliance.generate` cover all use cases.

---

## Out of Scope

- **Custom controls**: Users cannot define their own OASF controls in v1.0
- **Continuous monitoring**: Real-time control evaluation (future sprint)
- **PDF generation**: Server-side PDF rendering (use HTML with print-to-PDF)
- **Third-party framework import**: Cannot import CIS/PCI controls
- **Remediation automation**: Auto-fix failing controls (Sprint 33)
- **Public OASF page**: Marketing landing page for OASF standard
- **API for external compliance tools**: OASF API consumed by third parties

---

## Success Metrics

### Success Gates (from roadmap)

- [x] OASF 1.0 defined with 15 controls
- [ ] OASF report generated for at least 1 enterprise customer
- [ ] Compliance score widget live on enterprise dashboard
- [ ] 1 enterprise customer uses OASF report in SOC2 audit

### Quantitative Metrics

| Metric | Target |
|--------|--------|
| Assessment execution time | <10 seconds |
| Dashboard load time | <2 seconds |
| Report generation time | <5 seconds |
| Test coverage (scoring logic) | 100% |
| Test coverage (overall) | >=90% |
| API route files | All <200 lines |
