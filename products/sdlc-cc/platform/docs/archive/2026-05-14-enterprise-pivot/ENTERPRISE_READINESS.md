# Enterprise Readiness (SSO, SCIM, RBAC, SOC2/ISO)

This document outlines enterprise features and compliance readiness for the SDLC platform. It aligns with [SPRINTS_PLAN.md](./SPRINTS_PLAN.md) (S13–S16, 2026) and [compliance-platform/](../compliance-platform/).

## SSO (SAML 2.0 / OIDC)

**Goal:** Enterprise customers can sign in with their identity provider (IdP).

**Planned:**

- **SAML 2.0:** SP metadata endpoint, ACS endpoint, attribute mapping. Gateway and Admin UI accept SAML assertions for tenant admins.
- **OIDC:** Optional OIDC provider support for tenants that prefer OAuth2/OIDC over SAML.

**Where:** Sprint S14 (Enterprise features). Implement in Gateway and Admin UI; reuse Clerk or a dedicated SSO package for SP-side logic. Document IdP configuration (e.g. Azure AD, Okta) in runbooks.

**References:** [SPRINTS_PLAN.md](./SPRINTS_PLAN.md) S14, [compliance-platform/](../compliance-platform/) for policy context.

---

## SCIM

**Goal:** Provision and deprovision users and groups from the enterprise IdP via SCIM 2.0.

**Planned:**

- SCIM 2.0 API (users, groups) in Gateway or a dedicated user-sync service.
- Map IdP groups to platform roles/tenants for RBAC.

**Where:** S14. Often implemented after SSO so that the same IdP drives both auth and provisioning.

---

## RBAC and team management

**Goal:** Role-based access (e.g. admin, developer, viewer) and team/tenant hierarchy.

**Planned:**

- Roles and permissions model in Gateway (and optionally LLM Gateway) with OPA or in-process checks.
- Admin UI: team management, role assignment, invite flows.
- API keys and usage scoped by tenant and role.

**Where:** S14. Gateway already has policy and audit; extend policy engine for role checks and wire Admin UI.

---

## SOC 2 readiness

**Goal:** SOC 2 Type I/II in progress; controls and evidence documented.

**Planned:**

- **S13:** Controls documentation, policies, multi-region/backups, DR runbook (see [deploy/DEPLOYMENT_GUIDE.md](../deploy/DEPLOYMENT_GUIDE.md) and [PRODUCTION_READINESS.md](../PRODUCTION_READINESS.md)).
- **S16:** SOC 2 Type I in progress; HIPAA BAA; GDPR DPA template.
- **2026 Q2:** SOC 2 Type II; ISO 27001 roadmap.

**References:** [SPRINTS_PLAN.md](./SPRINTS_PLAN.md) S13, S16; [compliance-platform/](../compliance-platform/) (policies, audit logger, policy evaluator).

---

## HIPAA and GDPR

**Goal:** Support HIPAA BAA and GDPR DPA for relevant customers.

**Planned:**

- DPA template and security questionnaire (see [security page](https://sdlc.cc/security) and `/security`).
- HIPAA-oriented controls: encryption, access logging, minimal retention, BAA template.
- GDPR: data subject requests process, DPA, and privacy-by-design in DLP and audit.

**References:** [compliance-platform/policies/](../compliance-platform/policies/) (e.g. hipaa.json, gdpr.json); S16.

---

## Summary

| Area        | Sprint / timeline | Status   |
|------------|-------------------|----------|
| SSO (SAML/OIDC) | S14               | Planned  |
| SCIM       | S14               | Planned  |
| RBAC / teams | S14             | Planned  |
| SOC 2 prep | S13, S16          | In progress (runbooks, controls) |
| SOC 2 Type II / ISO | 2026 Q2     | Roadmap  |
| HIPAA / GDPR | S16, DPA/BAA    | Template and controls roadmap |

Implement in this order for enterprise pilots: (1) SOC2 prep and runbooks, (2) SSO, (3) RBAC and team management, (4) SCIM, (5) formal certifications and DPA/BAA.
