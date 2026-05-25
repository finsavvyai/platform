# External Integrations

**Analysis Date:** 2026-04-22

## APIs & External Services

**AI Providers:**
- OpenAI - Test generation and AI workflows in backend/workers and API service.
  - SDK/Client: `openai` (`backend/package.json`) and direct HTTP to `https://api.openai.com/v1/chat/completions` (`backend/src/services/AIProviderClient.ts`, `apps/api/src/services/testGenerator.ts`, `backend/src/services/vibe-test-pilot/AITestProvider.ts`).
  - Auth: `OPENAI_API_KEY` (`backend/src/config/env.ts`, `wrangler.toml` secret comments).
- Anthropic - Additional LLM provider support.
  - SDK/Client: `@anthropic-ai/sdk` (`backend/package.json`).
  - Auth: provider key loaded from environment where AI clients are configured.
- Hugging Face - Inference provider integration.
  - SDK/Client: `@huggingface/inference` (`backend/package.json`).
  - Auth: expected via environment config for provider clients.

**Payments/Billing:**
- Stripe - Checkout, portal, and webhook-based billing.
  - SDK/Client: `stripe` (`backend/package.json`), webhook handlers in `backend/src/routes/stripe-billing.routes.ts` and `backend/src/routes/payments.ts`.
  - Auth: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, plan IDs (`backend/src/config/env.ts`).
- LemonSqueezy - Subscription commerce and webhook lifecycle.
  - SDK/Client: REST via `axios`/`fetch` to `https://api.lemonsqueezy.com/v1` (`backend/src/services/LemonSqueezyService.ts`, `backend/src/services/PaymentService.ts`).
  - Auth: `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET` (`backend/src/services/LemonSqueezyService.ts`, `wrangler.toml` comments).

**Email/Notifications:**
- SendGrid - Transactional and lifecycle email delivery.
  - SDK/Client: direct API requests to `https://api.sendgrid.com/v3` (`backend/src/services/SendGridService.ts`, `backend/src/services/EmailService.ts`).
  - Auth: `SENDGRID_API_KEY`, sender env vars (`backend/src/config/env.ts`, `backend/src/services/SendGridService.ts`).
- Slack - Incoming webhook notifications for deployments/test events.
  - SDK/Client: webhook posts via `axios` (`backend/src/services/SlackService.ts`), Slack notifications in CI (`.github/workflows/ci-cd.yml`).
  - Auth: webhook URL provided at runtime (e.g., `SLACK_WEBHOOK_URL`/workflow secrets).

**Identity/SSO/OAuth:**
- GitHub OAuth - Login/connect flow (`backend/src/services/OAuthService.ts`, `backend/src/routes/oauth.ts`).
  - SDK/Client: OAuth endpoints `https://github.com/login/oauth/*` and GitHub API (`backend/src/services/OAuthService.ts`).
  - Auth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, redirect URI env vars.
- Google OAuth - Login/connect flow.
  - SDK/Client: `https://accounts.google.com/o/oauth2/v2/auth`, `https://oauth2.googleapis.com/token` (`backend/src/services/OAuthService.ts`).
  - Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, redirect URI env vars.
- Microsoft/Azure AD OAuth - Login/connect flow.
  - SDK/Client: Microsoft OAuth + Graph (`backend/src/services/OAuthService.ts`, `backend/src/auth/oauth-providers.ts`).
  - Auth: `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`.
- Jira OAuth + API integration - Project/issue import and linking.
  - SDK/Client: `backend/src/services/JiraAuthService.ts`, `backend/src/services/JiraAPIService.ts`, routes in `backend/src/routes/jira.routes.ts`.
  - Auth: Jira OAuth client credentials and encrypted tokens in DB.

**CI/CD Integrations:**
- GitHub/GitLab/generic webhook ingestion for test automation triggers (`backend/src/routes/cicd.routes.ts`, `backend/src/services/CICDIntegrationService.ts`).
  - SDK/Client: provider webhooks + signatures (`x-hub-signature-256`, `x-gitlab-token`).
  - Auth: per-integration `webhookSecret` / provider tokens.

## Data Storage

**Databases:**
- Cloudflare D1 (SQLite) for Worker API paths.
  - Connection: binding `DB` in `wrangler.toml`, `backend/wrangler.toml`, and `apps/api/src/index.ts`.
  - Client: Drizzle with D1 (`drizzle(c.env.DB)` in `backend/src/routes/cycles.route.ts`, `src/routes/mobile.routes.ts`).
- PostgreSQL for local/backend and integration services.
  - Connection: `DATABASE_URL` or `DB_*` vars (`backend/src/config/env.ts`, `docker-compose.yml`).
  - Client: `pg`, `postgres`, Drizzle usage (`backend/package.json`, `backend/src/config/database.ts`).
- Redis for cache/session/queues/health checks.
  - Connection: `REDIS_URL` and related vars (`backend/src/config/env.ts`, `backend/src/services/HealthCheckService.ts`).
  - Client: `redis` package (`backend/package.json`).

**File Storage:**
- Cloudflare R2 buckets for screenshots/recordings/artifacts (`wrangler.toml`, `backend/wrangler.toml`).
- Optional AWS S3-compatible storage config in backend env (`backend/src/config/env.ts`).

**Caching:**
- Cloudflare KV namespaces (`SESSIONS`, `CACHE`, `RATE_LIMIT`) in `wrangler.toml`.
- Redis cache path for backend services (`backend/src/config/env.ts`, `docker-compose.yml`).

## Authentication & Identity

**Auth Provider:**
- Custom JWT auth with optional OAuth/SSO providers.
  - Implementation: JWT token issuance/validation plus OAuth account linkage (`backend/src/config/env.ts`, `backend/src/services/OAuthService.ts`, `backend/src/routes/oauth.ts`, `apps/api/src/routes/auth.ts`).

## Monitoring & Observability

**Error Tracking:**
- Not detected as a dedicated external SaaS SDK in runtime code.
- Pipeline-level security/quality scanners present (SonarCloud, Snyk, Trivy, CodeQL) in `.github/workflows/ci-cd.yml` and `.github/workflows/production-deploy.yml`.

**Logs:**
- Application logging via Winston/custom logger (`backend/package.json`, `backend/src/utils/logger.ts` references).
- CI/CD notifications and deployment events via Slack/webhooks (`.github/workflows/ci-cd.yml`).

## CI/CD & Deployment

**Hosting:**
- Primary: Cloudflare Workers + Pages (`package.json` deploy scripts, `wrangler.toml`, `backend/wrangler.toml`).
- Also configured: Render deployment workflows for staging/production (`.github/workflows/ci-cd.yml`, `pushci.yml`).
- Container images pushed to GitHub Container Registry (`.github/workflows/ci-cd.yml`, `.github/workflows/production-deploy.yml`).

**CI Pipeline:**
- GitHub Actions as main CI/CD (`.github/workflows/ci-cd.yml`, `.github/workflows/production-deploy.yml`, `.github/workflows/ci.yml`).
- Additional PushCI pipeline file present (`pushci.yml`).

## Environment Configuration

**Required env vars:**
- Auth: `JWT_SECRET`, `JWT_REFRESH_SECRET` (`backend/src/config/env.ts`, `apps/api/src/index.ts`).
- AI: `OPENAI_API_KEY`, model/tuning vars (`backend/src/config/env.ts`, `backend/src/workers/aiProcessor.ts`).
- Billing: Stripe and LemonSqueezy key set (`backend/src/config/env.ts`, `backend/src/services/LemonSqueezyService.ts`).
- OAuth: GitHub/Google/Azure client credentials (`backend/src/services/OAuthService.ts`, `backend/src/auth/oauth-providers.ts`).
- Data: `DATABASE_URL`/`DB_*`, `REDIS_URL`, D1 bindings in Worker env (`backend/src/config/env.ts`, `wrangler.toml`).
- Email: `SENDGRID_API_KEY`, sender vars (`backend/src/config/env.ts`, `backend/src/services/SendGridService.ts`).

**Secrets location:**
- Cloudflare Worker secrets via `wrangler secret put ...` (`wrangler.toml` comments).
- Local/service templates in `.env.example`, `.env.development.example`, `backend/.env.example`, `frontend/.env.example`, `orchestrator/.env.example`.
- CI/CD secrets in GitHub Actions secret store (`.github/workflows/*.yml` references to `${{ secrets.* }}`).

## Webhooks & Callbacks

**Incoming:**
- `POST /api/billing/webhook` (Stripe) in `backend/src/routes/stripe-billing.routes.ts`.
- `POST /api/webhook/lemonsqueezy` and `POST /api/webhook/stripe` in `backend/src/routes/payments.ts`.
- `POST /api/cicd/webhook/:provider` for GitHub/GitLab/generic in `backend/src/routes/cicd.routes.ts`.
- `POST /billing/webhook` in Worker API app (`apps/api/src/routes/billing.ts`).
- OAuth callbacks: `POST /oauth/callback` (`backend/src/routes/oauth.ts`) and `GET /api/jira/auth/callback` (`backend/src/routes/jira.routes.ts`).

**Outgoing:**
- Provider callbacks/API calls to OpenAI, LemonSqueezy, SendGrid, Microsoft Graph, GitHub, Google OAuth, Jira APIs (`backend/src/services/AIProviderClient.ts`, `backend/src/services/LemonSqueezyService.ts`, `backend/src/services/SendGridService.ts`, `backend/src/services/OAuthService.ts`, `backend/src/services/JiraAPIService.ts`).
- Slack webhook posts from runtime and deployment workflows (`backend/src/services/SlackService.ts`, `.github/workflows/ci-cd.yml`).

---

*Integration audit: 2026-04-22*
