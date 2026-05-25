# Sprint 28: Enterprise Exit Prep - Requirements

**Scope**: OpenSyber / Sprint 28 - Enterprise Exit Prep
**Generated**: 2026-03-07
**Agent**: Design Architect Agent
**Target**: August 2026 (Series A readiness)

---

## 1. Overview

Sprint 28 prepares OpenSyber for Series A fundraising by closing enterprise-readiness gaps:
automated OpenAPI documentation, SOC2 Type 1 compliance controls, SCIM user provisioning,
multi-region deployment, SLA monitoring, and a data room for investors.

## 2. Functional Requirements

### 2.1 OpenAPI 3.0 Spec Auto-Generation

- **FR-2.1.1**: Auto-generate OpenAPI 3.0 spec from all `/api/v1/` Hono route definitions.
- **FR-2.1.2**: Serve the spec at `GET /openapi.json` (public, no auth required).
- **FR-2.1.3**: Include request/response schemas derived from Zod validators.
- **FR-2.1.4**: Include authentication requirements (Bearer JWT, Gateway Token, API Key).
- **FR-2.1.5**: Group endpoints by tag matching route file groupings (instances, security, agents, cloud, marketplace, admin).
- **FR-2.1.6**: Include pagination schemas (`nextCursor`, `hasMore` pattern).
- **FR-2.1.7**: Include error response schemas (400, 401, 403, 404, 429, 500).
- **FR-2.1.8**: Serve Swagger UI at `/docs` for interactive exploration.
- **FR-2.1.9**: Spec must be regenerated on each deploy (build-time, not runtime).

### 2.2 SOC2 Type 1 Controls for AI Agent Governance

- **FR-2.2.1**: Map existing OASF 15 controls to SOC2 Trust Service Criteria (CC1-CC9, A1, PI1).
- **FR-2.2.2**: Store OASF-to-SOC2 mapping in a `soc2_control_mappings` table.
- **FR-2.2.3**: Generate SOC2 evidence reports from existing OASF assessment data.
- **FR-2.2.4**: Create a SOC2 readiness dashboard page showing pass/fail per Trust Service Criterion.
- **FR-2.2.5**: Export SOC2 evidence package as PDF/JSON for auditor delivery.
- **FR-2.2.6**: Track control ownership (assigned team member per control).
- **FR-2.2.7**: Record remediation plans for failing controls with due dates.
- **FR-2.2.8**: Auto-collect evidence from existing tables: audit logs, RBAC configs, encryption settings, uptime records, vulnerability scans.

### 2.3 SCIM Provisioning

- **FR-2.3.1**: Implement SCIM 2.0 `/scim/v2/Users` endpoint (GET list, GET by id, POST create, PUT replace, PATCH update, DELETE deactivate).
- **FR-2.3.2**: Implement SCIM 2.0 `/scim/v2/Groups` endpoint (GET list, GET by id, POST create, PUT replace, PATCH update, DELETE).
- **FR-2.3.3**: Support SCIM filtering: `filter=userName eq "user@example.com"`.
- **FR-2.3.4**: Support SCIM pagination: `startIndex`, `count`, `totalResults`.
- **FR-2.3.5**: Map SCIM Users to `orgMembers` (create/update/deactivate org membership).
- **FR-2.3.6**: Map SCIM Groups to roles (admin, security, developer, viewer).
- **FR-2.3.7**: Authenticate SCIM requests via Bearer token (org-scoped SCIM token stored in `ssoConfigs`).
- **FR-2.3.8**: Support soft-delete: SCIM DELETE sets `orgMembers.status = 'removed'`, does not delete user.
- **FR-2.3.9**: Emit audit log entries for all SCIM provisioning actions.
- **FR-2.3.10**: Rate limit SCIM endpoints (100 req/min per org).

### 2.4 Multi-Region Deployment

- **FR-2.4.1**: Deploy API Worker to EU-West and US-East Cloudflare locations using `wrangler.toml` route configuration.
- **FR-2.4.2**: Use existing `dataResidencyConfigs` table to route org requests to the correct region.
- **FR-2.4.3**: Add region header `X-Region` to all API responses indicating serving region.
- **FR-2.4.4**: Deploy D1 database replicas (read replicas) in EU and US regions.
- **FR-2.4.5**: Route write operations to primary D1 instance; reads to nearest replica.
- **FR-2.4.6**: Add region selector to organization settings page.
- **FR-2.4.7**: Validate that agent compute (Hetzner) region matches org data residency config.

### 2.5 SLA Monitoring Dashboard

- **FR-2.5.1**: Aggregate `uptimeRecords` into hourly/daily/monthly uptime percentages.
- **FR-2.5.2**: Display SLA compliance status per org against configured `slaConfigs.targetUptime`.
- **FR-2.5.3**: Show incident timeline with downtime periods highlighted.
- **FR-2.5.4**: Calculate Mean Time To Recovery (MTTR) from incident data.
- **FR-2.5.5**: Show response time P50/P95/P99 percentiles from `uptimeRecords.responseTimeMs`.
- **FR-2.5.6**: Alert on SLA breach (uptime drops below target) via existing alert channels.
- **FR-2.5.7**: Export SLA report as PDF for customer delivery.
- **FR-2.5.8**: Admin view: global SLA dashboard across all orgs.

### 2.6 Series A Data Room

- **FR-2.6.1**: Create admin-only `/api/admin/data-room` endpoints for investor metrics.
- **FR-2.6.2**: MRR chart: aggregate subscription revenue from LemonSqueezy data by month.
- **FR-2.6.3**: Customer count: total orgs, paying orgs, enterprise orgs, churned orgs.
- **FR-2.6.4**: NRR (Net Revenue Retention): expansion vs contraction vs churn.
- **FR-2.6.5**: CAC/LTV calculation from sign-up source tracking + subscription duration.
- **FR-2.6.6**: Product usage metrics: active agents, total agent-hours, findings generated.
- **FR-2.6.7**: Security posture metrics: avg OASF score across all orgs, SOC2 readiness %.
- **FR-2.6.8**: Export data room as JSON bundle for investor portal upload.

## 3. Non-Functional Requirements

- **NFR-3.1**: OpenAPI spec generation adds zero runtime overhead (build-time only).
- **NFR-3.2**: SCIM endpoints respond in under 200ms for single-user operations.
- **NFR-3.3**: Multi-region failover: if primary region is unavailable, requests route to secondary within 30s.
- **NFR-3.4**: SLA dashboard loads in under 2s for 90-day aggregation window.
- **NFR-3.5**: SOC2 evidence export completes in under 10s.
- **NFR-3.6**: All new endpoints have 100% test coverage for critical paths, 90%+ overall.
- **NFR-3.7**: Maximum 200 lines per source file.
- **NFR-3.8**: All SCIM operations are idempotent.

## 4. New Permissions

| Permission | Roles with access |
|---|---|
| `scim.read` | owner, admin |
| `scim.write` | owner, admin |
| `sla.view` | owner, admin, security, developer, viewer |
| `sla.export` | owner, admin, security |
| `dataroom.view` | owner (admin-only routes) |

## 5. New Database Tables

- `soc2_control_mappings` - OASF control to SOC2 TSC mapping
- `soc2_evidence_snapshots` - Point-in-time evidence collection for auditor
- `soc2_remediation_plans` - Remediation tracking for failing controls
- `scim_tokens` - Per-org SCIM bearer tokens
- `scim_sync_logs` - Audit trail for SCIM operations
- `sla_reports` - Generated SLA compliance reports
- `dataroom_snapshots` - Cached investor metric snapshots

## 6. Dependencies

- Existing OASF assessment system (Sprint 26)
- Existing uptime/SLA config tables (Sprint 10)
- Existing RBAC and org membership system (Sprint 8)
- Existing SSO configuration (Sprint 9)
- Existing data residency config (Sprint 10)
- Existing audit logging infrastructure

## 7. Out of Scope

- SOC2 Type 2 (requires 6-month observation period -- this sprint sets up Type 1 only)
- Custom domain per region (deferred to post-Series A)
- SCIM for TokenForge tenants (OpenSyber orgs only)
- Automated investor portal hosting (manual upload from JSON export)

## 8. Success Gates

- [ ] OpenAPI spec published at `api.opensyber.cloud/openapi.json`
- [ ] SOC2 Type 1 audit started (auditor engaged)
- [ ] SCIM provisioning tested with Okta and Azure AD
- [ ] Multi-region deployment verified (EU-West + US-East)
- [ ] SLA dashboard shows 30/60/90 day views
- [ ] Data room export generates complete investor package
- [ ] 10 paying enterprise customers
- [ ] $50K+ MRR
