# OpenSyber

Managed AI agent hosting platform for security-conscious developers. Deploy a secured AI agent in 60 seconds with real-time security monitoring, an audited skill marketplace, and built-in compliance.

## What It Does

OpenSyber protects the full lifecycle of AI agent deployments:

- **Agent Runtime** -- Isolated Hetzner VMs with Docker containers, osquery + seccomp sandboxing, heartbeat monitoring, and auto-remediation
- **TokenForge** -- Device-bound session security aligned with the W3C DBSC spec. ECDSA P-256 non-extractable keys make stolen cookies useless. Two modes:
  - *Customer Mode* -- Protect SaaS end-users where Cisco Duo cannot reach
  - *Workforce Mode* -- Compete with Cisco Duo Passport via OIDC connectors (Okta, Entra, Google Workspace, Auth0) at half the price
- **Skill Marketplace** -- 18 audited security skills with a 70/30 revenue split. AI-powered triage, remediation, compliance writing, threat intel, incident response, and more
- **Claw Gateway** -- Shared multi-provider LLM proxy (Anthropic, OpenAI, Workers AI) with Durable Object session state, serving all portfolio projects

## Architecture

```
Browser / Agent SDK           opensyber.cloud               Infrastructure
---------------------         -------------------           ----------------
Next.js 16 + React 19   --->  Hono API (CF Worker)    --->  Cloudflare D1 (SQLite)
@opensyber/tokenforge         222 API routes                57 migrations, ~173 tables
  client SDK (Web Crypto)     Auth.js v5 (4 OAuth)          Cloudflare KV + R2
  6 framework adapters        RBAC + tenant isolation        Hetzner Cloud VMs
                                                            Resend (email)
TokenForge API (CF Worker)    Claw Gateway (CF Worker)      LemonSqueezy (billing)
  DBSC challenge/register     Durable Objects + SQLite
  refresh/revoke/policies     Multi-provider LLM routing
  workforce OIDC exchange
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS, 209 components |
| API | Hono 4 on Cloudflare Workers, 222 route files |
| Auth | Auth.js v5 (Google, GitHub, LinkedIn, Microsoft) |
| Database | Cloudflare D1, Drizzle ORM, ~173 tables, 57 migrations |
| Session Security | TokenForge -- ECDSA P-256 DBSC, 6 framework adapters, 6 native SDKs |
| Payments | LemonSqueezy (Free, Pro, Team, Enterprise tiers) |
| AI Gateway | Claw Gateway -- Anthropic/OpenAI/Workers AI with Durable Object sessions |
| Agent Runtime | Hetzner VMs, Docker (node:22-slim), osquery + seccomp |
| Cache/Storage | Cloudflare KV (tokens, rate limits), R2 (skill packages, logs) |
| Email | Resend API |
| Monitoring | Cloudflare Analytics, Sentry |
| Build | Turborepo, pnpm workspaces, TypeScript strict |

## Monorepo Structure

```
opensyber/
|-- apps/
|   |-- api/                  Hono Worker -- main OpenSyber API (222 routes, 459 source files)
|   |-- web/                  Next.js 16 -- dashboard + marketing (759 source files, 27 pages)
|   |-- agent/                Node.js daemon -- container runtime (21 source files)
|   |-- claw-gateway/         Hono Worker -- shared LLM proxy (14 source files)
|   |-- tokenforge-api/       Hono Worker -- TokenForge session API (60 source files)
|   |-- tokenforge-web/       Next.js -- TokenForge dashboard (81 source files, 9 pages)
|   |-- tokenforge-proxy/     CF Worker -- edge proxy (2 source files)
|   |-- ztna-proxy/           CF Worker -- zero trust proxy (6 source files)
|   |-- redirects/            CF Worker -- redirect handler
|
|-- packages/
|   |-- tokenforge/           @opensyber/tokenforge -- device-bound session SDK
|   |   |-- client/           Browser SDK (Web Crypto, IndexedDB, fetch interceptor)
|   |   |-- server/           Verification, DBSC, OIDC, policy engine, trust scoring
|   |   |-- adapters/         Hono, Express, Next.js, Fastify, SvelteKit, Astro
|   |   |-- react/            React provider + hooks
|   |   |-- shared/           Shared types
|   |-- tokenforge-sdks/      Native SDKs: Go, Python, Kotlin, Swift, React Native, MCP
|   |-- db/                   Drizzle ORM schemas + 57 D1 migrations
|   |-- shared/               Types, constants, plan configs
|   |-- auth/                 Auth.js handlers (callbacks, token, providers)
|   |-- claw-sdk/             AI gateway client (prompt, stream, sessions)
|   |-- skill-sdk/            Skill definition SDK + testing framework
|   |-- ui/                   Shared React components (Button, Card, Badge, MetricCard)
|   |-- cli/                  CLI tooling (scan logs, cloud posture)
|   |-- vscode-extension/     VS Code extension -- monitor AI coding agents in real time
|   |-- dns-orchestrator/     DNS firewall orchestrator
|   |-- swg-orchestrator/     Secure Web Gateway (Squid + E2Guardian config builder)
|   |-- rbi-orchestrator/     Remote Browser Isolation (Kasm Workspaces integration)
|   |-- wlp-orchestrator/     Workload Protection (Falco + osquery + Wazuh)
|   |-- fly-adapter/          Fly.io sidecar adapter
|   |-- modal-adapter/        Modal sidecar adapter
|   |-- opensyber-mcp/        MCP server for AI agent security monitoring
|
|-- skills/                   18 marketplace skills with manifests
|   |-- ai-reasoning-engine/  Root cause analysis + risk scoring
|   |-- ai-triage/            Batch finding prioritization by actual risk
|   |-- ai-remediation/       Fix generation with rollback procedures
|   |-- ai-compliance-writer/ SOC 2 / ISO 27001 / HIPAA / GDPR evidence
|   |-- ai-threat-intel/      CVE + OSINT enrichment (NVD, CIRCL)
|   |-- ai-incident-responder/ Multi-step attack chain investigation
|   |-- dependency-auditor/   CVEs, typosquatting, slopsquatting, malicious postinstall
|   |-- supply-chain-guard/   Block malicious packages at install time
|   |-- mcp-auditor/          MCP server misconfiguration scanning
|   |-- prompt-guard/         Self-hosted prompt injection detection (Ollama)
|   |-- pipeline-security-scanner/ CI/CD pipeline security (PipeWarden engine)
|   |-- agent-behavior-profiler/ Behavioral baselines + deviation alerts
|   |-- credential-rotator/   Auto-rotate keys, passwords, SSH on breach detection
|   |-- github-integration/   GitHub security events + PR watching
|   |-- log-analyzer/         Container log anomaly detection
|   |-- slack-notifier/       Slack alert delivery
|   |-- ruflo-aidefence/      Agent input sanitization (path traversal, command injection)
|   |-- voice-synthesis/      Self-hosted voice security briefings (Voicebox)
|
|-- docs/                     Architecture, API reference, sprint docs, guides
```

## TokenForge -- Device-Bound Session Security

TokenForge is a standalone product within OpenSyber that makes stolen session cookies useless by binding them to a cryptographic key that never leaves the browser.

### Protocol (W3C DBSC-aligned)

```
1. Login succeeds --> server calls POST /v1/dbsc/challenge (purpose: register)
2. Browser generates ECDSA P-256 non-extractable keypair
3. Browser signs challenge as compact JWS, POSTs to /v1/dbsc/register
4. Server binds session to public key, returns rotating __Secure-tf-bound cookie (5min TTL)
5. On cookie expiry --> /v1/dbsc/challenge (purpose: refresh) + Sec-Session-Response: <JWS>
6. Server verifies signature, computes risk signals, rotates cookie
```

### Risk Signals (computed on every refresh)

- Geo-IP drift from registration
- ASN change
- User-Agent fingerprint divergence
- Replay burst detection (Evilginx pattern: refresh < 2s after last)

### Workforce Mode (OIDC)

- POST /v1/workforce/sso/:appId/exchange -- verify IdP ID token, issue DBSC challenge
- Supports Okta, Entra, Google Workspace, Auth0, generic OIDC
- JWKS cached in KV (24h), stale-on-error fallback
- Per-tenant policy DSL evaluated on every refresh:

```json
{
  "if_any": [
    { "geo_country_in": ["RU", "KP", "IR"] },
    { "asn_in": ["TOR", "VPN_KNOWN"] }
  ],
  "then": "block"
}
```

Actions: `allow | step_up | block | revoke_session`

### Framework Adapters

```
npm install @opensyber/tokenforge
```

Hono, Express, Next.js, Fastify, SvelteKit, Astro -- plus native SDKs for Go, Python, Kotlin, Swift, React Native, and MCP.

## API Surface (OpenSyber)

Major route groups on the main API (222 routes):

| Group | Purpose |
|---|---|
| `/api/agents` | Agent CRUD, monitoring, team management |
| `/api/findings` | Security finding ingestion + search |
| `/api/ai` | AI-powered analysis via Claw Gateway |
| `/api/compliance` | SOC 2 / ISO 27001 evidence + AI generation |
| `/api/remediation` | Fix generation + deployment |
| `/api/marketplace` | Skill browsing, installation, reviews |
| `/api/attack-paths` | Graph-based attack surface analysis |
| `/api/kill-chain` | Kill chain stage mapping |
| `/api/vault` | Credential vault management |
| `/api/sso` | SAML/OIDC SSO |
| `/api/ztna` | Zero Trust Network Access |
| `/api/dns` | DNS firewall configuration |
| `/api/swg` | Secure Web Gateway policy |
| `/api/rbi` | Remote Browser Isolation |
| `/api/wlp` | Workload Protection (Falco/osquery/Wazuh) |
| `/api/admin` | Admin panel (users, orgs, billing) |

## API Surface (TokenForge)

| Method | Path | Purpose |
|---|---|---|
| POST | /v1/dbsc/challenge | Issue one-shot nonce (register/refresh/step_up) |
| POST | /v1/dbsc/register | Bind device with JWS-signed challenge response |
| POST | /v1/dbsc/refresh | Rotate cookie via signed nonce + risk signals |
| POST | /v1/dbsc/sessions/:id/revoke | Soft-revoke a bound session |
| GET | /v1/dbsc/sessions | List DBSC sessions for tenant |
| POST | /v1/bind | Legacy fingerprint-based device binding |
| POST | /v1/verify | Verify session + trust score |
| GET | /v1/sessions | List legacy sessions |
| POST | /v1/policies | Create workforce policy (DSL) |
| GET | /v1/policies | List policies |
| PATCH | /v1/policies/:id | Update policy |
| DELETE | /v1/policies/:id | Delete policy |
| POST | /v1/workforce/apps | Create workforce OIDC app |
| POST | /v1/workforce/sso/:appId/exchange | OIDC ID token --> DBSC challenge |
| POST | /v1/webhooks | Configure webhook subscription |
| GET | /.well-known/tokenforge/jwks | Public JWKS (future signing keys) |
| GET | /.well-known/tokenforge/dbsc | DBSC service descriptor |

## Skill Marketplace

18 audited skills. Premium AI bundle: $99/month (6 AI skills). Skills run inside the agent container with sandboxed permissions.

```
opensyber.cloud/dashboard/marketplace
```

Skill authors use `@opensyber/skill-sdk` to build, test, and publish.

## Quick Start

```bash
# Clone and install
git clone https://github.com/finsavvyai/opensyber.git
cd opensyber
pnpm install

# Run everything (API + Web + TokenForge)
pnpm dev

# Or run individually
cd apps/api && pnpm dev          # API at localhost:8787
cd apps/web && pnpm dev          # Web at localhost:3000
cd apps/tokenforge-api && pnpm dev  # TokenForge API
cd apps/claw-gateway && pnpm dev    # AI Gateway
```

## Environment Variables

```bash
# Required
AUTH_SECRET=                    # Auth.js signing secret
NEXT_PUBLIC_API_URL=            # API base URL

# Optional
LEMON_SQUEEZY_API_KEY=          # Billing
RESEND_API_KEY=                 # Email
ANTHROPIC_API_KEY=              # AI (via Claw Gateway)
SENTRY_DSN=                     # Error tracking
```

## Database

```bash
cd packages/db
pnpm db:generate    # Create new migration
pnpm db:migrate     # Apply to D1
pnpm db:push        # Sync schema
```

57 migrations, ~173 tables via Drizzle ORM on Cloudflare D1.

## Testing

```bash
pnpm test                        # All unit + integration tests
pnpm --filter @opensyber/api test  # API tests only
pnpm --filter @opensyber/tokenforge test  # TokenForge SDK tests
npx playwright test              # E2E browser tests
```

781 test files across the monorepo. Vitest for unit/integration, Playwright for E2E.

## Deployment

All apps deploy to Cloudflare (Workers + Pages):

```bash
cd apps/api && pnpm deploy
cd apps/web && pnpm deploy
cd apps/tokenforge-api && pnpm deploy
cd apps/tokenforge-web && pnpm deploy
cd apps/claw-gateway && pnpm deploy
```

PushCI runs tests + deploys on `git push origin main`.

## Pricing

| Tier | Price | Agents | Runs/mo | Skills |
|---|---|---|---|---|
| Starter Shield | Free | 1 | 300 | 3 bundled |
| Team | $299/mo | 10 | 10,000 | Marketplace |
| Professional | $799/mo | 25 | 50,000 | All + priority |
| Enterprise | $2,499/mo | Unlimited | Unlimited | All + SLA |
| Mission Defender | $9,999/mo | Unlimited | Unlimited | All + dedicated |

TokenForge workforce pricing: $4-7/user/month (undercuts Cisco Duo Premier at $9).

## License

See [LICENSE](LICENSE) for details.
