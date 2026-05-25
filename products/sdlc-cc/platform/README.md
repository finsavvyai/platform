# sdlc-platform

**Privacy gateway for any LLM.** Scrub PII and secrets out of
prompts **before** they reach ChatGPT, Claude, Gemini, Microsoft
Copilot, or your own self-hosted models. Real Go backend, browser
extensions, IDE addins, Office addins — one policy across every
surface.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL_3.0-blue.svg)](LICENSE)
[![Commercial License](https://img.shields.io/badge/Commercial-from_%2439%2Fseat%2Fmo-green.svg)](COMMERCIAL.md)
[![Status](https://img.shields.io/badge/Status-Active-success.svg)](STATUS.md)
[![Trust Center](https://img.shields.io/badge/Trust_Center-trust.sdlc.cc-purple.svg)](trust/)

> *Your data does not leave the building before it is scrubbed.*

---

## Why this exists

In **May 2025**, Cisco bought **Lakera Guard** for ≈$300M. The
category — pre-prompt PII / secret redaction — is a budget line
item now, and the buyers want a non-acquired-by-bigco alternative.
EU AI Act GPAI enforcement starts **August 2026**. Anthropic's
**FSI push** (Blackstone JV, FIS partnership) means every regulated
buyer is shortlisting Claude wrappers in 2026, and Trust posture
decides the shortlist.

Lawyers have it worse: *United States v. Heppner* (SDNY, 2026-02-17)
held that prompts to consumer Claude **destroyed attorney-client
privilege**. That's still in scope — it's now one DLP preset
(`legal`) inside a broader privacy-gateway product, not the whole
pitch.

## What's in the box (AGPL-3.0)

| Capability | What it does |
|---|---|
| **DLP presets** | `pii_default`, `secrets`, `legal`, `finance`, `healthcare` — pluggable per tenant |
| **`POST /v1/redact`** | Standalone scan endpoint clients hit before submitting to an LLM |
| **HMAC-chained audit log** | Tamper-evident, replay-with-redaction, GDPR Art. 15 surface |
| **RBAC + SCIM 2.0 + SAML SSO** | Paralegal / analyst / admin roles, MFA, WebAuthn |
| **Per-tenant spend caps** | RFC-7807 402 on overage |
| **Multi-provider routing** | Anthropic, OpenAI, Bedrock, Vertex, Azure, self-hosted (vLLM / Ollama) |
| **OPA Rego policy engine** | Version-controlled, auditable policies |
| **CMEK envelope encryption** | Customer holds the KEK |
| **IP allowlist (CIDR per tenant)** | Network-boundary enforcement |
| **pgvector RAG with Postgres RLS** | Tenant isolation at the row level |

## Distribution surfaces

The Go backend is the policy engine. These ship as thin clients
that all call `POST /v1/redact`:

| Surface | Where | Status |
|---|---|---|
| Self-hosted Docker | This repo | Production-ready (see [docs/quick-start.md](docs/quick-start.md)) |
| Browser extension (Chrome / Edge / Firefox / Safari) | [`extensions/browser/`](extensions/browser/) | Scaffold + Playwright-verified selectors for ChatGPT, Claude, Gemini, Copilot |
| VS Code / JetBrains / Cursor addin | [`extensions/ide/vscode/`](extensions/ide/vscode/) | VS Code addin shipped (2 commands); JetBrains + Cursor on roadmap |
| Word / Outlook addin | `extensions/office/` | On roadmap |
| CLI proxy | Built into the gateway | Production-ready |

## The 3-product Trust bundle

`sdlc-platform` is the front door of a three-product portfolio
that customers can adopt in any combination — one Trust Center
([trust/](trust/)) and one MSA cover all three:

| Product | Role |
|---|---|
| **sdlc-platform** | Privacy gateway — scrub PII + secrets pre-LLM |
| **AMLIQ** | AML compliance dashboard with AI summarisation (vertical proof point built on these primitives) |
| **OpenSyber / Claw** | Multi-provider AI gateway with provider fallback (routing layer beyond redaction) |

## Quick start (self-host)

```bash
git clone https://github.com/finsavvyai/sdlc-platform.git
cd sdlc-platform

docker-compose up

# Try the redact endpoint
curl -X POST http://localhost:8080/v1/redact \
  -H 'content-type: application/json' \
  -d '{"text":"contact alice@example.com please"}'
# → {"redacted":"contact [EMAIL] please","detections":[...],"blocked":false}

# Install the browser extension
cd extensions/browser && npm install && npm run build
# Load extensions/browser/dist as unpacked in chrome://extensions
```

Full setup: [docs/quick-start.md](docs/quick-start.md).

## Licensing

| You want to… | Use this license |
|---|---|
| Evaluate / self-host for internal use | **AGPL-3.0** (this repo) |
| Embed in a closed-source product or SaaS | **Commercial license** |
| Contribute to the OSS project | **AGPL-3.0** + CLA |

### Tiers

| Tier | Price | What it covers |
|---|---|---|
| **Free (self-host)** | $0 | AGPL terms apply |
| **Team** | $39/seat/mo | Commercial license · email support · semver upgrades |
| **Business** | $79/seat/mo | Team + extension add-ons · priority SLA · SAML/SCIM bundled |
| **Enterprise** | from $4,000/seat/yr | Business + custom DLP presets · DPA negotiation · CMEK · on-call |

OSS code = commercial code. No separate "Enterprise Edition"
binary. The commercial license is a contract artifact that lifts
the AGPL source-disclosure obligation.

Full terms: [COMMERCIAL.md](COMMERCIAL.md) ·
Buy: [sdlc.cc/pricing](https://sdlc.cc/pricing).

## What's NOT in scope (be honest)

- **No SOC 2 / HIPAA / ISO 42001 / FINRA certificate** yet. Year-1
  revenue funds the audit ([trust/soc2.html](trust/soc2.html)).
  Technical controls are implemented; what's missing is the
  attestation, not the security feature.
- **No managed SaaS option** in year 1. Self-host only. Year 2+ may
  add a hosted plane for firms that prefer it.
- **DLP is a heuristic, not a legal determination.** Every regulated
  buyer must run its own ethics / compliance review of any AI
  vendor — including this one.

## Architecture

```
services/gateway/        Go 1.24, Chi router, OpenAPI3 — the privacy gateway
services/rag/            Python 3.11, FastAPI, pgvector — tenant-scoped RAG
services/document-processor/   Node.js, Bull, Tesseract — OCR + queues
services/admin-ui/       Next.js — operator console
extensions/browser/      Manifest V3, TypeScript, Vite
extensions/ide/vscode/   VSCE addin, TypeScript
trust/                   Static Trust Center, Cloudflare Pages-ready
database/migrations/     Canonical SQL, applied via CI
```

## Documentation

- [Quick start](docs/quick-start.md)
- [Commercial license](COMMERCIAL.md)
- [Current direction](docs/PIVOT-2026-05-20-PRIVACY-GATEWAY.md)
- [Architecture decisions (ADRs)](docs/adr/)
- [Trust Center](trust/)
- [Roadmap](ROADMAP.md) · [Status](STATUS.md)

## Contributing

- Read [CONTRIBUTING.md](CONTRIBUTING.md). All contributions require
  a CLA so commercial customers can receive a clean grant.
- 200-line file cap. Strict typing at boundaries. SPDX header on
  every Go file. Failing test first, then fix.
- Coverage targets: 100% on critical paths, ≥90% line / ≥85%
  branch overall. See [CLAUDE.md](CLAUDE.md).

## Contact

- **Sales:** `commercial@sdlc.cc`
- **General:** `hello@sdlc.cc`
- **Security:** see [SECURITY.md](SECURITY.md) (`security@sdlc.cc`)
- **Issues:** [GitHub Issues](https://github.com/finsavvyai/sdlc-platform/issues)

## License

AGPL-3.0-or-later for the OSS release. See [LICENSE](LICENSE).
Commercial license available — see [COMMERCIAL.md](COMMERCIAL.md).

Copyright © 2026 sdlc-platform contributors.
