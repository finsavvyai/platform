# sdlc.cc

The privacy layer for AI workflows. One gateway, **8 surfaces**,
shared backend. Scrub PII / credentials / IDs before any prompt
reaches Claude, ChatGPT, Cowork, Copilot, Gemini, or Perplexity.

> Compliance for the AI surface area — not a single point of integration.

## Quick start

If you just want to use it:

| You are | Use this |
|---|---|
| Developer with Claude Code or Anthropic SDK | `ANTHROPIC_BASE_URL=https://api.sdlc.cc` |
| Anyone with text to scrub | <https://sdlc-cc-scrub.pages.dev> |
| Chrome / Edge user on claude.ai / chatgpt.com / gemini / perplexity / poe | sideload `extension/` |
| Firefox user on the same hosts | sideload `extension-firefox/` |
| Outlook user (web / desktop) | sideload `outlook-addin/manifest.xml` |
| Excel user | sideload `excel-addin/manifest.xml` |
| Word user | sideload `word-addin/manifest.xml` |
| PowerPoint user | sideload `powerpoint-addin/manifest.xml` |
| Teams user | sideload `teams-app/manifest/manifest.json` |
| Already on Cloudflare AI Gateway | drop-in `cf-ai-gateway-worker/` |

See `docs/CLIENT_SETUP.md` for the per-OS setup matrix.

## Architecture

One backend, N front-doors. Every surface POSTs to one endpoint
with one bearer key.

```
   ┌─ web app (scrub.sdlc.cc)
   ├─ browser ext (Chrome / Edge / Firefox)
   │     └─ claude.ai · chatgpt.com · cowork · gemini · perplexity · poe
   ├─ Outlook add-in
   ├─ Excel add-in
   ├─ Word add-in
   ├─ PowerPoint add-in
   ├─ Teams personal tab
   └─ Cloudflare AI Gateway plugin
              │
              │  POST https://api.sdlc.cc/v1/dlp/scrub
              │  Authorization: Bearer sk_sdlc_*
              ▼
        sdlc.cc gateway
          ├─ MaskAML chain (sdlc-core/dlp)
          ├─ audit log (tenant_id, counts; raw text NEVER stored)
          └─ Prometheus metrics
```

The brain is [sdlc-core](https://github.com/finsavvyai/sdlc-core) — a
private Go library that AMLIQ, TenantIQ, and sdlc.cc all share.

## Surfaces (live deployments)

| Surface | Deployed URL | Source |
|---|---|---|
| Marketing landing | <https://sdlc-cc-landing.pages.dev> | `landing/` |
| Web scrub app | <https://sdlc-cc-scrub.pages.dev> | `web/` |
| Outlook taskpane | <https://sdlc-cc-outlook.pages.dev> | `outlook-addin/web/` |
| Excel taskpane | <https://sdlc-cc-excel.pages.dev> | `excel-addin/web/` |
| Word taskpane | <https://sdlc-cc-word.pages.dev> | `word-addin/web/` |
| PowerPoint taskpane | <https://sdlc-cc-ppt.pages.dev> | `powerpoint-addin/web/` |
| Teams tab | <https://sdlc-cc-teams.pages.dev> | `teams-app/web/` |
| Browser extension (Chrome MV3) | sideload | `extension/` |
| Browser extension (Firefox MV3) | sideload | `extension-firefox/` |
| CF AI Gateway plugin | deploy-on-demand | `cf-ai-gateway-worker/` |

Custom-domain bindings (`scrub.sdlc.cc`, `addin.sdlc.cc`, etc.)
pending — see `docs/CUSTOM_DOMAINS.md`.

## Gateway

The brain. Go binary, Postgres-backed audit, per-tenant API keys.

```bash
# Local dev (recommended first run)
./scripts/dev-up.sh   # prompts for ANTHROPIC_API_KEY once

# Public via Cloudflare Tunnel (free, your laptop)
./scripts/tunnel-up.sh

# Cloud-hosted via Fly.io
./scripts/fly-bootstrap.sh
```

### Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/v1/messages` | Anthropic-compat drop-in (DLP'd) |
| POST | `/v1/messages` w/ `stream:true` | SSE event stream |
| POST | `/v1/dlp/scrub` | Standalone scrub — shared by every surface |
| GET | `/v1/audit/usage` | Admin aggregations (per-tenant, per-provider) |
| GET | `/metrics` | Prometheus text format |
| GET | `/health` / `/ready` | Liveness / readiness |

### Config

| Env var | Default | Notes |
|---|---|---|
| `PORT` | 8080 | HTTP listen |
| `ANTHROPIC_API_KEY` | _(unset)_ | Primary provider |
| `AWS_BEDROCK_REGION` | _(unset)_ | Bedrock fallback |
| `DATABASE_URL` | _(unset)_ | Postgres for audit + tenant_network_map + api_keys |
| `SDLC_ADMIN_BEARER` | _(unset)_ | Gates `/v1/audit/usage` |
| `AEGIS_AI_DAILY_CAP` | _(unset)_ | Per-tenant 24h quota |
| `TRANSPARENT_PROXY_HOSTS` | _(unset)_ | DNS-hijack mode hostnames |

### Tenant API keys

```bash
# After bringing up the stack with Postgres attached:
./keytool issue --tenant tnt_acme --label ci-runner
# → sk_sdlc_xxxxxxxx... (capture once)
```

## Detector pack

11 categories, validator-aware (Luhn / mod-97 / mod-10 / SSA structural
rules / HMRC NI prefix blacklist):

```
Email · Phone · IPv4 · IPv6
PAN · IBAN · BIC · Israeli ID
US SSN · UK NI
Credentials: Anthropic, OpenAI, GitHub, AWS, Slack, Stripe,
             Google API, JWT, PEM private key
```

See `sdlc-core/dlp` for the implementations.

## Repository layout

```
sdlc-cc/
├── cmd/                       gateway, migrate, keytool binaries
├── deploy/                    Dockerfile + docker-compose.yml + fly.toml
├── docs/                      architecture, runbooks, positioning
├── extension/                 Chrome / Edge MV3 ext
├── extension-firefox/         Firefox MV3 ext
├── outlook-addin/             Office.js for Outlook
├── excel-addin/               Office.js for Excel
├── word-addin/                Office.js for Word
├── powerpoint-addin/          Office.js for PowerPoint
├── teams-app/                 Teams personal tab + manifest
├── web/                       scrub.sdlc.cc paste-and-redact UI
├── landing/                   Marketing landing page
├── cf-ai-gateway-worker/      Cloudflare Worker plugging into AI Gateway
├── internal/                  Go gateway internals
├── migrations/                Postgres schema
└── scripts/
    ├── dev-up.sh              Local docker compose bring-up
    ├── tunnel-up.sh           Cloudflare Tunnel for api.sdlc.cc
    ├── fly-bootstrap.sh       Cloud deploy
    └── deploy-all-pages.sh    Re-deploy all 7 Pages projects
```

## Going live

See `docs/GO_LIVE_CHECKLIST.md` — the exact remaining ops/credentials
steps (DNS, AppSource publisher account, GitHub PAT, etc.) to flip
this from "demoable" to "production".

## Positioning

`docs/COMPETITIVE_LANDSCAPE.md` — vs. Strac, Skyflow, Microsoft
Purview, LiteLLM. Honest about where we win and where we don't.

`docs/PLATFORM_DISTRIBUTION.md` — 30-platform addon distribution
matrix. What's shipped, what's next, what we skip.

## CI setup (private sibling dep)

`sdlc-cc` (this repo, public) depends on
[`github.com/finsavvyai/sdlc-core`](https://github.com/finsavvyai/sdlc-core)
(private). Local dev uses `replace ../sdlc-core` in `go.mod` for
fast iteration.

CI clones the private sibling via `SDLC_CORE_TOKEN` — a fine-grained
GitHub PAT with read-only access to `finsavvyai/sdlc-core`. Set this
once at the repo level (Settings → Secrets → Actions).

## License

Proprietary. © FinSavvy AI 2026.
