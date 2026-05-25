# Sprint 27: Marketplace + Skill Ecosystem -- Requirements Document

**Scope**: OpenSyber / Sprint 27 Marketplace + Skill Ecosystem
**Generated**: 2026-03-07
**Agent**: Requirements Analyzer Agent
**Timeline**: July--August 2026 (2 weeks)

---

## 1. Executive Summary

Sprint 27 transforms OpenSyber from a closed platform into an extensible ecosystem.
Third-party developers can build, package, publish, and monetize AI agent monitoring
skills through a marketplace. The Skill SDK defines the extension API contract. The
`.opensyber-skill` package format standardizes distribution. Revenue sharing (70/30)
incentivizes external contributors.

### Success Gates

- [ ] Marketplace live with 3 first-party skills
- [ ] 1 external developer publishes a skill
- [ ] 1 enterprise customer requests a custom skill via marketplace

---

## 2. Functional Requirements

### 2.1 Skill SDK (`@opensyber/skill-sdk`)

**FR-SDK-01**: The SDK MUST export `SkillProfile`, `SkillContext`, and `SkillEmitter`
TypeScript interfaces as the extension API contract.

**FR-SDK-02**: `SkillProfile` MUST define: id, name, version (semver), description,
author, category, tier (`free` | `pro` | `team` | `enterprise`), targets, required
permissions, config schema (Zod), outputs, widgets, schedule, and a `run()` entry point.

**FR-SDK-03**: `SkillContext` MUST provide: orgId, instanceId, validated config,
resolved targets, emit (SkillEmitter), structured logger, vault client, and
rate-limited HTTP client.

**FR-SDK-04**: `SkillEmitter` MUST support typed emit methods: `finding()`,
`saasFinding()`, `riskDelta()`, `attackEdge()`, `complianceEvidence()`, and
`remediationSuggestion()`.

**FR-SDK-05**: The SDK MUST export a `defineSkill()` helper function that validates
the SkillProfile at compile time and returns a typed skill definition.

**FR-SDK-06**: The SDK MUST export a `MockSkillContext` for unit testing skills
without requiring the platform runtime.

**FR-SDK-07**: The SDK MUST export a `LocalSkillRunner` that can execute a skill
locally for development and testing.

### 2.2 Skill Packaging (`.opensyber-skill` Format)

**FR-PKG-01**: A `.opensyber-skill` package MUST be a gzipped tarball containing:
`manifest.json`, compiled JavaScript bundle, and optional `README.md`.

**FR-PKG-02**: `manifest.json` MUST contain the serialized `SkillProfile` (minus
the `run` function), a SHA-256 hash of the bundle, and a `bundleEntry` field pointing
to the main JS file.

**FR-PKG-03**: The platform MUST validate package integrity (SHA-256 hash match),
manifest schema, and required permissions before accepting a submission.

**FR-PKG-04**: Package size MUST NOT exceed 10MB compressed.

**FR-PKG-05**: The CLI command `opensyber-skill pack` MUST produce a valid
`.opensyber-skill` file from a skill project directory.

**FR-PKG-06**: The CLI command `opensyber-skill validate` MUST check manifest schema,
permission declarations, output specs, and bundle integrity without uploading.

### 2.3 Marketplace API

**FR-MKT-01**: `GET /api/marketplace` -- Browse all published skills with filtering
by category, tier, author, and search query. Paginated with cursor-based pagination.

**FR-MKT-02**: `GET /api/marketplace/:id` -- Skill detail including description,
author, version history, install count, rating, screenshots, and related skills.

**FR-MKT-03**: `POST /api/marketplace/:id/install` -- Install a skill to the org.
MUST check plan tier eligibility, required permissions, and plan skill limits.

**FR-MKT-04**: `DELETE /api/marketplace/:id/install` -- Uninstall a skill from the org.
MUST stop any running skill instances and clean up scheduled jobs.

**FR-MKT-05**: `POST /api/marketplace/:id/rate` -- Submit a 1-5 star rating.
One rating per org per skill. Updates are allowed (replaces previous rating).

**FR-MKT-06**: `POST /api/marketplace/publish` -- Submit a new skill package.
Upload `.opensyber-skill` to R2, create marketplace_submissions record, trigger
automated security scan.

**FR-MKT-07**: `GET /api/marketplace/my-skills` -- List skills published by the
authenticated user.

**FR-MKT-08**: `PATCH /api/marketplace/my-skills/:id` -- Update skill metadata
(description, screenshots). Version updates require a new package upload.

**FR-MKT-09**: `POST /api/marketplace/my-skills/:id/versions` -- Publish a new
version of an existing skill. Requires a new `.opensyber-skill` package.

### 2.4 Marketplace UI

**FR-UI-01**: Marketplace browse page with search bar, category filters, tier filters,
sort options (popular, newest, rating), and grid layout of skill cards.

**FR-UI-02**: Skill detail page with: name, icon, description, author, version,
install count, rating stars, screenshots/demo, "Install" button, related skills.

**FR-UI-03**: "My Skills" publisher dashboard showing published skills, submission
status, download counts, ratings, and revenue earned.

**FR-UI-04**: Skill publish wizard: multi-step form (upload package, preview manifest,
confirm permissions, set pricing, submit for review).

**FR-UI-05**: Installed skills management page: list installed skills per org,
enable/disable toggle, configuration panel, uninstall button.

**FR-UI-06**: Empty states with clear CTAs ("No skills installed yet -- Browse Marketplace").

### 2.5 Revenue Sharing

**FR-REV-01**: Skill publishers MAY set a price (monthly subscription) for their skill.
Free skills (price = 0) are always allowed.

**FR-REV-02**: Revenue split: 70% to publisher, 30% to OpenSyber.

**FR-REV-03**: Paid skill installs MUST go through LemonSqueezy checkout.

**FR-REV-04**: Publisher revenue dashboard showing total installs, active subscribers,
total revenue, and payout history.

**FR-REV-05**: Minimum payout threshold: $50. Monthly payout cycle.

### 2.6 Skill Runtime

**FR-RUN-01**: Skills MUST execute within a sandboxed environment with resource limits:
CPU 0.5 core, RAM 512MB, 5-minute execution timeout.

**FR-RUN-02**: Skill outputs MUST be validated against the declared output specs
before persisting to the database.

**FR-RUN-03**: Skills with `schedule: { cron }` MUST be registered with the platform
scheduler and executed on the defined cadence.

**FR-RUN-04**: Skills with `schedule: { trigger: 'event' }` MUST be triggered by
the matching platform event (e.g., `finding.created`).

**FR-RUN-05**: Skill execution logs MUST be persisted and viewable by the org admin.

**FR-RUN-06**: Failed skill executions MUST be retried up to 3 times with exponential
backoff, then marked as failed with an alert to the org.

### 2.7 Security Review Pipeline

**FR-SEC-01**: All submitted skills MUST pass automated static analysis before
entering the review queue.

**FR-SEC-02**: Static analysis MUST check for: network calls to unauthorized domains,
file system access outside sandbox, credential extraction patterns, and known
malicious code signatures.

**FR-SEC-03**: Skills from verified publishers ("OpenSyber Certified") MUST receive
a trust badge and featured placement.

**FR-SEC-04**: Admin moderation queue for reviewing pending skill submissions.

### 2.8 First-Party Skills

**FR-FP-01**: `cursor-monitor` skill: Cursor-specific telemetry (file edits, AI
completions, context windows). Category: `agent_monitor`. Tier: `pro`.

**FR-FP-02**: `secret-vault-bridge` skill: Connect agent activity to HashiCorp Vault
or AWS Secrets Manager. Category: `integration`. Tier: `team`.

**FR-FP-03**: `siem-forwarder` skill: Stream agent events to Splunk, Datadog, or
Elastic. Category: `integration`. Tier: `team`.

---

## 3. Non-Functional Requirements

**NFR-01**: Marketplace search MUST return results in under 200ms.

**NFR-02**: Skill package upload MUST complete within 30 seconds for packages up to 10MB.

**NFR-03**: Skill install/uninstall MUST complete within 5 seconds.

**NFR-04**: All marketplace API routes MUST enforce RBAC via `requirePermission()`.

**NFR-05**: All API inputs MUST be validated with Zod schemas.

**NFR-06**: Every new source file MUST have a corresponding test file with minimum
80% line coverage.

**NFR-07**: Source files MUST NOT exceed 200 lines.

**NFR-08**: UI MUST follow Apple HIG design principles (dark theme, neutral-900
backgrounds, 8px grid, typography hierarchy).

**NFR-09**: Marketplace MUST be accessible at 375px, 768px, and 1440px breakpoints.

---

## 4. New Permissions Required

| Permission | Description | Roles |
|---|---|---|
| `marketplace.browse` | Browse and search marketplace | all roles |
| `marketplace.install` | Install/uninstall skills | developer+ |
| `marketplace.publish` | Submit skills to marketplace | developer+ |
| `marketplace.admin` | Approve/reject submissions | admin, owner |

---

## 5. Plan Tier Integration

| Feature | Free | Pro | Team | Enterprise |
|---|---|---|---|---|
| Browse marketplace | yes | yes | yes | yes |
| Install free skills | 3 max | 10 max | unlimited | unlimited |
| Install paid skills | no | yes | yes | yes |
| Publish skills | no | yes | yes | yes |
| Revenue dashboard | no | yes | yes | yes |
| Custom skill request | no | no | no | yes |

---

## 6. Dependencies

- Sprint 11b Skill SDK types (designed, not yet implemented)
- Sprint 19 marketplace schema (designed, partially implemented)
- Existing `skills` table and `skillInstallations` table (Sprint 2)
- R2 bucket for package storage (already provisioned as `STORAGE`)
- LemonSqueezy integration (existing for plan subscriptions)
- RBAC middleware (Sprint 8, production)
- Plan enforcement middleware (Sprint 24, production)

---

## 7. Out of Scope

- White-label marketplace for MSSPs (Sprint 28+)
- Agent blueprints (deferred to Sprint 28)
- Webhook event system for marketplace events (Sprint 28)
- GraphQL API for marketplace (REST only)
- Skill sandboxing via Hetzner VMs (use Worker-level isolation initially)
