# ClawPipe Sprint Tasks — 6-Week Execution Plan

> Ticker format: CP-XXX | Each task = 1 day | RD = Requirements, AC = Acceptance Criteria, CR = Code Criteria

---

## WEEK 1 — Dashboard UI

---

### CP-001 · Day 1 · Dashboard Shell + Auth Check

**RD**
The dashboard at `dashboard/index.html` is a static vanilla HTML/JS/CSS Cloudflare Pages app. It currently has a mockup UI. Build the real shell: sidebar nav, top bar with project selector, auth token check on load, and a router that shows/hides panels based on hash navigation (`#overview`, `#providers`, `#cache`, `#routes`, `#prompts`). If no API key in `localStorage`, redirect to a login screen that accepts the ClawPipe API key and stores it.

**AC**
- [ ] Load `dashboard/index.html` → if no `clawpipe_api_key` in localStorage, show login panel
- [ ] Submit API key → store in localStorage → show main dashboard shell
- [ ] Sidebar links: Overview, Providers, Cache, Routes, Prompts — each changes the visible panel
- [ ] Top bar shows selected project name (hardcoded "Default Project" for now)
- [ ] Hash navigation works: `#overview` → overview panel visible, others hidden
- [ ] Logout button clears localStorage and returns to login screen
- [ ] Responsive: sidebar collapses to icons on viewports < 768px

**CR**
- Vanilla JS only — no framework, no npm, no build step
- All JS inline or in `dashboard/app.js`
- No inline event handlers (`onclick=`), use `addEventListener`
- Max 200 lines per JS file
- API key sent as `Authorization: Bearer <key>` header on all fetch calls
- No `eval()`, no `innerHTML` with user-controlled strings (use `textContent`)

**Test**
```
1. Open dashboard/index.html in browser (CF Pages dev or file://)
2. Verify login screen appears with no key set
3. Enter any string as API key → main shell appears
4. Click each sidebar link → correct panel shows, others hide
5. Resize to 600px → sidebar shows icons only
6. Click logout → login screen returns, localStorage cleared
```

**Resolution**: All AC checkboxes pass. No console errors. No XSS vectors via innerHTML.

---

**Implementation Prompt (CP-001)**

```
You are implementing the ClawPipe dashboard shell.

Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Files to edit: dashboard/index.html, create dashboard/app.js

Stack: Vanilla HTML/CSS/JS. No framework. No build step. Cloudflare Pages static deployment.

TASK: Build the dashboard shell with auth gate and hash-based panel routing.

REQUIREMENTS:
1. On load: check localStorage for `clawpipe_api_key`. If missing → show #login-panel, hide #main-shell.
2. Login panel: single input for API key + submit button. On submit: store key in localStorage, hide login, show main shell.
3. Main shell layout:
   - Left sidebar (240px): logo, nav links for Overview / Providers / Cache / Routes / Prompts / Settings
   - Top bar: "ClawPipe Dashboard" title + logout button (right)
   - Content area: panels with IDs #panel-overview, #panel-providers, #panel-cache, #panel-routes, #panel-prompts
4. Hash router: on hashchange and on load, show the panel matching location.hash (default: #overview). Hide all others.
5. Logout: clear localStorage, show login panel, hide main shell.
6. Responsive: sidebar collapses to 56px icon-only strip below 768px.

CODE RULES:
- Max 200 lines per file. Split into dashboard/app.js if needed.
- No inline onclick. Use addEventListener.
- No innerHTML with dynamic strings. Use textContent or createElement.
- CSS: use CSS variables for colors (--bg, --surface, --accent, --text, --muted).
- Dark theme default: --bg: #0f0f0f, --surface: #1a1a1a, --accent: #6366f1, --text: #f5f5f5

ACCEPTANCE: Login gate works. Hash nav works. No console errors. No XSS via innerHTML.
```

---

### CP-002 · Day 2 · Overview Metrics Panel

**RD**
Wire the `#panel-overview` panel to `GET /v1/analytics/overview`. Show 6 metric cards: Total Requests, Total Tokens, Total Cost ($), Cache Hit Rate (%), Boost Hit Rate (%), Avg Latency (ms). Fetch on panel activate. Show skeleton loaders while fetching. Handle error state (API unreachable or 401).

**AC**
- [ ] Panel fetches `GET /v1/analytics/overview` with `Authorization: Bearer <key>` on every activation
- [ ] 6 metric cards render with correct labels and formatted values
- [ ] Skeleton loader shows during fetch (grey animated bar)
- [ ] On 401: show "Invalid API key" message + logout button
- [ ] On network error: show "Could not reach gateway" + retry button
- [ ] Retry button re-fetches
- [ ] Cost formatted as `$0.0000` (4 decimal places)
- [ ] Cache hit rate and boost hit rate shown as `XX.X%`

**CR**
- `fetchAnalytics(endpoint, apiKey)` — single reusable function, returns parsed JSON or throws
- Format functions: `formatCost(n)`, `formatPercent(n)`, `formatNumber(n)` — pure, no side effects
- No hardcoded gateway URL — read from `const GATEWAY_URL = 'https://api.clawpipe.ai'` at top of app.js
- Skeleton via CSS animation only, no JS timers

**Test**
```
1. Activate Overview panel with valid key → 6 cards appear with real data
2. Set key to invalid string → 401 → "Invalid API key" + logout shown
3. Set GATEWAY_URL to unreachable host → network error → "Could not reach gateway" + retry shown
4. Click retry → fetch fires again
5. Check Network tab: Authorization header present on every request
```

**Resolution**: Cards render. Error states work. No Authorization header leaks to console.

---

**Implementation Prompt (CP-002)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Files: dashboard/app.js, dashboard/index.html

TASK: Wire #panel-overview to GET /v1/analytics/overview.

Gateway response shape:
{
  total_requests: number,
  total_tokens_in: number,
  total_tokens_out: number,
  total_cost: number,
  cached_count: number,
  boosted_count: number,
  avg_latency: number
}

Derived metrics:
- Cache Hit Rate = cached_count / total_requests * 100
- Boost Hit Rate = boosted_count / total_requests * 100

IMPLEMENTATION:
1. Add const GATEWAY_URL = 'https://api.clawpipe.ai' at top of app.js.
2. Add fetchAnalytics(path) → fetch with Bearer token from localStorage → return JSON.
3. On #overview panel activate: show 6 skeleton cards → fetch → replace with values.
4. Format: cost = $X.XXXX, percent = XX.X%, numbers = locale string.
5. Error handling: 401 → show error banner "Invalid API key" + logout button. Network fail → "Could not reach gateway" + retry button.
6. Skeleton: CSS class .skeleton with @keyframes pulse (opacity 0.4→1→0.4).

CODE RULES: Max 200 lines/file. No innerHTML with dynamic data. Pure format functions.
```

---

### CP-003 · Day 3 · Cost Trend + Savings Chart

**RD**
Add a line chart to `#panel-overview` below the metric cards showing 30-day cost trend from `GET /v1/analytics/cost-trend`. Two lines: actual cost and estimated cost without ClawPipe (baseline). Render using Canvas API (no charting library). Show savings badge: "Saved $X.XX this month".

**AC**
- [ ] Chart renders below metric cards in overview panel
- [ ] Two lines: `cost` (blue) and `baseline` (grey dashed) over 30 days
- [ ] X-axis: date labels (every 7 days), Y-axis: dollar amounts
- [ ] "Saved $X.XX this month" badge above chart (sum of baseline - cost)
- [ ] Chart redraws on window resize
- [ ] If < 7 data points, show "Not enough data yet" placeholder

**CR**
- Canvas 2D API only — no Chart.js, no D3, no external library
- `drawLineChart(canvas, data)` — pure function, takes canvas element + data array
- Chart drawing code in separate `dashboard/chart.js` (max 200 lines)
- Cost trend endpoint response: `[{ date: string, cost: number, baseline: number }]`

**Test**
```
1. Overview panel loads → chart appears with two lines
2. Resize window → chart redraws (no stretching)
3. Mock API to return 3 data points → "Not enough data yet" placeholder shows
4. Verify savings badge math: sum(baseline) - sum(cost) matches displayed value
```

---

**Implementation Prompt (CP-003)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Create: dashboard/chart.js (max 200 lines)
Edit: dashboard/index.html (add <script src="chart.js">), dashboard/app.js

TASK: Render a 30-day cost trend line chart using Canvas 2D API.

Endpoint: GET /v1/analytics/cost-trend
Response: [{ date: "2026-04-01", cost: 0.42, baseline: 0.80 }, ...]

IMPLEMENTATION:
1. In chart.js: export function drawLineChart(canvas, data, options).
   - options: { lineColor, baselineColor, padding, fontSize }
   - Draw axes, gridlines (5 horizontal), date labels (every 7 days), two polylines.
   - Normalize Y values to canvas height. Add 10% padding top for peak values.
2. In app.js: after fetching cost-trend, if data.length < 7 show placeholder, else call drawLineChart.
3. Savings badge: reduce data to sum(baseline-cost), render as "$X.XX saved" in accent color above canvas.
4. On window resize: debounce 200ms → redraw chart.

CODE RULES: No external libraries. Canvas 2D only. Pure drawLineChart function (no side effects beyond canvas).
```

---

### CP-004 · Day 4 · Provider Breakdown Table

**RD**
Build `#panel-providers`. Fetch `GET /v1/analytics/providers`. Render a sortable table: Provider, Model, Requests, Tokens, Cost ($), Avg Latency (ms), Cache Hits. Clicking a column header sorts ascending/descending. Add a bar chart column showing relative cost as a horizontal bar.

**AC**
- [ ] Table renders all providers returned from endpoint
- [ ] Click column header → sorts that column. Second click → reverses.
- [ ] Active sort column shows arrow indicator (↑ or ↓)
- [ ] Cost column has mini horizontal bar (width = cost/maxCost * 100%)
- [ ] Empty state: "No provider data yet" if array is empty
- [ ] Table is horizontally scrollable on mobile

**CR**
- Sort logic in pure `sortTable(data, col, direction)` function
- No `innerHTML` for table rows — use `createElement` + `appendChild`
- Bar rendered as a `<div>` with inline width style (safe — not user input)

**Test**
```
1. Panel activates → table renders
2. Click "Cost" header → sorts descending by cost → arrow shows ↓
3. Click again → ascending → arrow shows ↑
4. Mock empty array → "No provider data yet" shows
5. Viewport 400px wide → table scrolls horizontally
```

---

**Implementation Prompt (CP-004)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Files: dashboard/app.js, dashboard/index.html

TASK: Build sortable provider breakdown table for #panel-providers.

Endpoint: GET /v1/analytics/providers
Response: [{ provider: string, model: string, requests: number, tokens: number, cost: number, avg_latency: number, cache_hits: number }]

IMPLEMENTATION:
1. On panel activate: fetch endpoint → render table.
2. Table columns: Provider | Model | Requests | Tokens | Cost | Avg Latency | Cache Hits | Cost Bar
3. Cost bar column: <div class="bar-cell"><div class="bar-fill" style="width: X%"></div></div> where X = cost/maxCost*100.
4. Sort: track { col, dir } state. On th click: if same col toggle dir, else set col + dir='desc'. Re-render rows.
5. Arrow: th.dataset.sort === activeCol → append ↑ or ↓ to header text.
6. sortTable(data, col, dir): pure function, returns sorted copy.
7. Render rows with createElement (no innerHTML for row data).
8. Wrap table in div.table-scroll { overflow-x: auto }.

Empty state: if data.length === 0, show <p class="empty-state">No provider data yet</p>.
```

---

### CP-005 · Day 5 · Cache Analytics + Route Decisions Panel

**RD**
Build `#panel-cache` with cache hit trend (30-day bar chart from `GET /v1/analytics/cache`) and `#panel-routes` with routing decisions table from `GET /v1/analytics/routes`. Cache panel: bar chart + summary (total hits, total misses, hit rate). Routes panel: table of model selections with task type, provider, model, count, avg score.

**AC**
- [ ] Cache panel: bar chart renders 30 bars (one per day), hit vs miss stacked
- [ ] Cache panel: summary row shows total hits / total misses / hit rate %
- [ ] Routes panel: table renders with columns Task Type, Provider, Model, Count, Avg Score
- [ ] Routes panel: sortable by Count (default desc)
- [ ] Both panels handle empty/loading/error states

**CR**
- Stacked bar chart via Canvas 2D (reuse `chart.js` with a new `drawBarChart(canvas, data)` export)
- `drawBarChart` max 80 lines added to chart.js (total chart.js stays ≤ 200 lines)

**Test**
```
1. #cache panel → bar chart shows with two colors per bar (hit=green, miss=red)
2. Summary row values match sum of data array
3. #routes panel → table sorted by count desc on load
4. Both panels show skeleton on load, data after fetch
```

---

**Implementation Prompt (CP-005)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Files: dashboard/chart.js (add drawBarChart), dashboard/app.js

TASK: Build cache analytics panel + route decisions panel.

Cache endpoint: GET /v1/analytics/cache
Response: [{ date: string, hits: number, misses: number }]

Routes endpoint: GET /v1/analytics/routes  
Response: [{ task_type: string, provider: string, model: string, count: number, avg_score: number }]

IMPLEMENTATION:
1. drawBarChart(canvas, data, { hitColor, missColor }): stacked bar per day. X-axis: date every 7 days. Y-axis: count. Two segments per bar: hits (bottom, green #22c55e) and misses (top, red #ef4444).
2. Cache panel: render canvas + summary <div class="summary-row"> with 3 stats computed from data reduce.
3. Routes panel: table. Columns: Task Type | Provider | Model | Count | Avg Score. Default sort: count desc. Reuse sortTable() from CP-004.
4. Avg Score: format to 2 decimal places. Color-code: ≥0.9 green, ≥0.7 yellow, <0.7 red.

Both panels: skeleton → fetch → render → error handling same pattern as CP-002.
```

---

## WEEK 2 — Providers + Default Embedding

---

### CP-006 · Day 6 · AWS Bedrock Provider (SigV4)

**RD**
`gateway/src/providers/bedrock.ts` is a stub that throws. Implement real AWS Bedrock API calls using SigV4 request signing. Support models: `anthropic.claude-3-5-sonnet-20241022-v2:0`, `amazon.titan-text-express-v1`, `meta.llama3-70b-instruct-v1:0`. Input: OpenAI-format messages. Output: normalized OpenAI-format response.

**AC**
- [ ] `callBedrock(messages, model, config)` makes a real HTTP request to `https://bedrock-runtime.<region>.amazonaws.com/model/<modelId>/invoke`
- [ ] SigV4 signing implemented: canonical request → string to sign → HMAC-SHA256 signature → Authorization header
- [ ] Converts OpenAI messages array to Bedrock-native format per model family (Anthropic vs Titan vs Llama)
- [ ] Returns `{ content: string, usage: { prompt_tokens, completion_tokens } }` normalized shape
- [ ] Config requires: `{ accessKeyId, secretAccessKey, region, model }`
- [ ] Throws descriptive error if credentials missing or request fails

**CR**
- SigV4 implementation uses Web Crypto API (`crypto.subtle`) — no Node.js `crypto` module (Cloudflare Workers environment)
- `signRequest(method, url, headers, body, credentials)` — pure async function, returns signed headers object
- `normalizeBedrockResponse(raw, modelFamily)` — pure function
- No third-party AWS SDK — implement signing from scratch (Workers have no Node.js compat for aws4)
- Max 200 lines

**Test**
```bash
# In gateway unit test:
const result = await callBedrock(
  [{ role: 'user', content: 'Say hello' }],
  'anthropic.claude-3-5-sonnet-20241022-v2:0',
  { accessKeyId: process.env.AWS_KEY, secretAccessKey: process.env.AWS_SECRET, region: 'us-east-1' }
)
assert(result.content.length > 0)
assert(typeof result.usage.prompt_tokens === 'number')
```

**Resolution**: Real API call succeeds. SigV4 Authorization header passes AWS validation.

---

**Implementation Prompt (CP-006)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
File: gateway/src/providers/bedrock.ts (currently a stub — replace entirely)

Environment: Cloudflare Workers. Use Web Crypto API (crypto.subtle). No Node.js crypto. No aws4 npm package.

TASK: Implement AWS Bedrock provider with SigV4 signing.

SigV4 algorithm:
1. Create canonical request: METHOD\ncanonicalURI\ncanonicalQueryString\ncanonicalHeaders\nsignedHeaders\nhex(sha256(body))
2. Create string to sign: "AWS4-HMAC-SHA256\n" + isoDate + "\n" + credentialScope + "\n" + hex(sha256(canonicalRequest))
3. Derive signing key: HMAC(HMAC(HMAC(HMAC("AWS4"+secret, date), region), service), "aws4_request")
4. Signature: hex(HMAC(signingKey, stringToSign))
5. Authorization: "AWS4-HMAC-SHA256 Credential=KEY/SCOPE, SignedHeaders=HEADERS, Signature=SIG"

Helper: async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> using crypto.subtle.sign("HMAC", ...)
Helper: async function sha256hex(data: string): Promise<string>
Helper: function toHex(buffer: ArrayBuffer): string

Bedrock endpoint: https://bedrock-runtime.{region}.amazonaws.com/model/{modelId}/invoke
Method: POST
Content-Type: application/json

Request body by model family:
- anthropic.*: { anthropic_version: "bedrock-2023-05-31", max_tokens: 2048, messages: [...] }
- amazon.titan-*: { inputText: combinedMessages, textGenerationConfig: { maxTokenCount: 2048 } }
- meta.llama*: { prompt: combinedMessages, max_gen_len: 2048 }

Normalize response to: { content: string, usage: { prompt_tokens: number, completion_tokens: number } }

Export: export async function callBedrock(messages, model, config: { accessKeyId, secretAccessKey, region })
Max 200 lines. No external deps.
```

---

### CP-007 · Day 7 · Google Vertex AI Provider (OAuth)

**RD**
`gateway/src/providers/vertex.ts` is a stub requiring manual OAuth token. Implement proper service account JWT → access token exchange. Support `gemini-1.5-pro` and `gemini-1.5-flash` via Vertex AI endpoint. Accept `{ projectId, location, serviceAccountKey: { client_email, private_key } }` config.

**AC**
- [ ] `callVertex(messages, model, config)` exchanges service account credentials for access token via `https://oauth2.googleapis.com/token`
- [ ] JWT signed with RS256 using `crypto.subtle.sign` with PKCS8 private key
- [ ] Caches access token in memory for its lifetime (3600s) — no re-auth per request
- [ ] Calls `https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent`
- [ ] Returns normalized `{ content, usage }` shape

**CR**
- `signJwt(header, payload, privateKeyPem)` — async, returns JWT string using `crypto.subtle`
- Token cache: module-level `let tokenCache: { token: string, expiresAt: number } | null = null`
- PEM → PKCS8 import using `crypto.subtle.importKey('pkcs8', ...)`
- Max 200 lines

**Test**
```bash
const result = await callVertex(
  [{ role: 'user', content: 'Say hello' }],
  'gemini-1.5-flash',
  { projectId: 'my-project', location: 'us-central1', serviceAccountKey: JSON.parse(process.env.GCP_SA_KEY) }
)
assert(result.content.length > 0)
```

---

**Implementation Prompt (CP-007)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
File: gateway/src/providers/vertex.ts (replace stub)

Environment: Cloudflare Workers. crypto.subtle available. No Node.js.

TASK: Implement Google Vertex AI provider with service account JWT auth.

JWT signing (RS256):
1. header = { alg: "RS256", typ: "JWT" }
2. payload = { iss: client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", exp: now+3600, iat: now }
3. base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(payload)) → sign with crypto.subtle RS256 → append "." + base64url(signature)

PEM key import: strip "-----BEGIN PRIVATE KEY-----" headers, base64 decode to ArrayBuffer, crypto.subtle.importKey('pkcs8', keyBuffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])

Token exchange: POST https://oauth2.googleapis.com/token with { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }

Token cache: module-level variable. Check expiresAt - 60s before expiry.

Vertex endpoint: POST https://{location}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/google/models/{model}:generateContent

Request body: { contents: [{ role, parts: [{ text }] }], generationConfig: { maxOutputTokens: 2048 } }

Normalize response: candidates[0].content.parts[0].text → content. usageMetadata → usage.

Export: export async function callVertex(messages, model, config: { projectId, location, serviceAccountKey: { client_email, private_key } })
Max 200 lines.
```

---

### CP-008 · Day 8 · Default Embedding via Cloudflare Workers AI

**RD**
`sdk/src/semantic-cache.ts` accepts optional `embeddingFn`. When no function is provided, semantic cache silently disables. Instead, when deployed on the gateway side, use Cloudflare Workers AI binding (`env.AI.run('@cf/baai/bge-small-en-v1.5', { text })`) as the default embedding. Add a gateway-side semantic cache wrapper that uses this binding.

**AC**
- [ ] New file `gateway/src/semantic-cache-cf.ts` exports `makeCFEmbeddingFn(env)` returning `(text: string) => Promise<number[]>`
- [ ] `makeCFEmbeddingFn` calls `env.AI.run('@cf/baai/bge-small-en-v1.5', { text: [text] })` and returns `result.data[0]`
- [ ] Gateway request handler passes this to `SemanticCache` constructor
- [ ] SDK `SemanticCache` works unchanged — embedding injection is gateway-side only
- [ ] If `env.AI` is not bound (local dev), `makeCFEmbeddingFn` returns `null` and semantic cache falls back to disabled

**CR**
- `makeCFEmbeddingFn(env: { AI?: any }): ((text: string) => Promise<number[]>) | null` — returns null if no AI binding
- No changes to SDK `semantic-cache.ts`
- Add `[ai]` binding to `gateway/wrangler.toml` if not present
- Max 50 lines for new file

**Test**
```bash
# Local: env.AI undefined → makeCFEmbeddingFn returns null → SemanticCache disabled
# CF deployed: env.AI bound → embedding returns 384-dim float array → cosine similarity works
npx wrangler dev → POST /v1/chat with same prompt twice → second returns cached: true
```

---

**Implementation Prompt (CP-008)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Create: gateway/src/semantic-cache-cf.ts
Edit: gateway/src/index.ts (wire embedding fn), gateway/wrangler.toml (add AI binding)

TASK: Provide default embedding for SemanticCache using Cloudflare Workers AI.

gateway/src/semantic-cache-cf.ts:
export function makeCFEmbeddingFn(env: { AI?: any }): ((text: string) => Promise<number[]>) | null {
  if (!env.AI) return null
  return async (text: string) => {
    const result = await env.AI.run('@cf/baai/bge-small-en-v1.5', { text: [text] })
    return result.data[0] as number[]
  }
}

gateway/wrangler.toml — add:
[ai]
binding = "AI"

gateway/src/index.ts — in the fetch handler where SemanticCache is constructed:
import { makeCFEmbeddingFn } from './semantic-cache-cf'
import { SemanticCache } from '../../sdk/src/semantic-cache' // or from built SDK

const embeddingFn = makeCFEmbeddingFn(env)
const semanticCache = new SemanticCache({ embeddingFn: embeddingFn ?? undefined })

RULES: No changes to sdk/src/semantic-cache.ts. Max 50 lines in new file.
```

---

### CP-009 · Day 9 · Provider Integration Tests

**RD**
Add integration tests for Bedrock, Vertex, and the semantic cache embedding flow. Tests should be skipped automatically if required env vars are absent (no CI failures on missing credentials). Each test makes a real API call and asserts on response shape.

**AC**
- [ ] `gateway/tests/bedrock.integration.test.ts` — skips if `AWS_ACCESS_KEY_ID` not set; calls `callBedrock` with real creds; asserts `content` is non-empty string and `usage.prompt_tokens > 0`
- [ ] `gateway/tests/vertex.integration.test.ts` — skips if `GCP_SA_KEY` not set; calls `callVertex`; same assertions
- [ ] `gateway/tests/semantic-cache-cf.integration.test.ts` — mocks `env.AI` with a stub that returns a fixed 384-dim vector; asserts cache hit on second identical prompt
- [ ] All three tests are in the `integration` vitest config (not run on standard `npm test`)

**CR**
- Skip pattern: `if (!process.env.AWS_ACCESS_KEY_ID) { test.skip(...) }`
- Separate vitest config: `gateway/vitest.integration.config.ts` with `testMatch: ['**/*.integration.test.ts']`
- No mocking of SigV4 or JWT — real signing must work in integration tests

**Test**
```bash
cd gateway
AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=yyy AWS_REGION=us-east-1 \
  npx vitest run --config vitest.integration.config.ts
```

---

**Implementation Prompt (CP-009)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe

TASK: Create integration tests for Bedrock, Vertex, and CF semantic cache embedding.

Create: gateway/vitest.integration.config.ts
Content:
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['tests/**/*.integration.test.ts'], testTimeout: 30000 } })

Create: gateway/tests/bedrock.integration.test.ts
- import { callBedrock } from '../src/providers/bedrock'
- describe('Bedrock integration'): beforeAll check env vars → skip if missing
- test: calls callBedrock with 'anthropic.claude-3-5-sonnet-20241022-v2:0', asserts content string, usage shape

Create: gateway/tests/vertex.integration.test.ts  
- import { callVertex } from '../src/providers/vertex'
- Same pattern, reads GCP_SA_KEY from env (JSON.parse)

Create: gateway/tests/semantic-cache-cf.integration.test.ts
- import { makeCFEmbeddingFn } from '../src/semantic-cache-cf'
- import { SemanticCache } from '../../sdk/src/semantic-cache'
- Mock env.AI: { run: async () => ({ data: [Array.from({length:384}, () => Math.random())] }) }
- Same vector returned for both calls → cosine similarity ≥ 0.999 → cache hit on second call

RULES: Real calls for Bedrock/Vertex. Mock only for CF test. Skip pattern on missing env vars.
```

---

### CP-010 · Day 10 · Semantic Cache Zero-Config Flow

**RD**
End-to-end test and documentation for semantic cache running zero-config via the gateway. A request through `POST /v1/chat` with an identical prompt should return `cached: true` on the second call when the gateway has `env.AI` bound. Write a test using `wrangler dev` local simulation and document the zero-config setup in a `docs/semantic-cache.md`.

**AC**
- [ ] `POST /v1/chat` with prompt A → response with `cached: false`
- [ ] `POST /v1/chat` with same prompt A → response with `cached: true`, no upstream call made
- [ ] `POST /v1/chat` with semantically similar prompt B ("Hey there" vs "Hello") → response with `cached: true` (similarity ≥ 0.92)
- [ ] Cold start (no cached entries) → no error, falls through to provider

**CR**
- Gateway must set `cached: true` in response JSON when serving from semantic cache
- Upstream provider call must NOT be made on cache hit (verify via mock)
- Similarity threshold configurable via env var `SEMANTIC_CACHE_THRESHOLD` (default 0.92)

**Test**
```bash
cd gateway && npx wrangler dev &
curl -X POST http://localhost:8787/v1/chat \
  -H "Authorization: Bearer test-key" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is 2+2?"}]}'
# Second identical request → cached: true in response
```

---

**Implementation Prompt (CP-010)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Files: gateway/src/index.ts, gateway/src/routes.ts

TASK: Wire semantic cache into the /v1/chat request path so it returns cached:true on hits.

In the chat handler:
1. After auth validation, before routing:
   const cacheKey = await computeHash(JSON.stringify(messages)) // reuse existing hash fn
   const semanticHit = await semanticCache.get(messages[messages.length-1].content)
   if (semanticHit) return Response.json({ ...semanticHit, cached: true })

2. After provider response:
   await semanticCache.set(messages[messages.length-1].content, providerResponse)
   return Response.json({ ...providerResponse, cached: false })

3. Read threshold from env: const threshold = parseFloat(env.SEMANTIC_CACHE_THRESHOLD ?? '0.92')
   Pass to SemanticCache constructor: { similarityThreshold: threshold, embeddingFn }

Add to gateway/wrangler.toml under [vars]:
SEMANTIC_CACHE_THRESHOLD = "0.92"

Write gateway/tests/semantic-cache-flow.test.ts:
- Mock env.AI to return consistent embeddings
- First request → cached: false
- Same request → cached: true  
- Verify fetch (upstream) called only once

RULES: Hash cache first, semantic cache second. No upstream call on any cache hit.
```

---

## WEEK 3 — Global Learning

---

### CP-011 · Day 11 · SDK Router → Gateway Weight Sync (Push)

**RD**
The SDK `Router.learn()` currently saves weights to a local `.clawpipe/weights.json` file. The gateway has `PUT /v1/weights` and a `weight_history` D1 table. Wire the SDK to push weight updates to the gateway after each `learn()` call when a `gatewayUrl` and `apiKey` are configured.

**AC**
- [ ] `RouterConfig` accepts optional `{ gatewayUrl: string, apiKey: string }` fields
- [ ] When both set: after every `learn()` call, fire async `pushWeights()` — does NOT block the response
- [ ] `pushWeights()` calls `PUT /v1/weights` with current weight data
- [ ] If push fails (network error, 4xx, 5xx), silently logs to console.warn — never throws
- [ ] If `gatewayUrl` not set: behavior unchanged (local file only)

**CR**
- `pushWeights()` must be fire-and-forget: `this.pushWeights().catch(() => {})` — never awaited in `learn()`
- Request timeout: 5000ms via `AbortController`
- Weight payload: `{ weights: Record<string, { avgLatency: number, avgTokensOut: number, score: number, totalCalls: number }> }`
- Changes only to `sdk/src/router.ts` and `sdk/src/weight-store.ts`

**Test**
```typescript
const router = new Router({ gatewayUrl: 'https://api.clawpipe.ai', apiKey: 'test' })
await router.learn('gpt-4o', 'openai', 320, 500)
// Gateway PUT /v1/weights was called (mock fetch to verify)
// learn() returned without waiting for push
```

---

**Implementation Prompt (CP-011)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Files: sdk/src/router.ts, sdk/src/weight-store.ts

TASK: Add fire-and-forget weight push to gateway after Router.learn().

1. Add to RouterConfig interface: gatewayUrl?: string; apiKey?: string

2. In Router class, add private method:
private pushWeights(): Promise<void> {
  if (!this.config.gatewayUrl || !this.config.apiKey) return Promise.resolve()
  const controller = new AbortController()
  setTimeout(() => controller.abort(), 5000)
  return fetch(`${this.config.gatewayUrl}/v1/weights`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ weights: this.weightStore.getAll() }),
    signal: controller.signal
  }).then(r => { if (!r.ok) console.warn(`ClawPipe: weight sync failed ${r.status}`) })
    .catch(e => console.warn('ClawPipe: weight sync error', e.message))
}

3. At end of learn() method: this.pushWeights().catch(() => {})

4. Add to WeightStore: getAll(): Record<string, WeightEntry> { return { ...this.weights } }

RULES: Never await pushWeights in learn(). Never throw from pushWeights. 5s timeout via AbortController.
```

---

### CP-012 · Day 12 · SDK Router Weight Fetch on Init

**RD**
When `gatewayUrl` and `apiKey` are set in `RouterConfig`, fetch existing weights from `GET /v1/weights` on first `route()` call (lazy init). Merge remote weights with local file weights — remote scores win for models with more calls, local wins for models with no remote record.

**AC**
- [ ] First `route()` call triggers weight fetch if `gatewayUrl` configured and not yet fetched
- [ ] Fetch is awaited before routing decision (blocking for first call only)
- [ ] Merge logic: for each model, if remote `totalCalls > local.totalCalls`, use remote; else keep local
- [ ] On fetch failure: use local weights, log `console.warn`
- [ ] Subsequent `route()` calls skip fetch (one-time init)

**CR**
- `private weightsLoaded = false` flag
- Fetch with 5s timeout same as push
- `mergeWeights(local, remote)` — pure function, returns merged record

**Test**
```typescript
// Mock GET /v1/weights to return { weights: { 'gpt-4o:openai': { totalCalls: 100, score: 0.9 } } }
const router = new Router({ gatewayUrl: '...', apiKey: '...' })
const result = await router.route(messages) // triggers fetch
// result should prefer gpt-4o if remote score is highest
```

---

**Implementation Prompt (CP-012)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
File: sdk/src/router.ts

TASK: Lazy-fetch remote weights on first route() call.

1. Add private weightsLoaded = false to Router class.

2. Add private async loadRemoteWeights(): Promise<void>:
   - if (!this.config.gatewayUrl || this.weightsLoaded) return
   - this.weightsLoaded = true (set before fetch to prevent double-fetch)
   - fetch GET /v1/weights with 5s timeout
   - on success: parse { weights }, call this.weightStore.merge(remoteWeights)
   - on failure: console.warn only

3. Add to WeightStore: merge(remote: Record<string, WeightEntry>): void
   For each key in remote: if remote[key].totalCalls > (local[key]?.totalCalls ?? 0), use remote.

4. In route() method, first line: await this.loadRemoteWeights()

Pure function: function mergeWeights(local, remote): Record<string, WeightEntry>
- For each key in union of keys: pick entry with higher totalCalls.

RULES: One-time init only. Never block subsequent route() calls. 5s timeout same pattern as CP-011.
```

---

### CP-013 · Day 13 · Weight Merge Strategy + Conflict Resolution

**RD**
The current merge in CP-012 is winner-takes-all by `totalCalls`. Add a weighted average merge: new score = (local.score * local.totalCalls + remote.score * remote.totalCalls) / (local.totalCalls + remote.totalCalls). This gives accurate global scores when both local and remote have meaningful data.

**AC**
- [ ] `mergeWeights` uses weighted average when both sides have `totalCalls > 0`
- [ ] If one side has 0 calls, other side wins entirely
- [ ] `totalCalls` in merged entry = local.totalCalls + remote.totalCalls
- [ ] `avgLatency` merged the same way (weighted average)
- [ ] Unit tests cover: local-only, remote-only, both, remote-heavier, local-heavier scenarios

**CR**
- `mergeWeights` is a pure exported function in `sdk/src/weight-store.ts`
- Unit test file: `sdk/tests/weight-store.test.ts` (add cases, do not replace existing)

**Test**
```typescript
// local: { score: 0.7, totalCalls: 10 }, remote: { score: 0.9, totalCalls: 90 }
// merged: { score: (0.7*10 + 0.9*90) / 100 = 0.88, totalCalls: 100 }
const merged = mergeWeights(local, remote)
expect(merged['gpt-4o:openai'].score).toBeCloseTo(0.88)
expect(merged['gpt-4o:openai'].totalCalls).toBe(100)
```

---

**Implementation Prompt (CP-013)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
File: sdk/src/weight-store.ts, sdk/tests/weight-store.test.ts

TASK: Implement weighted average merge strategy for router weights.

In weight-store.ts, replace or update mergeWeights:
export function mergeWeights(
  local: Record<string, WeightEntry>,
  remote: Record<string, WeightEntry>
): Record<string, WeightEntry> {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)])
  const result: Record<string, WeightEntry> = {}
  for (const key of keys) {
    const l = local[key]
    const r = remote[key]
    if (!l) { result[key] = r; continue }
    if (!r) { result[key] = l; continue }
    const total = l.totalCalls + r.totalCalls
    result[key] = {
      score: (l.score * l.totalCalls + r.score * r.totalCalls) / total,
      avgLatency: (l.avgLatency * l.totalCalls + r.avgLatency * r.totalCalls) / total,
      avgTokensOut: (l.avgTokensOut * l.totalCalls + r.avgTokensOut * r.totalCalls) / total,
      totalCalls: total
    }
  }
  return result
}

Add tests in sdk/tests/weight-store.test.ts:
- test('local only'): remote empty → result = local
- test('remote only'): local empty → result = remote  
- test('weighted average'): local {score:0.7, calls:10} + remote {score:0.9, calls:90} → score ≈ 0.88, calls=100
- test('equal weight'): both calls=50, score=0.6 and 0.8 → score=0.7
```

---

### CP-014 · Day 14 · Global Learning Opt-In Config + Docs

**RD**
Add a `globalLearning: boolean` flag to `RouterConfig`. When `true` AND `gatewayUrl` set, push and fetch weights. When `false` (default), disable all remote weight sync even if credentials are present. Document the feature in `docs/global-learning.md`.

**AC**
- [ ] `globalLearning: false` (default) → no network calls from router, ever
- [ ] `globalLearning: true` + `gatewayUrl` set → push + fetch active (CP-011, CP-012 behavior)
- [ ] `globalLearning: true` without `gatewayUrl` → no-op, no error
- [ ] `RouterConfig` TypeScript type updated with `globalLearning?: boolean`

**CR**
- Single `if (!this.config.globalLearning) return` guard at top of `loadRemoteWeights()` and `pushWeights()`
- Default must be `false` — opt-in, not opt-out (privacy requirement)

---

**Implementation Prompt (CP-014)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
File: sdk/src/router.ts

TASK: Add globalLearning opt-in flag. Default false.

1. Add to RouterConfig: globalLearning?: boolean  (default false)

2. In pushWeights(): first line add:
   if (!this.config.globalLearning) return Promise.resolve()

3. In loadRemoteWeights(): first line add:
   if (!this.config.globalLearning || !this.config.gatewayUrl) return

4. Update JSDoc on RouterConfig.globalLearning:
   // When true, router syncs learned weights with the ClawPipe gateway for cross-instance learning.
   // Default false (opt-in). Requires gatewayUrl and apiKey.

RULES: Default MUST be false. No network calls when false. No error when true but no gatewayUrl.
```

---

### CP-015 · Day 15 · Global Learning Integration Tests

**RD**
Integration tests proving the full push → fetch → merge → route cycle works end-to-end using a real gateway connection or a local gateway mock.

**AC**
- [ ] Test 1: Router A learns model X has high score → pushes to gateway → Router B fetches → Router B routes to model X
- [ ] Test 2: Router push fails (gateway down) → Router still routes using local weights
- [ ] Test 3: globalLearning=false → no HTTP calls made
- [ ] All tests use mock fetch or local wrangler dev (not real prod gateway)

---

**Implementation Prompt (CP-015)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Create: sdk/tests/global-learning.integration.test.ts

TASK: Test the full global learning cycle.

Use vi.stubGlobal('fetch', mockFetch) to intercept network calls.

Test 1 — push then fetch:
- Create routerA with globalLearning:true, gatewayUrl:'http://mock'
- Call routerA.learn('gpt-4o', 'openai', 100, 500) → verify mockFetch called with PUT /v1/weights
- Create routerB with same config, stub GET /v1/weights to return routerA weights
- Call routerB.route([{ role:'user', content:'...' }]) → verify routerB uses remote weights

Test 2 — push failure fallback:
- Stub fetch to throw network error
- Call learn() → no throw, only console.warn

Test 3 — globalLearning false:
- Create router with globalLearning:false, gatewayUrl:'http://mock'
- Call learn() and route() → verify mockFetch never called

Restore vi.restoreAllMocks() in afterEach.
```

---

## WEEK 4 — Quality Scoring

---

### CP-016 · Day 16 · LLM-as-Judge Scorer Module

**RD**
Build `sdk/src/scorer.ts`. Given a prompt and a response, call a small fast LLM (default: `gpt-4o-mini`) with a structured scoring prompt. Return a score 0.0–1.0 representing response quality. This score will be fed into the router learner.

**AC**
- [ ] `scoreResponse(prompt, response, config)` returns `Promise<number>` between 0 and 1
- [ ] Uses a meta-prompt that asks the judge LLM to rate on: relevance, completeness, accuracy (equal weight)
- [ ] Parses the judge response as JSON `{ score: number }` — if parse fails, returns 0.5 (safe default)
- [ ] Config: `{ apiKey: string, model?: string, provider?: string }` — defaults to openai gpt-4o-mini
- [ ] Timeout: 10s — if judge times out, return 0.5

**CR**
- Judge prompt: `You are a response quality judge. Rate this response 0.0 to 1.0. Respond ONLY with JSON: {"score": <number>}. Prompt: <prompt>. Response: <response>.`
- `parseScore(text: string): number` — pure function, try JSON.parse → extract score → clamp to [0,1] → fallback 0.5
- Max 100 lines

**Test**
```typescript
// Mock: judge returns '{"score": 0.85}'
const score = await scoreResponse('What is 2+2?', '4', { apiKey: 'mock' })
expect(score).toBe(0.85)

// Mock: judge returns garbage
const score2 = await scoreResponse('...', '...', { apiKey: 'mock' })
expect(score2).toBe(0.5)
```

---

**Implementation Prompt (CP-016)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Create: sdk/src/scorer.ts (max 100 lines)

TASK: LLM-as-judge quality scorer.

export interface ScorerConfig {
  apiKey: string
  model?: string      // default: 'gpt-4o-mini'
  baseUrl?: string    // default: 'https://api.openai.com/v1'
}

const JUDGE_PROMPT = (prompt: string, response: string) => `You are a response quality judge.
Rate how well the response answers the prompt on a scale 0.0 to 1.0.
Consider: relevance, completeness, and accuracy equally.
Respond ONLY with valid JSON: {"score": <number between 0 and 1>}

Prompt: ${prompt}
Response: ${response}`

export async function scoreResponse(prompt: string, response: string, config: ScorerConfig): Promise<number> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`${config.baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model ?? 'gpt-4o-mini', messages: [{ role: 'user', content: JUDGE_PROMPT(prompt, response) }], max_tokens: 50 }),
      signal: controller.signal
    })
    const data = await res.json()
    return parseScore(data.choices?.[0]?.message?.content ?? '')
  } catch { return 0.5 } finally { clearTimeout(timeout) }
}

function parseScore(text: string): number {
  try { const parsed = JSON.parse(text); const s = Number(parsed.score); return isNaN(s) ? 0.5 : Math.min(1, Math.max(0, s)) }
  catch { return 0.5 }
}

Tests in sdk/tests/scorer.test.ts: mock fetch, verify parsing, verify timeout fallback.
```

---

### CP-017 · Day 17 · Sampling Logic (10% Quality Scoring)

**RD**
Integrate the scorer into the pipeline. After each provider response, score 1 in 10 responses. Pass the quality score to `Router.learn()`. Do not block the response return — scoring is async background work.

**AC**
- [ ] `Router.learn()` accepts optional `qualityScore?: number` parameter
- [ ] When qualityScore provided, scoring weight in `computeScore` is: latency 40% + efficiency 30% + quality 30%
- [ ] Sampling: `Math.random() < 0.1` — only 10% of responses trigger scoring
- [ ] Scoring is fire-and-forget: `.catch(() => {})`, does not block response
- [ ] Sampling rate configurable via `RouterConfig.scoringSampleRate` (default 0.1)

**CR**
- `computeScore(latencyMs, tokensOut, qualityScore?)` — updated signature, quality optional
- If qualityScore undefined: fallback to old weights (latency 50%, efficiency 50%)

**Test**
```typescript
// With quality score:
router.learn('gpt-4o', 'openai', 200, 400, 0.95)
// computeScore: latency=0.96, efficiency=0.4, quality=0.95
// score = 0.96*0.4 + 0.4*0.3 + 0.95*0.3 = 0.384 + 0.12 + 0.285 = 0.789

// Without quality score (old behavior):
router.learn('gpt-4o', 'openai', 200, 400)
// score = latency*0.5 + efficiency*0.5
```

---

**Implementation Prompt (CP-017)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Files: sdk/src/router.ts, sdk/src/pipeline.ts (or wherever provider call happens)

TASK: Integrate scorer into pipeline at 10% sample rate.

1. Update Router.learn signature:
   async learn(model: string, provider: string, latencyMs: number, tokensOut: number, qualityScore?: number): Promise<void>

2. Update computeScore:
   private computeScore(latencyMs: number, tokensOut: number, qualityScore?: number): number {
     const latencyScore = 1 - Math.min(latencyMs / 5000, 1)
     const efficiencyScore = Math.min(tokensOut / 1000, 1)
     if (qualityScore !== undefined) {
       return latencyScore * 0.4 + efficiencyScore * 0.3 + qualityScore * 0.3
     }
     return latencyScore * 0.5 + efficiencyScore * 0.5
   }

3. Add to RouterConfig: scoringSampleRate?: number // default 0.1

4. In the post-response pipeline step (after provider returns):
   if (this.config.scorer && Math.random() < (this.config.scoringSampleRate ?? 0.1)) {
     scoreResponse(lastUserMessage, responseContent, this.config.scorer)
       .then(q => this.learn(model, provider, latencyMs, tokensOut, q))
       .catch(() => {})
   } else {
     this.learn(model, provider, latencyMs, tokensOut)
   }

RULES: Never await scorer in response path. scoringSampleRate 0-1 range only.
```

---

### CP-018 · Day 18 · Quality Score D1 Storage

**RD**
Add a `quality_scores` table to the gateway D1 schema. After the gateway receives a quality score via a new `POST /v1/quality` endpoint, store it with request_id, model, provider, score, and timestamp. The gateway itself does not run the scorer — the SDK pushes scores back.

**AC**
- [ ] `gateway/schema.sql` has `quality_scores` table: `(id, request_id, project_id, model, provider, score, created_at)`
- [ ] `POST /v1/quality` endpoint accepts `{ request_id, model, provider, score }`, validates score ∈ [0,1], stores in D1
- [ ] `GET /v1/analytics/quality` returns `[{ date, avg_score, model, provider }]` grouped by day + model
- [ ] Both endpoints require valid `Authorization: Bearer` header

**CR**
- Zod validation: `z.object({ request_id: z.string(), model: z.string(), provider: z.string(), score: z.number().min(0).max(1) })`
- SQL: parameterized queries only (no string interpolation)
- New file: `gateway/src/quality.ts` (max 80 lines)

---

**Implementation Prompt (CP-018)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Edit: gateway/schema.sql, gateway/src/routes.ts
Create: gateway/src/quality.ts (max 80 lines)

TASK: Add quality score storage to gateway.

gateway/schema.sql — add table:
CREATE TABLE IF NOT EXISTS quality_scores (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  request_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  score REAL NOT NULL CHECK(score >= 0 AND score <= 1),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_quality_project ON quality_scores(project_id, created_at);

gateway/src/quality.ts:
import { z } from 'zod'

const QualitySchema = z.object({ request_id: z.string(), model: z.string(), provider: z.string(), score: z.number().min(0).max(1) })

export async function handlePostQuality(req: Request, env: Env, projectId: string): Promise<Response> {
  const body = QualitySchema.safeParse(await req.json())
  if (!body.success) return Response.json({ error: 'Invalid payload' }, { status: 400 })
  const { request_id, model, provider, score } = body.data
  await env.DB.prepare('INSERT INTO quality_scores (request_id, project_id, model, provider, score) VALUES (?,?,?,?,?)')
    .bind(request_id, projectId, model, provider, score).run()
  return Response.json({ ok: true })
}

export async function handleGetQualityTrend(req: Request, env: Env, projectId: string): Promise<Response> {
  const rows = await env.DB.prepare(
    'SELECT date(created_at) as date, model, provider, AVG(score) as avg_score FROM quality_scores WHERE project_id=? GROUP BY date(created_at), model, provider ORDER BY date DESC LIMIT 30'
  ).bind(projectId).all()
  return Response.json(rows.results)
}

Register routes in gateway/src/routes.ts:
POST /v1/quality → handlePostQuality
GET /v1/analytics/quality → handleGetQualityTrend
```

---

### CP-019 · Day 19 · SDK Quality Score Push

**RD**
After scoring (CP-017), the SDK should push the quality score to the gateway via `POST /v1/quality`. Wire this into the existing fire-and-forget scoring path.

**AC**
- [ ] After `scoreResponse()` resolves, SDK calls `POST /v1/quality` with request_id, model, provider, score
- [ ] `request_id` is the ID returned by the gateway in the original chat response (add `request_id` field to gateway response)
- [ ] Push is fire-and-forget, same 5s timeout pattern as weight sync
- [ ] No push if `gatewayUrl` not configured

---

**Implementation Prompt (CP-019)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Files: sdk/src/router.ts, gateway/src/index.ts

TASK: Push quality scores back to gateway from SDK.

1. Gateway: add request_id to every chat response:
   const requestId = crypto.randomUUID()
   return Response.json({ ...providerResponse, cached: false, request_id: requestId })

2. SDK pipeline: capture request_id from response.

3. In the scorer fire-and-forget chain:
   scoreResponse(prompt, content, config)
     .then(score => {
       this.learn(model, provider, latencyMs, tokensOut, score)
       if (this.config.gatewayUrl && this.config.apiKey) {
         return pushQualityScore(this.config.gatewayUrl, this.config.apiKey, { request_id: requestId, model, provider, score })
       }
     }).catch(() => {})

4. Add function pushQualityScore(gatewayUrl, apiKey, payload): Promise<void>
   - POST /v1/quality with 5s timeout
   - Silently catch all errors

RULES: Fire-and-forget. Never throw. 5s AbortController timeout.
```

---

### CP-020 · Day 20 · Quality Trend Dashboard Panel

**RD**
Add a Quality tab to the dashboard. Fetch `GET /v1/analytics/quality`. Show a line chart of avg quality score per day per model. Add a summary table: model | provider | avg score | trend (↑↓→ vs previous week).

**AC**
- [ ] New sidebar link "Quality" → `#panel-quality`
- [ ] Line chart: one line per model, 30 days, Y-axis 0–1
- [ ] Summary table: model, provider, avg score (last 7 days), trend indicator
- [ ] Trend: if avg(last 7d) > avg(prior 7d) + 0.02 → ↑ green; < -0.02 → ↓ red; else → → grey

---

**Implementation Prompt (CP-020)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Files: dashboard/index.html, dashboard/app.js, dashboard/chart.js

TASK: Add Quality panel to dashboard.

1. Add sidebar link: <a href="#quality">Quality</a>. Add #panel-quality div.

2. On #quality activate: fetch GET /v1/analytics/quality
   Response: [{ date, model, provider, avg_score }]

3. Group data by model → array of { model, points: [{date, avg_score}] }

4. Use drawLineChart from chart.js with multiple series:
   - Extend drawLineChart to accept data: Array<{ label: string, points: {x,y}[], color: string }>
   - Assign a color per model from a palette: ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4']

5. Summary table below chart:
   - For each model: avg_score (last 7 days), avg_score (prior 7 days)
   - Trend: diff > 0.02 → ↑ (#22c55e), diff < -0.02 → ↓ (#ef4444), else → → (#9ca3af)

RULES: Reuse existing drawLineChart. Extend it to support multi-series with a data parameter. Keep chart.js ≤ 200 lines total.
```

---

## WEEK 5 — Prompt Versioning

---

### CP-021 · Day 21 · Prompts D1 Schema + Migration

**RD**
The gateway routes `GET /v1/prompts`, `POST /v1/prompts`, `POST /v1/prompts/{id}/render` already exist but the `prompts` table is missing from `schema.sql`. Add it. Add prompt versioning: each prompt name can have multiple versions. Add `prompt_versions` table.

**AC**
- [ ] `schema.sql` has `prompts` table: `(id, project_id, name, description, created_at)`
- [ ] `schema.sql` has `prompt_versions` table: `(id, prompt_id, version, content, variables JSON, created_at)`
- [ ] `version` is an integer auto-incremented per prompt (not global)
- [ ] `variables` stores a JSON array of variable names extracted from content (e.g., `["name", "context"]` from `Hello {{name}}`)
- [ ] Migration script `gateway/migrations/002_prompts.sql` contains the CREATE statements

**CR**
- All columns NOT NULL where semantically required
- Indexes on `project_id`, `prompt_id`
- `version` uniqueness: `UNIQUE(prompt_id, version)`

---

**Implementation Prompt (CP-021)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Edit: gateway/schema.sql
Create: gateway/migrations/002_prompts.sql

TASK: Add prompts and prompt_versions tables.

gateway/schema.sql — append:
CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE(project_id, name)
);
CREATE INDEX IF NOT EXISTS idx_prompts_project ON prompts(project_id);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  prompt_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  variables TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (prompt_id) REFERENCES prompts(id),
  UNIQUE(prompt_id, version)
);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt ON prompt_versions(prompt_id);

Copy same SQL into gateway/migrations/002_prompts.sql for explicit migration tracking.
```

---

### CP-022 · Day 22 · Prompt CRUD Gateway Endpoints

**RD**
Implement the existing stub routes: `GET /v1/prompts`, `POST /v1/prompts`, `GET /v1/prompts/{id}`, `POST /v1/prompts/{id}/versions`, `POST /v1/prompts/{id}/render`. Render substitutes `{{variable}}` placeholders with provided values.

**AC**
- [ ] `POST /v1/prompts` creates a prompt + first version (content required)
- [ ] `GET /v1/prompts` returns all prompts for project with latest version number
- [ ] `POST /v1/prompts/{id}/versions` creates a new version (auto-increments version number)
- [ ] `POST /v1/prompts/{id}/render` accepts `{ version?: number, variables: Record<string,string> }`, renders content, returns `{ rendered: string }`
- [ ] Render: replaces `{{key}}` patterns with values; unknown keys left as-is

**CR**
- New file `gateway/src/prompts.ts` max 150 lines
- `renderTemplate(content, variables)` — pure function, regex replace `{{(\w+)}}` globally
- Zod validation on all inputs

---

**Implementation Prompt (CP-022)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Create: gateway/src/prompts.ts (max 150 lines)
Edit: gateway/src/routes.ts

TASK: Implement prompt CRUD and render endpoints.

gateway/src/prompts.ts:

export function renderTemplate(content: string, variables: Record<string,string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`)
}

function extractVariables(content: string): string[] {
  return [...new Set([...content.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))]
}

POST /v1/prompts — body: { name, description?, content }
  1. INSERT into prompts
  2. INSERT into prompt_versions with version=1, variables=JSON(extractVariables(content))
  3. Return { id, name, version: 1 }

GET /v1/prompts
  SELECT p.id, p.name, p.description, MAX(pv.version) as latest_version, p.created_at
  FROM prompts p LEFT JOIN prompt_versions pv ON pv.prompt_id = p.id
  WHERE p.project_id=? GROUP BY p.id ORDER BY p.created_at DESC

POST /v1/prompts/:id/versions — body: { content }
  1. SELECT MAX(version) FROM prompt_versions WHERE prompt_id=?
  2. INSERT new version = max + 1
  3. Return { prompt_id, version }

POST /v1/prompts/:id/render — body: { version?, variables }
  1. SELECT content FROM prompt_versions WHERE prompt_id=? AND version=COALESCE(?,MAX(version))
  2. renderTemplate(content, variables)
  3. Return { rendered }

All inputs validated with Zod. All SQL parameterized.
```

---

### CP-023 · Day 23 · SDK promptVersion() Method

**RD**
Add `ClawPipe.promptVersion(name, variables, options?)` method to the SDK. Fetches the specified (or latest) prompt version from the gateway, renders it, and returns the rendered string. Cache the prompt content locally in memory for TTL seconds.

**AC**
- [ ] `pipeline.promptVersion('greeting', { name: 'Alice' })` → returns rendered string
- [ ] `options.version` pin to specific version; default = latest
- [ ] `options.ttl` cache duration in seconds (default 300)
- [ ] In-memory cache: `Map<string, { rendered: string, expiresAt: number }>`
- [ ] Requires `gatewayUrl` + `apiKey` in pipeline config; throws if not set

**CR**
- New method in `sdk/src/pipeline.ts` (or main class)
- Cache key: `${name}:${version ?? 'latest'}:${JSON.stringify(variables)}`
- Max 50 lines added

---

**Implementation Prompt (CP-023)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
File: sdk/src/pipeline.ts (or main ClawPipe class file)

TASK: Add promptVersion() method to SDK.

private promptCache = new Map<string, { rendered: string, expiresAt: number }>()

async promptVersion(
  name: string,
  variables: Record<string,string> = {},
  options: { version?: number, ttl?: number } = {}
): Promise<string> {
  if (!this.config.gatewayUrl || !this.config.apiKey) throw new Error('ClawPipe: gatewayUrl and apiKey required for promptVersion()')
  const ttl = options.ttl ?? 300
  const cacheKey = `${name}:${options.version ?? 'latest'}:${JSON.stringify(variables)}`
  const cached = this.promptCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.rendered

  // Find prompt ID
  const listRes = await fetch(`${this.config.gatewayUrl}/v1/prompts`, { headers: { Authorization: `Bearer ${this.config.apiKey}` } })
  const prompts = await listRes.json() as Array<{ id: string, name: string }>
  const prompt = prompts.find(p => p.name === name)
  if (!prompt) throw new Error(`ClawPipe: prompt "${name}" not found`)

  const renderRes = await fetch(`${this.config.gatewayUrl}/v1/prompts/${prompt.id}/render`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: options.version, variables })
  })
  const { rendered } = await renderRes.json() as { rendered: string }
  this.promptCache.set(cacheKey, { rendered, expiresAt: Date.now() + ttl * 1000 })
  return rendered
}
```

---

### CP-024 · Day 24 · Dashboard Prompts Tab

**RD**
Build `#panel-prompts` dashboard panel. List all prompts with name, description, latest version, created date. Click a prompt → expand to show version history. "New Prompt" button opens a modal form (name, description, content with `{{variable}}` highlighting). "New Version" button on expanded prompt opens modal with content field.

**AC**
- [ ] Prompt list renders on panel activate
- [ ] Click row → expand showing version history (version number + created date)
- [ ] "New Prompt" modal: name + description + content textarea, submit calls POST /v1/prompts
- [ ] "New Version" modal: content textarea pre-filled with latest content
- [ ] After create: list refreshes
- [ ] `{{variable}}` in content textarea highlighted in yellow (CSS only, no rich editor)

**CR**
- Modal: `<dialog>` element (native HTML dialog API, not `display:none` div)
- No innerHTML for user-entered content (use textContent)
- Highlight: readonly `<pre>` overlay trick or `contenteditable` + CSS — whichever avoids XSS

---

**Implementation Prompt (CP-024)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Files: dashboard/index.html, dashboard/app.js

TASK: Build prompts management panel.

1. Add #panel-prompts with:
   - "New Prompt" button (top right)
   - Prompt list: each row = name | description | v{latest_version} | created_at | "New Version" button
   - Click row (not button): toggle .expanded class → show nested version list

2. Fetch on activate: GET /v1/prompts → render list with createElement.

3. "New Prompt" button → open <dialog id="dialog-new-prompt">
   Fields: name (text), description (text), content (textarea)
   Submit → POST /v1/prompts → close dialog → refresh list

4. "New Version" button → open <dialog id="dialog-new-version">
   Fields: content (textarea, pre-filled with latest version content via GET prompt then fetch version)
   Submit → POST /v1/prompts/{id}/versions → close → refresh

5. {{variable}} highlight: in content preview (not textarea), show rendered <span class="var-highlight">{{name}}</span>
   CSS: .var-highlight { background: #fef9c3; color: #92400e; border-radius: 3px; padding: 0 2px }
   Use textContent to set text, then regex-replace to build safe DOM nodes (createElement span).

RULES: Use <dialog> native API (.showModal()/.close()). No innerHTML for user data.
```

---

### CP-025 · Day 25 · Prompt Versioning Tests

**RD**
Full unit and integration test coverage for prompt CRUD endpoints and SDK `promptVersion()`.

**AC**
- [ ] `gateway/tests/prompts.test.ts`: CRUD tests with D1 mock — create, list, new version, render
- [ ] `renderTemplate` pure function: 10 cases (happy path, missing var, nested, empty vars, special chars)
- [ ] `sdk/tests/prompt-version.test.ts`: mock gateway fetch, verify caching behavior (TTL)

---

**Implementation Prompt (CP-025)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Create: gateway/tests/prompts.test.ts, sdk/tests/prompt-version.test.ts

TASK: Test prompt versioning.

gateway/tests/prompts.test.ts:
- Mock env.DB.prepare().bind().run() and .all() and .first()
- test('POST /v1/prompts creates prompt + version 1')
- test('GET /v1/prompts returns list with latest_version')
- test('POST /v1/prompts/:id/versions increments version')
- test('POST /v1/prompts/:id/render substitutes {{variables}}')
- test('POST /v1/prompts/:id/render leaves unknown vars unchanged')

renderTemplate unit tests (no mocking needed):
- renderTemplate('Hello {{name}}', {name:'Alice'}) === 'Hello Alice'
- renderTemplate('{{a}} {{b}}', {a:'x'}) === 'x {{b}}'
- renderTemplate('no vars', {}) === 'no vars'
- renderTemplate('{{a}}{{a}}', {a:'!'}) === '!!'

sdk/tests/prompt-version.test.ts:
- Mock fetch for GET /v1/prompts and POST /v1/prompts/:id/render
- test('returns rendered string')
- test('uses cache on second call with same args') — verify fetch called only once
- test('cache expires after TTL') — mock Date.now() to advance past TTL → fetch called again
- test('throws if no gatewayUrl configured')
```

---

## WEEK 6 — ROI Calculator + Pricing Page

---

### CP-026 · Day 26 · Savings Projection Algorithm

**RD**
Build `landing-page/roi.js` — a pure JS module containing the savings projection algorithm. Input: monthly LLM spend ($), provider mix (% OpenAI / % Anthropic / % other), use case type (chatbot / RAG / code / general). Output: projected savings breakdown (booster %, cache %, routing %, total %) and monthly dollar savings.

**AC**
- [ ] `projectSavings(spend, providerMix, useCase)` returns `{ boosterSavings, cacheSavings, routingSavings, totalSavings, totalPercent }`
- [ ] Conservative estimates by use case: chatbot (booster 15%, cache 25%, routing 10%), RAG (booster 5%, cache 40%, routing 15%), code (booster 20%, cache 10%, routing 15%), general (booster 10%, cache 20%, routing 10%)
- [ ] Routing savings adjusted for provider mix: higher OpenAI % → higher routing savings potential
- [ ] `totalPercent` capped at 60% (never overclaim)
- [ ] All values in dollars, 2 decimal places

**CR**
- Pure functions only — no DOM, no fetch
- Exported as ES module: `export function projectSavings(...)`
- Unit tested with known inputs/outputs

---

**Implementation Prompt (CP-026)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Create: landing-page/roi.js (max 80 lines)

TASK: Savings projection algorithm.

const USE_CASE_RATES = {
  chatbot:  { booster: 0.15, cache: 0.25, routing: 0.10 },
  rag:      { booster: 0.05, cache: 0.40, routing: 0.15 },
  code:     { booster: 0.20, cache: 0.10, routing: 0.15 },
  general:  { booster: 0.10, cache: 0.20, routing: 0.10 }
}

export function projectSavings(
  monthlySpend: number,
  providerMix: { openai: number, anthropic: number, other: number }, // fractions summing to 1
  useCase: 'chatbot' | 'rag' | 'code' | 'general'
) {
  const rates = USE_CASE_RATES[useCase]
  // Routing savings scale with expensive provider concentration
  const routingMultiplier = 1 + (providerMix.openai * 0.3 + providerMix.anthropic * 0.2)
  const adjustedRouting = Math.min(rates.routing * routingMultiplier, 0.25)

  const boosterSavings = monthlySpend * rates.booster
  const cacheSavings = monthlySpend * rates.cache
  const routingSavings = monthlySpend * adjustedRouting
  const totalSavings = Math.min(boosterSavings + cacheSavings + routingSavings, monthlySpend * 0.60)
  const totalPercent = (totalSavings / monthlySpend) * 100

  return {
    boosterSavings: +boosterSavings.toFixed(2),
    cacheSavings: +cacheSavings.toFixed(2),
    routingSavings: +routingSavings.toFixed(2),
    totalSavings: +totalSavings.toFixed(2),
    totalPercent: +totalPercent.toFixed(1)
  }
}

Tests in landing-page/roi.test.js: at least 6 cases covering all use case types and edge cases (spend=0, all-openai mix).
```

---

### CP-027 · Day 27 · ROI Calculator Component

**RD**
Add an interactive ROI calculator section to `landing-page/index.html`. Inputs: monthly LLM spend slider ($100–$50,000), provider mix sliders, use case dropdown. Output updates live as inputs change. Show savings breakdown bar and recommended pricing tier.

**AC**
- [ ] Monthly spend: range input $100–$50,000 with live dollar display
- [ ] Provider mix: three sliders (OpenAI %, Anthropic %, Other %) that auto-normalize to 100%
- [ ] Use case: `<select>` with 4 options
- [ ] Results update on every input event (no submit button)
- [ ] Savings breakdown: 3 horizontal bars (booster, cache, routing) with dollar amounts
- [ ] Total savings badge: large "Save $X,XXX/mo" display
- [ ] Recommended tier: if savings > $500 → Growth; if savings > $2000 → Scale; else → Dev
- [ ] CTA button: "Start saving — try [Recommended Tier]" linking to signup

**CR**
- Uses `landing-page/roi.js` as ES module import
- All DOM updates via `textContent` or `style.width` (no innerHTML with calculated values)
- Slider auto-normalize: on any provider slider change, proportionally adjust others to sum to 100

---

**Implementation Prompt (CP-027)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Edit: landing-page/index.html (add ROI section)
Edit: landing-page/roi.js if needed

TASK: Interactive ROI calculator section.

HTML structure to add after hero section:
<section id="roi-calculator">
  <h2>Calculate Your Savings</h2>
  <div class="roi-inputs">
    <label>Monthly LLM Spend: <span id="spend-display">$1,000</span>
      <input type="range" id="spend-slider" min="100" max="50000" step="100" value="1000">
    </label>
    <div class="provider-mix">
      <label>OpenAI <span id="openai-pct">60</span>% <input type="range" id="openai-slider" min="0" max="100" value="60"></label>
      <label>Anthropic <span id="anthropic-pct">30</span>% <input type="range" id="anthropic-slider" min="0" max="100" value="30"></label>
      <label>Other <span id="other-pct">10</span>% <input type="range" id="other-slider" min="0" max="100" value="10"></label>
    </div>
    <label>Use Case: <select id="usecase-select">...</select></label>
  </div>
  <div class="roi-results">
    <div class="savings-badge">Save <span id="total-savings">$0</span>/mo</div>
    <div class="savings-bars">...</div>
    <div class="recommended-tier" id="recommended-tier"></div>
    <a href="/signup" id="cta-btn">Start saving</a>
  </div>
</section>

JavaScript (inline <script type="module"> at bottom):
- import { projectSavings } from './roi.js'
- function updateCalculator(): read all inputs → call projectSavings → update DOM via textContent/style.width
- Provider normalization: on openai-slider input → set other = 100 - openai - anthropic, clamp to [0, 100-openai]
- addEventListener('input') on all inputs → updateCalculator()
- Call updateCalculator() on load

Tier recommendation:
- savings > 2000 → 'Scale ($799/mo) — you\'ll save ${X} more than the plan costs'
- savings > 500 → 'Growth ($299/mo)'  
- else → 'Dev ($79/mo)'

RULES: No innerHTML with calculated values. textContent only. Import roi.js as module.
```

---

### CP-028 · Day 28 · Pricing Page Redesign

**RD**
Rewrite the pricing section in `landing-page/index.html` with the new 5-tier value-based pricing (Free / Dev $79 / Growth $299 / Scale $799 / Enterprise $2,500+). Highlight Growth as "Most Popular". Each tier shows the ROI story, not just feature lists. Add a billing toggle (monthly/annual — annual 20% off).

**AC**
- [ ] 5 pricing cards with correct tier names and prices
- [ ] Annual toggle: monthly prices shown by default; toggle switches to annual (×12 × 0.80)
- [ ] Annual savings badge: "Save 2 months free" visible when annual selected
- [ ] "Most Popular" badge on Growth tier
- [ ] Each card shows: ROI story (1 sentence), price, calls/day, top 4 features, CTA button
- [ ] Enterprise card: "Talk to sales" CTA (mailto or Calendly link)
- [ ] Mobile: cards stack vertically, most popular card elevated

**CR**
- Toggle with `<input type="checkbox">` + `<label>` (no JS framework)
- Price swap via CSS `[data-billing="annual"] .price-annual { display: block }` — no JS DOM manipulation for prices
- All prices in `data-monthly` and `data-annual` attributes; CSS shows/hides the right one

---

**Implementation Prompt (CP-028)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Edit: landing-page/index.html (replace existing pricing section)

TASK: New 5-tier pricing section with billing toggle.

Pricing data:
| Tier       | Monthly | Annual/mo | Calls/day | ROI Story |
|------------|---------|-----------|-----------|-----------|
| Free       | $0      | $0        | 500       | Try the full pipeline |
| Dev        | $79     | $63       | 15K       | Spend $300/mo on LLMs → save $45-150/mo |
| Growth     | $299    | $239      | 150K      | Spend $1K/mo → save $300-1,000/mo |
| Scale      | $799    | $639      | 1.5M      | Spend $5K/mo → save $1,500-5,000/mo |
| Enterprise | $2,500+ | Custom    | Unlimited | $20K+ LLM spend → dedicated ROI analysis |

HTML structure:
<div class="billing-toggle">
  <span>Monthly</span>
  <label class="toggle"><input type="checkbox" id="billing-toggle"><span class="slider"></span></label>
  <span>Annual <em class="save-badge">Save 20%</em></span>
</div>
<div class="pricing-grid" id="pricing-grid">
  <!-- 5 cards -->
</div>

Each card:
<div class="pricing-card [most-popular]" data-tier="growth">
  <div class="tier-name">Growth</div>
  <div class="roi-story">Spend $1K/mo on LLMs → save $300–$1,000/mo</div>
  <div class="price">
    <span class="price-monthly">$299<span class="per">/mo</span></span>
    <span class="price-annual" hidden>$239<span class="per">/mo</span></span>
  </div>
  <ul class="features">...</ul>
  <a href="/signup?tier=growth" class="cta-btn">Start free trial</a>
</div>

JS (10 lines max): 
billing-toggle change → toggle class 'annual' on #pricing-grid →
CSS rule: .pricing-grid.annual .price-monthly { display:none } .pricing-grid.annual .price-annual { display:block }
```

---

### CP-029 · Day 29 · Landing Page Integration + CTA Flow

**RD**
Integrate the ROI calculator and new pricing sections cohesively into the full landing page. Ensure the ROI calculator's recommended tier CTA links to the correct pricing card (smooth scroll + highlight). Add UTM parameters to all signup links. Test full page flow: hero → ROI calc → pricing → signup.

**AC**
- [ ] ROI calc CTA button smooth-scrolls to pricing section and highlights recommended tier card
- [ ] All signup CTAs include `?tier=X&utm_source=landing&utm_medium=cta&utm_campaign=roi`
- [ ] Page load performance: < 3s on 3G (no unoptimized images, no blocking scripts)
- [ ] All images have `alt` attributes
- [ ] Lighthouse accessibility score ≥ 90

---

**Implementation Prompt (CP-029)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Edit: landing-page/index.html

TASK: Wire ROI calculator to pricing section. Add UTM params. Verify performance.

1. ROI calculator CTA → smooth scroll + highlight:
   document.getElementById('cta-btn').addEventListener('click', (e) => {
     e.preventDefault()
     const tier = determineTier(savings) // 'free'|'dev'|'growth'|'scale'
     const card = document.querySelector(`[data-tier="${tier}"]`)
     card.scrollIntoView({ behavior: 'smooth', block: 'center' })
     card.classList.add('highlighted')
     setTimeout(() => card.classList.remove('highlighted'), 2000)
     // Navigate after scroll animation
     setTimeout(() => window.location.href = `/signup?tier=${tier}&utm_source=landing&utm_medium=cta&utm_campaign=roi`, 600)
   })

2. UTM params: update all <a href="/signup"> to include utm_source=landing&utm_medium=cta&utm_campaign=pricing

3. CSS for highlight:
   .pricing-card.highlighted { box-shadow: 0 0 0 3px var(--accent); transition: box-shadow 0.3s }

4. Performance:
   - All <script> tags: add defer attribute
   - All images: add loading="lazy" and explicit width/height
   - Inline critical CSS (above-fold) in <style> tag

5. Accessibility:
   - All inputs have associated <label>
   - All buttons have descriptive text (no "click here")
   - Add aria-label to icon-only buttons
   - Color contrast: verify accent #6366f1 on #0f0f0f passes AA (it does: 5.8:1)
```

---

### CP-030 · Day 30 · E2E Conversion Test + Analytics Events

**RD**
Write Playwright E2E tests covering the full landing page conversion funnel. Add analytics event tracking (custom events to `POST /v1/analytics/events` or a lightweight analytics integration) for: page load, ROI calculator interaction, pricing tier view, CTA click.

**AC**
- [ ] E2E test: land on homepage → interact with ROI slider → verify savings update → click CTA → verify URL has correct tier + UTM params
- [ ] E2E test: visit pricing → click Growth plan CTA → verify redirect to `/signup?tier=growth`
- [ ] E2E test: billing toggle → verify prices change to annual amounts
- [ ] Analytics: on ROI slider interaction, fire `trackEvent('roi_interaction', { spend, useCase, totalSavings })`
- [ ] Analytics: on CTA click, fire `trackEvent('cta_click', { tier, location })`
- [ ] `trackEvent` is fire-and-forget; failure never breaks UX

**CR**
- Playwright tests in `landing-page/tests/landing.e2e.ts`
- `trackEvent` sends `POST` to `/v1/events` (or `navigator.sendBeacon`) — never blocks
- Analytics events do not include PII

---

**Implementation Prompt (CP-030)**

```
Repo: /Users/shaharsolomon/dev/projects/portfolio/clawpipe
Create: landing-page/tests/landing.e2e.ts
Edit: landing-page/index.html (add trackEvent)

TASK: E2E tests + analytics events.

landing-page/tests/landing.e2e.ts (Playwright):
import { test, expect } from '@playwright/test'

test('ROI calculator updates savings', async ({ page }) => {
  await page.goto('/')
  await page.locator('#spend-slider').fill('5000')
  await expect(page.locator('#total-savings')).not.toHaveText('$0')
})

test('CTA click includes tier and UTM params', async ({ page }) => {
  await page.goto('/')
  await page.locator('#spend-slider').fill('10000')
  const [response] = await Promise.all([
    page.waitForURL(/\/signup/),
    page.locator('#cta-btn').click()
  ])
  expect(page.url()).toContain('utm_source=landing')
  expect(page.url()).toMatch(/tier=(dev|growth|scale)/)
})

test('billing toggle switches to annual prices', async ({ page }) => {
  await page.goto('/#pricing')
  await page.locator('#billing-toggle').click()
  await expect(page.locator('[data-tier="growth"] .price-annual')).toBeVisible()
  await expect(page.locator('[data-tier="growth"] .price-monthly')).toBeHidden()
})

Analytics in landing-page/index.html:
function trackEvent(name, props = {}) {
  const payload = JSON.stringify({ event: name, props, ts: Date.now() })
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/v1/events', payload)
  } else {
    fetch('/v1/events', { method: 'POST', body: payload, keepalive: true }).catch(() => {})
  }
}
// Fire on interactions:
document.getElementById('spend-slider').addEventListener('change', () => {
  trackEvent('roi_interaction', { spend: getCurrentSpend(), useCase: getCurrentUseCase(), totalSavings: getCurrentSavings() })
})

RULES: sendBeacon preferred (non-blocking). Never track PII. Events fire after UX action, never before.
```

---

## Summary: 30-Task Sprint

| Week | Focus | Tasks | Goal |
|------|-------|-------|------|
| 1 | Dashboard UI | CP-001 – CP-005 | Live analytics dashboard |
| 2 | Providers + Embedding | CP-006 – CP-010 | Bedrock, Vertex, zero-config semantic cache |
| 3 | Global Learning | CP-011 – CP-015 | Cross-instance weight sync |
| 4 | Quality Scoring | CP-016 – CP-020 | LLM-as-judge + quality dashboard |
| 5 | Prompt Versioning | CP-021 – CP-025 | Versioned prompts + SDK method |
| 6 | ROI + Pricing | CP-026 – CP-030 | Value-based pricing, ROI calculator, E2E tests |

**Pricing tiers shipped by end of Week 6:**

| Tier | Price | Daily Calls |
|------|-------|-------------|
| Free | $0 | 500 |
| Dev | $79/mo | 15K |
| Growth | $299/mo | 150K |
| Scale | $799/mo | 1.5M |
| Enterprise | $2,500+/mo | Unlimited |
