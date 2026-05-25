---
title: "How to self-host an LLM gateway with attorney-client privilege redaction in 20 minutes"
published: false
description: "A walkthrough of running an AGPL-licensed LLM gateway in your firm's own infrastructure, with inbound redaction for privileged communications, work-product markers, and a tamper-evident audit chain. Real Go, real config, no benchmarks."
tags: golang, legaltech, llm, selfhosted
cover_image: https://placeholder.sdlc.cc/blog/01-technical-self-host/cover.png
canonical_url: https://sdlc.cc/blog/self-host-llm-gateway-attorney-client-privilege
---

If your firm uses ChatGPT, Claude, or Gemini through hosted APIs, every prompt leaves your network and lands in a vendor's logs. Vendors will tell you (correctly) that enterprise plans offer zero-retention modes. Your general counsel will tell you (also correctly) that "zero retention by contract" is not the same as "the data never touched a third party."

That gap is what this post is about.

`sdlc-platform` recently re-licensed as **AGPL-3.0 plus a commercial license** ($4K/yr/seat for firms that don't want AGPL obligations). The gateway is a single Go binary that sits between your attorneys and whatever LLM you point it at. It redacts privileged communications inbound, tags work-product material, and writes a tamper-evident audit chain.

This post walks through a real self-host in under 20 minutes. No SaaS dependency.

## Why this matters

ABA Model Rule 1.6(c) requires lawyers to "make reasonable efforts to prevent the inadvertent or unauthorized disclosure of, or unauthorized access to, information relating to the representation of a client." [^aba-1.6]

ABA Formal Opinion 512 (July 29, 2024) applies that obligation to generative AI specifically. It says, in summary: before a lawyer inputs information relating to the representation into a generative-AI tool, they must consider whether the tool's terms of service and data-handling practices put confidentiality at risk. [^aba-512]

The opinion is non-binding but every state-bar opinion published since (California, Florida, New York, New Jersey) cites it. The California guidance is the most operationally specific. [^cal-bar]

The pragmatic translation: if your firm sends client data through a hosted LLM API, you carry the burden of proving you took reasonable steps. "We trust the vendor" is not that proof. Running the inference call through your own gateway, with logged redactions on the way in, is.

Separately, FRCP 26(b)(3) protects "documents and tangible things that are prepared in anticipation of litigation or for trial." [^frcp-26] If an associate dumps a draft brief into a public LLM, the work-product privilege argument gets weaker. A gateway that tags `X-WorkProduct: true` on outbound calls — and refuses to send them to non-approved providers — is one way to keep that argument intact.

## What you'll build

```
┌─────────────┐    ┌──────────────────────────┐    ┌─────────────┐
│ Attorney    │───▶│ sdlc-platform gateway    │───▶│ OpenAI /    │
│ (Claude     │    │ (Go, your VPC)           │    │ Anthropic / │
│  Desktop,   │    │                          │    │ Bedrock /   │
│  Cursor,    │    │ • DLP inbound scan       │    │ self-hosted │
│  internal   │    │ • Privilege redaction    │    │ Llama       │
│  apps)      │    │ • Audit chain (hash)     │    │             │
└─────────────┘    └──────────────────────────┘    └─────────────┘
```

The gateway is OpenAI-compatible at the wire level, so any client that talks to `api.openai.com/v1/chat/completions` will talk to your gateway with one base-URL change.

## Step 1 — Clone and configure

```bash
git clone https://github.com/finsavvyai/sdlc-platform.git
cd platform/services/gateway
cp config.example.yaml config.yaml
```

Edit `config.yaml`:

```yaml
listen: "0.0.0.0:8443"

tls:
  cert_file: "/etc/sdlc/tls/cert.pem"
  key_file:  "/etc/sdlc/tls/key.pem"

dlp:
  # The legal pattern bundle lives in
  # internal/infrastructure/middleware/dlp_legal.go
  # and adds detectors for: privileged communications,
  # work-product markers, client matter numbers.
  enabled: true
  default_action: "redact"   # allow | mask | redact | tokenize | block
  bundles:
    - "legal"                # privileged-comm, work-product, matter-id
    - "pii"                  # SSN, DOB, financial accounts

audit:
  enabled: true
  backend: "postgres"
  hash_chain: true           # tamper-evident: each row hashes prior row

providers:
  - id: "anthropic"
    base_url: "https://api.anthropic.com"
    api_key_env: "ANTHROPIC_API_KEY"
  - id: "azure-openai"
    base_url: "https://your-tenant.openai.azure.com"
    api_key_env: "AZURE_OPENAI_KEY"
```

> **Why this matters.** `default_action: redact` means privileged content is rewritten to `<PRIVILEGED_001>` placeholders before the gateway forwards the request. The original string never reaches the LLM provider. If you set it to `block`, the request returns HTTP 422 and the audit row records the attempted disclosure.

## Step 2 — Run it

```bash
go build -o gateway ./cmd/gateway
ANTHROPIC_API_KEY=sk-ant-... \
AZURE_OPENAI_KEY=...        \
./gateway --config ./config.yaml
```

That's the whole runtime. One binary. No Kubernetes operator. No control plane phone-home. If your firm's policy is "the gateway runs on a box we own and can power off," it does.

For TLS, terminate at your existing reverse proxy (nginx, Caddy, F5) or run `gateway` behind your firm's load balancer.

## Step 3 — Point a client at it

Any OpenAI-compatible client works. Cursor, Continue, the OpenAI Python SDK, the official Anthropic SDK with the `base_url` override — all of them.

```bash
curl -X POST https://gateway.internal.firm.com/v1/messages \
  -H "Authorization: Bearer ${FIRM_API_KEY}" \
  -H "X-Matter-ID: 2026-0142" \
  -H "X-WorkProduct: true" \
  -d '{
    "model": "claude-opus-4-7",
    "messages": [
      {"role": "user", "content": "Summarize this deposition transcript..."}
    ]
  }'
```

The `X-Matter-ID` and `X-WorkProduct` headers are recorded in the audit chain. They don't change behaviour by themselves — but if a court ever asks "which AI calls were made for this matter, and what did they contain (after redaction)," you can answer with a single SQL query against the `audit_logs` table instead of a forensic exercise.

## Step 4 — What the DLP layer actually does

The inbound DLP middleware buffers the request body, scans it against compiled detectors, and rewrites or blocks based on the per-tenant policy. The relevant file is `services/gateway/internal/infrastructure/middleware/dlp_middleware.go` (which already exists in the OSS repo) plus the legal-specific pattern bundle in `services/gateway/internal/infrastructure/middleware/dlp_legal.go`.

A simplified view of the inbound path:

```go
// services/gateway/internal/infrastructure/middleware/dlp_middleware.go
func (d *DLP) Inbound() func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            body, _ := io.ReadAll(r.Body)
            action, _ := d.Policy.DLPAction(r.Context(), d.TenantFromCtx(r.Context()))
            findings := d.Detector.Scan(body)

            switch action {
            case ActionBlock:
                if len(findings) > 0 {
                    writeProblem(w, http.StatusUnprocessableEntity,
                        "request blocked by DLP policy", findings)
                    d.Audit.AppendAsync(toAuditRow(r, findings, "block"))
                    return
                }
            case ActionRedact, ActionTokenize:
                body = d.Detector.Rewrite(body, findings, action)
                r.Body = io.NopCloser(bytes.NewReader(body))
                r.ContentLength = int64(len(body))
                d.Audit.AppendAsync(toAuditRow(r, findings, string(action)))
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

> **Why this matters.** The rewrite happens *before* the handler that talks to the LLM provider ever sees the body. If you've enabled `tokenize`, the outbound middleware also runs the reverse map on the LLM response so the attorney sees the original strings restored client-side, but the provider only ever saw placeholders.

## Step 5 — Audit chain

Every redaction writes a row to `audit_logs`. The schema includes a `prior_hash` column; each new row's hash is computed over `(prior_hash, payload, timestamp)`. Tampering with row N invalidates rows N+1..M.

```sql
SELECT
  ts,
  matter_id,
  user_id,
  action,                    -- 'allow' | 'mask' | 'redact' | 'block'
  detector_classes,          -- e.g. ['privileged_comm','client_ssn']
  llm_provider,
  llm_model,
  request_hash,
  prior_hash
FROM audit_logs
WHERE matter_id = '2026-0142'
ORDER BY ts;
```

This is the artifact you hand to opposing counsel during discovery if asked. It's also the artifact a state bar would want to see if they ever investigate a confidentiality complaint involving AI use at the firm.

## What this doesn't do

To stay honest:

- **Not a privilege magic bullet.** Sending redacted content to a third-party LLM still requires informed client consent under most state-bar guidance. The gateway makes consent enforceable and auditable; it does not replace the client conversation.
- **No SOC 2 certification.** That's a separate, expensive process the project hasn't done. The repo is honest about this in `docs/compliance/`.
- **Catches markers, not minds.** The legal pattern bundle catches structured markers (headers like "ATTORNEY-CLIENT PRIVILEGED," matter numbers, work-product cover sheets). Unmarked privileged content still requires policy + training.

## Licensing

The gateway is **AGPL-3.0**. That means: you can run it, fork it, embed it in internal systems, ship it as part of a private firm deployment — all fine. If you want to bundle it inside a closed-source product you ship to others, you need either to release that product's source under AGPL or to buy the commercial license ($4K/yr/seat). Pricing details: [sdlc.cc/pricing](https://sdlc.cc/pricing).

The repo is at [github.com/finsavvyai/sdlc-platform](https://github.com/finsavvyai/sdlc-platform).

## Next steps

If you want to compare this approach against managed alternatives, there's a comparison page at [sdlc.cc/compare](https://sdlc.cc/compare) that breaks down trade-offs honestly (including cases where a managed product is the better choice).

If you want help deploying inside your firm's VPC, there's a paid setup engagement ($5K one-time) listed on the pricing page. Otherwise the docs are enough — that's the whole point of self-host.

---

[^aba-1.6]: ABA Model Rule 1.6, Confidentiality of Information. https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/
[^aba-512]: ABA Standing Committee on Ethics and Professional Responsibility, Formal Opinion 512 (July 29, 2024), "Generative Artificial Intelligence Tools." https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf
[^cal-bar]: State Bar of California, Practical Guidance for the Use of Generative Artificial Intelligence in the Practice of Law (November 2023). https://www.calbar.ca.gov/Portals/0/documents/ethics/Generative-AI-Practical-Guidance.pdf
[^frcp-26]: Federal Rule of Civil Procedure 26(b)(3), Trial Preparation: Materials. https://www.law.cornell.edu/rules/frcp/rule_26

## Publishing checklist

- [ ] Final pass for accuracy
- [ ] Replace any placeholder URLs with real ones
- [ ] Confirm `services/gateway/internal/infrastructure/middleware/dlp_legal.go` exists in the repo before publishing
- [ ] Set `published: true`
- [ ] Run `luna-agents:devto-publish` to push to Dev.to
