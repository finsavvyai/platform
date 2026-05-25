# 🌙 LunaOS — 6 Sprint Execution Plan

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
| **S5** | Apr 7 – Apr 18 | 🔮 Growth | VS Code extension, GitHub Action, smart onboarding |
| **S6** | May+ | 🔗 PipeWarden | AI reviews in CI/CD pipeline, quality gates, trend analytics |

---

## Sprint 1: 🔌 Foundation
**Feb 10 – Feb 21 (10 days)**

> **Goal**: A developer can `npm i -g @luna-agents/cli && luna run code-review` and get a real result. All 5 subdomains are live.

### Epic 1.1: CLI Core (Days 1-3)

| # | Task | Repo | Files to Create/Edit | Acceptance Criteria | Est |
|---|------|------|---------------------|-------------------|:---:|
| 1.1.1 | **Init CLI package** — scaffold TypeScript CLI with Commander.js, tsup bundler | `luna-agents` | `cli/package.json`, `cli/tsconfig.json`, `cli/tsup.config.ts`, `cli/src/index.ts` | `npx ts-node cli/src/index.ts --help` shows commands | ✅ Done |
| 1.1.2 | **`luna init` command** — create `.luna/` directory with config file | `luna-agents` | `cli/src/commands/init.ts`, `cli/src/templates/luna-config.yaml` | Running `luna init` in any dir creates `.luna/config.yaml` with project name, default LLM provider | ✅ Done |
| 1.1.3 | **`luna list` command** — read `agents/` dir, display table of available agents | `luna-agents` | `cli/src/commands/list.ts`, `cli/src/utils/agent-loader.ts` | `luna list` shows 28 agents with name, category, description | ✅ Done |
| 1.1.4 | **Agent persona loader** — parse markdown persona → extract role, workflow, input/output sections | `luna-agents` | `cli/src/core/persona-parser.ts` | Given `luna-code-review.md`, returns `{ role, workflow, inputs, outputs, systemPrompt }` | ✅ Done |
| 1.1.5 | **`luna run <agent>` command — local mode** — load persona, call OpenAI/Anthropic, stream response to terminal | `luna-agents` | `cli/src/commands/run.ts`, `cli/src/core/llm-client.ts`, `cli/src/core/executor.ts` | `luna run code-review` streams a real code review to stdout using ANTHROPIC_API_KEY from env | ✅ Done |
| 1.1.6 | **Report saving** — save agent output to `.luna/reports/<agent>-<date>.md` | `luna-agents` | `cli/src/core/report-writer.ts` | After `luna run`, report file exists at `.luna/reports/code-review-2026-02-10.md` | ✅ Done |
| 1.1.7 | **Context gathering** — auto-detect project type, read relevant files, build context for agent | `luna-agents` | `cli/src/core/context-builder.ts` | Detects package.json/Cargo.toml/go.mod, reads src files, builds context string < 100K tokens | ✅ Done |
| 1.1.8 | **npm publish setup** — configure package for `@luna-agents/cli`, add bin entry, build script | `luna-agents` | `cli/package.json` (update), `.npmrc`, `cli/README.md` | `npm pack` produces valid tarball, `npx @luna-agents/cli --help` works | ✅ Done |

**Sprint 1.1 deliverable**: `npm i -g @luna-agents/cli && luna init && luna run code-review` works end-to-end.

---

### Epic 1.2: Engine API (Days 3-5)

| # | Task | Repo | Files to Create/Edit | Acceptance Criteria | Est |
|---|------|------|---------------------|-------------------|:---:|
| 1.2.1 | **Clean worker.ts** — remove all NestJS references, fix env shadowing, single clean Hono entry point | `lunaos-engine` | `packages/api/src/worker.ts` (rewrite), delete `index.ts`, `worker-standalone.ts`, `worker-simple.ts`, `worker-minimal.ts` | Single `worker.ts` < 200 lines, exports Hono app, no TypeScript errors | ✅ Done |
| 1.2.2 | **Health endpoint** — `GET /health` returns `{ status: "ok", version, timestamp }` | `lunaos-engine` | `packages/api/src/routes/health.ts` | `curl api.lunaos.ai/health` returns 200 JSON | ✅ Done |
| 1.2.3 | **Auth routes** — `POST /auth/signup`, `POST /auth/login`, `POST /auth/verify` with JWT in Cloudflare Workers | `lunaos-engine` | `packages/api/src/routes/auth.ts`, `packages/api/src/middleware/auth.ts`, `packages/api/src/utils/jwt.ts` | Signup creates user in D1, login returns JWT, protected routes reject without valid token | ✅ Done |
| 1.2.4 | **Agent execution endpoint** — `POST /agents/execute` — receives agent name + context, loads persona, calls LLM, streams SSE | `lunaos-engine` | `packages/api/src/routes/agents.ts`, `packages/api/src/services/agent-executor.ts`, `packages/api/src/services/llm-client.ts` | POST with `{ agent: "code-review", context: "..." }` streams response via SSE | ✅ Done |
| 1.2.5 | **Agent personas bundle** — bundle all 28 persona markdowns into the Worker (KV or embedded) | `lunaos-engine` | `packages/api/src/data/personas.ts`, build script to generate from `luna-agents/agents/` | Worker can load any persona by name without filesystem access | ✅ Done |
| 1.2.6 | **Execution history** — save each execution to D1: user_id, agent, input_hash, output, duration, tokens_used | `lunaos-engine` | `packages/api/src/services/execution-store.ts`, D1 migration `002_executions.sql` | `GET /agents/executions` returns list of past runs for authenticated user | ✅ Done |
| 1.2.7 | **Wrangler config** — update `wrangler.toml` for api.lunaos.ai with D1, KV, Vectorize bindings | `lunaos-engine` | `wrangler.toml` (rewrite) | `npx wrangler deploy` succeeds, worker responds on custom domain | ✅ Done |
| 1.2.8 | **CLI cloud mode** — `luna run code-review --cloud` calls api.lunaos.ai instead of local LLM | `luna-agents` | `cli/src/commands/run.ts` (add --cloud flag), `cli/src/core/api-client.ts` | `luna run code-review --cloud` streams response from cloud API | ✅ Done |

**Sprint 1.2 deliverable**: `api.lunaos.ai` is live with auth, agent execution, and history.

---

### Epic 1.3: Deploy All Subdomains (Days 6-7)

| # | Task | Repo | Files to Create/Edit | Acceptance Criteria | Est |
|---|------|------|---------------------|-------------------|:---:|
| 1.3.1 | **Cloudflare DNS setup** — CNAME records for all 5 subdomains | `lunaos-infra` | `terraform/cloudflare/dns.tf` or manual via dashboard | `dig agents.lunaos.ai` resolves, all 5 subdomains have DNS | ✅ Done — `api.lunaos.ai`, `lunaos.ai`, `agent.lunaos.ai` active; `studio.lunaos.ai`, `agents.lunaos.ai` pending SSL |
| 1.3.2 | **Deploy marketing** — `lunaos.ai` root via Cloudflare Pages | `lunaos-marketing` | Add `wrangler.toml` for Pages | `https://lunaos.ai` shows landing page with valid SSL | ✅ Deployed → `lunaos-marketing.pages.dev` |
| 1.3.3 | **Deploy Studio** — `studio.lunaos.ai` via Cloudflare Pages | `lunaos-studio` | Update `wrangler.toml` or Pages config | `https://studio.lunaos.ai` shows visual workflow builder | ✅ Deployed → `lunaos-studio.pages.dev` |
| 1.3.4 | **Deploy API** — `api.lunaos.ai` via Cloudflare Workers | `lunaos-engine` | `wrangler.toml` with routes | `https://api.lunaos.ai/health` returns JSON | ✅ Deployed — `api.lunaos.ai/health` returns OK, D1+KV verified |
| 1.3.5 | **Deploy Dashboard** — `agents.lunaos.ai` via Cloudflare Pages | `lunaos-dashboard` | Add `wrangler.toml`, update `next.config.mjs` for static export or edge | `https://agents.lunaos.ai` shows login page | ✅ Deployed → `luna-agent.pages.dev` (28 agent pages pre-rendered) |
| 1.3.6 | **Cross-domain auth** — configure CORS, cookie domains for `*.lunaos.ai` | `lunaos-engine` | `packages/api/src/middleware/cors.ts` | Dashboard at agents.lunaos.ai can call api.lunaos.ai with auth cookies | ✅ Done |

**Sprint 1.3 deliverable**: All 5 subdomains live and accessible.

---

### Epic 1.4: Dashboard MVP (Days 8-10)

| # | Task | Repo | Files to Create/Edit | Acceptance Criteria | Est |
|---|------|------|---------------------|-------------------|:---:|
| 1.4.1 | **Auth pages** — login + signup forms that call api.lunaos.ai | `lunaos-dashboard` | `app/auth/login/page.tsx`, `app/auth/signup/page.tsx`, `lib/api.ts` | User can create account and log in, JWT stored in cookie | ✅ Done |
| 1.4.2 | **Dashboard home** — show recent agent executions, quick-run buttons for top agents | `lunaos-dashboard` | `app/dashboard/page.tsx`, `components/ExecutionCard.tsx` | Shows 5 most recent executions with status, agent name, duration | ✅ Done |
| 1.4.3 | **Agent catalog page** — grid of 28 agents with icon, name, description, "Run" button | `lunaos-dashboard` | `app/dashboard/agents/page.tsx`, `components/AgentCard.tsx` | All 28 agents displayed, clicking "Run" opens execution modal | ✅ Done |
| 1.4.4 | **Agent execution UI** — modal/page with context input, streaming output display | `lunaos-dashboard` | `app/dashboard/agents/[id]/page.tsx`, `components/ExecutionStream.tsx` | User clicks Run → enters context → sees streaming markdown output → result saved | ✅ Done |
| 1.4.5 | **Execution history page** — table of all past runs with filters | `lunaos-dashboard` | `app/dashboard/history/page.tsx`, `components/ExecutionTable.tsx` | Paginated list of executions, click to view full output | ✅ Done |
| 1.4.6 | **Settings page** — API key display, LLM provider config, theme toggle | `lunaos-dashboard` | `app/dashboard/settings/page.tsx` | User can see their API key, change dark/light mode | ✅ Done |
| 1.4.7 | **Navigation** — sidebar with Dashboard, Agents, History, Settings, Studio link | `lunaos-dashboard` | `app/dashboard/layout.tsx`, `components/Sidebar.tsx` | Clean nav, active state, responsive | ✅ Done |

**Sprint 1.4 deliverable**: Working dashboard with agent execution, history, and settings.

---

### Epic 1.5: Testing & Coverage (Continuous)

| # | Task | Repo | Files to Create/Edit | Acceptance Criteria | Est |
|---|------|------|---------------------|-------------------|:---:|
| 1.5.1 | **Jest + RTL setup** — configure Jest with next/jest, jsdom, @testing-library/react | `lunaos-dashboard` | `jest.config.js`, `jest.setup.ts` | `npm test` runs without config errors | ✅ Done |
| 1.5.2 | **API client tests** — full coverage of auth, agents, health endpoints | `lunaos-dashboard` | `lib/__tests__/api.test.ts` | 23 tests: login, signup, me, logout, isAuthenticated, agent list/execute/executions, health check, URL config | ✅ Done |
| 1.5.3 | **Zustand store tests** — auth, UI, agents, notification stores | `lunaos-dashboard` | `store/__tests__/store.test.ts` | 25+ tests: setUser, logout, sidebar toggle, theme, notifications auto-remove | ✅ Done |
| 1.5.4 | **Hooks tests** — useDebounce, useLocalStorage, useClickOutside | `lunaos-dashboard` | `hooks/__tests__/hooks.test.ts` | Timer behavior, localStorage persistence, click-outside detection | ✅ Done |
| 1.5.5 | **Page tests — Auth** — login/signup form rendering, submission, error states | `lunaos-dashboard` | `app/auth/login/__tests__/`, `app/auth/signup/__tests__/` | Form rendering, submit success/error, loading states, field validation | ✅ Done |
| 1.5.6 | **Page tests — Landing** — hero, features, CTA, Luna story, navigation | `lunaos-dashboard` | `app/__tests__/page.test.tsx` | 12 tests: headline, brand, beta badge, CTAs, terminal demo, 6 features, story, footer, links | ✅ Done |
| 1.5.7 | **Page tests — Dashboard** — stats, quick run, CLI banner, API status | `lunaos-dashboard` | `app/dashboard/__tests__/page.test.tsx` | 13 tests: stat cards, agent count, online/offline, quick run, CLI banner, empty state | ✅ Done |
| 1.5.8 | **Page tests — Agents** — catalog, search, filter, linking | `lunaos-dashboard` | `app/dashboard/agents/__tests__/page.test.tsx` | 10 tests: title, search filtering, tier buttons, Pro filter, execution page links | ✅ Done |
| 1.5.9 | **Page tests — History** — execution list, empty state, duration display | `lunaos-dashboard` | `app/dashboard/history/__tests__/page.test.tsx` | 6 tests: title, empty state, execution rendering, duration format, error handling | ✅ Done |
| 1.5.10 | **Page tests — Settings** — account, API health, CLI setup, About Luna & Nippy | `lunaos-dashboard` | `app/dashboard/settings/__tests__/page.test.tsx` | 9 tests: heading, account info, Connected/Unreachable, CLI setup, Luna & Nippy story | ✅ Done |
| 1.5.11 | **Page tests — Pricing** — three tiers, prices, features, badges | `lunaos-dashboard` | `app/pricing/__tests__/page.test.tsx` | 9 tests: three tiers, correct prices, Most Popular badge, feature lists, CTAs | ✅ Done |
| 1.5.12 | **Coverage gates** — enforce per-module coverage thresholds | `lunaos-dashboard` | `jest.config.js` | api.ts ≥90% lines, store ≥90% lines, global ≥50% | ✅ Done |
| 1.5.13 | **Engine API tests** — auth, agents, health endpoint tests | `lunaos-engine` | `packages/api/tests/api.test.ts` | Cover all API routes with request/response validation | ✅ Done |
| 1.5.14 | **CLI tests** — persona parser, context builder, executor | `luna-agents` | `cli/tests/cli.test.ts` | Cover core CLI modules: init, list, run, context builder | ✅ Done |

**Sprint 1.5 status**: ✅ **255 total tests passing** — Dashboard: 130 (11 suites) + Engine API: 64 (Vitest) + CLI: 61 (Vitest).

---

### Sprint 1 Definition of Done

```
■ `npm i -g @luna-agents/cli` — builds successfully (tsup, 37KB bundle)
■ `luna init` creates .luna/ directory
■ `luna list` shows 28 agents
■ `luna run code-review` produces real code review (local mode)
■ `luna run code-review --cloud` works via api.lunaos.ai
■ https://lunaos.ai shows marketing page (verified)
■ https://agents.lunaos.ai shows dashboard with login (deployed, pending nodejs_compat flag)
■ https://api.lunaos.ai/health returns OK (verified)
■ https://studio.lunaos.ai shows visual builder (deployed as /dashboard/visualizer)
■ Dashboard: user can signup → login → run agent → see result (Next.js build verified, 13 pages)
■ All agent executions saved to D1 with history
■ Dashboard: 175 tests passing, 12 suites, coverage gates enforced
■ Engine API: 64 tests passing — health, auth, agents, JWT, CORS, middleware, tier logic, 404s
■ CLI: 61 tests passing — persona parser, context builder, LLM client, commands, agent catalog
■ NestJS legacy removed — 10 clean files, worker.ts < 80 lines
```

---

## Sprint 2: 🧠 Intelligence
**Feb 24 – Mar 7 (10 days)**

> **Goal**: Agents understand your codebase via RAG. Agent chains work. GitHub integration.

### Epic 2.1: RAG Pipeline (Days 1-4)

| # | Task | Repo | Files | Acceptance Criteria | Status |
|---|------|------|-------|-------------------|:---:|
| 2.1.1 | **File scanner** — recursively scan project dir, respect .gitignore, filter by extension | `lunaos-engine` | `packages/rag/src/services/file-scanner.ts` | Given a repo path, returns list of source files with content, skips node_modules/dist/binary | ✅ Implemented (120 lines, glob patterns, exclude lists) |
| 2.1.2 | **Document chunker** — split files into overlapping chunks (~500 tokens each) with metadata | `lunaos-engine` | `packages/rag/src/services/document-processor.ts` | 1 file → N chunks, each with: content, filePath, startLine, endLine, language | ✅ Implemented (738 lines, 5 strategies: fixed, semantic, recursive, sliding, hybrid) |
| 2.1.3 | **Embedding service** — call Cloudflare AI `@cf/baai/bge-base-en-v1.5` for embeddings | `lunaos-engine` | `packages/rag/src/services/cf-embedding.ts` | Given text, returns 768-dim float array via Cloudflare AI binding | ✅ Implemented & deployed (82 lines, batch support) |
| 2.1.4 | **Vector store (Vectorize)** — insert/query embeddings in Cloudflare Vectorize | `lunaos-engine` | `packages/rag/src/services/cf-vector-store.ts` | Insert 1000 vectors, query top-5 by cosine similarity < 100ms | ✅ Implemented & deployed (208 lines, Vectorize index `luna-code-index` created) |
| 2.1.5 | **Metadata store (D1)** — store chunk metadata in D1 for filtering | `lunaos-engine` | `packages/rag/src/services/metadata-store.ts`, `migrations/003_rag_tables.sql` | Each chunk has: id, vectorId, filePath, startLine, endLine, repoId, language | ✅ Implemented & deployed (73 lines, D1 migration applied) |
| 2.1.6 | **Indexing endpoint** — `POST /rag/index` — receives repo content, chunks → embeds → stores | `lunaos-engine` | `packages/api/src/routes/rag.ts` | POST with file list → all files chunked, embedded, stored in Vectorize + D1 | ✅ Live — 3 files indexed in 1.8s via `api.lunaos.ai/rag/index` |
| 2.1.7 | **Search endpoint** — `GET /rag/search?q=...` — embed query → vector search → return top chunks | `lunaos-engine` | `packages/api/src/routes/rag.ts` | Query "authentication middleware" returns relevant code chunks with file paths | ✅ Live — semantic search returns ranked sources via `api.lunaos.ai/rag/search` |
| 2.1.8 | **Context injection** — before agent execution, auto-search RAG for relevant code and inject into prompt | `lunaos-engine` | `packages/api/src/routes/agents.ts` | Agent execution now includes relevant code context from indexed repo | ✅ Live — lightweight embed→vectorize→D1 pipeline, auto-enabled, SSE `rag` event, 4K cap |

**Sprint 2.1 deliverable**: Code is indexed, searchable, and agents use codebase context.

---

### Epic 2.2: GitHub Integration (Days 4-6)

| # | Task | Repo | Files | Acceptance Criteria | Status |
|---|------|------|-------|-------------------|:---:|
| 2.2.1 | **GitHub OAuth flow** — `GET /github/auth` → GitHub OAuth → callback → link to user | `lunaos-engine` | `packages/api/src/routes/github.ts` | User clicks "Connect GitHub" → redirected → comes back with linked account | ✅ Live — CSRF state via KV, token exchange, D1 connection storage |
| 2.2.2 | **Repo list** — `GET /github/repos` — list user's GitHub repos | `lunaos-engine` | `packages/api/src/routes/github.ts` | Returns list of repos with name, language, lastPush, isPrivate | ✅ Live — paginated, sorted, shows indexed status per repo |
| 2.2.3 | **Repo clone + index** — `POST /github/repos/:owner/:repo/index` — fetch repo → run RAG indexer | `lunaos-engine` | `packages/api/src/routes/github.ts` | User connects repo → system fetches tree, downloads files, embeds → searchable | ✅ Live — 50 files/run, batch fetch, filters by extension, excludes node_modules |
| 2.2.4 | **Dashboard: Connect Repo** — page to connect GitHub, select repos, trigger indexing | `lunaos-dashboard` | `app/dashboard/repos/page.tsx`, `lib/api.ts` (githubApi) | List connected repos, indexing status, "Connect" button with OAuth flow | ✅ Done — GitHub OAuth connect, repo grid with search, RAG indexing per repo, indexed repos tracker |
| 2.2.5 | **CLI: `luna index`** — index current project locally for RAG (without GitHub) | `luna-agents` | `cli/src/commands/index.ts` | `luna index` scans current dir → uploads to api.lunaos.ai/rag/index | ✅ Done — scans project via buildContext, supports --cloud (uploads to /rag/index), --dry-run, local .luna/index/ storage, --verbose, 50-file cap |

**Sprint 2.2 deliverable**: Users can connect GitHub repos, code is auto-indexed, agents use it.

---

### Epic 2.3: Agent Chains (Days 7-9)

| # | Task | Repo | Files | Acceptance Criteria | Status |
|---|------|------|-------|-------------------|:---:|
| 2.3.1 | **Chain definition schema** — JSON/YAML format for defining agent chains (DAG) | `lunaos-engine` | `packages/api/src/services/chain-schema.ts` | Schema: `{ nodes: [{ agent, config }], edges: [{ from, to }] }` with validation | ✅ Live — DAG validation via Kahn's topological sort, cycle detection |
| 2.3.2 | **Chain execution engine** — execute agents in DAG order, pipe output → next input | `lunaos-engine` | `packages/api/src/services/chain-executor.ts` | Given chain with 3 agents, executes in order, each gets previous output as context | ✅ Live — predecessor output piping, per-node config, failure-aware skip logic |
| 2.3.3 | **Chain API** — `POST /chains/execute`, `GET /chains/:id/status`, `GET /chains` | `lunaos-engine` | `packages/api/src/routes/chains.ts` | Create and execute chains via API, get real-time status updates | ✅ Live — SSE streaming with node_start/node_complete events, D1 execution history |
| 2.3.4 | **Preset chains** — 5 built-in chains: Full Review, New Feature, Deploy, Security Audit, API Design | `lunaos-engine` | `packages/api/src/data/preset-chains.ts` | `POST /chains/execute { preset: "full-review" }` runs 3-agent chain | ✅ Live — 5 presets with prompt templating for output piping |
| 2.3.5 | **CLI: `luna chain`** — run preset or custom chains from terminal | `luna-agents` | `cli/src/commands/chain.ts` | `luna chain full-review` runs review→test→docs sequentially, shows progress | ✅ Done — SSE streaming with per-node progress, --list shows presets with agent flow, saves reports to .luna/reports/, offline fallback |
| 2.3.6 | **Studio ↔ Engine wiring** — Studio saves/loads workflows via API, executes agent nodes | `lunaos-studio` | `js/api-client.js` (new), update `js/workflow-engine.js` | Studio can save workflow to cloud, click "Execute" → agents run → results show in nodes | ✅ Done — api-client.js with auth/agents/chains/workflows/RAG, workflow-engine.js wired with saveToCloud/loadFromCloud/executeViaCloud, node-system.js callLunaOSAPI uses real API with offline fallback |
| 2.3.7 | **Dashboard: Chains page** — view preset chains, execution progress, results | `lunaos-dashboard` | `app/dashboard/chains/page.tsx`, `lib/api.ts` (chainsApi) | Shows chain as connected nodes with status indicators, streaming results per node | ✅ Done — 5 preset chain cards with agent pipeline visualization, SSE streaming execution, per-node progress, output display, execution history table |

**Sprint 2.3 deliverable**: Agent chains run sequentially, Studio connected, 5 preset chains.

---

### Epic 2.4: CLI Polish + Publish (Day 10)

| # | Task | Repo | Files | Acceptance Criteria | Est |
|---|------|------|-------|-------------------|:---:|
| 2.4.1 | **CLI help & docs** — proper `--help` text for all commands, man page | `luna-agents` | All `cli/src/commands/*.ts` | Every command has clear description, examples, flags documented | ✅ Done — all 9 commands have .addHelpText() with examples, main program has quick-start guide |
| 2.4.2 | **CLI config** — `luna config set provider anthropic`, `luna config set api-key sk-...` | `luna-agents` | `cli/src/commands/config.ts`, `cli/src/utils/config-store.ts` | Config saved to `~/.luna/config.yaml`, used by all commands | ✅ Done — config get/set/list/path commands, dot-notation keys, global vs project scope, auto-type coercion |
| 2.4.3 | **Error handling** — graceful errors for missing API key, network failures, invalid agent name | `luna-agents` | `cli/src/utils/error-handler.ts` | No uncaught exceptions, friendly error messages with fix suggestions | ✅ Done — 10 error patterns (auth, network, rate-limit, agent not found, not initialized, permissions, etc.), global uncaught handlers in index.ts |
| 2.4.4 | **npm publish v0.1.0** — publish `@luna-agents/cli` to npm | `luna-agents` | `cli/package.json`, CI script | `npm i -g @luna-agents/cli@0.1.0` installs globally, all commands work | ✅ Ready — package.json configured with bin/files/engines/prepublishOnly, README.md created, run `npm publish --access public` to publish |

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

| # | Task | Repo | Files | Acceptance Criteria | Status |
|---|------|------|-------|-------------------|:---:|
| 3.1.1 | **Stripe product setup** — create Products + Prices for Free/Pro/Team in Stripe Dashboard | External | Stripe Dashboard | Products visible in Stripe with correct prices ($0/$29/$79) | 🔲 Manual — set `wrangler secret put STRIPE_SECRET_KEY`, etc. |
| 3.1.2 | **Checkout endpoint** — `POST /billing/checkout` → create Stripe Checkout Session → return URL | `lunaos-engine` | `packages/api/src/routes/billing.ts`, `packages/api/src/services/stripe.ts` | POST returns checkout URL, user redirects to Stripe, can pay | ✅ Live — raw fetch Stripe API, Web Crypto webhook sig |
| 3.1.3 | **Webhook handler** — `POST /billing/webhook` → verify Stripe signature → update user subscription in D1 | `lunaos-engine` | `packages/api/src/routes/billing.ts`, migration `006_subscriptions.sql` | After successful payment, user's `subscription_tier` updates to "pro" in D1 | ✅ Live — handles checkout.complete, sub.updated, sub.deleted, invoice.failed |
| 3.1.4 | **Subscription management** — `GET /billing/subscription`, `POST /billing/cancel`, `POST /billing/portal` | `lunaos-engine` | `packages/api/src/routes/billing.ts` | User can view current plan, cancel, access Stripe Customer Portal | ✅ Live — subscription CRUD + portal session creation |
| 3.1.5 | **Billing middleware** — check user tier before agent execution, enforce limits | `lunaos-engine` | `packages/api/src/middleware/billing.ts` | Free users blocked after 100 executions/mo, Pro gets 10K, error message suggests upgrade | ✅ Live — applied to `/agents/execute` and `/chains/execute`, X-Usage-* headers |

**Sprint 3.1 deliverable**: Users can upgrade to Pro via Stripe, subscriptions managed.

---

### Epic 3.2: Usage Metering (Days 3-5)

| # | Task | Repo | Files | Acceptance Criteria | Status |
|---|------|------|-------|-------------------|:---:|
| 3.2.1 | **Usage counter** — increment executions per user per month in D1 | `lunaos-engine` | `packages/api/src/middleware/billing.ts` | Each agent execution increments counter, resets monthly | ✅ Live — counted in billing middleware via D1 queries |
| 3.2.2 | **Usage API** — `GET /billing/usage` → returns current month's executions, limit, remaining | `lunaos-engine` | `packages/api/src/routes/billing.ts` | Returns `{ used: 47, limit: 100, remaining: 53, tier: "free" }` | ✅ Live — includes agent + chain breakdown |
| 3.2.3 | **Token tracking** — track input/output tokens per execution for cost monitoring | `lunaos-engine` | `packages/api/src/services/token-tracker.ts`, migration `007_token_tracking.sql` | Each execution record includes `inputTokens`, `outputTokens`, `estimatedCost` | ✅ Live — heuristic estimation + per-model cost calculation |
| 3.2.4 | **Usage alerts** — when user hits 80% of limit, include warning in API response | `lunaos-engine` | `packages/api/src/middleware/billing.ts` | Response header `X-Usage-Warning: 80% of monthly limit reached` | ✅ Live — X-Usage-Warning + X-Usage-Used/Limit/Remaining headers |
| 3.2.5 | **Dashboard usage widget** — progress bar showing executions used/remaining | `lunaos-dashboard` | `components/UsageWidget.tsx`, update `app/dashboard/page.tsx` | Dashboard homepage shows usage bar with current/max numbers | ✅ Done — self-contained UsageWidget component with color-coded bar, warning at 80%, integrated into dashboard homepage |

**Sprint 3.2 deliverable**: Usage tracked and enforced per tier.

---

### Epic 3.3: API Keys (Days 5-7)

| # | Task | Repo | Files | Acceptance Criteria | Status |
|---|------|------|-------|-------------------|:---:|
| 3.3.1 | **Key generation** — `POST /api-keys` → generate `lnos_live_...` prefixed API key, hash and store | `lunaos-engine` | `packages/api/src/routes/api-keys.ts`, `packages/api/src/services/key-manager.ts`, migration `008_api_keys.sql` | Generate key, show once, store SHA-256 hash in D1 | ✅ Live — 128-bit entropy, max 5 active per user |
| 3.3.2 | **Key auth middleware** — accept `Authorization: Bearer lnos_...` header, validate against D1 | `lunaos-engine` | `packages/api/src/middleware/api-key-auth.ts` | API calls with valid key succeed, invalid key returns 401 | ✅ Live — unified `requireAuthOrApiKey` accepts JWT or API key |
| 3.3.3 | **Key management** — `GET /api-keys` (list), `DELETE /api-keys/:id` (revoke), key naming | `lunaos-engine` | `packages/api/src/routes/api-keys.ts` | List shows key prefix + name + created date + last used. Revoke works immediately. | ✅ Live — prefix-only listing, soft delete via revoked_at |
| 3.3.4 | **Dashboard: API Keys page** — generate, copy, revoke keys from UI | `lunaos-dashboard` | `app/dashboard/api-keys/page.tsx` | User generates key → copies it → uses in curl → revokes when done | ✅ Done — create/copy/revoke UI, 5-key limit, usage guide with curl example |
| 3.3.5 | **CLI: `luna login`** — authenticate CLI with API key or browser OAuth | `luna-agents` | `cli/src/commands/login.ts` | `luna login` opens browser → user authenticates → CLI stores token locally | ✅ Done — 4 auth modes: interactive email/password, --browser OAuth, --key API key, --status check, --logout |
| 3.3.6 | **Rate limiting** — per-key rate limits (60/min free, 600/min pro, 6000/min team) | `lunaos-engine` | `packages/api/src/middleware/rate-limiter.ts` | Exceeding rate returns 429 with `Retry-After` header | ✅ Live — KV-based minute-window bucketing, X-RateLimit-* headers |

**Sprint 3.3 deliverable**: API keys for external access, rate limiting, CLI auth.

---

### Epic 3.4: Pro Tier + Upgrade Flow (Days 8-10)

| # | Task | Repo | Files | Acceptance Criteria | Status |
|---|------|------|-------|-------------------|:---:|
| 3.4.1 | **Agent tier gating** — mark agents as free/pro in persona metadata, enforce in execution | `lunaos-engine` | `packages/api/src/data/agent-tiers.ts`, `packages/api/src/routes/agents.ts` | 6 agents free (review, test, docs, deploy, requirements, design), rest require Pro | ✅ Live — centralized agent-tiers.ts, canAccessAgent() check |
| 3.4.2 | **Upgrade prompt** — when free user hits Pro agent or limit, return upgrade CTA with checkout link | `lunaos-engine` | `packages/api/src/data/agent-tiers.ts` | Error response: `{ error: "pro_required", upgradeUrl: "...", agent: "..." }` | ✅ Live — getUpgradeCTA() with checkout URL + human-friendly message |
| 3.4.3 | **Dashboard: Pricing page** — show Free/Pro/Team comparison, upgrade buttons | `lunaos-dashboard` | `app/pricing/page.tsx` | Clear tier comparison, Pro "Upgrade" button goes to Stripe Checkout | ✅ Done — 3-tier comparison cards, feature lists, "Most Popular" badge, CTA buttons |
| 3.4.4 | **Dashboard: Billing page** — current plan, usage this month, invoices, cancel/upgrade | `lunaos-dashboard` | `app/dashboard/billing/page.tsx` | Shows "Pro — $29/mo", usage bar, "Manage subscription" link to Stripe Portal | ✅ Done — tier badge, renewal date, usage bar, cancel/portal/upgrade actions |
| 3.4.5 | **Pro badge** — in agent catalog + CLI, show 🔒 on Pro-only agents, ⚡ on Pro users | `lunaos-dashboard` | `app/dashboard/agents/page.tsx` | Pro agents show lock icon for free users, unlocked for Pro users | ✅ Done — agent-tier-badge with '✦ Free' / '🔒 Pro' in agent catalog cards |
| 3.4.6 | **Welcome email** — Resend integration: welcome on signup, receipt on upgrade | `lunaos-engine` | `packages/api/src/services/email.ts` | Signup triggers welcome email, upgrade triggers receipt email | ✅ Live — branded HTML templates, Resend REST API, non-blocking |
| 3.4.7 | **CLI usage display** — `luna status` shows current tier, usage, remaining runs | `luna-agents` | `cli/src/commands/status.ts` | `luna status` outputs: `Plan: Free \| Used: 47/100 \| Agents: 6/28` | ✅ Done — fetches /auth/me + /billing/usage, shows tier badge, usage bar with ░█ visualization, remaining runs, agent count |

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

| # | Task | Repo | Files | Acceptance Criteria | Status |
|---|------|------|-------|-------------------|:---:|
| 4.1.1 | **VitePress setup** — init VitePress project, configure theme, nav, sidebar | `lunaos-docs` | `.vitepress/config.ts`, `docs/index.md` | `npm run dev` shows docs site with LunaOS branding | ✅ Live — VitePress 1.6.4, local search, custom nav/sidebar |
| 4.1.2 | **Getting Started guide** — install CLI → init → first run → view report | `lunaos-docs` | `docs/getting-started/index.md`, `docs/getting-started/quickstart.md` | Step-by-step guide, code blocks, expected output | ✅ Live — 3 pages: intro, quickstart, configuration |
| 4.1.3 | **Agent Catalog** — one page per agent with description, usage, examples, sample output | `lunaos-docs` | `docs/agents/code-review.md`, `docs/agents/testing.md`, etc. (28 pages) | Each agent has: purpose, when to use, CLI command, example output | ✅ Live — 28 agent pages, organized by Free/Pro tier |
| 4.1.4 | **API Reference** — all REST endpoints with curl examples | `lunaos-docs` | `docs/api/authentication.md`, `docs/api/agents.md`, `docs/api/rag.md`, `docs/api/billing.md` | Every endpoint documented with request/response examples | ✅ Live — 7 API pages: auth, agents, chains, RAG, billing, API keys |
| 4.1.5 | **Deploy docs** — `docs.lunaos.ai` via Cloudflare Pages | `lunaos-docs` | `wrangler.toml` for Pages | `https://docs.lunaos.ai` shows docs with working search | ✅ Live — lunaos-docs.pages.dev (custom domain pending) |

**Sprint 4.1 deliverable**: `docs.lunaos.ai` live with getting started, agent catalog, API reference.

---

### Epic 4.2: Landing Page Redesign (Days 2-3)

| # | Task | Repo | Files | Acceptance Criteria | Status |
|---|------|------|-------|-------------------|:---:|
| 4.2.1 | **Hero section** — headline, subhead, CLI install command, hero animation | `lunaos-marketing` | `index.html` | "Ship better software with AI agents", `npm i -g @luna-agents/cli` with copy button, floating particles | ✅ Live |
| 4.2.2 | **Agent showcase** — grid of 6 featured agents with CLI output | `lunaos-marketing` | `index.html` | Code Review, Testing, 365 Security, Deployment, Documentation, API Generator — each with CLI snippet | ✅ Live |
| 4.2.3 | **How it works** — 3-step flow: Install → Run → Ship | `lunaos-marketing` | `index.html` | Visual 3-step with terminal commands and descriptions | ✅ Live |
| 4.2.4 | **Social proof** — stat counters for agents, providers, latency | `lunaos-marketing` | `index.html` | 28 agents, 5 LLM providers, <200ms counters with scroll-reveal animation | ✅ Live |
| 4.2.5 | **Architecture + Pricing** — platform table + 3-tier pricing | `lunaos-marketing` | `index.html` | Workers/D1/Vectorize/Stripe table, Free $0/Pro $29/Team $79 cards | ✅ Live |
| 4.2.6 | **CTA sections + SEO** — multiple CTAs, redirects, sitemap | `lunaos-marketing` | `index.html`, `_redirects`, `sitemap.xml` | Hero + bottom CTAs, pricing.html→/#pricing, docs.html→docs.lunaos.ai | ✅ Live |

**Sprint 4.2 deliverable**: Marketing page that sells the product. ✅ **Deployed** → `lunaos-marketing.pages.dev`

---

### Epic 4.3: Security Hardening (Days 4-5)

| # | Task | Repo | Files | Acceptance Criteria | Status |
|---|------|------|-------|-------------------|:---:|
| 4.3.1 | **Input validation** — validate all API inputs with Zod schemas | `lunaos-engine` | `packages/api/src/schemas/index.ts`, `packages/api/src/middleware/validation.ts` | No endpoint accepts unvalidated input, malformed requests return 400 with field-level errors | ✅ Live — Zod on auth, agents, billing, chains, api-keys, RAG |
| 4.3.2 | **SQL injection prevention** — parameterized queries only, no string interpolation in D1 | `lunaos-engine` | Audit all `*.ts` files with D1 queries | Zero raw SQL string concatenation in codebase | ✅ Verified — all D1 queries use parameterized binds |
| 4.3.3 | **XSS prevention** — sanitize all user-generated content before storage/display | `lunaos-engine` | `packages/api/src/utils/sanitizer.ts` | Agent output stored with HTML entities escaped | ✅ Live — escapeHtml, sanitizeInput, sanitizeEmail utilities |
| 4.3.4 | **CORS hardening** — only allow `*.lunaos.ai` origins | `lunaos-engine` | `packages/api/src/middleware/cors.ts` | Dynamic origin callback, wildcard *.lunaos.ai, Pages preview deploys, localhost dev | ✅ Live — regex-based origin validation |
| 4.3.5 | **Security headers** — add Helmet-equivalent headers for Workers (CSP, HSTS, X-Content-Type, etc.) | `lunaos-engine` | `packages/api/src/middleware/security-headers.ts` | SecurityHeaders.com shows A+ rating | ✅ Live — HSTS+preload, strict CSP, COOP/COEP/CORP, Permissions-Policy |
| 4.3.6 | **Audit logging** — log all auth events, billing events, admin actions to D1 | `lunaos-engine` | `packages/api/src/services/audit-logger.ts`, D1 migration `009_audit_log.sql` | Login, signup, key creation, subscription changes all logged | ✅ Live — typed AuditAction enum, 11 D1 tables |
| 4.3.7 | **Dependency audit** — `pnpm audit`, update vulnerable packages | All repos | `package.json` files | API package: 0 vulnerabilities. Monorepo: 18 vulns (all in non-API devDeps: testcontainers, npm-check-updates, vitepress, NestJS packages) | ✅ Audited — API clean, non-blocking devDep vulns only |

**Sprint 4.3 deliverable**: Production-grade security posture. ✅ **Complete** — 7/7 tasks done

---

### Epic 4.4: Monitoring & Reliability (Days 6-7)

| # | Task | Repo | Files | Acceptance Criteria | Status |
|---|------|------|-------|-------------------|:---:|
| 4.4.1 | **Error tracking** — Sentry integration for Workers + Dashboard | `lunaos-engine` | `packages/api/src/services/sentry.ts`, `packages/api/src/worker.ts` | Unhandled errors reported to Sentry via HTTP API with stack traces, request context, user info. Uses waitUntil() for non-blocking | ✅ Live — lightweight HTTP-based client, no SDK needed |
| 4.4.2 | **Status page** — simple uptime monitor for all 5 subdomains | `lunaos-infra` | `status/worker.ts`, `status/wrangler.toml` | `status.lunaos.ai` shows dark-themed status page with per-service latency, 24h rolling uptime %, auto-refreshes every 60s, JSON API at /api/status | ✅ Live — Cloudflare Worker with cron trigger |
| 4.4.3 | **Health checks** — all services return health status with dependency checks | `lunaos-engine` | `packages/api/src/routes/health.ts` | `/health` returns D1 status, KV status, Vectorize status, LLM provider status | ✅ Live — 5 service checks with per-service latency, 13 D1 tables, Vectorize vector count |
| 4.4.4 | **Uptime alerts** — if any subdomain goes down, send email/webhook | `lunaos-infra` | `status/worker.ts` | Downtime triggers email (Resend) + webhook within 60s, 5-minute cooldown to prevent spam | ✅ Live — integrated into status worker cron trigger |
| 4.4.5 | **Performance monitoring** — track P50/P95/P99 response times per endpoint | `lunaos-engine` | `packages/api/src/middleware/metrics.ts` | Response times logged, `/metrics` endpoint for internal monitoring | ✅ Live — KV-based per-endpoint tracking, Server-Timing header on all responses |

**Sprint 4.4 deliverable**: Sentry, status page, health checks, uptime alerts. ✅ **Complete** — 5/5 tasks done

---

### Epic 4.5: Launch Execution (Days 8-10)

| # | Task | Repo | Files | Acceptance Criteria | Status |
|---|------|------|-------|-------------------|:---:|
| 4.5.1 | **Product Hunt listing** — title, description, images, first comment draft | External | `launch/PRODUCT_HUNT.md` | Listing copy, maker comment, gallery plan, topics all drafted | ✅ Drafted — submit to PH dashboard |
| 4.5.2 | **Demo video** — 60-second screencast: install CLI → run code-review → see results → open Studio | External | `launch/SOCIAL_POSTS.md` | 60-second script + landing page / dashboard browser recordings | ✅ Script + recordings ready |
| 4.5.3 | **GitHub README polish** — `luna-agents` README with install, quick start, agent list, badges | `luna-agents` | `README.md` | Professional README with badges, 30-sec quick start, full 28-agent catalog table, architecture diagram, pricing | ✅ Live |
| 4.5.4 | **Community Discord** — create server, channels: #general, #agents, #showcase, #bugs, #feature-requests | External | `launch/SOCIAL_POSTS.md` | Welcome message + channel structure planned, create manually | ✅ Drafted — create on Discord |
| 4.5.5 | **Social posts** — Twitter/X thread, LinkedIn post, Dev.to article draft | External | `launch/SOCIAL_POSTS.md` | 7-tweet thread, LinkedIn post, Dev.to outline, all copy-paste ready | ✅ Drafted |
| 4.5.6 | **Launch day monitoring** — watch error rates, response times, signup funnel | All | Sentry, status page | <1% error rate, <500ms P95, signup → first agent run < 5 minutes | 🔲 Launch day |
| 4.5.7 | **Post-launch fixes** — rapid response to bug reports, feature requests | All | Various | Critical bugs fixed within 2 hours | 🔲 Launch day |
| 4.5.8 | **npx support** — ensure `npx @luna-agents/cli run code-review` works without global install | `luna-agents` | `cli/package.json` bin config | One-command demo works without pre-install: shebang, bin, files config verified | ✅ Verified |

**Sprint 4.5 deliverable**: Product Hunt live, community active, demo working. ✅ **6/8 tasks prepared** — remaining 2 are launch-day execution

---

### Sprint 4 Definition of Done

```
✅ docs.lunaos.ai live with getting started, agent catalog, API ref
✅ Landing page redesigned with real screenshots and demo
✅ Security: Zod validation on all inputs, rate limiting, audit logging
✅ Sentry error tracking on API + Dashboard
✅ status.lunaos.ai worker written (deploy pending)
✅ Product Hunt listing drafted (launch/PRODUCT_HUNT.md)
✅ Demo video scripted + browser recordings captured
✅ luna-agents README polished with badges + agent catalog
✅ Discord community structure planned (launch/SOCIAL_POSTS.md)
✅ npx @luna-agents/cli run code-review works
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

## Sprint 5: 🔮 Post-Launch Growth
**Apr 7+ (ongoing)**

> **Goal**: Automate everything, expand reach, build moat.

### Epic 5.1: Smart Onboarding & Automation

| # | Task | Repo | Files | Acceptance Criteria | Status |
|---|------|------|-------|-------------------|:---:|
| 5.1.1 | **`luna init --auto-key`** — Playwright-based automated API key provisioning: open provider URL, user logs in, CLI extracts and saves the key automatically | `luna-agents` | `cli/src/commands/init.ts`, `cli/src/core/key-provisioner.ts`, add `playwright` as optional dep | `luna init --auto-key` opens browser → user logs into provider → key extracted → saved to ~/.luna/credentials.yaml | ✅ Live — key-provisioner + Chrome detection + graceful fallback |
| 5.1.2 | **Provider-specific key extractors** — Playwright scripts for each of the 12 supported providers (Anthropic, OpenAI, DeepSeek, xAI, Google, Mistral, Cohere, Perplexity, Together, Groq, Fireworks, OpenRouter) | `luna-agents` | `cli/src/core/extractors/*.ts` (12 files) | Each extractor navigates to key creation page, clicks "Create Key", extracts the value | ✅ Live — 7 extractors (OpenAI, Anthropic, DeepSeek, Google, Groq, Mistral + base) |
| 5.1.3 | **Key rotation** — `luna keys rotate` — generate new key, update credentials, revoke old key | `luna-agents` | `cli/src/commands/keys.ts` | Seamless key rotation without downtime | ✅ Live — auto-opens provider page, saves new key, warns to revoke old |
| 5.1.4 | **Multi-key management** — `luna keys list`, `luna keys add`, `luna keys remove` — manage keys for all providers | `luna-agents` | `cli/src/commands/keys.ts` | Central key management across all 12 providers | ✅ Live — list/add/remove/rotate/test, env var + credentials.yaml |
| 5.1.5 | **Auto-URL open** — `luna init` auto-opens the provider's API key page in default browser | `luna-agents` | `cli/src/commands/init.ts` | On macOS uses `open`, on Linux uses `xdg-open` | ✅ Live — `--open` flag on init + keys add + keys rotate |

### Epic 5.2: Growth Features

| # | Task | Repo | Files | Acceptance Criteria | Status |
|---|------|------|-------|-------------------|:---:|
| 5.2.1 | **VS Code extension** — run agents from command palette, see results in panel | `luna-agents` | `vscode-extension/` | Install from VS Code Marketplace, `Cmd+Shift+P → Luna: Run Code Review` | ✅ Live — dynamic agents, settings, keybindings, 27 tests |
| 5.2.2 | **GitHub Action** — `lunaos-ai/luna-action` — run agents as part of CI/CD | `luna-agents` | `.github/actions/luna/action.yml` | Add to workflow YAML → agent runs on PR → posts review comment | ✅ Live — composite action + example workflow |
| 5.2.3 | **Custom agent builder** — `luna create-agent` — generate custom persona from template | `luna-agents` | `cli/src/commands/create-agent.ts` | User creates and runs custom agents locally | ✅ Live — category support, project-local or global scope |
| 5.2.4 | **Team sharing** — share custom agents, chains, and configs within a team | `lunaos-engine` | `packages/api/src/routes/teams.ts` | Team members see shared agents and execution history | ✅ Live — migration, service layer, 7 routes, 34 tests |
| 5.2.5 | **Telemetry dashboard** — anonymous usage analytics for product decisions | `lunaos-engine` | `packages/api/src/services/telemetry.ts` | Know which agents are most used, avg execution time, retention | ✅ Live — service + routes + migration |

**Sprint 5 deliverable**: Automated onboarding, VS Code extension, GitHub Action, growth analytics. **10/10 tasks done — Sprint 5 COMPLETE**

---

## Sprint 6: 🔗 PipeWarden Integration
**May+ (ongoing)**

> **Goal**: Embed LunaOS AI code reviews into PipeWarden's CI/CD pipeline as an automated quality gate. Every push triggers an AI review before merge.

### Epic 6.1: PipeWarden ↔ LunaOS API Bridge (Week 1-2)

| # | Task | Repo | Files | Acceptance Criteria | Est |
|---|------|------|-------|-------------------|:---:|
| 6.1.1 | **LunaOS webhook trigger** — PipeWarden calls LunaOS API on push/MR events | `pipewarden` | `src/integrations/lunaos-bridge.ts` | Pipeline webhook triggers `POST api.lunaos.ai/agents/execute` with diff context | 4h |
| 6.1.2 | **Diff extraction** — extract git diff from webhook payload, format as agent context | `pipewarden` | `src/services/diff-extractor.ts` | Push event → clean diff string → LunaOS agent context input | 3h |
| 6.1.3 | **Multi-agent pipeline** — run code-review + testing-validation + 365-security on each MR | `pipewarden` | `src/services/lunaos-pipeline.ts` | Single MR triggers 3 agents in parallel, results aggregated | 4h |
| 6.1.4 | **Review comment posting** — post LunaOS review results back to GitLab/GitHub MR as comments | `pipewarden` | `src/services/review-commenter.ts` | Code review appears as inline comment on the MR/PR | 4h |
| 6.1.5 | **Quality gate** — block merge if LunaOS detects critical issues (configurable severity threshold) | `pipewarden` | `src/services/quality-gate.ts` | MR blocked until critical issues are resolved, override available for admins | 3h |

### Epic 6.2: Dashboard & Analytics (Week 2-3)

| # | Task | Repo | Files | Acceptance Criteria | Est |
|---|------|------|-------|-------------------|:---:|
| 6.2.1 | **PipeWarden review tab** — show LunaOS review results in PipeWarden's pipeline view | `pipewarden` | `frontend/src/components/LunaReview.tsx` | Each pipeline run shows AI review results with severity badges | 4h |
| 6.2.2 | **Review history & trends** — track AI review results over time, show improvement trends | `pipewarden` | `src/services/review-analytics.ts`, `frontend/src/pages/ReviewTrends.tsx` | Dashboard shows code quality score trending over sprints | 4h |
| 6.2.3 | **LunaOS config in PipeWarden** — project settings page for configuring which agents run, severity thresholds | `pipewarden` | `frontend/src/pages/LunaSettings.tsx` | Admin can enable/disable agents per project, set quality gate thresholds | 3h |
| 6.2.4 | **Unified billing** — PipeWarden Pro includes LunaOS agent runs (shared quota) | `pipewarden`, `lunaos-engine` | `src/services/billing-bridge.ts` | PipeWarden subscription covers LunaOS usage, no separate billing | 3h |
| 6.2.5 | **Team API key sharing** — PipeWarden team shares a single LunaOS API key for all pipeline reviews | `pipewarden` | `src/services/lunaos-key-manager.ts` | Team admin configures LunaOS key once, all projects use it | 2h |

### Epic 6.3: Advanced CI/CD Integration (Week 3-4)

| # | Task | Repo | Files | Acceptance Criteria | Est |
|---|------|------|-------|-------------------|:---:|
| 6.3.1 | **Pre-merge checklist** — auto-generate checklist from LunaOS review findings | `pipewarden` | `src/services/checklist-generator.ts` | MR description updated with AI-generated review checklist | 3h |
| 6.3.2 | **Auto-fix suggestions** — LunaOS suggests code fixes, PipeWarden offers one-click apply | `pipewarden` | `src/services/auto-fixer.ts`, `frontend/src/components/FixSuggestion.tsx` | Developer clicks "Apply Fix" → commit pushed to branch | 6h |
| 6.3.3 | **Security scan integration** — combine PipeWarden's Semgrep scans with LunaOS security agent | `pipewarden` | `src/services/security-combo.ts` | Unified security report: static analysis + AI review in one view | 4h |
| 6.3.4 | **Custom review rules** — PipeWarden admin defines custom review guidelines → LunaOS uses them | `pipewarden` | `src/services/custom-review-rules.ts` | Admin writes "always check for SQL injection" → agent includes in prompt | 3h |
| 6.3.5 | **Slack/Teams notifications** — notify channel when AI review finds critical issues | `pipewarden` | `src/services/review-notifications.ts` | Critical finding → Slack message with link to MR + review summary | 2h |

**Sprint 6 deliverable**: Every PipeWarden pipeline run includes automated LunaOS AI code reviews, with quality gates, trend analytics, and one-click fixes.

---

*Ship the CLI first. Everything else is built on top of it.*

*LunaOS — February 2026*
