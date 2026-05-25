---
title: "Scrub PII out of every ChatGPT prompt with a self-hosted Go gateway"
published: false
description: "A privacy gateway that detects and redacts PII, secrets, and regulated identifiers before prompts ever reach OpenAI, Anthropic, Gemini, or Copilot. AGPL-3.0, self-host in 60 seconds."
tags: privacy, opensource, golang, llm
canonical_url: https://sdlc.cc/blog/privacy-gateway-launch
cover_image:
series: sdlc-platform launch
---

# Scrub PII out of every ChatGPT prompt with a self-hosted Go gateway

> TL;DR — I just open-sourced (AGPL-3.0) a Go gateway that runs PII / secrets / regulated-identifier detection on every prompt **before** it reaches an LLM provider. One `docker-compose up`, one `POST /v1/redact` call, browser extensions and IDE addins on the way. [github.com/finsavvyai/sdlc-platform](https://github.com/finsavvyai/sdlc-platform).

## Why this exists

In **May 2025**, Cisco bought **Lakera Guard** for roughly $300M. That made one thing official: pre-prompt PII redaction is a budget line, not a research topic. The follow-up reality: every Lakera customer is now a Cisco customer, and a lot of them want a non-Cisco alternative they can actually self-host.

Meanwhile the regulatory clock is real:

- **EU AI Act GPAI enforcement** kicks in on **2026-08-02**. Up to €15M or 3% of global revenue, transparency obligations, the SEND platform.
- **US v. Heppner** (SDNY, 2026-02-17) ruled that consumer Claude prompts **destroyed attorney-client privilege**. That's case law now.
- Every regulated buyer in 2026 is shortlisting Claude / GPT wrappers, and a Trust posture decides the shortlist.

If you ship a product that uses an LLM, "we sometimes send PII to OpenAI" is not a position you can defend anymore. You need a layer between your app and the provider that proves what left the building.

## What's in the box

The repo ships a real Go backend, not a marketing site. Today, on `main`:

- **`POST /v1/redact`** — a standalone DLP scan endpoint your client hits before submitting to any LLM.
- **5 DLP presets** — `pii_default` (emails, phones, SSN, credit cards with Luhn, addresses, honorific-prefixed names), `secrets` (Anthropic/OpenAI/AWS/GCP/GitHub/Slack/Stripe keys + JWTs + private-key armor + DB connection strings), `legal`, `finance` (IBAN, BIC, Israeli ID, ABA routing), `healthcare` (PHI marker, NPI, DEA, ICD-10).
- **HMAC-chained audit log** — tamper-evident, replay-with-redaction, GDPR Article 15 surface.
- **RBAC + SCIM 2.0 + SAML SSO** — paralegal / analyst / admin roles, MFA, WebAuthn.
- **Per-tenant spend caps** — RFC 7807 `402 Payment Required` on overage.
- **Multi-provider routing** — Anthropic, OpenAI, Bedrock, Vertex, Azure, self-hosted (vLLM / Ollama).
- **OPA Rego policy engine** — version-controlled, auditable policies.
- **CMEK envelope encryption** — customer holds the KEK.

```bash
git clone https://github.com/finsavvyai/sdlc-platform.git
cd sdlc-platform
docker-compose up

curl -X POST http://localhost:8080/v1/redact \
  -H 'content-type: application/json' \
  -d '{"text":"Dr. Jane Doe lives at 123 Main St, call +14155551234"}'

# {
#   "redacted":"<PERSON_NAME> lives at <US_STREET_ADDRESS>, call <PHONE_E164>",
#   "detections":[
#     {"type":"person_name","start":0,"end":13},
#     {"type":"us_street_address","start":20,"end":34},
#     {"type":"phone_e164","start":41,"end":53}
#   ],
#   "blocked":false
# }
```

## Distribution: same Go backend, lots of thin shims

The gateway is the policy engine. Every other surface is a thin client that hits `/v1/redact`:

| Surface | Status |
|---|---|
| Self-hosted Docker | Production-ready |
| Browser extension (Chrome / Edge / Firefox / Safari) | Scaffolded; content scripts for ChatGPT, Claude, Gemini, Copilot; store submission next |
| VS Code addin | Two-command MVP shipped; transparent proxy on roadmap |
| JetBrains / Cursor addins | On roadmap |
| Word / Outlook addins | On roadmap |
| CLI proxy | Built into the gateway |

The reason for the multi-surface push is that PII leakage doesn't happen on one channel. The same employee will paste a customer email into ChatGPT in the morning, write a deal memo in Word + Copilot at lunch, and ask Cursor to refactor a function containing an API key in the afternoon. One backend policy, scrubbed everywhere.

## The honest licensing model

```
AGPL-3.0 for the OSS release. Anyone embedding the gateway in a
non-OSS product must release their source under AGPL, or buy out.

Commercial license at $4K+/yr/seat lifts that obligation.
```

| Tier | Price | What it covers |
|---|---|---|
| Free (self-host) | $0 | AGPL terms apply |
| Team | $39/seat/mo | Commercial license, email support, semver upgrades |
| Business | $79/seat/mo | Team + extensions, priority SLA, SAML/SCIM bundled |
| Enterprise | from $4K/seat/yr | Business + custom DLP presets, DPA negotiation, CMEK, on-call |

No separate "Enterprise Edition" binary. The OSS code **is** the commercial code; the commercial license is a contract artefact, not a different build.

This is the Grafana / Bitwarden / Plausible model. It's been tested, it works, and it solves the "but my customers can't AGPL their SaaS" objection cleanly.

## What this is NOT

- **Not SOC 2 / HIPAA / ISO 42001 / FINRA certified yet.** The technical controls are implemented; the attestation is what's missing. Year-1 revenue funds the audit. If you need the paper today, this isn't your vendor today.
- **Not a managed SaaS in year 1.** Self-host only. We may add a hosted plane in year 2 for firms that prefer it.
- **Not a legal determination.** DLP is heuristic. Every regulated buyer must run its own ethics / compliance review of any AI vendor — including this one.

I'd rather tell you that on day one than walk it back six months from now.

## How it compares

| | sdlc-platform | LiteLLM | Portkey | Microsoft Presidio | Nightfall |
|---|---|---|---|---|---|
| License | AGPL + commercial | OSS + enterprise | MIT (+ managed) | MIT | Closed |
| DLP focus | Native, multi-preset | Built-in regex pack | Enterprise tier | Yes, primitive only | Yes |
| Browser + IDE + Office shims | Roadmap (browser & VS Code already shipped) | None | None | None | Browser yes |
| Multi-provider routing | Yes | Yes (100+) | Yes (1,600+) | N/A | Limited |
| Self-hostable | Yes | Yes | Yes (gateway core) | Yes | No |

LiteLLM and Portkey are the gateway category leaders, and they're great at what they do. The gap is that PII-first design isn't their north star — it's a feature. The bet here is that a privacy-first gateway, with regulated-vertical presets, browser / IDE / Office surfaces shipping in the same monorepo, and an AGPL+commercial path for embedders that LiteLLM Enterprise won't touch, is a defensible wedge.

## What I'd like from you

1. **`docker-compose up` and try it.** PRs welcome. The 200-line file cap, the SPDX header rule, the CLA — all documented in `CONTRIBUTING.md`.
2. **Tell me what's missing for your use case.** Open an issue. The DLP preset list is going to grow based on what actual users hit first.
3. **If you want the commercial license** ($39 - $4K/seat depending on tier), `sdlc.cc/pricing`. If you want to talk before you buy, `commercial@sdlc.cc`.

The next two weeks are the public-launch sprint — Show HN, Product Hunt, Chrome Web Store, VS Code Marketplace. If "privacy gateway for any LLM" sounds like something your shop has been searching for, this is the time to throw a star, a PR, or a complaint at the repo.

[github.com/finsavvyai/sdlc-platform](https://github.com/finsavvyai/sdlc-platform) · [sdlc.cc/pricing](https://sdlc.cc/pricing) · [Trust Center](https://trust.sdlc.cc)
