# OpenSyber — 30-Day Flagship GTM Plan

Created: 2026-06-03
Source: `MARKET_SCAN_2026-05.md` "Next 30 days" + codebase readiness audit (2026-06-03).
Positioning: **OpenSyber MCP Firewall** — approve, block, replay, audit every agent tool call. "WAF + IAM + audit layer for AI agents and MCP tool calls."

## Strategic finding

The headline claim is the weakest part of the product. Readiness audit:

| Deliverable | Readiness | Verdict |
|---|---|---|
| MCP Firewall enforcement (request-path tool-call interception) | 2/10 | **Critical path. Whole story rests here.** |
| Signed audit export | 3/10 | CSV exists; no signing/verify/JSON |
| CLI / GitHub Action | 6/10 CLI · 0/10 Action | CLI real; `scan` is mock; no Action |
| Landing page | 4/10 | Static HTML; generic "AI security", not MCP Firewall |
| Latency benchmark | 5/10 | Harness real; no p99<50ms assert, no tool-call scenario, not in CI |
| Demo repo | 4/10 | 12 framework samples; no kill-chain "firewall blocks bad tool" flow |
| Dashboard | 7/10 | Extensive; no MCP Firewall view |
| Tests + CI | 4/10 · 2/10 | Single workflow; no coverage gate on hot path |

**Implication:** do not lead the market with a claim the code can't demo. Week 1 builds the real interceptor; everything downstream (benchmark, demo, landing copy) becomes truthful only after it lands.

## Constraints (portfolio CLAUDE.md — non-negotiable)

- The interceptor + signature verify + audit emit are **security controls → 100% coverage required**.
- **TDD**: failing test first, then implementation. (superpowers `test-driven-development`.)
- Max 200 lines per source file. Split by responsibility.
- Audit emit failure is **fail-closed** (blocks the action).
- `reason` fields are stable codes (e.g. `tool_unsigned`, `tool_blocked`), never free-form PII.

---

## Week 1 — Enforcement core (the flagship claim becomes real)

**Goal:** a request-path interceptor that approves/blocks/steps-up every MCP `tools/call`, default-deny on unsigned/unlisted tools, with per-call signature verification.

- [ ] **1.1 Signed tool registry** — schema + store for tool manifests (tool ID, arg schema, Ed25519 pubkey, allowed agents). Reuse `packages/db/src/schema/`. _Tests first._
- [ ] **1.2 MCP interceptor middleware** (`apps/api`) — intercept `{jsonrpc, method:"tools/call", params}`. Pull tool from registry; **default-deny if unknown/unsigned**. Files ≤200 lines. _Tests first; 100% coverage._
- [ ] **1.3 Per-call signature verify** — Ed25519 over `(toolId, argsHash, agentId, nonce, ts)`. Reject on bad/missing/expired. _Tests first; 100%._
- [ ] **1.4 Wire policy engine to tool calls** — reuse `packages/tokenforge/src/server/policy.ts` DSL (geo/ASN/signals/sensitive-path/time). Action precedence: `allow > step_up > block > revoke`. _Tests first._
- [ ] **1.5 Fail-closed audit emit on every decision** — reason codes only. If emit fails, block.

**Exit:** an agent tool call with no valid signature is blocked by default; a signed+policy-allowed call passes; both emit audit rows. Demonstrable in a test.

## Week 2 — Evidence (proof the enforcement happened)

**Goal:** signed, verifiable audit export + a published latency number that backs the p99<50ms claim.

- [ ] **2.1 Ed25519-sign audit export** — extend `apps/api/src/routes/admin-audit.ts`. Export carries signature + pubkey + nonce. _Tests first._
- [ ] **2.2 JSON export** (alongside CSV) + **`GET /api/audit/verify`** — returns `{valid, originalData}`. _Tests first._
- [ ] **2.3 Tool-call inspection benchmark** — new scenario in `tests/sample-projects/10-performance-benchmarks.test.ts`: 1,000 concurrent intercepted calls. **Assert p99 < 50ms (fail CI if violated).**
- [ ] **2.4 Publish benchmark report** — `docs/benchmarks/mcp-firewall-latency.md` with p50/p95/p99, methodology, hardware. Honest numbers only.

**Exit:** an exported audit file verifies through the endpoint; CI fails if hot-path p99 ≥ 50ms.

## Week 3 — Distribution + demo (the GTM artifacts)

**Goal:** a one-command local install and a repeatable "firewall blocks the attack" story.

- [ ] **3.1 Finish `opensyber scan`** — replace mock in `packages/cli/src/bin/agent-scan.ts` with real scan via `mcp-guardian` 7-check scanner.
- [ ] **3.2 GitHub Action** — `.github/actions/opensyber-scan/` wrapping the CLI; runs on PR, posts findings. Publish to Marketplace.
- [ ] **3.3 Kill-chain demo repo** — `finsavvyai/opensyber-mcp-firewall-demo`: malicious MCP server → agent attempts secret exfil → firewall **blocks** → signed audit shows the blocked call. README + 60s asciinema.
- [ ] **3.4 Dashboard "MCP Firewall" view** — `apps/web` page: tool calls blocked today, top policy violations, signature failures. Wired to Week-1 audit data.

**Exit:** `npx opensyber scan` returns real findings; demo repo reproduces a block end-to-end; dashboard shows live blocks.

## Week 4 — Market (positioning + pricing live)

**Goal:** the public story matches the working product.

- [ ] **4.1 Reframe landing page** — `landing-page/index.html` → MCP Firewall narrative: threat model (prompt injection, tool poisoning, exfil, priv-esc), "WAF for MCP" comparison, link to benchmark + demo. Drop generic "AI agent security".
- [ ] **4.2 Pricing** — wire vision tiers: OSS local firewall · Pro cloud audit $19-49/dev/mo · Team $199/mo · Enterprise SSO/SIEM. CTA → CLI install.
- [ ] **4.3 Exploit demo writeup** — one published post: "We let an agent try to exfil a .env — here's the firewall blocking it." Reproduce-locally instructions (feeds the "AI Agent Security Lab" content engine).
- [ ] **4.4 CI hardening** — main monorepo workflow (build+test+coverage); coverage gate enforcing 100% on interceptor/sig-verify/audit per CLAUDE.md.

**Exit:** landing page, pricing, benchmark, demo, and Action are all live and mutually consistent.

---

## Critical path

`1.2 interceptor → 1.3 sig verify → 1.4 policy → 2.1 signed export → 2.3 benchmark → 3.3 demo → 4.1 landing`

Weeks 1-2 are sequential and gate everything. Week 3-4 items parallelize once the core lands.

## Out of scope (this 30 days)

Marketplace 70/30 split, TokenForge DBSC sessions, ZTNA proxy, sandbox profiles (osquery/seccomp) beyond what already exists. These are post-launch.

## Open decisions

- [ ] Demo repo: standalone GitHub repo vs `products/opensyber/samples/`? (Scan wants a public `finsavvyai/...` repo.)
- [ ] Signing key custody: per-tenant keys in D1 vs platform KMS?
- [ ] Does the monorepo copy lead, or do we cut these into the standalone `finsavvyai/opensyber` first per `PRODUCTS_KEEP_ALIVE.md`?
