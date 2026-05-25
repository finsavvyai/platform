# Show HN — submission package

## Title (under 80 chars)

`Show HN: SDLC – Self-hosted Go gateway that scrubs PII before any LLM call (AGPL)`

(78 chars including "Show HN:".)

## URL

`https://github.com/finsavvyai/sdlc-platform`

## First comment (post immediately after submission)

Hi HN — Shahar here. Solo dev, two weeks of focused work on top of a year of background research.

The repo is a Go gateway that runs DLP on every prompt before it hits OpenAI / Anthropic / Gemini / Copilot / Bedrock / Vertex / Azure or your local vLLM. AGPL-3.0 for the OSS release, $39–$4K/seat commercial license to lift the AGPL obligation for closed-source embedders. Same binary either way.

What's actually in `main` today, not the roadmap:

- `POST /v1/redact` — standalone scan endpoint. Your client hits it before submitting to the LLM and gets back the redacted text + detection spans. Mounted, integration-tested, 15/15 green.
- Five DLP presets — `pii_default` (emails, phones with NANP area-code anchoring, SSN, Luhn-validated cards, USPS-anchored addresses, honorific-prefixed names), `secrets` (anthropic_key / openai_key / aws_access_key / github_token / slack_token / stripe_key / jwt / private-key armor / DB connection strings), `legal`, `finance` (IBAN / BIC / Israeli ID / ABA routing), `healthcare` (PHI marker / NPI / DEA / ICD-10).
- HMAC-chained audit log, RBAC + SCIM 2.0 + SAML SSO, per-tenant spend caps, OPA Rego policy engine, CMEK envelope encryption.
- Browser-extension scaffold (MV3, content scripts for chat.openai.com / claude.ai / gemini.google.com / copilot.microsoft.com), VS Code addin with two commands.

Why a new entrant in a crowded space:

- LiteLLM (47.9k stars) and Portkey gateway (11.8k, MIT) are the category leaders. Both are great at provider routing. Neither is privacy-first by design — DLP is a feature on the side.
- Microsoft Presidio (8.2k, MIT) is the PII primitive — not a gateway.
- Closed-source money is Nightfall, Cisco-Lakera, Harmonic. The Lakera-Cisco $300M acquisition (May 2025) made every Lakera customer a Cisco customer; a chunk of them want an alternative they can actually inspect.

What I'm explicitly NOT claiming:

- No SOC 2 / HIPAA / ISO 42001 cert yet. The technical controls are implemented; the attestation is what's missing. Year-1 revenue funds the audit. If you need the paper today, this isn't your vendor today — and I'd rather say that here than in an enterprise call six months in.
- No managed SaaS in year 1. Self-host only.
- DLP is heuristic. Production-grade NER (Microsoft Presidio) is a documented integration hookpoint, not a shipped backend.

The interesting design choice for HN: the OSS code is the commercial code. There's no separate "Enterprise Edition" binary. The commercial license is a contract artefact that lifts the AGPL source-disclosure obligation for closed-source embedders — same Grafana / Bitwarden / Plausible pattern. Solves the "but our SaaS can't go AGPL" objection without forking the codebase or hiding features behind an enterprise flag.

Happy to dig into the regex design, the Luhn-validation false-positive suppression, the per-tenant preset opt-in via PostgreSQL migrations 032/033, the HMAC audit-chain shape, or anything else. Brutal feedback welcome — I'd rather hear what's broken on day one of HN than from a paying customer in month three.

`docker-compose up` → `curl localhost:8080/v1/redact …` → judge for yourself.

## Anticipated objections + replies (have these ready)

**"AGPL is a non-starter for our SaaS."**
> Right — that's exactly what the commercial license at $39–$4K/seat is for. One contract artefact, no AGPL obligation. The OSS code stays AGPL so the community version doesn't get rug-pulled into closed source.

**"Why not just use Presidio directly?"**
> You can, and the `extra patterns` interface is designed to plug Presidio in. What this repo adds is the gateway shell: multi-provider routing, audit log, RBAC, spend caps, browser / IDE / Office shims. Presidio is the PII primitive; this is everything between the primitive and the buyer's compliance team.

**"LiteLLM has guardrails."**
> Correct. LiteLLM ships keyword blocking + integrations with Bedrock Guardrails / Aporia / Guardrails AI / Lakera. The bet here is that PII-first design as the north star produces a different product than DLP-as-a-feature — particularly the regulated-vertical presets (legal / finance / healthcare) and the cross-surface coverage (browser + IDE + Office) most gateways don't ship.

**"Why Go?"**
> Single-binary deployment, sub-millisecond latency budget on the hot path, no Python dependency tree for the gateway core. Presidio is Python and runs as a sidecar when you want NER-backed name detection.

**"How is this not the Heppner-case legal-AI pivot you did last week?"**
> Fair callout. Legal AI is one DLP preset (`legal`) now, not the headline. Heppner is still a real wedge in legal-vertical sales, but the broader-product framing converts better — privacy gateway covers legal, AML, healthcare, and general enterprise in the same backend.

**"Is the landing live?"**
> Pricing page is wired, Cloudflare Pages deploy is the next step. Repo is the source of truth today.

## Where else to syndicate (different framings)

- **r/selfhosted** — lead with `docker-compose up` and the self-host-as-policy story.
- **r/programming** — lead with the Go internals, the Luhn-validation false-positive suppression, the regex design notes.
- **r/MachineLearning** — lead with the multi-provider routing + DLP-as-a-preset architecture.
- **r/devops** — lead with the OPA Rego policy engine + audit-log shape.
- **r/cybersecurity** — lead with the Lakera-Cisco vacuum + the AGPL-vs-Cisco-AI-Defense framing.
