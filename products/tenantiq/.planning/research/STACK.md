# Technology Stack — TenantIQ Milestone 2

**Project:** TenantIQ — Enterprise SAML/OIDC SSO + Copilot Readiness + Storage Analytics + CI Hardening
**Researched:** 2026-04-22
**Scope:** Brownfield additions to existing Cloudflare Workers + Hono + D1 + SvelteKit 5 stack

---

## 1. Enterprise SAML / OIDC SSO

### Recommended Approach: WorkOS SDK (managed) or raw `jose` + custom SAML parser (self-hosted)

The choice is binary and driven by business model:

| Decision axis | WorkOS (managed) | Self-hosted (`jose` + XML parser) |
|---|---|---|
| Time to ship | 1-2 days | 2-3 weeks |
| Cost at 20 MSP orgs | ~$2,500/mo ($125/connection) | Infrastructure only |
| Cost at 100 MSP orgs | ~$12,500/mo | Infrastructure only |
| Maintenance burden | Zero | High (XML security surface) |
| SCIM directory sync | Included | Must build separately |
| IT admin self-serve portal | Included | Must build |

**Recommendation: WorkOS for MVP, with migration path to self-hosted if ARPU economics deteriorate.**

WorkOS at $125/connection/month is prohibitive once TenantIQ scales past ~15-20 enterprise orgs. At the MSP-first pricing model (per-skill, not per-user), the unit economics break. Plan WorkOS for the first 10-15 enterprise customers, then re-evaluate. The SDK is edge-compatible (fetch-based, no Node.js APIs).

**If self-hosted is chosen later, the stack is:**

### SAML Parsing on Workers (edge-safe)

**Critical constraint:** Cloudflare Workers cannot use Node.js `crypto`, `fs`, or native C bindings. XML parsing must use `@xmldom/xmldom` (pure JS) and signature verification must use the Web Crypto API (`SubtleCrypto`).

| Library | Version | Purpose | Workers compatible | Notes |
|---|---|---|---|---|
| `@workos-inc/node-sdk` | `^7.x` | Managed SAML + OIDC broker | YES (fetch-based) | Preferred path |
| `samlify` | `>=2.10.0` ONLY | Raw SAML 2.0 SP/IdP | PARTIAL — needs testing | **CVE-2025-47949**: versions <2.10.0 have critical signature wrapping bypass (CVSS 9.9). Never use <2.10.0. Edge compat unconfirmed — needs xmldom polyfill validation in miniflare. |
| `@xmldom/xmldom` | `^0.8.x` | XML DOM parser (pure JS) | YES | Required peer dep for any raw SAML work |
| `jose` | `^5.x` | OIDC JWT validation + JWKS | YES (built for Workers) | Already in project for custom JWT |

**SAML on Workers — known pain points:**

1. `samlify` uses `@xmldom/xmldom` internally but also pulls `xml-crypto` which historically required `node:crypto`. As of xml-crypto 3.x this is resolved via SubtleCrypto polyfill. Must verify with `wrangler dev` before committing.
2. Alternative: parse SAML at a thin Deno Deploy or Node.js sidecar, return a signed JWT to Workers. Avoids the XML problem entirely if edge-native proves unworkable.
3. WorkOS eliminates this entirely — their SDK issues standard OAuth 2.0 tokens that Workers verify with `jose`.

### OIDC Validation Pattern (Workers-native)

OIDC discovery + token validation is fully supported in Workers today via `jose`:

```typescript
import { createRemoteJWKSet, jwtVerify } from 'jose';

// One-time setup per IdP (cache the JWKS fetcher in module scope)
const JWKS = createRemoteJWKSet(
  new URL('https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys')
);

// Per-request validation
const { payload } = await jwtVerify(idToken, JWKS, {
  issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
  audience: env.AZURE_CLIENT_ID,
});
```

`createRemoteJWKSet` caches keys in-memory within the Worker isolate lifetime and re-fetches on cache miss. This is stateless, no D1 or KV required for JWKS caching. Confidence: HIGH (jose explicitly lists Cloudflare Workers as a supported runtime).

### JIT Provisioning Pattern

On first SAML/OIDC login from an enterprise IdP:
1. Extract `email`, `groups`, and `upn` from assertion/token claims
2. `INSERT OR IGNORE` into `users` D1 table scoped to the org
3. Assign role from group claim mapping (stored in `sso_configs` D1 table)
4. Issue TenantIQ JWT (existing `jose` HS256 path)

No new libraries needed for JIT — it is application logic over existing D1 + jose stack.

### SSO Config Storage

Add `sso_configs` table to D1:
- `org_id`, `provider` (okta/entra/generic-saml/oidc), `metadata_url` or `metadata_xml`, `attribute_mappings` (JSON), `jit_enabled`, `created_at`
- Metadata XML cached in KV with TTL 24h (avoid re-fetching on every login)

---

## 2. M365 Copilot Readiness Assessment

### API Surface (all v1.0 as of April 2026)

The Microsoft Graph Copilot readiness signal set is now stable. The beta Copilot usage report APIs reached GA in December 2025; beta endpoints retire March 31, 2026.

| Signal | Graph Endpoint | Permissions | Notes |
|---|---|---|---|
| Copilot license assignment | `GET /users?$select=assignedLicenses` | `User.Read.All` | Check for `M365CopilotEnterpriseUser` service plan |
| Copilot usage per user | `GET /reports/getMicrosoft365CopilotUsageUserDetail(period='D30')` | `Reports.Read.All` | **v1.0 GA Dec 2025** |
| Copilot agent/app inventory | `GET /admin/copilot/apps` | `CopilotAdminApp.Read.All` | GA mid-April 2026 (MC1173195) |
| Secure Score | `GET /security/secureScores` | `SecurityEvents.Read.All` | Existing in project |
| Conditional Access policies | `GET /identity/conditionalAccessPolicies` | `Policy.Read.All` | Existing |
| MFA registration details | `GET /reports/authenticationMethods/userRegistrationDetails` | `UserAuthenticationMethod.Read.All` | Key readiness signal |
| SharePoint/OneDrive quotas | `GET /sites/{siteId}/drive` | `Sites.Read.All` | Feeds storage analytics too |
| DLP policies | `GET /security/dataLossPreventionPolicies` | `InformationProtectionPolicy.Read.All` | Purview compliance signal |
| Sensitivity labels | `GET /security/informationProtection/sensitivityLabels` | `InformationProtectionPolicy.Read.All` | Copilot data governance readiness |

**No new npm packages required.** TenantIQ already wraps `@microsoft/microsoft-graph-client`. Copilot readiness is a new set of Graph calls + a scoring algorithm, not a new library.

**Scoring model reference:** Microsoft's open-source `m365-copilot-automated-readiness-assessment` (GitHub: `microsoft/m365-copilot-automated-readiness-assessment`) evaluates 200+ signals across licensing, identity, security, compliance, and governance. Use this as the ground-truth signal checklist, not as a dependency.

### Score Computation

Implement as a pure function in `packages/ai/src/copilot-readiness.ts`:
- Input: raw Graph API responses (licenses, policies, scores, usage)
- Output: `{ score: number, category: 'licensing'|'identity'|'security'|'compliance'|'governance', recommendations: Recommendation[] }`
- Store results in new `copilot_assessments` D1 table (org_id, tenant_id, score, details JSON, scanned_at)
- Cache in KV for 24h to avoid rate-limit pressure on large MSP orgs

---

## 3. Storage Analytics

### API Surface

| Signal | Graph Endpoint | Permissions |
|---|---|---|
| OneDrive per-user quota | `GET /users/{id}/drive` | `Files.Read.All` |
| SharePoint site storage | `GET /sites/{siteId}/drive` | `Sites.Read.All` |
| SharePoint all sites | `GET /sites?search=*` or `GET /admin/sharePoint/settings` | `Sites.Read.All` |
| Mailbox size | `GET /users/{id}/mailboxSettings` + Exchange stats | `MailboxSettings.Read` |

Same pattern as Copilot readiness — no new libraries. Aggregate per user + per site, compute utilization %, flag outliers, recommend deprovisioning for users >90 days inactive with high quota.

---

## 4. Playwright E2E Testing

### Current State

CI already runs `pnpm test:e2e:chromium` via `npx playwright install --with-deps chromium`. The infrastructure exists. What's missing is coverage breadth.

### Recommended Config

| Library | Version | Purpose | Notes |
|---|---|---|---|
| `@playwright/test` | `^1.52.x` (latest as of April 2026) | E2E test runner | Already in project |
| `@cloudflare/playwright` | `^0.0.x` (experimental) | Workers-side Playwright | Only needed if testing Worker endpoints directly; not needed for SvelteKit UI tests |

**Do NOT use `@cloudflare/playwright` for SvelteKit UI tests.** It requires `nodejs_compat` + `compatibility_date: 2025-09-15` and is scoped to Browser Rendering, not UI automation. Standard `@playwright/test` against a `wrangler pages dev` server is the correct pattern.

### Playwright Config for Cloudflare Pages + SvelteKit 5

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['github']],
  use: {
    baseURL: 'http://localhost:8788', // wrangler pages dev default port
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Build then serve via wrangler pages dev (real CF Pages runtime)
    command: 'pnpm build && wrangler pages dev .svelte-kit/cloudflare --port 8788',
    port: 8788,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

**Why `wrangler pages dev` not `vite preview`:** MSW and KV bindings behave differently under vite preview vs the actual CF Pages runtime. E2E tests should run against the real runtime to catch binding errors, D1 query failures, and middleware differences.

**Auth bypass for E2E:** Inject a signed test JWT via cookie in `test.beforeEach` using the test `JWT_SECRET` from `.dev.vars`. Do not mock the auth middleware — test the real path.

### Test Structure

```
tests/e2e/
├── fixtures/
│   ├── auth.ts          # JWT cookie injection helper
│   └── tenant.ts        # Seed/teardown test tenant in D1
├── flows/
│   ├── login.spec.ts
│   ├── cis-scan.spec.ts
│   ├── copilot-readiness.spec.ts
│   ├── sso-config.spec.ts
│   └── storage-analytics.spec.ts
└── smoke/
    └── page-load.spec.ts  # All 27 sidebar pages return 200
```

---

## 5. CI/CD Security Hardening

### Current CI Gap Analysis

The current `ci.yml` runs: lint, typecheck, unit tests with coverage, E2E, build. Missing:
- No SAST scan
- No dependency vulnerability scan
- No secret scan
- No license compliance check

All four are required by the portfolio `CLAUDE.md` security rules and are release-blocking.

### Recommended Security Stack

| Tool | Version / Action | Purpose | Cost | Confidence |
|---|---|---|---|---|
| `semgrep` | `semgrep/semgrep-action@v1` | SAST — TypeScript/JS pattern scanning | Free (OSS rules) | HIGH |
| `pnpm audit` + `audit-ci` | `ibm/audit-ci@^6` | Dependency CVE scanning | Free | HIGH |
| `gitleaks` | `gitleaks/gitleaks-action@v2` | Secret scanning (fast, pre-merge) | Free | HIGH |
| `license-checker` | `licensee` or `license-checker` npm | License compliance | Free | MEDIUM |

**Why Semgrep over CodeQL:** CodeQL requires GitHub Advanced Security for private repos (paid). Semgrep OSS is free for all repos and has TypeScript + Node.js rulesets that cover the relevant attack surface (injection, auth bypass, hardcoded creds). For a monorepo with Workers + SvelteKit, Semgrep's per-file pattern approach is faster and produces fewer false positives on edge-runtime code.

**Why `audit-ci` over raw `pnpm audit`:** `pnpm audit` exits non-zero on any advisory, including low-severity ones with no fix. `audit-ci` lets you set a threshold (`--moderate`, `--high`, `--critical`) and allowlist known false positives, making it suitable for blocking CI without constant noise.

**Why Gitleaks over TruffleHog for CI:** TruffleHog's live-verification feature (making real API calls) is valuable for deep scans but too slow and noisy for per-PR CI. Gitleaks is a single Go binary, scans in under 5 seconds, and has 150+ built-in secret patterns. Use Gitleaks in CI and TruffleHog on a weekly scheduled scan.

### Additional CI Jobs to Add

```yaml
# Add to ci.yml

  sast:
    name: SAST (Semgrep)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: semgrep/semgrep-action@v1
        with:
          config: >-
            p/typescript
            p/nodejs
            p/secrets
            p/owasp-top-ten

  dep-audit:
    name: Dependency Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: npx audit-ci --high

  secret-scan:
    name: Secret Scan (Gitleaks)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Add `sast`, `dep-audit`, `secret-scan` to the `status-check` needs array to make them release-blocking.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| Enterprise SSO | WorkOS SDK | Auth0 / Okta Workforce | Auth0 is 3-10x more expensive at enterprise tier; Okta is infrastructure not a library |
| Enterprise SSO (self-hosted) | `jose` + SAML parser | BoxyHQ/Ory Polis (`@boxyhq/saml-jackson`) | Jackson is a full service (Docker container), not an edge-native library; adds deployment complexity on Workers |
| SAML parsing | `samlify` >=2.10.0 | `node-saml` | `node-saml` has heavier Node.js API surface; less tested on edge |
| SAST | Semgrep | CodeQL | CodeQL requires GitHub Advanced Security (paid) for private repos |
| Secret scan | Gitleaks | TruffleHog | TruffleHog too slow for per-PR CI; use TruffleHog on weekly schedule instead |
| E2E server | `wrangler pages dev` | `vite preview` | `vite preview` misses KV/D1 bindings, gives false-green tests |
| Copilot readiness | Custom Graph aggregation | Third-party SaaS (Syskit, CoreView) | TenantIQ IS the alternative to those tools; must be self-contained |

---

## Installation

```bash
# Enterprise SSO (WorkOS path)
pnpm add @workos-inc/node-sdk --filter api

# Enterprise SSO (self-hosted SAML path — only if not using WorkOS)
# WARNING: pin to >=2.10.0 — CVE-2025-47949 is critical
pnpm add samlify@>=2.10.0 @xmldom/xmldom --filter api

# jose is already installed (used for custom JWT)
# No new install needed for OIDC validation

# CI tooling (dev deps at root)
pnpm add -Dw audit-ci

# Playwright — already installed, just update if needed
pnpm add -D @playwright/test@latest --filter web
```

---

## Runtime Constraints Checklist (Cloudflare Workers)

| Constraint | Impact | Mitigation |
|---|---|---|
| No `node:crypto` | SAML signature verification cannot use Node crypto | Use `SubtleCrypto` (Web Crypto API) — `jose` already does this |
| No `node:fs` | Cannot read metadata XML from filesystem | Fetch from IdP metadata URL at runtime; cache in KV |
| No `node:buffer` outside `nodejs_compat` | Some SAML libs use `Buffer.from()` | Add `compatibility_flags = ["nodejs_compat"]` to wrangler.toml if needed |
| 10ms CPU burst limit | Long XML parsing can hit CPU time | Samlify parses incrementally; WorkOS offloads entirely |
| 1MB script size | Large SSO SDK bundles can violate limit | WorkOS SDK treeshakes to ~40KB; verify with `wrangler build --dry-run` |
| No persistent in-memory state | JWKS cache cleared between isolate restarts | KV-backed JWKS cache for SAML metadata; `jose` JWKS cache is acceptable (short-lived) |

---

## Sources

- [jose — Cloudflare Workers support](https://github.com/panva/jose) — HIGH confidence
- [WorkOS Cloudflare SAML integration docs](https://workos.com/docs/integrations/cloudflare-saml) — HIGH confidence
- [CVE-2025-47949 — samlify signature wrapping (CVSS 9.9)](https://github.com/advisories/GHSA-r683-v43c-6xqv) — HIGH confidence
- [microsoft/m365-copilot-automated-readiness-assessment](https://github.com/microsoft/m365-copilot-automated-readiness-assessment) — HIGH confidence
- [getMicrosoft365CopilotUsageUserDetail v1.0 GA](https://office365itpros.com/2025/10/10/copilot-usage-report-api-ga/) — HIGH confidence
- [Copilot Graph APIs for agent management GA April 2026](https://mc.merill.net/message/MC1173195) — MEDIUM confidence (message center, not official Learn doc)
- [Cloudflare Pages SvelteKit adapter docs](https://svelte.dev/docs/kit/adapter-cloudflare) — HIGH confidence
- [Semgrep vs CodeQL comparison](https://konvu.com/compare/semgrep-vs-codeql) — MEDIUM confidence
- [audit-ci — IBM GitHub](https://github.com/IBM/audit-ci) — HIGH confidence
- [gitleaks-action](https://github.com/gitleaks/gitleaks-action) — HIGH confidence
- [WorkOS pricing $125/connection](https://workos.com/pricing) — HIGH confidence
- [SSOJet on Cloudflare Workers edge SSO architecture](https://ssojet.com/blog/how-ssojet-uses-cloudflare-workers-to-deliver-high-availability-sso-for-saas-apps) — MEDIUM confidence
