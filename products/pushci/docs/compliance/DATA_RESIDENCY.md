# Data Residency & EU-Only Mode

**Version:** 1.0 — 2026-04-11
**License:** CC-BY-4.0
**Audience:** Enterprise customers in regulated industries (energy,
financial services, healthcare) who require data to remain inside a
specified geographic boundary.

---

## TL;DR

- PushCI supports three data residency modes: **`global`** (default),
  **`eu`** (European Economic Area only), and **`us`** (United States
  only).
- The active mode is stored in a `RetentionPolicy` record in KV and can
  be read via `GET /api/compliance/retention-policy`.
- **EU-only mode** pins Cloudflare D1, KV, R2, and Workers execution to
  EU data centres, uses EU-hosted subprocessors where available, and
  routes LLM calls through a European Anthropic endpoint when one is
  available (otherwise AI features are disabled in EU-only mode).
- Customer source code is **never stored** by PushCI — we only process
  metadata about pipeline runs. Source lives in the customer's own Git
  hosting (GitHub, GitLab, Bitbucket) or on their self-hosted runner.

---

## 1. Scope of "data"

For the purposes of this document, "data" means:

1. **Authentication data** — OAuth `sub`, login, refresh tokens (if any),
   JWT sessions.
2. **Project metadata** — project name, repo URL, webhook secrets
   (encrypted), role assignments.
3. **Pipeline metadata** — run id, commit SHA, branch, pass/fail status,
   timing, resource usage, step logs.
4. **Audit data** — the hash-chained `audit_logs` table.
5. **Billing data** — usage counters, plan, Lemon Squeezy customer id.
6. **AI call metadata** — prompt length, model, latency, cost (NOT the
   prompt content, unless the customer opts in to prompt logging).

Data that PushCI **does not process**:

- Your source code itself. PushCI reads pipeline definitions from your
  repo via the platform webhook; actual code execution happens either on
  a self-hosted runner you operate, or on a PushCI-managed ephemeral
  runner that is wiped after the job.
- Personal messages, emails, or anything not sent into a PushCI API.
- Contents of secret files — secrets are stored in the CLI vault
  encrypted with a machine-bound key, never transmitted to PushCI.

## 2. Where data lives in each mode

### 2.1 Global mode (default)

- **Compute:** Cloudflare Workers running on the nearest PoP to the
  caller.
- **D1:** primary database in the region closest to the project owner at
  project creation time, with automatic backups per Cloudflare SLA.
- **KV:** replicated globally for low-latency reads.
- **R2:** primary bucket in the region specified by Cloudflare defaults.
- **AI:** Anthropic endpoint in the US (until a European Anthropic region
  is generally available).
- **Billing:** Lemon Squeezy, processing in the US with EU data subprocessing in
  Ireland.

### 2.2 EU-only mode (`data_residency: "eu"`)

- **Compute:** Cloudflare Workers pinned to EU PoPs via a routing rule.
- **D1:** primary database in Frankfurt (`weur`) or Amsterdam; backups
  remain in the EEA.
- **KV:** EU-only read and write via namespace configuration.
- **R2:** EU jurisdictional location (`eu`).
- **AI:** **Disabled** unless an EU Anthropic endpoint is configured.
  AI feature flags are forced off, and calls return a 501 with
  `{ error: "ai_disabled_in_eu_mode" }` so the customer can plug in
  their own EU-hosted LLM gateway.
- **Billing:** Lemon Squeezy (merchant of record, US + EU VAT compliance) or, for customers that cannot use
  Lemon Squeezy at all, a manual invoicing path via the sales team.
- **Email:** Resend EU region.

In EU-only mode, PushCI will **refuse to write** any record outside the
EEA. If the infrastructure fails the region check at startup, the API
returns 503 with `{ error: "residency_violation" }` and pages on-call.

### 2.3 US-only mode (`data_residency: "us"`)

- **Compute:** Cloudflare Workers pinned to US PoPs.
- **D1/KV/R2:** US jurisdictional locations.
- **AI:** Anthropic US endpoint.
- **Billing:** Lemon Squeezy (US, with EU VAT compliance).
- **Email:** Resend US region.

## 3. Configuring residency

### 3.1 API

```
PUT /api/compliance/retention-policy
Content-Type: application/json
Authorization: Bearer <admin-JWT>

{
  "data_residency": "eu"
}
```

Only users with the platform-level `admin` role can modify the
residency setting. See `api/src/compliance.ts` `isPlatformAdmin`.

The update is recorded in `audit_logs` with action
`compliance.retention_policy.update` and is chained into the immutable
audit log.

### 3.2 Reading the current setting

```
GET /api/compliance/retention-policy
```

Returns the current `RetentionPolicy` including `data_residency`.

### 3.3 Environment variable override

For customers who cannot trust a KV-stored setting (e.g. because they
want a compile-time guarantee), PushCI offers a self-hosted deployment
where `PUSHCI_DATA_RESIDENCY` is set at deploy time and **cannot** be
changed via the API.

## 4. Subprocessor residency summary

| Subprocessor | Default region | EU-only mode              | Notes                                                          |
|--------------|----------------|---------------------------|----------------------------------------------------------------|
| Cloudflare   | Global         | EU (Frankfurt/Amsterdam)  | SOC 2 / ISO 27001 / PCI certified.                             |
| Lemon Squeezy | US            | EU VAT compliance via MoR | Merchant-of-record model; EU buyers get compliant invoices.    |
| Resend       | US             | EU                        | Email only; customer may supply their own SMTP.                |
| Anthropic    | US             | **Disabled** (until EU)   | AI features disabled in EU-only mode if no EU endpoint.        |
| GitHub       | US             | N/A                       | OAuth only; data never leaves the OAuth provider.              |
| GitLab       | US             | N/A                       | OAuth only.                                                    |
| Bitbucket    | US/AU          | N/A                       | OAuth only.                                                    |
| PagerDuty    | US             | Internal only             | No customer data sent.                                         |

## 5. Logging, metrics, and telemetry

### 5.1 Pipeline logs
Pipeline step output is stored in D1 (metadata) + R2 (blob). In EU-only
mode, both are pinned to the EEA. Retention defaults to **90 days** and
is configurable via `RetentionPolicy.pipeline_log_days`.

### 5.2 Metrics
Aggregated metrics (runs per day, failure rate, DORA) are stored in D1
and retained for **365 days** by default. Fully anonymised.

### 5.3 Error telemetry
PushCI does **not** send error telemetry to third-party services. All
errors are logged to Cloudflare's own logging, which respects the
residency setting.

## 6. Data subject rights in each mode

Data subject rights (export, erasure) are available in all residency
modes and are served by the same API endpoints. See
[`GDPR_DPA.md`](./GDPR_DPA.md) Section 9.

## 7. Self-hosted deployment

Customers whose regulatory regime requires on-premise operation can run
PushCI entirely inside their own perimeter. In this configuration:

- The API runs as a Docker container or Kubernetes deployment on
  customer infrastructure.
- The database is any SQLite-compatible store the customer chooses
  (SQLite directly, libSQL, or D1 in self-hosted Cloudflare).
- Runners are always customer-operated.
- No data ever leaves the customer's perimeter.
- AI features are pluggable via `AGENT_CORE_URL` pointing at a
  customer-hosted model.

Self-hosted deployments **automatically** force `data_residency` to
`eu` (or whatever is configured at deploy time) and expose
`/api/compliance/retention-policy` as read-only.

## 8. Verifying residency

Customers can verify residency in three ways:

1. **API response header:** every response includes an `X-Cf-Colo`
   header identifying the Cloudflare PoP that served the request. In
   EU-only mode this will always be an EU PoP.
2. **Evidence pack:** `GET /api/compliance/soc2/evidence` includes the
   current `RetentionPolicy` inline and is signed with HMAC-SHA-256.
3. **Audit log inspection:** policy changes are chained into
   `audit_logs` and detectable via
   `verifyAuditChain(db, fromId, toId)`.

## 9. Change process

Residency changes are disruptive — they require data migration from one
Cloudflare jurisdiction to another. The process is:

1. Customer opens a support ticket requesting a change.
2. PushCI schedules a maintenance window.
3. `PUT /api/compliance/retention-policy` is called with the new mode.
4. A migration job copies D1 + R2 data to the new jurisdiction.
5. Old records are securely deleted after a 7-day grace period.
6. An audit event `compliance.residency_migration` is appended to the
   immutable audit log.

## 10. Frequently asked questions

**Does EU-only mode guarantee GDPR compliance?**
No single technical feature "guarantees GDPR compliance." Residency is a
necessary but not sufficient condition — the full picture requires a
signed DPA, documented processing activities, and a legal basis. See
[`GDPR_DPA.md`](./GDPR_DPA.md).

**Can I pick a sub-region (e.g. "Germany only")?**
Cloudflare does not currently offer country-level pinning inside the
EEA. If you have a specific country mandate, open a support ticket and
we'll discuss a self-hosted deployment.

**What about Schrems II?**
International transfers outside the EEA rely on the **EU Standard
Contractual Clauses** and, where applicable, supplementary technical
measures (encryption in transit + at rest, pseudonymisation). In
EU-only mode, no regular transfers outside the EEA occur.

**Can I audit where my data actually is?**
Yes — `GET /api/compliance/retention-policy` returns the active
`data_residency` setting, and the Cloudflare PoP ID is on every
response header. We will also, on request, provide Cloudflare's own
data-location confirmation for your tenant.
