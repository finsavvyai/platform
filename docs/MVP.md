# Platform v1.0 — MVP Scope

*Target: publishable `1.0.0` of all five packages, with persistence ports + reference adapters, so any consumer product (PushCI, Qestro, LunaOS, OpenSyber, SDLC.cc, AMLIQ) can build on a stable contract. Strategy in [`VISION.md`](VISION.md); market rationale in [`MARKET_RESEARCH.md`](MARKET_RESEARCH.md).*

> **The consumer products live in separate repositories.** This repo ships **only** the published library packages — no product code is wired here. v1.0's job is therefore a **stable, versioned public contract** that those repos consume; "done" is measured by published packages + injectable ports, not by an end-to-end product demo.

## Where we are (v0.1.0)

~1,300 lines of clean, framework-agnostic TypeScript. Every package ships **in-memory reference implementations of well-defined interfaces** — the architecture (ports-and-adapters, errors-as-values, strict ESM) is sound. What's missing for a real platform: **persistence, a few functional gaps, audit logging, and release machinery.**

| Package | State today | Biggest v1.0 gap |
|---|---|---|
| `auth` | Most complete (JWT, HMAC, RBAC, SCIM, WebAuthn, Hono mw) | Audit emission; OAuth/API-key lifecycle helpers |
| `policy-engine` | `RuleEngine` + 2 toy rules; thin `PolicyContext` | Real PR/diff model; rule-config loader; AI-governance rules |
| `telemetry` | In-memory tracer + AI-exec logger | **Replay does not exist yet** (docs promise it); no persistence/serialization |
| `billing` | Entitlement check + branded types | Subscription lifecycle; LemonSqueezy webhook verification |
| `ai-gateway` | Routing + retry + cache interface | `ProviderAdapter` reference impl; emit usage to telemetry — *keep thin* |

> **Known doc/code discrepancy to fix:** `README.md` and `VISION.md` describe telemetry "replay," but no replay code exists. v1.0 either ships it (preferred — it's the defensible whitespace) or the docs are corrected.

## Definition of done for v1.0

1. **Persistence is injectable everywhere.** Every stateful capability defines a `*Store` **port** (interface-first), ships an `InMemory*` reference impl, and has **one** concrete reference adapter (e.g. SQLite/Postgres) proving the seam.
2. **The moat is real, not just typed.** `policy-engine` governs an actual PR/diff; `telemetry` can serialize, persist, and **replay** an AI execution.
3. **Trust requirements are enforced in code.** A shared **audit-log primitive** exists and is emitted on auth events, admin actions, and sensitive mutations (currently a README rule with no implementation).
4. **Publishable.** Versioned `1.0.0`, release/publish pipeline (provenance), per-package README with a usage example. CI gates already in place (typecheck → build → coverage; audit + gitleaks).
5. **Coverage held:** thresholds met repo-wide; **100%** on policy decisions, auth, and audit/billing writes.

## Workstreams (→ tracked as GitHub issues)

1. **policy-engine → real governance.** Replace `metadata["content:…"]` smuggling with a typed PR/diff `PolicyContext` (hunks, author = human vs agent, provenance). Add a rule-config schema + loader (declare rules as data, not hardcoded classes). Add an AI-governance rule set (attribution/provenance, agent-touches-sensitive-path, coverage gate, oversized-diff). Add a `PolicyDecisionStore` port for auditable decisions.
2. **telemetry → persistence + replay.** Serializable span/event log format; `TraceStore` port + in-memory + one reference adapter; a minimal **replay API** that reconstructs an AI execution from the log (record inputs/outputs/seed for determinism).
3. **billing → subscriptions.** Subscription lifecycle state machine; `SubscriptionStore` port + reference adapter; LemonSqueezy **webhook signature verification** (reuse `auth` HMAC).
4. **ai-gateway → finish thin.** `ProviderAdapter` reference impl; emit `AiExecutionEvent`s into `telemetry`. Explicitly **do not** add real provider SDKs or cache backends — keep it a neutral cost/control surface (hyperscalers commoditize this layer).
5. **auth → 1.0 hardening.** OAuth flow + API-key lifecycle helpers; wire **audit emission** (W6) into auth events. Smallest gap — it's already the most complete.
6. **platform → audit-log primitive (cross-cutting).** Define an `AuditLog` port + in-memory ref impl; a canonical `AuditEvent` shape; emit from auth/admin/sensitive mutations. This is the trust requirement made executable.
7. **release → publishable v1.0.** Versioning/changesets, npm publish workflow with provenance (restricted access per `publishConfig`), per-package README usage examples, and a docs-accuracy pass (fix the replay claim).

## Sequencing

```
6 (audit primitive)  ─┐
1 (policy diff+rules) ─┼─► 2 (telemetry replay) ─► 4 (gateway→telemetry) ─► 7 (release)
3 (billing)          ─┤
5 (auth hardening)   ─┘
```
Audit primitive (6) first — others emit into it. Policy (1) and telemetry (2) are the moat and the headline of v1.0; gateway (4) and billing (3) ride alongside; auth (5) is light; release (7) closes.

## Out of scope for v1.0

- Real provider SDKs, semantic-cache backends, OAuth IdP integrations (inject via adapters later).
- Anything in `ai-gateway` beyond a neutral surface — the gateway is commoditizing; don't invest the moat there.
- A consumer-product UI/runtime — these packages stay pure libraries.

## Risks

- **Replay scope creep** — *deterministic* replay is hard; v1.0 target is reconstructable + best-effort deterministic, not perfect re-execution.
- **Persistence-adapter sprawl** — ship **one** reference adapter per port, not a matrix; consumers bring their own.
- **200-line file cap** — split early (rule sets, replay engine, audit will tempt large files).
