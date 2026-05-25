# Qestro Production and Market Readiness Plan

Date: 2026-05-08
Owner: Product and Engineering
Target state: Qestro is safe to use inside a company, credible to market publicly, and backed by real production systems instead of demo-only behavior.

## Executive Summary

Qestro is not ready for broad public marketing yet. It is suitable for a controlled internal pilot after production deployment parity is restored and access is restricted. The current priority is to turn the visible product into a trustworthy production system: deployed backend routes, durable data, verified auth, safe API execution, real provider integrations, reliable production tests, observability, and clear launch positioning.

The immediate release goal is not "add more screens." The release goal is to make the existing product honest, durable, secure, testable, and supportable.

## Current Verified State

### Working

- Production site responds at `https://qestro.app`.
- Production API health responds at `https://api.qestro.app/api/health`.
- Production API health also responds at `https://api.qestro.io/api/health`.
- Local frontend exposes the API Studio UI at `http://127.0.0.1:3000/api-studio`.
- Recent code includes API Studio, Cloud Devices, paid GitHub repository scan gating, app shell wiring, and frontend flows.

### Not Production Ready

- Latest API Studio and Cloud Devices endpoints are not live in production:
  - `GET /api/api-testing/collections` returned `404`.
  - `POST /api/api-testing/execute` returned `404`.
  - `GET /api/devices` returned `404`.
- `app.qestro.app` does not resolve.
- `api.qestro.ai` does not resolve, while deployment scripts still reference it.
- API Studio and Cloud Devices backend routes use process memory/demo data in current code.
- Some route auth logic decodes JWT payloads without strong verification and falls back to demo users.
- Frontend services silently fall back to mock data when backend calls fail.
- Production E2E coverage is not a strong release gate yet.
- Deployment configuration is fragmented across Cloudflare, qestro.app/qestro.io/qestro.ai naming, and AWS/EKS workflow artifacts.

## Launch Decision

### Approved Position

Use this language until the hardening work is done:

> Qestro is in private company pilot for AI-assisted QA, API testing, repo scanning, and product-to-test workflow automation.

### Do Not Claim Yet

- Do not claim full public production availability.
- Do not claim real cloud device provider execution until provider APIs are integrated.
- Do not claim enterprise security readiness until auth, tenant isolation, audit logging, and secrets handling are verified.
- Do not claim TablePlus/Tableau-level maturity until persistence, collaboration, governance, and reliability gates are met.

## Release Gates

The product can move from internal pilot to market launch only when every P0 and P1 gate below is complete.

### P0 Gates: Required Before Internal Company Use

- [ ] Production frontend and backend deploy from the same release branch and commit.
- [ ] `https://api.qestro.app/api/api-testing/collections` works in production.
- [ ] `https://api.qestro.app/api/api-testing/execute` works in production with SSRF protection.
- [ ] `https://api.qestro.app/api/devices` works or is hidden behind a beta/off feature flag.
- [ ] API Studio data persists in a real datastore.
- [ ] Cloud Devices does not return fake provider/device state in production.
- [ ] Production frontend does not silently fall back to mock data.
- [ ] Auth is verified server-side for all paid and tenant-scoped routes.
- [ ] Paid GitHub repository scan enforcement is server-side.
- [ ] Production smoke tests pass from CI.
- [ ] Rollback path is documented and tested.
- [ ] Support email, incident owner, and basic runbook exist.

### P1 Gates: Required Before Public Marketing

- [ ] Domain strategy is finalized and DNS is clean.
- [ ] Deployment pipeline is single-source and reproducible.
- [ ] Tenant isolation is tested.
- [ ] API execution has rate limits, timeouts, max response size, private network blocking, and audit logs.
- [ ] Secrets are encrypted at rest and redacted from logs/UI.
- [ ] Error tracking and uptime monitoring are active.
- [ ] Backups and restore procedure are verified.
- [ ] Production E2E tests cover login, API Studio, repo scan, paid gating, and critical navigation.
- [ ] Security review is complete.
- [ ] Privacy policy, terms, security page, and company onboarding docs exist.
- [ ] Pricing/paywall behavior is verified end to end.
- [ ] A pilot feedback loop exists for product managers, business analysts, QA, and developers.

### P2 Gates: Required Before Enterprise Sales

- [ ] SSO/SAML/OIDC is production ready.
- [ ] Role-based access control supports admin, developer, QA, PM, BA, and viewer roles.
- [ ] Audit log export is available.
- [ ] Workspace-level data retention controls exist.
- [ ] Admin billing and seat management exist.
- [ ] SOC 2 readiness gap assessment is complete.
- [ ] Vendor security questionnaire package is prepared.

## Workstream 1: Production Deployment Parity

### Problem

Production health is live, but the newest product routes are not live. The UI and production API are not aligned.

### Tasks

1. Pick canonical production domains:
   - App: `https://qestro.app`
   - API: `https://api.qestro.app`
   - Optional marketing: `https://www.qestro.app`
2. Remove or update stale `qestro.ai` and unresolved `app.qestro.app` references.
3. Decide final hosting path:
   - Preferred short-term: Cloudflare Pages + Workers.
   - Alternative: AWS/EKS only if there is a clear operational reason.
4. Align deployment scripts and GitHub Actions to one path.
5. Deploy latest backend commit to staging.
6. Verify staging endpoint parity.
7. Promote the same artifact/commit to production.
8. Add a production endpoint contract check.

### Acceptance Criteria

- [ ] `GET /api/health` returns healthy.
- [ ] `GET /api/api-testing/collections` returns authenticated data or `401`, not `404`.
- [ ] `POST /api/api-testing/execute` returns a real execution result or a controlled validation error.
- [ ] `GET /api/devices` returns real provider/device state or a feature-disabled response.
- [ ] CI records the deployed commit SHA.
- [ ] Rollback command is documented and tested.

## Workstream 2: API Studio Production Backend

### Problem

Current API Studio behavior is useful for a demo but not durable enough for company use.

### Tasks

1. Design datastore tables:
   - `api_collections`
   - `api_requests`
   - `api_environments`
   - `api_execution_history`
   - `api_secrets`
   - `audit_events`
2. Add migrations.
3. Replace process memory Maps with repository/service layer storage.
4. Scope all records by `tenant_id` and `user_id`.
5. Add CRUD endpoints with validation.
6. Add import/export for OpenAPI/Postman-compatible collections.
7. Add optimistic UI updates with real backend confirmation.
8. Add execution history retention policy.

### Acceptance Criteria

- [ ] Collections persist after Worker restart/redeploy.
- [ ] Users cannot read another tenant's collections.
- [ ] Failed backend calls show real errors, not mock data.
- [ ] API execution history is queryable and scoped by tenant.
- [ ] Unit and integration tests cover CRUD, validation, auth, and tenant isolation.

## Workstream 3: Safe API Execution

### Problem

An API testing tool that fetches arbitrary URLs can become a server-side request forgery vector if it is not tightly controlled.

### Tasks

1. Block private, loopback, link-local, multicast, and metadata IP ranges.
2. Resolve DNS before execution and validate resolved IPs.
3. Revalidate redirects and block unsafe redirect targets.
4. Enforce protocol allowlist: `https` preferred, `http` configurable for internal pilot only.
5. Add per-user and per-tenant rate limits.
6. Add request timeout.
7. Add max request body size.
8. Add max response size.
9. Redact secrets from logs, traces, UI, and stored execution history.
10. Add audit events for every execution.
11. Add admin kill switch.

### Acceptance Criteria

- [ ] Requests to `127.0.0.1`, `localhost`, `169.254.169.254`, RFC1918 ranges, and internal hostnames are blocked.
- [ ] Redirects to blocked targets are blocked.
- [ ] Oversized responses are truncated safely.
- [ ] Secrets never appear in logs or execution history.
- [ ] Abuse attempts produce audit events.

## Workstream 4: Cloud Devices Reality Check

### Problem

Cloud Devices currently behaves like a product surface but does not yet prove real provider integration.

### Tasks

1. Decide first supported provider:
   - BrowserStack
   - Sauce Labs
   - LambdaTest
2. Add encrypted provider credential storage.
3. Validate credentials when a provider is configured.
4. Fetch real device/browser inventory from the provider API.
5. Implement reservation leases and cleanup.
6. Show provider health and capacity.
7. Add feature flag:
   - `cloud_devices_enabled`
   - `cloud_devices_beta`
8. Hide the feature in production until real integration passes tests.

### Acceptance Criteria

- [ ] Production does not show fake devices as real.
- [ ] Provider credentials are encrypted and never logged.
- [ ] Device inventory comes from provider API.
- [ ] Reservations expire and clean up.
- [ ] Feature can be disabled without redeploying frontend.

## Workstream 5: GitHub Repository Scan and AI Scenario Generation

### Product Goal

Let a user connect a GitHub repository, generate an AI prompt or scan job, inspect project structure, and produce test scenarios for developers, QA, PMs, and business analysts.

### Tasks

1. Confirm GitHub OAuth app permissions.
2. Store repository connection metadata by tenant.
3. Add branch selection.
4. Add scan modes:
   - Developer: code paths, API contracts, fixtures, edge cases.
   - QA: test scenarios, regression risk, coverage gaps.
   - PM: user journeys, acceptance criteria, release risks.
   - BA: business rules, process flows, compliance checks.
5. Add paid entitlement gate server-side.
6. Add scan job queue and status tracking.
7. Persist scan output.
8. Add prompt builder with editable context.
9. Add export formats:
   - Markdown
   - CSV
   - Jira/Linear-ready issue list
   - Playwright/Cypress scenario draft
10. Add usage limits and billing events.

### Acceptance Criteria

- [ ] Free users cannot run paid scans by calling the API directly.
- [ ] Paid users can connect GitHub and run scans.
- [ ] Scan output is reproducible from stored job metadata.
- [ ] PM/BA modes produce non-code business scenarios, not only developer tests.
- [ ] Large repositories do not block request/response lifecycle.

## Workstream 6: AI Capability Layer

### Product Goal

Qestro should support developers, product managers, business analysts, and QA users through role-aware AI workflows.

### Tasks

1. Define AI personas:
   - Developer
   - QA engineer
   - Product manager
   - Business analyst
   - Engineering manager
2. Add a shared prompt contract:
   - User role
   - Project context
   - Source artifacts
   - Risk tolerance
   - Output format
   - Traceability requirements
3. Add prompt templates for:
   - Generate test scenarios from repository
   - Generate API tests from OpenAPI/Postman
   - Turn product requirement into acceptance criteria
   - Turn acceptance criteria into test cases
   - Explain failing test to PM/BA
   - Create release risk summary
4. Add AI output review flow:
   - Draft
   - Reviewed
   - Accepted
   - Exported
5. Add cost controls and usage telemetry.
6. Add prompt/output audit logs.

### Acceptance Criteria

- [ ] AI outputs are tied to source context.
- [ ] Users can edit prompts before running.
- [ ] PM/BA users can generate useful scenarios without writing code.
- [ ] Developer users can export technical test drafts.
- [ ] Token usage and cost are visible internally.

## Workstream 7: Auth, Tenancy, and Paid Features

### Problem

Company usage requires trust boundaries. Paid features must be enforced in backend code, not just UI.

### Tasks

1. Verify JWT signatures on every protected route.
2. Remove demo-user fallback in production.
3. Add tenant middleware.
4. Add role middleware.
5. Add entitlement middleware.
6. Add paid feature IDs:
   - `github_repo_scan`
   - `api_studio_execution`
   - `cloud_devices`
   - `ai_scenario_generation`
7. Add tests for unauthorized access.
8. Add tests for cross-tenant access.

### Acceptance Criteria

- [ ] Invalid JWT is rejected.
- [ ] Missing JWT is rejected.
- [ ] Expired JWT is rejected.
- [ ] User from tenant A cannot read tenant B data.
- [ ] Free users cannot execute paid API routes.
- [ ] Production has no demo-user fallback.

## Workstream 8: Frontend Production Honesty

### Problem

Mock fallbacks make demos look smooth but hide production failures.

### Tasks

1. Disable mock fallback in production builds.
2. Add explicit degraded-state UI.
3. Add retry affordances.
4. Add trace IDs in user-visible error details.
5. Add telemetry events for failed API calls.
6. Add feature flags for beta modules.
7. Add route guards for paid features.
8. Add empty states that explain the real next action.

### Acceptance Criteria

- [ ] Production API failure does not show fake successful data.
- [ ] User sees a clear error state and request ID.
- [ ] Paid feature pages show upgrade/access state when entitlement is missing.
- [ ] Beta features can be hidden remotely.

## Workstream 9: Testing and Quality Gates

### Required Test Layers

1. Unit tests for services and route helpers.
2. Backend integration tests for API contracts.
3. Frontend component tests for critical states.
4. E2E tests for user workflows.
5. Production smoke tests against deployed URLs.
6. Security regression tests for SSRF and auth bypass.
7. Responsive UI tests for desktop, tablet, and mobile.

### Critical E2E Flows

- [ ] Login.
- [ ] Navigation shell loads.
- [ ] API Studio loads real collections.
- [ ] API Studio creates a collection.
- [ ] API Studio executes a safe request.
- [ ] Unsafe API execution is blocked.
- [ ] GitHub repository connection starts.
- [ ] Free user is blocked from paid repo scan.
- [ ] Paid user can run repo scan.
- [ ] PM persona generates business scenarios.
- [ ] BA persona generates rules/process scenarios.
- [ ] Developer persona exports test draft.
- [ ] Cloud Devices is either hidden or backed by real provider data.

### Acceptance Criteria

- [ ] `npm run build` passes.
- [ ] `npm test` passes.
- [ ] Backend test suite passes.
- [ ] Frontend test suite passes.
- [ ] E2E smoke suite passes in CI.
- [ ] Production smoke suite passes after deploy.
- [ ] Test report is attached to release notes.

## Workstream 10: Observability and Operations

### Tasks

1. Add uptime monitors:
   - Web app
   - API health
   - Auth flow
   - API Studio collections endpoint
   - API execution safe request
2. Add structured logs.
3. Add request IDs.
4. Add error tracking.
5. Add performance monitoring.
6. Add billing/entitlement event logs.
7. Add alert routing.
8. Add incident runbook.
9. Add backup and restore runbook.
10. Add deploy and rollback runbook.

### Acceptance Criteria

- [ ] Production errors are visible without SSH/local reproduction.
- [ ] A failed endpoint triggers an alert.
- [ ] Every user-facing error has a trace/request ID.
- [ ] Restore procedure is tested.
- [ ] Rollback procedure is tested.

## Workstream 11: Security and Compliance Baseline

### Tasks

1. Add security headers:
   - HSTS
   - CSP
   - X-Content-Type-Options
   - Referrer-Policy
   - Permissions-Policy
2. Add CORS allowlist.
3. Add CSRF protections where relevant.
4. Add input validation to all public routes.
5. Add rate limits.
6. Add dependency audit.
7. Add secrets inventory.
8. Add data classification.
9. Add audit log retention policy.
10. Add privacy/security docs.

### Acceptance Criteria

- [ ] Security headers pass baseline scan.
- [ ] CORS is not wildcard in production.
- [ ] Public routes have validation.
- [ ] Secrets are not committed or logged.
- [ ] Dependency audit has no unresolved critical issues.
- [ ] Privacy policy and terms are published before public marketing.

## Workstream 12: Product and Go-to-Market

### Positioning

Qestro should be positioned as:

> AI-native QA and product validation workspace for teams that want to turn repositories, APIs, product requirements, and user journeys into executable test intelligence.

### Target Users

- Developers: API tests, repo scans, generated technical test drafts.
- QA engineers: scenario generation, regression risk, execution tracking.
- Product managers: acceptance criteria, release risk, journey validation.
- Business analysts: business rule extraction, process coverage, compliance scenarios.
- Engineering leaders: coverage visibility and release confidence.

### Launch Assets

- [ ] Product one-liner.
- [ ] Landing page.
- [ ] Demo video.
- [ ] Internal pilot guide.
- [ ] Security overview.
- [ ] Pricing page.
- [ ] Paid feature matrix.
- [ ] FAQ.
- [ ] Support email.
- [ ] Status page.
- [ ] Changelog.
- [ ] Sample outputs for each persona.

### Acceptance Criteria

- [ ] Marketing claims match implemented production behavior.
- [ ] No page claims unsupported real integrations.
- [ ] PM/BA value is demonstrated with real examples.
- [ ] Paid feature boundaries are clear.
- [ ] Internal users can onboard without engineering help.

## 14-Day Execution Plan

### Days 1-2: Stabilize Production Path

- [ ] Freeze release branch.
- [ ] Clean dirty worktree or isolate release branch.
- [ ] Pick canonical domains.
- [ ] Remove stale deployment targets.
- [ ] Deploy latest backend to staging.
- [ ] Verify API route parity.

### Days 3-4: Auth and Entitlement Hardening

- [ ] Remove production demo-user fallback.
- [ ] Verify JWT signatures.
- [ ] Add tenant middleware.
- [ ] Add paid entitlement middleware.
- [ ] Add unauthorized/cross-tenant tests.

### Days 5-6: API Studio Persistence

- [ ] Add DB schema/migrations.
- [ ] Replace in-memory collections/environments/history.
- [ ] Add CRUD integration tests.
- [ ] Add production smoke checks.

### Days 7-8: Safe API Execution

- [ ] Add SSRF protections.
- [ ] Add rate limits/timeouts/size limits.
- [ ] Add secret redaction.
- [ ] Add audit events.
- [ ] Add security regression tests.

### Days 9-10: Repo Scan and AI Scenario Flow

- [ ] Verify paid GitHub repo scan backend enforcement.
- [ ] Add job persistence/status tracking.
- [ ] Add role-aware prompt modes.
- [ ] Add PM/BA scenario outputs.
- [ ] Add export formats.

### Days 11-12: Frontend Honesty and Responsive QA

- [ ] Disable production mock fallback.
- [ ] Add degraded states.
- [ ] Add trace IDs to errors.
- [ ] Test desktop/tablet/mobile layouts.
- [ ] Fix overlap and critical responsive issues.

### Days 13-14: Production QA and Pilot Launch

- [ ] Run full test suite.
- [ ] Run production smoke tests.
- [ ] Verify monitoring alerts.
- [ ] Create release notes.
- [ ] Publish internal pilot guide.
- [ ] Start pilot with 5-10 users.

## 30-Day Roadmap

### Week 1

Production route parity, domain cleanup, deployment pipeline, auth hardening.

### Week 2

Persistence, API execution safety, paid gating, production smoke suite.

### Week 3

GitHub repository scan maturity, AI persona workflows, PM/BA outputs, export formats.

### Week 4

Cloud provider integration, monitoring, onboarding, launch assets, internal pilot feedback, security review.

## Ownership Matrix

| Area | Owner | Backup | Priority |
| --- | --- | --- | --- |
| Deployment and DNS | Engineering | DevOps | P0 |
| Auth and tenancy | Backend | Security | P0 |
| API Studio persistence | Backend | Frontend | P0 |
| API execution safety | Backend | Security | P0 |
| Frontend production states | Frontend | Product | P0 |
| GitHub repo scan | Full stack | AI | P1 |
| AI persona workflows | AI/Product | Frontend | P1 |
| Cloud Devices | Backend | QA | P1 |
| Production tests | QA/Engineering | DevOps | P0 |
| Launch assets | Product/Marketing | Founder | P1 |
| Support and runbooks | Ops | Engineering | P1 |

## Risk Register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Frontend shows fake success because of mock fallback | High | Disable production mocks and add explicit degraded states |
| API execution SSRF exposure | Critical | Block private networks, validate DNS, add limits and audit logs |
| Paid feature bypass through direct API calls | High | Enforce entitlements server-side |
| Cross-tenant data exposure | Critical | Tenant middleware and integration tests |
| Production endpoints missing after deploy | High | Add endpoint contract smoke tests |
| Cloud Devices appears real but is demo data | High | Feature flag or real provider integration |
| Deployment scripts target unresolved domains | Medium | Canonical domain cleanup |
| No reliable production E2E gate | High | CI smoke suite with real deployed URLs |
| Unsupported marketing claims | Medium | Launch copy review against feature matrix |

## Launch Readiness Scorecard

Score each item from 0 to 2:

- 0: missing
- 1: partially done
- 2: production ready

| Category | Score | Required For Launch |
| --- | ---: | ---: |
| Production deployment parity | 0 | 2 |
| Domain/DNS clarity | 0 | 2 |
| Auth verification | 1 | 2 |
| Tenant isolation | 0 | 2 |
| Paid feature enforcement | 1 | 2 |
| API Studio persistence | 0 | 2 |
| Safe API execution | 0 | 2 |
| GitHub repo scan flow | 1 | 2 |
| AI PM/BA workflows | 1 | 2 |
| Cloud Devices real integration | 0 | 1 for beta, 2 for launch |
| Production E2E tests | 0 | 2 |
| Observability | 1 | 2 |
| Security baseline | 1 | 2 |
| Onboarding docs | 1 | 2 |
| Launch assets | 1 | 2 |

Current estimated score: 8/30.

Minimum internal pilot score: 20/30 with all P0 gates complete.
Minimum public marketing score: 26/30 with all P0 and P1 gates complete.

## Definition of Done

Qestro is ready to market when:

1. The production app and API run the same release.
2. Critical user flows work against real backend systems.
3. No production feature silently fakes backend success.
4. Paid capabilities are enforced server-side.
5. API execution cannot reach internal/private infrastructure.
6. User data is persisted, tenant-scoped, and recoverable.
7. Monitoring, alerts, and rollback exist.
8. Production smoke and E2E tests pass in CI.
9. Marketing claims match real shipped behavior.
10. Internal pilot users can complete core workflows without developer intervention.

## Immediate Next Engineering Tasks

1. Fix deployment target and ship latest backend routes to staging.
2. Add production smoke checks for API Studio and Cloud Devices endpoints.
3. Remove production mock fallbacks from API Studio and Cloud Device frontend services.
4. Replace API Studio in-memory storage with durable storage.
5. Add verified auth and entitlement middleware to paid routes.
6. Add SSRF protection to API execution.
7. Feature-flag Cloud Devices until provider integration is real.
8. Run full CI and production smoke suite.

