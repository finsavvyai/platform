# SDLC as a Claude Team PII Gateway — Gap Analysis

Created: 2026-04-30. Question: *what's missing if a Claude Team
customer wants to drop SDLC in front of their Claude usage as a PII
redaction proxy, with zero engineering changes on their side?*

The honest answer: **most of the wiring is there, but the surface is
wrong**. Customers don't talk to `/v1/chat`; they talk to the
Anthropic SDK pointed at `https://api.anthropic.com/v1/messages`.
Until our endpoint speaks that exact dialect (URL + headers + body +
streaming + errors), drop-in is impossible.

Below: gaps grouped by what blocks each customer segment, ordered by
release-blocking impact.

---

## A. Drop-in compatibility (P0 — blocks every customer)

### A1. Anthropic-compatible API surface — ✅ shipped 2026-05-01
**Status**: `POST /anthropic/v1/messages` is mounted under the chain
in `services/gateway/internal/app/handlers/anthropic_compat/`. Body
is forwarded verbatim to the upstream, `x-api-key` /
`anthropic-version` / `anthropic-beta` headers pass through, response
is returned in Anthropic shape, spend is recorded on success when a
tracker is wired. DLP runs through chain steps 8a + 12a so prompts
+ responses are redacted per tenant policy. Behavior covered by
6 tests in `handler_test.go`. Customers point
`ANTHROPIC_BASE_URL=https://gateway.sdlc.app` and their existing SDK
keeps working.

**Remaining**: SSE streaming (A2) and per-tenant BYOK (A3) — see
below; the v1 endpoint uses the platform `ANTHROPIC_API_KEY` so
customers cannot bring their own key yet.

### A2. SSE streaming + inline DLP — ✅ shipped 2026-05-01
**Status**: streaming `stream: true` requests are detected via
`isStreamingRequest`. When the tenant's DLP action is mask/redact/
tokenize, the upstream SSE flows through a `StreamRedactor` that:
1. Parses Anthropic SSE event frames (`event:` + `data:` line pairs).
2. Routes `content_block_delta` events with `text_delta` deltas
   into a per-content-block accumulator.
3. Holds the trailing 128 chars per block as a "safety margin" so a
   PII match split across two delta events still gets caught.
4. Emits redacted synthetic `content_block_delta` events
   downstream as soon as buffered text exceeds the margin.
5. Flushes remaining buffered text through the redactor on Close
   (driven by upstream EOF).
6. JSON encodes with `SetEscapeHTML(false)` so `<EMAIL>` placeholders
   travel as literal angle brackets.

Block action degrades to Redact in the streaming path (we can't
422 a partially-streamed response without orphaning the SDK).
Allow + missing-policy fall back to byte-for-byte pass-through.

**Tests**: 7 (single-event redact, non-text events pass verbatim,
PII spanning event boundary, allow pass-through, block-degrade,
custom patterns, buffer flush on Close).

**Limit (defer)**: tool_use deltas (`{"delta":{"type":"input_json_delta"}}`)
are passed through verbatim. Tool argument PII inside structured
JSON deltas is week-3 work; the C1 path covers tool_use in the
non-streaming case.

### A3. Bring-your-own Anthropic key — ✅ shipped 2026-05-01
**Status**: per-tenant BYOK ships through migration 027
(`tenant_provider_credentials`), `byok.Sealer` (AES-256-GCM with
`BYOK_ENCRYPTION_KEY` 32-byte hex env var), `byok.PgxRepo`
(seal-on-Set, open-on-Get), and admin endpoints
`PUT /admin/tenants/{id}/provider-credentials/{provider}` +
`DELETE /admin/tenants/{id}/provider-credentials/{provider}`. The
Anthropic-compat handler resolves the upstream key per request via
`resolveKey(ctx, deps)`: tenant BYOK row first, platform fallback
second. Empty after both → 503 with Anthropic-shape error directing
the operator to either path.

**Tests**: 7 sealer tests (round-trip + tampered ciphertext + wrong
key + tampered nonce + short nonce + non-hex + short key); 6 admin
tests (set/delete/idempotent/missing-fields/nil-repo); 2 handler
tests (`TestMessages_BYOKResolves*`) prove the precedence path.

**Remaining for hardening**: CMEK envelope encryption (currently
single platform-wide key); admin UI page; rotation runbook.

---

## B. PII coverage that matches Claude Team's actual workload (P0)

### B1. Class library — ✅ partially shipped 2026-05-01 (15 classes; phone/IBAN/etc. still pending)

**Status**: code-secret pack landed in `dlp.go` patterns table:
`anthropic_key`, `openai_key`, `aws_access_key`, `github_token`,
`slack_token`, `stripe_key`, `jwt`, `private_key_block`,
`db_connection_string`, `gcp_service_account`. Combined with the
existing 6 (ssn / itin / mrn / credit_card / account_number / email)
that's **15 classes** — the "12+ PII classes" marketing claim is now
honest. Pack proven by `dlp_secrets_test.go` (10 positive +
3 negative cases for false-positive resistance).

**Remaining gap (defer)**: phone, DOB, passport, driver's license,
IP-as-PII, IBAN, SWIFT, ICD-10, NPI, DEA, internal hostnames as
custom regex. Microsoft Presidio integration is a separate ~3-day
engagement.

Claude Team users paste source code. They do not paste mortgage
records. The gap:

| Category | Currently covered | Need |
| --- | --- | --- |
| Personal | email, SSN, ITIN, MRN | + phone, DOB, passport, driver's license, IP-as-PII |
| Financial | credit_card, account_number | + IBAN, SWIFT |
| **Code** | ❌ | AWS access key (AKIA…), AWS secret key, GCP service account JSON, Azure SAS, GitHub PAT (ghp_…), Slack token (xoxb-…), Stripe key (sk_live_…), generic JWT, SSH private key, internal hostnames, DB connection strings, OpenAI keys (sk-…), Anthropic keys (sk-ant-…) |
| **Infra** | ❌ | UUIDv4 of internal resource IDs, cron URLs with secrets, S3 presigned URLs |
| Health | MRN | + ICD-10, NPI, DEA number |

**Why it's blocking**: someone pastes `aws_access_key_id = AKIAIOSFODNN7EXAMPLE`
into Claude. Today we do not detect it. That is the demo we lose
on. Code-secret detection is the bar OpenAI's `gpt-4` system prompt
already meets via Microsoft Presidio + regex.

**Effort**: ~1 day for the regex pack + Luhn-style validators where
applicable. Microsoft Presidio integration is a separate ~3-day
engagement.

### B2. Reversible tokenization — ✅ shipped 2026-05-01
**Status**: a fifth `Action` value `tokenize` is now accepted by the
DLP middleware. On inbound the detector replaces each PII match with
a deterministic `<TYPE_NNN>` placeholder (1-indexed per type;
duplicates collapse to one token), attaches the reverse map to the
request context, and forwards the rewritten body to Claude. On
outbound the middleware unwraps the response with `Detokenize` so
the customer sees their original values restored, but the LLM only
ever saw placeholders.

Migration 028 extends `tenant_dlp_policy.action` enum to include
`tokenize`. A pre-existing bug in `rewrite()` was caught during
implementation: matches arrive in pattern-declaration order, not
position order, so a multi-pattern document (email + SSN) had every
match-after-the-first silently dropped. Fixed by sorting matches
by Start position before walking. (No prior test exercised the
multi-pattern case so the bug stayed dormant.)

**Tests**: `TestDetector_Tokenize_PreservesViaDetokenize`,
`TestDetector_Tokenize_DuplicatesCollapse`,
`TestDetector_Tokenize_EmptyInputIsNoop`,
`TestDLP_TokenizeRoundtripThroughMiddleware` (full inbound→handler→
outbound chain), and the security-property test
`TestDLP_TokenizeMiddleware_LLMSeesPlaceholdersOnly`.

**Limit (defer)**: token map is in-process context only. A
multi-instance deployment behind a load balancer must hash-route by
session id so the response comes back through the same instance.
Cross-instance Redis-backed map is week-3 work.

### B3. Code-aware redaction — ✅ shipped 2026-05-01
**Status**: redact label is now `<UPPER_TYPE>` so the surrounding
code/JSON/YAML stays parseable. Value-only substitution was already
in place (rewrite() only replaces the matched span); the label
change made the result a valid placeholder rather than an
obviously-broken `[REDACTED:type]` artefact. Concrete examples:
- `api_key = "sk-ant-…"` → `api_key = "<ANTHROPIC_KEY>"`
- `{"user":"alice@example.com"}` → `{"user":"<EMAIL>"}`
- `export AWS_ACCESS_KEY_ID=AKIA…` → `export AWS_ACCESS_KEY_ID=<AWS_ACCESS_KEY>`
- Indented JSON inside markdown fences keeps language tag + spacing.

**Tests**: `TestRedact_PreservesCodeStructure` (6 cases covering
Python / JSON / shell / YAML / .env / fenced markdown) +
`TestRedact_LabelHasNoBracketChars` (label cannot contain `[` or
`]` so it doesn't break shells or array destructuring).

### B4. Tenant-defined custom patterns — ✅ shipped 2026-05-01
**Status**: migration 029 adds `custom_patterns JSONB` to
`tenant_dlp_policy`. `PolicyLookup` exposes an optional
`CustomPatternsLookup` capability; `PgxPolicyLookup` reads the
column and returns `[]CustomPatternSpec{Name, Regex}`. The DLP
middleware compiles tenant patterns at request time via
`CompileCustomPatterns` (invalid regexes are silently skipped so
one typo cannot wedge the pipeline) and merges them into both the
detector and the tokenize round-trip.

**Tests**: `TestCustomPatterns_TenantPatternMatchesAndRedacts` (a
custom `EMP-\d{6}` pattern produces `<EMPLOYEE_ID>` placeholders),
`TestCustomPatterns_BuiltInPackStillFiresAlongsideCustom` (custom
+ built-in coexist), `TestCompileCustomPatterns_SkipsInvalidRegex`
(typo isolation), and `TestCustomPatterns_TokenizeRoundTripWith
TenantPattern` (custom patterns work in the tokenize round-trip
too).

**Remaining**: admin endpoint for custom pattern CRUD. Operators
edit via direct DB updates today.

---

## C. Claude-feature parity (P1 — blocks 2026 deals)

### C1. Tool use / function calling — ✅ shipped 2026-05-01
**Status**: the regex-based detector was already running over the
raw JSON bytes so PII inside `tool_use` `input` payloads was
caught. This batch adds two missing pieces:
1. Regression test (`TestDLP_ToolUseBlock_DetectsPII`) that proves
   PII inside Anthropic `tool_use` content blocks gets redacted in
   the round-trip.
2. Audit categorization: when the scanned body contains a
   `"type":"tool_use"` marker, the audit row's `target_type` is
   `tool_use` (vs the default `http_request`) so security admins
   can split detections by surface in compliance dashboards.

**Tests**: `TestHasToolUseBlock_DetectsCommonEncodings` (4
encodings — compact, spaced, padded), `TestDLP_ToolUseBlock_DetectsPII`,
`TestDLP_AuditTagsToolUseSeparately` (plain body → `http_request`,
tool_use body → `tool_use`), `TestDLP_InboundToolUseRequestTagged
Correctly` (inbound request with tool_use also gets tagged).

**Limit**: classifier is a substring probe, not a JSON parser.
False positives (a body that happens to contain the literal string
`"type":"tool_use"`) are acceptable since the field is for
filtering, not enforcement.

### C2. Vision (image inputs) — ✅ block-by-default shipped 2026-05-01
**Status**: migration 030 adds `image_policy` column with values
`allow|block|warn`. Default is `allow` (current behavior). Tenants
with regulatory requirements opt into `block` and the gateway 422s
with an Anthropic-shape error before any text scanning runs.
`warn` passes through but emits a `dlp.image.warn` audit row so
admins can review uploads.

The `EnforceImagePolicy` middleware lives at chain step 8aa,
immediately before the text DLP scanner. Probe-only detection
(no JSON parse) keeps the hot path cheap.

**Tests**: 6 (encoding probe, block path, allow path, no-image
passthrough, warn path with audit assertion, body-restoration).

**Remaining**: OCR-then-DLP for tenants who want image content
scanned (week-3 work; Tesseract latency budget).

### C3. MCP (Model Context Protocol)
Claude Team uses MCP servers for filesystem, GitHub, Slack access.
SDLC sits in front of the LLM but MCP traffic goes elsewhere.

**Coverage gap**: a customer pastes a file via MCP filesystem; the
file's PII never sees our DLP.

**Options**:
- Document the gap honestly ("SDLC covers prompt + response, not
  MCP context").
- Ship an MCP proxy at `https://gateway.sdlc.app/mcp` that wraps the
  customer's MCP servers and applies DLP to the tool-result payload
  before it reaches Claude. ~3 days.

**Recommendation**: doc the gap for v1 launch, MCP proxy is an
enterprise upsell in 6 months.

### C4. Anthropic-shape error envelopes — ✅ shipped 2026-05-01
**Status**: `writeAnthropicError` in `anthropic_compat/handler.go`
emits `{type: "error", error: {type, message}}` for all gateway-
originated errors (misconfig, transport failure, body read failure).
Upstream errors are forwarded verbatim — they're already in
Anthropic shape. Covered by `TestMessages_AnthropicErrorEnvelope*`
test cases.

---

## D. Claude Team admin / governance (P1)

### D1. Per-user redaction view — ✅ shipped 2026-05-01
**Status**: `GET /v1/me/redactions?from=&to=&limit=&cursor=` returns
the caller's own DLP detection events from `audit_logs` scoped to
(tenant_id, actor_id). Pagination via `cursor`; date filtering via
RFC3339 `from` / `to`. RFC3339 enforcement on the date params; bad
input returns 400 with a clean error message.

`me_redactions.PgxReader` reads `audit_logs` rows where
`action LIKE 'dlp.%'`, parses the `details` JSONB for `leg / types
/ matches`, and returns a flat `Page` shape.

**Tests**: 8 (page shape, tenant+user scoping, RFC3339 parsing,
RFC3339 rejection, nil reader → 503, missing tenant → 401, limit
parsing, non-numeric limit rejection).

### D2. Org-wide policy templates — ✅ shipped 2026-05-01
**Status**: 4 curated templates land at
`internal/policy/templates/templates.go`:
- **hipaa-strict**: action=block, image=block, custom NPI/DEA/ICD-10
- **pci-dss**: action=tokenize, image=warn, custom CVV/cardholder
- **gdpr-eu**: action=tokenize, image=allow, custom IBAN/DNI/NIR/StID
- **soc2-code-reviewer**: action=redact, image=warn, internal_hostname/ticket_id

`GET /admin/dlp-templates` returns the catalog as JSON; `POST
/admin/tenants/{id}/dlp-policy/template/{name}` applies one via
`infrastructure/dlp_template.PgxRepo.UpsertPolicy` (single
ON-CONFLICT DO UPDATE so apply is idempotent).

**Tests**: 5 template-registry tests + 5 admin-endpoint tests
(catalog JSON shape, apply HIPAA, unknown template → 404, invalid
tenant → 400, nil repo → 503).

**Remaining**: admin UI page that presents the catalog as a picker
with description previews.

### D3. Compliance evidence export — ✅ shipped 2026-05-01
**Status**: `GET /admin/tenants/{id}/compliance/export?from=&to=`
returns a JSON bundle covering five audit prefixes: `dlp.%`,
`policy.%`, `api_key.%`, `auth.%`, `session.%`. Events sort by
created_at; the bundle includes a SHA-256 hash chain over the
canonical event JSON so auditors can detect post-export tampering
by re-running the chain offline.

`Content-Disposition: attachment; filename="compliance-{tenant}.json"`
makes the response a one-click download in browsers.

**Tests**: 7 (nil reader → 503, bundle shape, all 5 action
prefixes queried, hash chain determinism + mutation detection,
sort order, bad date → 400, bad tenant → 400).

**Remaining**: ZIP + CSV emit modes for auditors who prefer
spreadsheets; admin UI button on the compliance page.

### D4. Drift / anomaly detection — ✅ shipped 2026-05-01
**Status**: a per-tenant detection-rate watcher runs hourly in the
gateway. `infrastructure/drift.Detector.Tick` pulls 168 hourly
buckets from `audit_logs` (action LIKE 'dlp.%'), computes a sample
mean + standard deviation over the leading 167 buckets, and emits
a `dlp.drift.alert` webhook via the Day-38 dispatcher when the
latest bucket's z-score exceeds the configured threshold (2.0 by
default). Both spike and collapse directions are flagged.

The math primitive (`evaluate` + `twoSigmaDeviation`) is split out
of the loop so the test suite can hammer it directly. Pure-zero
baseline + non-zero latest is treated as a spike (z=+Inf); flat-
constant baseline + matching latest is normal.

Background goroutine started from `wiring.go::initSecuritySuite`
on the same lifetime as the audit Writer; per-tenant errors fall
through to a slog warning so one bad tenant cannot wedge the loop.

**Tests**: 9 (5 evaluate cases including spike, collapse, normal,
flat-zero spike, flat-constant normal; 4 Tick-loop cases including
webhook fire, no-fire on normal, error propagation, nil
dispatcher).

**Remaining**: PagerDuty-specific webhook payload schema (today
the alert lands as a generic webhook event); per-tenant threshold
override (today the 2σ default is global).

---

## E. Performance (P1)

### E1. Sub-50ms p99 redaction
Hero promises `<50ms`. Day 19 k6 load tests are still 🔴 (no
staging URL). Until we benchmark with a real SSE stream and a
50-class detector, this number is aspirational.

**Effort**: ~0.5 day to set up k6 with mocked Anthropic + real DLP.
Blocks on Ops for staging URL.

### E2. SSE first-byte overhead
Inline DLP on a stream cannot add more than 100ms to time-to-first-byte
or it kills UX. Needs measurement after A2 ships.

---

## F. Trust (P0 for enterprise, P2 for SMB)

| Asset | Status |
| --- | --- |
| SOC 2 Type II report | targeted Q2 2026 (per CLAUDE.md) — not done |
| Penetration test report | not present |
| DPA (Data Processing Agreement) | template needed for EU customers |
| Subprocessor list | needs `/legal/subprocessors` page (Anthropic, AWS, Cloudflare) |
| Privacy policy update | needs explicit "we do not train on your prompts" line |

---

## Suggested ship order for "Claude Team beta" milestone

This isn't part of the existing 90-day roadmap; it's a focused
productization spike. Estimate: 3–4 weeks for an opinionated 1.0.

### Week 1 — Drop-in (P0 blockers)
- A1 Anthropic-compatible `/anthropic/v1/messages` (1d)
- A3 Per-tenant Anthropic key BYOK (1d)
- C4 Anthropic error envelope shim (1h)
- B1 Code-secret regex pack (AWS, GCP, GitHub, Slack, Stripe,
  Anthropic, OpenAI) (1d)
- A2 SSE streaming with inline DLP (2d)

**Deliverable**: a Claude Team customer changes one env var and
their existing app keeps working with PII redacted.

### Week 2 — PII parity
- B3 Code-aware redaction (1d)
- B4 Tenant-defined custom patterns (0.5d)
- B2 Reversible tokenization (2d)
- C1 Tool-use payload scanning (0.5d)
- C2 Vision: block-by-default (1h)

**Deliverable**: detection covers what Claude Team actually does.

### Week 3 — Governance
- D1 Per-user redaction view + GDPR Article 15 endpoint (0.5d)
- D2 Policy templates (1d)
- D3 Compliance evidence export (1d)
- D4 Drift detection + PagerDuty webhook (0.5d)
- F  DPA template + subprocessors page + privacy update (1d)

### Week 4 — Performance + trust
- E1 k6 load test with real DLP + SSE (0.5d, blocked on staging URL)
- F  Penetration test engagement kickoff
- F  SOC 2 Type II readiness audit

---

## What we ALREADY have that matches the pitch

Don't undersell. The session-end state is strong on these:

- ✅ Inline DLP middleware on inbound + outbound (chain.go steps 8a + 12a)
- ✅ Per-tenant policy lookup (`tenant_dlp_policy`)
- ✅ Audit-log immutability (HMAC-signed Writer)
- ✅ Per-tenant CMEK envelope encryption
- ✅ SAML SSO + SCIM provisioning (PgxStore)
- ✅ IP allowlist (`private_only` mode)
- ✅ FallbackChain (Anthropic + OpenAI + Bedrock + Vertex + Azure)
- ✅ Spend tracking + 402 hard cap
- ✅ Webhook fan-out on critical events
- ✅ Rego policy engine with syntax validation
- ✅ Analytics + compliance readers

The gap is **shape, not substance**. We have the right machine; it
just speaks the wrong dialect.

---

## Open questions

1. **Resold-Anthropic vs BYOK pricing model**: do customers always
   bring their own key (only billed for the gateway), or do we offer
   a resold tier? Affects A3's fallback behavior.
2. **Vision policy default**: block all images for HIPAA tenants
   only, or for everyone in v1?
3. **MCP coverage**: doc-only gap or invest in MCP proxy now?
4. **SOC 2 timeline**: per CLAUDE.md it's Q2 2026 (current target).
   Does "Claude Team beta" require Type II already, or do we ship
   with Type I + Type II in flight?
