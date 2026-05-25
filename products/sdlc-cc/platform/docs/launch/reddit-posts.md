# Reddit launch pack

Each post is sized to the subreddit's bias. Read each subreddit's
rules and recent top posts before pasting. Self-promo rules are
real — interleave with useful comments elsewhere on the sub for a
week before posting.

---

## r/selfhosted

### Title

`I open-sourced a self-hosted Go gateway that scrubs PII out of LLM prompts before they reach ChatGPT / Claude / Gemini`

### Body

If you've been wanting to let your team use AI without sending customer data to a third-party cloud, this is what I just shipped.

**One `docker-compose up`** stands up a Go gateway with:

- `POST /v1/redact` — your client hits it before submitting to the LLM. Returns the scrubbed text + detection spans.
- Five DLP presets: PII default (emails, phones with NANP area-code anchoring, SSN, Luhn-validated cards, USPS-anchored addresses, honorific-prefixed names), secrets (API keys / JWT / AWS / GitHub / Slack / Stripe / private-key armor), legal, finance (IBAN / BIC / Israeli ID / ABA routing), healthcare (NPI / DEA / ICD-10 / PHI markers).
- HMAC-chained audit log so you can prove what was sent and what was scrubbed.
- Multi-provider routing — Anthropic, OpenAI, Bedrock, Vertex, Azure, plus self-hosted vLLM / Ollama. Bring your own provider keys, the gateway never holds them outside the process.
- RBAC + SCIM 2.0 + SAML SSO + per-tenant spend caps + OPA Rego policy engine if you want to grow past a single team.

Stack: Go 1.24, PostgreSQL 16 + pgvector, Chi router, OpenAPI3.

License: AGPL-3.0 for the OSS release. There's a commercial license at $39–$4K/seat if you need to embed in a closed-source product, but self-host for your own team is free, no strings attached. Same binary either way — no "Enterprise Edition" trick.

Repo: github.com/finsavvyai/sdlc-platform

Honest disclosure: no SOC 2 cert yet, no managed SaaS option, DLP is heuristic (Microsoft Presidio is the documented NER upgrade path). Year-1 revenue funds the audit.

Brutal feedback welcome. The 200-line file cap, the SPDX header rule, the CLA are all documented in CONTRIBUTING.md if anyone wants to send PRs.

---

## r/programming

### Title

`Show /r/programming: AGPL Go gateway that runs DLP on every LLM prompt before it leaves the building`

### Body

Two-week build, open-sourced this week. The interesting parts for a programming-audience post:

**Pattern design.** The hot path is regex-based with Luhn validation downstream for credit cards. The regex set is intentionally conservative — fewer false positives, not maximal recall. NANP area codes are anchored `[2-9]` so ISO dates (`2024-12-31`) don't match the US phone pattern. ZIP codes only match with an explicit `ZIP:` label or a 2-letter state prefix, because bare 5-digit runs false-positive on every order ID in the world.

**Per-tenant preset opt-in.** Vertical presets (legal / finance / healthcare) are off by default and turn on per tenant via PostgreSQL boolean columns (migrations 032 / 033). The PolicyLookup interface composes them in via an optional capability check — `LegalPresetLookup`, `FinancePresetLookup`, `HealthcarePresetLookup`. Lookup failure falls through to nil so a transient DB blip can't drop traffic.

**Tokenize round-trip.** When the per-tenant action is `tokenize`, inbound replaces PII with `<TYPE_NNN>` placeholders and attaches a reverse map to the request context. Outbound detokenises the response so the user sees the original values restored, but the LLM provider never saw them. Same value collapses to the same placeholder so the model sees consistent identifiers.

**HMAC audit chain.** Each row's `chain_hash` is `HMAC(prev_chain_hash || row_bytes)`. Tamper-evident, replay-with-redaction support for GDPR Article 15 requests.

**File-size discipline.** 200-line cap per file is enforced as a contributing rule. DLP preset code lives in sibling files (`dlp_finance.go`, `dlp_healthcare.go`, `dlp_legal_*.go`, `dlp_pii_default.go`) that compose into a single global pattern slice via `init()`. The main `dlp.go` is already over budget (409 lines) — that's tech debt I'm working off.

**Licensing.** AGPL-3.0 + commercial buyout at $39–$4K/seat. No separate Enterprise Edition. The OSS code is the commercial code; the commercial licence is a contract artefact that lifts the AGPL source-disclosure obligation. Grafana / Bitwarden / Plausible pattern.

Repo: github.com/finsavvyai/sdlc-platform

Happy to defend any design choice in the thread. Brutal welcome.

---

## r/MachineLearning

### Title

`[P] Open-source privacy gateway for any LLM — multi-preset DLP + multi-provider routing`

### Body

Solo-built, AGPL-3.0 + commercial buyout for closed-source embedders. The ML-relevant design choices:

- **Heuristic DLP** with a documented NER hookpoint. The detector's `DetectWith(input, extra)` interface lets you plug Microsoft Presidio (or a custom NER stack) for production-grade name detection — the in-repo name pattern only matches honorific-prefixed forms (`Dr. Jane Doe`) to avoid bare-bigram false positives that wreck precision on technical text.
- **Multi-provider routing** with consistent policy across providers — Anthropic, OpenAI, Bedrock, Vertex, Azure, self-hosted vLLM / Ollama. Per-tenant spend caps return RFC 7807 402 on overage so client libraries see a clean failure mode.
- **Tokenisation round-trip.** Action `tokenize` swaps PII for stable `<TYPE_NNN>` placeholders on inbound, restores originals on outbound, so the model output stays usable to the human without leaking the raw values to the provider.
- **HMAC-chained audit log** with replay-with-redaction support for downstream training-data auditing.

Repo: github.com/finsavvyai/sdlc-platform

Honest scope: this is the gateway layer, not the model layer. If you want a base-model PII evaluation, Presidio is the de facto primitive; this is what sits between Presidio and your buyer's compliance team.

---

## r/devops

### Title

`Self-hosted LLM gateway with built-in DLP, audit, OPA Rego policy engine — one docker-compose up`

### Body

Posted on r/selfhosted for the team-self-host story, but the ops-shaped story for /r/devops:

- **Single-binary Go gateway** + PostgreSQL 16 + pgvector. No Python dependency tree on the hot path. Presidio runs as a sidecar when you need NER-backed name detection.
- **OPA Rego policy engine** for version-controlled, auditable DLP / routing policies. Policy changes flow through your existing GitOps pipeline.
- **HMAC-chained audit log** that satisfies GDPR Article 15 replay + tamper-evidence.
- **Per-tenant spend caps** with RFC 7807 problem+json on overage.
- **SCIM 2.0 + SAML SSO** for identity wiring into existing IdPs.
- **CMEK envelope encryption** for the data plane. Customer holds the KEK.

CI matrix: pushci pipeline runs 60 stages on every PR (unit + integration + smoke). Migrations applied via a canonical `database/migrations/` directory through a GitHub Actions workflow that verifies idempotent + duplicate-version-guard semantics.

Repo: github.com/finsavvyai/sdlc-platform · Trust Center: trust.sdlc.cc

Happy to walk through the deployment story for anyone trying to put this behind an existing API gateway (Kong / Envoy / Traefik). The /v1/redact endpoint is designed to compose under those.

---

## r/cybersecurity

### Title

`Open-source AGPL alternative to Lakera Guard / Nightfall — self-hosted Go gateway, multi-preset DLP, audit log`

### Body

Cisco's $300M Lakera Guard acquisition (May 2025) confirmed pre-prompt PII redaction as a budget line item. Every Lakera customer is now a Cisco customer. A chunk of them want an alternative they can self-host and inspect.

This is that alternative.

Repo: github.com/finsavvyai/sdlc-platform · AGPL-3.0 + commercial buyout.

Day-one scope:

- Five DLP presets (PII default, secrets, legal, finance, healthcare) with documented Presidio integration path for NER.
- HMAC-chained audit log — tamper-evident, replay-with-redaction.
- RBAC + SCIM 2.0 + SAML SSO + WebAuthn MFA.
- Per-tenant spend caps + CMEK envelope encryption (customer holds the KEK).
- Multi-provider routing with consistent policy enforcement across providers.

What this is NOT:

- Not SOC 2 / HIPAA / ISO 42001 certified yet — technical controls implemented, attestation funded by year-1 revenue.
- Not a Cisco AI Defense replacement at the enterprise tier today — but the path to it is the year-1 audit cycle.
- DLP is heuristic. Compliance review remains your responsibility.

The interesting cybersecurity-relevant design choice: the OSS code is the commercial code. There is no separate Enterprise Edition binary. The commercial licence is a contract artefact lifting the AGPL source-disclosure obligation, not a different build. That makes the supply-chain audit story symmetric — what you read is what you ship.

Brutal feedback / red-team welcome.

---

## Cadence

- **Day 0 (launch day)**: Show HN at noon ET. Don't post Reddit same day — looks like spam.
- **Day +1**: r/selfhosted (early morning).
- **Day +2**: r/programming.
- **Day +3**: r/MachineLearning.
- **Day +5**: r/devops.
- **Day +7**: r/cybersecurity.
- **Day +10**: Dev.to article #2 if response is good, otherwise post-mortem on what flopped.

Cross-posting the same post the same day to multiple programming subs is the fastest way to get rate-limited. Stagger.
