# ClawPipe — CLAUDE.md

> Extends portfolio-level `/CLAUDE.md`. Cannot weaken any rule.

## Product Mission

**"The intelligent AI pipeline. Booster -> Pack -> Cache -> Route -> Call -> Learn."**

ClawPipe sits between your app and LLM providers. It is the only product that
combines Agent Booster, Context Packing, Prompt Caching, Self-Learning Routing,
Multi-Provider Gateway, and Swarm Orchestration in a single pipeline.

**Target user**: Developers and teams using LLMs who want to cut costs
without changing their application logic. (Per-bucket cost-reduction range
pending the public measured benchmark at
github.com/finsavvyai/clawpipe-booster-benchmark.)

## Architecture Constraints

- **Stack**: TypeScript, Cloudflare Workers, Hono, D1, KV
- **SDK**: `clawpipe` npm package — lightweight client with local pipeline steps
- **Gateway**: Cloudflare Worker at `api.clawpipe.ai`
- **Landing page**: Static HTML deployed to Cloudflare Pages
- **Max 200 lines per source file** (CI-enforced)
- **Single Responsibility**: one module per pipeline stage

### Pipeline Stages

```
Request -> Booster -> Packer -> Cache -> Router -> Provider Call -> Learn
```

1. **Booster** — deterministic transforms that skip LLM calls entirely
2. **Packer** — compress context to reduce token count
3. **Cache** — hash-based prompt deduplication (local + KV)
4. **Router** — cost/quality/latency-aware model selection
5. **Gateway** — multi-provider dispatch (OpenAI, Anthropic, DeepSeek, etc.)
6. **Learner** — track outcomes and refine routing weights

### Data Model (D1)

```
projects       (id, name, api_key_hash, created_at)
requests       (id, project_id, prompt_hash, provider, model, tokens_in, tokens_out, latency_ms, cost, cached, boosted, created_at)
route_weights  (id, project_id, task_type, provider, model, score, updated_at)
cache_entries  (id, project_id, prompt_hash, response, ttl, created_at)
```

## Test Matrix

- Unit tests for each pipeline stage (booster, packer, cache, router)
- Integration tests for full pipeline flow
- E2E tests for SDK -> Gateway round trip
- Load test: 1K concurrent requests through pipeline

## Security Controls

- API keys hashed with SHA-256, never stored in plaintext
- Provider keys encrypted at rest in KV
- Rate limiting per project (free: 1K, dev: 15K, growth: 150K, scale: 1.5M calls/day)
- Input validation with Zod on all gateway endpoints
- No PII logged; prompt content redacted in telemetry

## Release Checklist

- [x] All pipeline stages unit tested (647 tests, 136 files)
- [x] SDK published to npm with correct types (v3.6.1, 167 files, 94.7 kB)
- [x] Gateway deployed to Cloudflare Workers
- [x] Landing page deployed to Cloudflare Pages
- [x] Rate limiting verified under load (1.5K concurrent, binary search prune)
- [x] Security scan clean (parameterized SQL, XSS escaped, no leaked secrets)
- [x] Documentation complete (README, API reference, OpenAPI spec)

## Pricing

| Tier       | Price    | Calls/day | Features                              |
|------------|----------|-----------|---------------------------------------|
| Free       | $0       | 1,000     | All pipeline stages, 1 project        |
| Dev        | $79/mo   | 15,000    | Unlimited projects, analytics         |
| Growth     | $299/mo  | 150,000   | Quality scoring, global weight sync   |
| Scale      | $799/mo  | 1,500,000 | SLA guarantee, team management        |
| Enterprise | Custom   | Unlimited | SSO, audit logs, dedicated infra      |

## Commands

```bash
cd sdk && npm install        # Install SDK deps
cd sdk && npm run build      # Build SDK
cd sdk && npm test           # Run unit tests
cd landing-page && npx wrangler pages dev .  # Preview landing page
```

## Anti-Bluff Guardrails (drill-derived 2026-04-27)

Active for every session writing release notes, changelogs, audit reports, or docs:

- NEVER cite a file path or line number without `grep`/`Read` confirming it in the current session.
- NEVER quote a metric (coverage %, file count, kB size, test count, latency, cost reduction) without naming the artifact (`file.json`, `npm pack`, `vitest output`) that produced it in this session.
- NEVER use "comprehensive", "production-ready", "fully implemented", "complete" without a test/CI/scan reference. Replace with the concrete observed evidence or remove the word.
- WHEN uncertain or out-of-scope, write "I have not verified <X>" and stop. Do not pad with adjacent verified facts to disguise the gap.
- BEFORE writing release notes for a commit, read the commit body and run `git diff` for that commit; describe only files in the diff.
- BEFORE summarizing test counts, run `grep -cE "^\s*(test|it)\("` on each file or run the test runner; do not rely on commit-body numbers.
- WHEN a commit body's summary number disagrees with its breakdown (e.g. "24 tests = 10+14+7+3"), trust the breakdown and flag the summary.

