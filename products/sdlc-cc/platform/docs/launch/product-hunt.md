# Product Hunt launch — copy pack

## Name

`SDLC — Privacy gateway for any LLM`

## Tagline (60 chars max)

`Scrub PII out of every prompt before it reaches an LLM`

(54 chars.)

## Description (260 chars max)

`Self-hosted Go gateway that detects and redacts PII, secrets, IBAN, PHI, and case identifiers before prompts hit ChatGPT, Claude, Gemini, or Copilot. AGPL-3.0 + commercial license. Browser + IDE + Office shims on the same backend. docker-compose up to try.`

(254 chars.)

## Topics

- Developer Tools
- Privacy
- Artificial Intelligence
- Open Source
- SaaS

## First comment (maker's pitch — keep under 1,500 chars)

Hey Product Hunt — Shahar here, solo maker.

I built **SDLC** because the same conversation kept happening on every enterprise call: "we want to use Claude / GPT, but legal won't let us send customer data to a third-party LLM." Cisco's $300M acquisition of Lakera Guard in May 2025 confirmed the category, but it also turned every Lakera customer into a Cisco customer — and a lot of them want an alternative they can actually self-host and inspect.

So I open-sourced one.

**What you get on day one:**

🛡️ `POST /v1/redact` — your client hits the gateway before submitting to the LLM. Gets back the scrubbed text + detection spans.
🎯 5 DLP presets — PII default, secrets (API keys / JWT / private keys), legal (privilege / discovery), finance (IBAN / BIC / Israeli ID), healthcare (NPI / DEA / ICD-10).
📜 HMAC-chained audit log — tamper-evident, GDPR Article 15 ready.
🌐 Multi-provider routing — Anthropic, OpenAI, Bedrock, Vertex, Azure, self-hosted vLLM / Ollama.
🔌 Browser + IDE + Office shims on the way — Chrome / Edge / Firefox / Safari, VS Code / JetBrains / Cursor, Word / Outlook.

**Licensing:** AGPL-3.0 if you self-host for internal use, $39–$4K/seat commercial license if you embed in a closed-source product. Same binary either way — no "Enterprise Edition" build hidden behind a feature flag.

**Built with:** Go 1.24, PostgreSQL 16 + pgvector, OPA Rego, Cloudflare Pages for the landing.

Honest disclosure: no SOC 2 / HIPAA cert yet, no managed SaaS in year 1. Year-1 revenue funds the audit. If you need the paper today, this isn't your vendor today.

Try it: `docker-compose up`, then `curl localhost:8080/v1/redact`. Or grab a commercial license at sdlc.cc/pricing.

Brutal feedback welcome. PRs more welcome.

## Gallery captions (5 slots)

1. **Hero.** "Your prompts never leave the building unscrubbed."
2. **Redaction in action.** `curl POST /v1/redact` request/response shot showing `Dr. Jane Doe lives at 123 Main St, call +14155551234` → `<PERSON_NAME> lives at <US_STREET_ADDRESS>, call <PHONE_E164>` with the detection spans alongside.
3. **Browser extension.** Side-by-side ChatGPT compose window — left without extension (raw PII in textarea), right with extension (yellow redaction overlay, "scrubbed before send" toast).
4. **Trust Center.** Screenshot of `trust.sdlc.cc` — sub-processors, DPA, audit-log architecture, SOC 2 readiness disclosure.
5. **Pricing.** The 4-tier comparison table — Free (self-host) / Team $39 / Business $79 / Enterprise from $4K.

## Hunter / collaborator outreach DM (if asking someone to hunt)

> Hey [name] — long shot, but I'm launching an OSS privacy gateway for LLMs on Product Hunt next [day]. It scrubs PII out of every prompt before it hits ChatGPT / Claude / Gemini. AGPL-3.0, Go backend, browser + IDE shims on the way. I'm solo and don't have a big follower base, but the product is real and the timing (Lakera-Cisco vacuum + EU AI Act Aug 2026) is sharp. Would you be willing to hunt it? Repo: github.com/finsavvyai/sdlc-platform — happy to send a preview link or hop on a 10-min call if useful.

## Day-of checklist

- [ ] Submit at 12:01 PT on launch day.
- [ ] Drop the maker comment within the first 5 minutes.
- [ ] Tweet + LinkedIn + Mastodon + Bluesky cross-post with the PH link.
- [ ] DM the 20 people most likely to find this useful — privacy folks, OSS founders, AI consultants.
- [ ] Reply to every comment within 30 min for the first 6 hours.
- [ ] Drop the Show HN at noon ET (same day if PH is going well, day after if it's flat).
- [ ] r/selfhosted + r/programming evening posts.
- [ ] Dev.to article #1 publishes 24h after PH.
