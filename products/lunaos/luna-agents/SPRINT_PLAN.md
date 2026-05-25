# 🌙 LunaOS — 4 Sprint Execution Plan

### From Zero to Product Hunt in 6 Weeks

**Created**: February 7, 2026
**Sprint Duration**: 10 working days each (~2 weeks)
**Team**: Solo developer + AI pair programming

---

## Sprint Overview

| Sprint | Dates | Theme | Key Outcome |
|--------|-------|-------|-------------|
| **S1** | Feb 10 – Feb 21 | 🔌 Foundation | CLI works, 5 subdomains live, first agent execution |
| **S2** | Feb 24 – Mar 7 | 🧠 Intelligence | RAG pipeline, GitHub integration, agent chains |
| **S3** | Mar 10 – Mar 21 | 💰 Commercial | Payments, API keys, usage limits, Pro tier |
| **S4** | Mar 24 – Apr 4 | 🚀 Launch | Polish, docs, security hardening, Product Hunt |

---

## Sprint 1: 🔌 Foundation
**Feb 10 – Feb 21 (10 days)**

> **Goal**: A developer can `npm i -g @luna-agents/cli && luna run code-review` and get a real result. All 5 subdomains are live.

### Epic 1.1: CLI Core (Days 1-3)

| # | Task | Repo | Files to Create/Edit | Acceptance Criteria | Est |
|---|------|------|---------------------|-------------------|:---:|
| 1.1.1 | **Init CLI package** — scaffold TypeScript CLI with Commander.js, tsup bundler | `luna-agents` | `cli/package.json`, `cli/tsconfig.json`, `cli/tsup.config.ts`, `cli/src/index.ts` | `npx ts-node cli/src/index.ts --help` shows commands | 2h |
| 1.1.2 | **`luna init` command** — create `.luna/` directory with config file | `luna-agents` | `cli/src/commands/init.ts`, `cli/src/templates/luna-config.yaml` | Running `luna init` in any dir creates `.luna/config.yaml` with project name, default LLM provider | 2h |
| 1.1.3 | **`luna list` command** — read `agents/` dir, display table of available agents | `luna-agents` | `cli/src/commands/list.ts`, `cli/src/utils/agent-loader.ts` | `luna list` shows 28 agents with name, category, description | 2h |
| 1.1.4 | **Agent persona loader** — parse markdown persona → extract role, workflow, input/output sections | `luna-agents` | `cli/src/core/persona-parser.ts` | Given `luna-code-review.md`, returns `{ role, workflow, inputs, outputs, systemPrompt }` | 3h |
| 1.1.5 | **`luna run <agent>` command — local mode** — load persona, call OpenAI/Anthropic, stream response to terminal | `luna-agents` | `cli/src/commands/run.ts`, `cli/src/core/llm-client.ts`, `cli/src/core/executor.ts` | `luna run code-review` streams a real code review to stdout using ANTHROPIC_API_KEY from env | 4h |
| 1.1.6 | **Report saving** — save agent output to `.luna/reports/<agent>-<date>.md` | `luna-agents` | `cli/src/core/report-writer.ts` | After `luna run`, report file exists at `.luna/reports/code-review-2026-02-10.md` | 1h |
| 1.1.7 | **Context gathering** — auto-detect project type, read relevant files, build context for agent | `luna-agents` | `cli/src/core/context-builder.ts` | Detects package.json/Cargo.toml/go.mod, reads src files, builds context string < 100K tokens | 3h |
| 1.1.8 | **npm publish setup** — configure package for `@luna-agents/cli`, add bin entry, build script | `luna-agents` | `cli/package.json` (update), `.npmrc`, `cli/README.md` | `npm pack` produces valid tarball, `npx @luna-agents/cli --help` works | 2h |

**Sprint 1.1 deliverable**: `npm i -g @luna-agents/cli && luna init && luna run code-review` works end-to-end.

---

### Epic 1.2: Engine API (Days 3-5)

| # | Task | Repo | Files to Create/Edit | Acceptance Criteria | Est |
|---|------|------|---------------------|-------------------|:---:|
| 1.2.1 | **Clean worker.ts** — remove all NestJS references, fix env shadowing, single clean Hono entry point | `lunaos-engine` | `packages/api/src/worker.ts` (rewrite), delete `index.ts`, `worker-standalone.ts`, `worker-simple.ts`, `worker-minimal.ts` | Single `worker.ts` < 200 lines, exports Hono app, no TypeScript errors | 3h |
| 1.2.2 | **Health endpoint** — `GET /health` returns `{ status: "ok", version, timestamp }` | `lunaos-engine` | `packages/api/src/routes/health.ts` | `curl api.lunaos.ai/health` returns 200 JSON | 30m |
| 1.2.3 | **Auth routes** — `POST /auth/signup`, `POST /auth/login`, `POST /auth/verify` with JWT in Cloudflare Workers | `lunaos-engine` | `packages/api/src/routes/auth.ts`, `packages/api/src/middleware/auth.ts`, `packages/api/src/utils/jwt.ts` | Signup creates user in D1, login returns JWT, protected routes reject without valid token | 4h |
| 1.2.4 | **Agent execution endpoint** — `POST /agents/execute` — receives agent name + context, loads persona, calls LLM, streams SSE | `lunaos-engine` | `packages/api/src/routes/agents.ts`, `packages/api/src/services/agent-executor.ts`, `packages/api/src/services/llm-client.ts` | POST with `{ agent: "code-review", context: "..." }` streams response via SSE | 4h |
| 1.2.5 | **Agent personas bundle** — bundle all 28 persona markdowns into the Worker (KV or embedded) | `lunaos-engine` | `packages/api/src/data/personas.ts`, build script to generate from `luna-agents/agents/` | Worker can load any persona by name without filesystem access | 2h |
| 1.2.6 | **Execution history** — save each execution to D1: user_id, agent, input_hash, output, duration, tokens_used | `lunaos-engine` | `packages/api/src/services/execution-store.ts`, D1 migration `002_executions.sql` | `GET /agents/executions` returns list of past runs for authenticated user | 2h |
| 1.2.7 | **Wrangler config** — update `wrangler.toml` for api.lunaos.ai with D1, KV, Vectorize bindings | `lunaos-engine` | `wrangler.toml` (rewrite) | `npx wrangler deploy` succeeds, worker responds on custom domain | 2h |
| 1.2.8 | **CLI cloud mode** — `luna run code-review --cloud` calls api.lunaos.ai instead of local LLM | `luna-agents` | `cli/src/commands/run.ts` (add --cloud flag), `cli/src/core/api-client.ts` | `luna run code-review --cloud` streams response from cloud API | 2h |

**Sprint 1.2 deliverable**: `api.lunaos.ai` is live with auth, agent execution, and history.

---

### Epic 1.3: Deploy All Subdomains (Days 6-7)

| # | Task | Repo | Files to Create/Edit | Acceptance Criteria | Est |
|---|------|------|---------------------|-------------------|:---:|
| 1.3.1 | **Cloudflare DNS setup** — CNAME records for all 5 subdomains | `lunaos-infra` | `terraform/cloudflare/dns.tf` or manual via dashboard | `dig agents.lunaos.ai` resolves, all 5 subdomains have DNS | 1h |
| 1.3.2 | **Deploy marketing** — `lunaos.ai` root via Cloudflare Pages | `lunaos-marketing` | Add `wrangler.toml` for Pages | `https://lunaos.ai` shows landing page with valid SSL | 1h |
| 1.3.3 | **Deploy Studio** — `studio.lunaos.ai` via Cloudflare Pages | `lunaos-studio` | Update `wrangler.toml` or Pages config | `https://studio.lunaos.ai` shows visual workflow builder | 1h |
| 1.3.4 | **Deploy API** — `api.lunaos.ai` via Cloudflare Workers | `lunaos-engine` | `wrangler.toml` with routes | `https://api.lunaos.ai/health` returns JSON | 1h |
| 1.3.5 | **Deploy Dashboard** — `agents.lunaos.ai` via Cloudflare Pages | `lunaos-dashboard` | Add `wrangler.toml`, update `next.config.mjs` for static export or edge | `https://agents.lunaos.ai` shows login page | 2h |
| 1.3.6 | **Cross-domain auth** — configure CORS, cookie domains for `*.lunaos.ai` | `lunaos-engine` | `packages/api/src/middleware/cors.ts` | Dashboard at agents.lunaos.ai can call api.lunaos.ai with auth cookies | 2h |

**Sprint 1.3 deliverable**: All 5 subdomains live and accessible.

---

### Epic 1.4: Dashboard MVP (Days 8-10)

| # | Task | Repo | Files to Create/Edit | Acceptance Criteria | Est |
|---|------|------|---------------------|-------------------|:---:|
| 1.4.1 | **Auth pages** — login + signup forms that call api.lunaos.ai | `lunaos-dashboard` | `app/auth/login/page.tsx`, `app/auth/signup/page.tsx`, `lib/api.ts` | User can create account and log in, JWT stored in cookie | 3h |
| 1.4.2 | **Dashboard home** — show recent agent executions, quick-run buttons for top agents | `lunaos-dashboard` | `app/dashboard/page.tsx`, `components/ExecutionCard.tsx` | Shows 5 most recent executions with status, agent name, duration | 3h |
| 1.4.3 | **Agent catalog page** — grid of 28 agents with icon, name, description, "Run" button | `lunaos-dashboard` | `app/dashboard/agents/page.tsx`, `components/AgentCard.tsx` | All 28 agents displayed, clicking "Run" opens execution modal | 3h |
| 1.4.4 | **Agent execution UI** — modal/page with context input, streaming output display | `lunaos-dashboard` | `app/dashboard/agents/[id]/page.tsx`, `components/ExecutionStream.tsx` | User clicks Run → enters context → sees streaming markdown output → result saved | 4h |
| 1.4.5 | **Execution history page** — table of all past runs with filters | `lunaos-dashboard` | `app/dashboard/history/page.tsx`, `components/ExecutionTable.tsx` | Paginated list of executions, click to view full output | 2h |
| 1.4.6 | **Settings page** — API key display, LLM provider config, theme toggle | `lunaos-dashboard` | `app/dashboard/settings/page.tsx` | User can see their API key, change dark/light mode | 2h |
| 1.4.7 | **Navigation** — sidebar with Dashboard, Agents, History, Settings, Studio link | `lunaos-dashboard` | `app/dashboard/layout.tsx`, `components/Sidebar.tsx` | Clean nav, active state, responsive | 2h |

**Sprint 1.4 deliverable**: Working dashboard with agent execution, history, and settings.

---

### Sprint 1 Definition of Done

```
□ `npm i -g @luna-agents/cli` installs successfully
□ `luna init` creates .luna/ directory
□ `luna list` shows 28 agents
□ `luna run code-review` produces real code review (local mode)
□ `luna run code-review --cloud` works via api.lunaos.ai
□ https://lunaos.ai shows marketing page
□ https://agents.lunaos.ai shows dashboard with login
□ https://api.lunaos.ai/health returns OK
□ https://studio.lunaos.ai shows visual builder
□ Dashboard: user can signup → login → run agent → see result
□ All agent executions saved to D1 with history
```

---

## Sprint 2: 🧠 Intelligence
**Feb 24 – Mar 7 (10 days)**

> **Goal**: Agents understand your codebase via RAG. Agent chains work. GitHub integration.

### Epic 2.1: RAG Pipeline (Days 1-4)

| # | Task | Repo | Files | Acceptance Criteria | Est |
|---|------|------|-------|-------------------|:---:|
| 2.1.1 | **File scanner** — recursively scan project dir, respect .gitignore, filter by extension | `lunaos-engine` | `packages/rag/src/services/file-scanner.ts` | Given a repo path, returns list of source files with content, skips node_modules/dist/binary | 3h |
| 2.1.2 | **Document chunker** — split files into overlapping chunks (~500 tokens each) with metadata | `lunaos-engine` | `packages/rag/src/services/chunker.ts` | 1 file → N chunks, each with: content, filePath, startLine, endLine, language | 3h |
| 2.1.3 | **Embedding service** — call Cloudflare AI `@cf/baai/bge-base-en-v1.5` for embeddings | `lunaos-engine` | `packages/rag/src/services/cf-embedding.ts` | Given text, returns 768-dim float array via Cloudflare AI binding | 2h |
| 2.1.4 | **Vector store (Vectorize)** — insert/query embeddings in Cloudflare Vectorize | `lunaos-engine` | `packages/rag/src/services/cf-vector-store.ts` | Insert 1000 vectors, query top-5 by cosine similarity < 100ms | 3h |
| 2.1.5 | **Metadata store (D1)** — store chunk metadata in D1 for filtering | `lunaos-engine` | `packages/rag/src/services/metadata-store.ts`, D1 migration `003_rag_chunks.sql` | Each chunk has: id, vectorId, filePath, startLine, endLine, repoId, language | 2h |
| 2.1.6 | **Indexing endpoint** — `POST /rag/index` — receives repo content, chunks → embeds → stores | `lunaos-engine` | `packages/api/src/routes/rag.ts` | POST with file list → all files chunked, embedded, stored in Vectorize + D1 | 3h |
| 2.1.7 | **Search endpoint** — `GET /rag/search?q=...` — embed query → vector search → return top chunks | `lunaos-engine` | `packages/api/src/routes/rag.ts` (add search route) | Query "authentication middleware" returns relevant code chunks with file paths | 2h |
| 2.1.8 | **Context injection** — before agent execution, auto-search RAG for relevant code and inject into prompt | `lunaos-engine` | `packages/api/src/services/agent-executor.ts` (enhance) | Agent execution now includes relevant code context from indexed repo | 3h |

**Sprint 2.1 deliverable**: Code is indexed, searchable, and agents use codebase context.

---

### Epic 2.2: GitHub Integration (Days 4-6)

| # | Task | Repo | Files | Acceptance Criteria | Est |
|---|------|------|-------|-------------------|:---:|
| 2.2.1 | **GitHub OAuth flow** — `GET /auth/github` → GitHub OAuth → callback → link to user | `lunaos-engine` | `packages/api/src/routes/github.ts`, `packages/api/src/services/github-oauth.ts` | User clicks "Connect GitHub" → redirected → comes back with linked account | 3h |
| 2.2.2 | **Repo list** — `GET /github/repos` — list user's GitHub repos | `lunaos-engine` | `packages/api/src/routes/github.ts` | Returns list of repos with name, language, lastPush, isPrivate | 2h |
| 2.2.3 | **Repo clone + index** — `POST /github/repos/:id/index` — clone repo → run RAG indexer | `lunaos-engine` | `packages/api/src/services/github-indexer.ts` | User connects repo → system clones, chunks, embeds → searchable within 2 min | 4h |
| 2.2.4 | **Dashboard: Connect Repo** — page to connect GitHub, select repos, trigger indexing | `lunaos-dashboard` | `app/dashboard/repos/page.tsx`, `components/RepoCard.tsx`, `components/ConnectGitHub.tsx` | List connected repos, indexing status, "Connect" button with OAuth flow | 3h |
| 2.2.5 | **CLI: `luna index`** — index current project locally for RAG (without GitHub) | `luna-agents` | `cli/src/commands/index.ts` | `luna index` scans current dir → uploads to api.lunaos.ai/rag/index | 2h |

**Sprint 2.2 deliverable**: Users can connect GitHub repos, code is auto-indexed, agents use it.

---

### Epic 2.3: Agent Chains (Days 7-9)

| # | Task | Repo | Files | Acceptance Criteria | Est |
|---|------|------|-------|-------------------|:---:|
| 2.3.1 | **Chain definition schema** — JSON/YAML format for defining agent chains (DAG) | `lunaos-engine` | `packages/api/src/services/chain-schema.ts` | Schema: `{ nodes: [{ agent, config }], edges: [{ from, to }] }` with validation | 2h |
| 2.3.2 | **Chain execution engine** — execute agents in DAG order, pipe output → next input | `lunaos-engine` | `packages/api/src/services/chain-executor.ts` | Given chain with 3 agents, executes in order, each gets previous output as context | 4h |
| 2.3.3 | **Chain API** — `POST /chains/execute`, `GET /chains/:id/status`, `GET /chains` | `lunaos-engine` | `packages/api/src/routes/chains.ts` | Create and execute chains via API, get real-time status updates | 3h |
| 2.3.4 | **Preset chains** — 3 built-in chains: "Full Review" (review→test→docs), "New Feature" (req→design→plan→execute), "Deploy" (review→test→deploy) | `lunaos-engine` | `packages/api/src/data/preset-chains.ts` | `POST /chains/execute { preset: "full-review" }` runs 3-agent chain | 2h |
| 2.3.5 | **CLI: `luna chain`** — run preset or custom chains from terminal | `luna-agents` | `cli/src/commands/chain.ts` | `luna chain full-review` runs review→test→docs sequentially, shows progress | 2h |
| 2.3.6 | **Studio ↔ Engine wiring** — Studio saves/loads workflows via API, executes agent nodes | `lunaos-studio` | `js/api-client.js` (new), update `js/workflow-engine.js` | Studio can save workflow to cloud, click "Execute" → agents run → results show in nodes | 4h |
| 2.3.7 | **Dashboard: Chains page** — view preset chains, execution progress, results | `lunaos-dashboard` | `app/dashboard/chains/page.tsx`, `components/ChainVisualizer.tsx` | Shows chain as connected nodes with status indicators, streaming results per node | 3h |

**Sprint 2.3 deliverable**: Agent chains run sequentially, Studio connected, 3 preset chains.

---

### Epic 2.4: CLI Polish + Publish (Day 10)

| # | Task | Repo | Files | Acceptance Criteria | Est |
|---|------|------|-------|-------------------|:---:|
| 2.4.1 | **CLI help & docs** — proper `--help` text for all commands, man page | `luna-agents` | All `cli/src/commands/*.ts` | Every command has clear description, examples, flags documented | 2h |
| 2.4.2 | **CLI config** — `luna config set provider anthropic`, `luna config set api-key sk-...` | `luna-agents` | `cli/src/commands/config.ts`, `cli/src/utils/config-store.ts` | Config saved to `~/.luna/config.yaml`, used by all commands | 2h |
| 2.4.3 | **Error handling** — graceful errors for missing API key, network failures, invalid agent name | `luna-agents` | `cli/src/utils/error-handler.ts` | No uncaught exceptions, friendly error messages with fix suggestions | 2h |
| 2.4.4 | **npm publish v0.1.0** — publish `@luna-agents/cli` to npm | `luna-agents` | `cli/package.json`, CI script | `npm i -g @luna-agents/cli@0.1.0` installs globally, all commands work | 1h |

**Sprint 2.4 deliverable**: CLI v0.1.0 published on npm.

---

### Sprint 2 Definition of Done

```
□ RAG: project files indexed into Cloudflare Vectorize
□ RAG: semantic search returns relevant code chunks
□ RAG: agent execution auto-injects codebase context
□ GitHub OAuth: user can connect GitHub account
□ GitHub: repos listed in dashboard, indexing triggers automatically
□ Chains: "Full Review" chain runs 3 agents sequentially
□ Chains: Studio can execute workflows via API
□ CLI: `luna index` indexes current project
□ CLI: `luna chain full-review` runs agent chain
□ CLI: v0.1.0 published on npm
□ Dashboard: Repos page, Chains page with visualization
```

---

## Sprint 3: 💰 Commercial
**Mar 10 – Mar 21 (10 days)**

> **Goal**: Revenue infrastructure. Free → Pro → Team. API keys for external integrations.

### Epic 3.1: Payments (Days 1-3)

| # | Task | Repo | Files | Acceptance Criteria | Est |
|---|------|------|-------|-------------------|:---:|
| 3.1.1 | **Stripe product setup** — create Products + Prices for Free/Pro/Team in Stripe Dashboard | External | Stripe Dashboard | Products visible in Stripe with correct prices ($0/$29/$79) | 1h |
| 3.1.2 | **Checkout endpoint** — `POST /billing/checkout` → create Stripe Checkout Session → return URL | `lunaos-engine` | `packages/api/src/routes/billing.ts`, `packages/api/src/services/stripe.ts` | POST returns checkout URL, user redirects to Stripe, can pay | 3h |
| 3.1.3 | **Webhook handler** — `POST /billing/webhook` → verify Stripe signature → update user subscription in D1 | `lunaos-engine` | `packages/api/src/routes/billing.ts` (webhook route), D1 migration `004_subscriptions.sql` | After successful payment, user's `subscription_tier` updates to "pro" in D1 | 3h |
| 3.1.4 | **Subscription management** — `GET /billing/subscription`, `POST /billing/cancel`, `POST /billing/portal` | `lunaos-engine` | `packages/api/src/routes/billing.ts` | User can view current plan, cancel, access Stripe Customer Portal | 2h |
| 3.1.5 | **Billing middleware** — check user tier before agent execution, enforce limits | `lunaos-engine` | `packages/api/src/middleware/billing.ts` | Free users blocked after 100 executions/mo, Pro gets 10K, error message suggests upgrade | 2h |

**Sprint 3.1 deliverable**: Users can upgrade to Pro via Stripe, subscriptions managed.

---

### Epic 3.2: Usage Metering (Days 3-5)

| # | Task | Repo | Files | Acceptance Criteria | Est |
|---|------|------|-------|-------------------|:---:|
| 3.2.1 | **Usage counter** — increment executions per user per month in KV | `lunaos-engine` | `packages/api/src/services/usage-meter.ts` | Each agent execution increments counter, resets monthly | 2h |
| 3.2.2 | **Usage API** — `GET /billing/usage` → returns current month's executions, limit, remaining | `lunaos-engine` | `packages/api/src/routes/billing.ts` | Returns `{ used: 47, limit: 100, remaining: 53, tier: "free" }` | 1h |
| 3.2.3 | **Token tracking** — track input/output tokens per execution for cost monitoring | `lunaos-engine` | `packages/api/src/services/token-tracker.ts` | Each execution record includes `inputTokens`, `outputTokens`, `estimatedCost` | 2h |
| 3.2.4 | **Usage alerts** — when user hits 80% of limit, include warning in API response | `lunaos-engine` | `packages/api/src/middleware/billing.ts` | Response header `X-Usage-Warning: 80% of monthly limit reached` | 1h |
| 3.2.5 | **Dashboard usage widget** — progress bar showing executions used/remaining | `lunaos-dashboard` | `components/UsageWidget.tsx`, update `app/dashboard/page.tsx` | Dashboard homepage shows usage bar with current/max numbers | 2h |

**Sprint 3.2 deliverable**: Usage tracked and enforced per tier.

---

### Epic 3.3: API Keys (Days 5-7)

| # | Task | Repo | Files | Acceptance Criteria | Est |
|---|------|------|-------|-------------------|:---:|
| 3.3.1 | **Key generation** — `POST /api-keys` → generate `lnos_...` prefixed API key, hash and store | `lunaos-engine` | `packages/api/src/routes/api-keys.ts`, `packages/api/src/services/key-manager.ts`, D1 migration `005_api_keys.sql` | Generate key, show once, store bcrypt hash in D1 | 3h |
| 3.3.2 | **Key auth middleware** — accept `Authorization: Bearer lnos_...` header, validate against D1 | `lunaos-engine` | `packages/api/src/middleware/api-key-auth.ts` | API calls with valid key succeed, invalid key returns 401 | 2h |
| 3.3.3 | **Key management** — `GET /api-keys` (list), `DELETE /api-keys/:id` (revoke), key naming | `lunaos-engine` | `packages/api/src/routes/api-keys.ts` | List shows key prefix + name + created date + last used. Revoke works immediately. | 2h |
| 3.3.4 | **Dashboard: API Keys page** — generate, copy, revoke keys from UI | `lunaos-dashboard` | `app/dashboard/settings/api-keys/page.tsx`, `components/ApiKeyCard.tsx` | User generates key → copies it → uses in curl → revokes when done | 3h |
| 3.3.5 | **CLI: `luna login`** — authenticate CLI with API key or browser OAuth | `luna-agents` | `cli/src/commands/login.ts` | `luna login` opens browser → user authenticates → CLI stores token locally | 2h |
| 3.3.6 | **Rate limiting** — per-key rate limits (60/min free, 600/min pro, 6000/min team) | `lunaos-engine` | `packages/api/src/middleware/rate-limiter.ts` | Exceeding rate returns 429 with `Retry-After` header | 2h |

**Sprint 3.3 deliverable**: API keys for external access, rate limiting, CLI auth.

---

### Epic 3.4: Pro Tier + Upgrade Flow (Days 8-10)

| # | Task | Repo | Files | Acceptance Criteria | Est |
|---|------|------|-------|-------------------|:---:|
| 3.4.1 | **Agent tier gating** — mark agents as free/pro in persona metadata, enforce in execution | `lunaos-engine` | `packages/api/src/services/agent-executor.ts`, `packages/api/src/data/agent-tiers.ts` | 6 agents free (review, test, docs, deploy, requirements, design), rest require Pro | 2h |
| 3.4.2 | **Upgrade prompt** — when free user hits Pro agent or limit, return upgrade CTA with checkout link | `lunaos-engine` | `packages/api/src/middleware/billing.ts` | Error response: `{ error: "pro_required", upgradeUrl: "...", agent: "security-hardener" }` | 1h |
| 3.4.3 | **Dashboard: Pricing page** — show Free/Pro/Team comparison, upgrade buttons | `lunaos-dashboard` | `app/pricing/page.tsx` | Clear tier comparison, Pro "Upgrade" button goes to Stripe Checkout | 3h |
| 3.4.4 | **Dashboard: Billing page** — current plan, usage this month, invoices, cancel/upgrade | `lunaos-dashboard` | `app/dashboard/billing/page.tsx` | Shows "Pro — $29/mo", usage bar, "Manage subscription" link to Stripe Portal | 3h |
| 3.4.5 | **Pro badge** — in agent catalog + CLI, show 🔒 on Pro-only agents, ⚡ on Pro users | `lunaos-dashboard` | `components/AgentCard.tsx` (update) | Pro agents show lock icon for free users, unlocked for Pro users | 1h |
| 3.4.6 | **Welcome email** — Resend integration: welcome on signup, receipt on upgrade | `lunaos-engine` | `packages/api/src/services/email.ts` | Signup triggers welcome email, upgrade triggers receipt email | 2h |
| 3.4.7 | **CLI usage display** — `luna status` shows current tier, usage, remaining runs | `luna-agents` | `cli/src/commands/status.ts` | `luna status` outputs: `Plan: Free | Used: 47/100 | Agents: 6/28` | 1h |

**Sprint 3.4 deliverable**: Complete upgrade flow from Free to Pro.

---

### Sprint 3 Definition of Done

```
□ Stripe checkout works: user can pay $29 and get Pro
□ Webhooks update user subscription in real-time
□ Usage metering: executions counted per month
□ Free tier: 100 runs/mo, 6 agents
□ Pro tier: 10K runs/mo, 28 agents
□ API keys: generate, use, revoke from dashboard
□ Rate limiting: per-key limits enforced
□ CLI: `luna login` authenticates, `luna status` shows plan
□ Dashboard: Pricing page, Billing page, API Keys page
□ Upgrade CTA shown when free user hits limits
```

---

## Sprint 4: 🚀 Launch
**Mar 24 – Apr 4 (10 days)**

> **Goal**: Product Hunt launch. Everything polished, documented, secured, monitored.

### Epic 4.1: Documentation Site (Days 1-2)

| # | Task | Repo | Files | Acceptance Criteria | Est |
|---|------|------|-------|-------------------|:---:|
| 4.1.1 | **VitePress setup** — init VitePress project, configure theme, nav, sidebar | `lunaos-docs` | `.vitepress/config.ts`, `docs/index.md` | `npm run dev` shows docs site with LunaOS branding | 2h |
| 4.1.2 | **Getting Started guide** — install CLI → init → first run → view report | `lunaos-docs` | `docs/getting-started/index.md`, `docs/getting-started/quickstart.md` | Step-by-step guide, code blocks, expected output | 2h |
| 4.1.3 | **Agent Catalog** — one page per agent with description, usage, examples, sample output | `lunaos-docs` | `docs/agents/code-review.md`, `docs/agents/testing.md`, etc. (28 pages) | Each agent has: purpose, when to use, CLI command, example output | 4h |
| 4.1.4 | **API Reference** — all REST endpoints with curl examples | `lunaos-docs` | `docs/api/authentication.md`, `docs/api/agents.md`, `docs/api/rag.md`, `docs/api/billing.md` | Every endpoint documented with request/response examples | 3h |
| 4.1.5 | **Deploy docs** — `docs.lunaos.ai` via Cloudflare Pages | `lunaos-docs` | `wrangler.toml` for Pages | `https://docs.lunaos.ai` shows docs with working search | 1h |

**Sprint 4.1 deliverable**: `docs.lunaos.ai` live with getting started, agent catalog, API reference.

---

### Epic 4.2: Landing Page Redesign (Days 2-3)

| # | Task | Repo | Files | Acceptance Criteria | Est |
|---|------|------|-------|-------------------|:---:|
| 4.2.1 | **Hero section** — headline, subhead, CLI install command, hero animation/screenshot | `lunaos-marketing` | `index.html`, `css/styles.css` | Above-fold: clear value prop, `npm i -g @luna-agents/cli` with copy button | 3h |
| 4.2.2 | **Agent showcase** — grid of 6 featured agents with live demo previews | `lunaos-marketing` | `index.html` (section), `js/agent-demos.js` | 6 cards with agent name, description, sample output in code block | 3h |
| 4.2.3 | **How it works** — 3-step flow: Install → Run → Ship | `lunaos-marketing` | `index.html` (section) | Visual 3-step with terminal screenshots | 2h |
| 4.2.4 | **Social proof** — GitHub stars counter, npm downloads, testimonial placeholders | `lunaos-marketing` | `index.html` (section), `js/social-proof.js` | Live GitHub stars badge, npm weekly downloads | 1h |
| 4.2.5 | **Studio teaser** — embedded iframe or GIF of Studio visual builder | `lunaos-marketing` | `index.html` (section) | Shows the visual Studio with particle effects | 1h |
| 4.2.6 | **CTA sections** — "Get Started Free", "Star on GitHub", pricing link | `lunaos-marketing` | `index.html` (sections) | Clear CTAs at top, middle, bottom of page | 1h |

**Sprint 4.2 deliverable**: Marketing page that sells the product.

---

### Epic 4.3: Security Hardening (Days 4-5)

| # | Task | Repo | Files | Acceptance Criteria | Est |
|---|------|------|-------|-------------------|:---:|
| 4.3.1 | **Input validation** — validate all API inputs with Zod schemas | `lunaos-engine` | `packages/api/src/middleware/validation.ts`, `packages/api/src/schemas/*.ts` | No endpoint accepts unvalidated input, malformed requests return 400 | 3h |
| 4.3.2 | **SQL injection prevention** — parameterized queries only, no string interpolation in D1 | `lunaos-engine` | Audit all `*.ts` files with D1 queries | Zero raw SQL string concatenation in codebase | 2h |
| 4.3.3 | **XSS prevention** — sanitize all user-generated content before storage/display | `lunaos-engine` | `packages/api/src/utils/sanitizer.ts` | Agent output stored with HTML entities escaped | 1h |
| 4.3.4 | **CORS hardening** — only allow `*.lunaos.ai` origins | `lunaos-engine` | `packages/api/src/middleware/cors.ts` | Requests from other origins rejected with 403 | 1h |
| 4.3.5 | **Security headers** — add Helmet-equivalent headers for Workers (CSP, HSTS, X-Content-Type, etc.) | `lunaos-engine` | `packages/api/src/middleware/security-headers.ts` | SecurityHeaders.com shows A+ rating | 1h |
| 4.3.6 | **Audit logging** — log all auth events, billing events, admin actions to D1 | `lunaos-engine` | `packages/api/src/services/audit-logger.ts`, D1 migration `006_audit_log.sql` | Login, signup, key creation, subscription changes all logged | 2h |
| 4.3.7 | **Dependency audit** — `npm audit`, update vulnerable packages | All repos | `package.json` files | Zero high/critical vulnerabilities | 1h |

**Sprint 4.3 deliverable**: Production-grade security posture.

---

### Epic 4.4: Monitoring & Reliability (Days 6-7)

| # | Task | Repo | Files | Acceptance Criteria | Est |
|---|------|------|-------|-------------------|:---:|
| 4.4.1 | **Error tracking** — Sentry integration for Workers + Dashboard | `lunaos-engine`, `lunaos-dashboard` | `packages/api/src/services/sentry.ts`, `lib/sentry.ts` | Unhandled errors appear in Sentry with stack trace and context | 2h |
| 4.4.2 | **Status page** — simple uptime monitor for all 5 subdomains | `lunaos-infra` | `status/worker.ts`, `status/index.html` | `status.lunaos.ai` shows green/red for each subdomain, refreshes every 60s | 3h |
| 4.4.3 | **Health checks** — all services return health status with dependency checks | `lunaos-engine` | `packages/api/src/routes/health.ts` (enhance) | `/health` returns D1 status, KV status, Vectorize status, LLM provider status | 2h |
| 4.4.4 | **Uptime alerts** — if any subdomain goes down, send email/webhook | `lunaos-infra` | `status/worker.ts` (add alerting) | Downtime triggers email to admin within 5 minutes | 2h |
| 4.4.5 | **Performance monitoring** — track P50/P95/P99 response times per endpoint | `lunaos-engine` | `packages/api/src/middleware/metrics.ts` | Response times logged, `/metrics` endpoint for internal monitoring | 2h |

**Sprint 4.4 deliverable**: Sentry, status page, health checks, uptime alerts.

---

### Epic 4.5: Launch Execution (Days 8-10)

| # | Task | Repo | Files | Acceptance Criteria | Est |
|---|------|------|-------|-------------------|:---:|
| 4.5.1 | **Product Hunt listing** — title, description, images, first comment draft | External | PH Dashboard | Listing submitted, scheduled for Tuesday 12:01 AM PT | 2h |
| 4.5.2 | **Demo video** — 60-second screencast: install CLI → run code-review → see results → open Studio | External | Screen recording | MP4/GIF showing the demo flow, used on PH + landing page | 3h |
| 4.5.3 | **GitHub README polish** — `luna-agents` README with install, quick start, agent list, badges | `luna-agents` | `README.md` | Professional README with badges, GIF, table of agents, "start in 30 seconds" | 2h |
| 4.5.4 | **Community Discord** — create server, channels: #general, #agents, #showcase, #bugs, #feature-requests | External | Discord | Invite link on website + README, welcome message, bot for GitHub stars | 1h |
| 4.5.5 | **Social posts** — Twitter/X thread, LinkedIn post, Dev.to article draft | External | Documents | Thread ready to post on launch day | 2h |
| 4.5.6 | **Launch day monitoring** — watch error rates, response times, signup funnel | All | Sentry, status page | <1% error rate, <500ms P95, signup → first agent run < 5 minutes | All day |
| 4.5.7 | **Post-launch fixes** — rapid response to bug reports, feature requests | All | Various | Critical bugs fixed within 2 hours | All day |
| 4.5.8 | **npx support** — ensure `npx @luna-agents/cli run code-review` works without global install | `luna-agents` | `cli/package.json` bin config | One-command demo works without pre-install | 1h |

**Sprint 4.5 deliverable**: Product Hunt live, community active, demo working.

---

### Sprint 4 Definition of Done

```
□ docs.lunaos.ai live with getting started, agent catalog, API ref
□ Landing page redesigned with real screenshots and demo
□ Security: Zod validation on all inputs, rate limiting, audit logging
□ Sentry error tracking on API + Dashboard
□ status.lunaos.ai showing all services green
□ Product Hunt listing submitted
□ Demo video recorded (60 sec)
□ luna-agents README polished with badges + GIF
□ Discord community created
□ npx @luna-agents/cli run code-review works
□ Launch day: <1% error rate, <500ms P95
```

---

## Task Summary

| Sprint | Epics | Tasks | Estimated Hours |
|--------|:-----:|:-----:|:---------------:|
| S1: Foundation | 4 | 31 | ~85h |
| S2: Intelligence | 4 | 24 | ~72h |
| S3: Commercial | 4 | 24 | ~65h |
| S4: Launch | 5 | 25 | ~68h |
| **Total** | **17** | **104** | **~290h** |

At ~6-7 productive hours/day × 40 working days = **240-280 hours available**.

This is tight but achievable with AI pair programming accelerating every task.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Cloudflare Vectorize latency too high | RAG search slow | Fall back to D1 FTS or Workers AI embeddings with KV cache |
| Stripe webhook delivery unreliable | Missed subscription updates | Implement webhook retry + daily reconciliation job |
| npm publish fails (name conflict) | Can't distribute CLI | Use scoped package `@lunaos/cli` as backup name |
| LLM API costs exceed budget | Burn rate too high | Implement response caching, reduce max tokens, add cost alerts |
| Product Hunt timing wrong | Low visibility launch | Have backup: Dev.to article, Twitter thread, Reddit posts |
| Security vulnerability found post-launch | Trust damage | Pre-launch security audit (Sprint 4.3), bug bounty post-launch |

---

## Priority Order (If We Run Out of Time)

If we can't finish everything, ship in this order:

1. ✅ CLI works locally (`luna run code-review`) — **this IS the product**
2. ✅ CLI published on npm — **distribution**
3. ✅ API deployed with agent execution — **cloud mode**
4. ✅ Dashboard with login + execute — **visual interface**
5. ✅ Stripe payments — **revenue**
6. ⚠️ RAG pipeline — nice to have for v1
7. ⚠️ Agent chains — nice to have for v1
8. ⚠️ GitHub integration — nice to have for v1
9. ⚠️ Docs site — can use README for v1
10. ⚠️ Status page — can skip for v1

**Items 1-5 are the MVP. Items 6-10 are v1.1.**

---

*Ship the CLI first. Everything else is built on top of it.*

*LunaOS — February 2026*
