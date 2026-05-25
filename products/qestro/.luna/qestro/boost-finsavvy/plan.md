# Qestro — FinsavvyAI Boost Plan

**Generated**: 2026-04-08
**Priority**: Ship-ready optimizations for Wave 2 launch

---

## Phase 1: Connect to Claw Gateway (Effort: 4 hours)

**Why**: Every AI call currently goes direct to Anthropic/OpenAI APIs. Routing through Claw Gateway enables ReasoningBank caching (30% token savings), Smart Router model selection, and centralized billing.

### Steps:
1. **Register Qestro on Claw Gateway**
   - Add `CLAW_GATEWAY_URL=https://claw-gateway.workers.dev` to env
   - Add `CLAW_PROJECT_ID=qestro` and `CLAW_API_KEY` to secrets
   - File: `.env.production`

2. **Create AI proxy client**
   - New file: `backend/src/lib/claw-client.ts`
   - Wraps all AI calls through gateway instead of direct SDK
   - Falls back to direct SDK if gateway is down

3. **Migrate AI service calls**
   - Update `backend/src/services/AIService.ts` (or equivalent) to use claw-client
   - Update test generation, self-healing, and conversational test services
   - Files: `ConversationalTestService.ts`, `SelfHealingEngine.ts`

4. **Enable ReasoningBank**
   - Add cache keys for test generation prompts (URL + requirements hash)
   - Expected savings: 30% on repeated/similar test generation requests

5. **Enable Smart Router**
   - Route test generation (complex) → Claude Opus/Sonnet
   - Route selector healing (simple) → Haiku or Agent Booster
   - Route API test generation → Sonnet (good enough, cheaper)

---

## Phase 2: Install @finsavvyai/llm (Effort: 3 hours)

**Why**: Replace direct @anthropic-ai/sdk + openai imports with unified multi-provider client that has built-in fallback chains, retry logic, and token tracking.

### Steps:
1. `npm install @finsavvyai/llm` in backend workspace
2. Replace `@anthropic-ai/sdk` imports with `@finsavvyai/llm` client
3. Configure fallback chain: Claude → OpenAI → HuggingFace
4. Add token usage tracking (feeds into billing/analytics)
5. Remove direct `@anthropic-ai/sdk` and `openai` from dependencies

---

## Phase 3: Install @finsavvyai/auth (Effort: 6 hours)

**Why**: Custom JWT + OAuth in `shared/auth/index.ts` is ~300 lines of hand-rolled auth. @finsavvyai/auth provides battle-tested auth with Clerk/Supabase/CF Access support, reducing maintenance from ~20 hrs/mo to ~2 hrs/mo.

### Steps:
1. `npm install @finsavvyai/auth` in shared workspace
2. Map current JWT token format to @finsavvyai/auth token format
3. Migrate OAuth providers (GitHub, Azure AD, Google) to shared config
4. Update `backend/src/middleware/authMiddleware.ts` to use shared auth
5. Update `frontend/src/stores/authStore.ts` to use shared auth client
6. Run migration: existing tokens remain valid during transition
7. Remove custom auth code from `shared/auth/index.ts`

---

## Phase 4: Install @finsavvyai/monitor (Effort: 2 hours)

**Why**: Custom winston logger provides basic logging but no error tracking, no performance metrics, no alerting. @finsavvyai/monitor adds Sentry + Prometheus + structured logging.

### Steps:
1. `npm install @finsavvyai/monitor` in backend + frontend workspaces
2. Initialize Sentry in backend `index.ts` and frontend `App.tsx`
3. Replace `backend/src/utils/logger.ts` calls with structured logging
4. Add Prometheus metrics for test execution (duration, pass rate, queue depth)
5. Keep custom TelemetryService as product-specific layer on top

---

## Phase 5: Install @finsavvyai/pay (Effort: 3 hours)

**Why**: Stripe-only payments limit market reach. @finsavvyai/pay adds LemonSqueezy for international markets and provides unified webhook handling.

### Steps:
1. `npm install @finsavvyai/pay` in backend workspace
2. Migrate `backend/src/services/StripeService.ts` to use unified client
3. Add LemonSqueezy as secondary payment provider
4. Update webhook handlers in `backend/src/routes/billing.routes.ts`
5. Keep existing Stripe customer IDs and subscriptions intact

---

## Phase 6: Install @finsavvyai/test-config (Effort: 1 hour)

**Why**: Jest, Vitest, and Playwright configs are duplicated across workspaces. Shared presets ensure consistent coverage thresholds and reporter configs.

### Steps:
1. `npm install @finsavvyai/test-config` in root
2. Extend Jest config from `@finsavvyai/test-config/jest`
3. Extend Vitest config from `@finsavvyai/test-config/vitest`
4. Extend Playwright config from `@finsavvyai/test-config/playwright`
5. Remove duplicated config values, keep Qestro-specific overrides

---

## Phase 7: Install @finsavvyai/cf-stack + @finsavvyai/db (Effort: 2 hours)

**Why**: Already using Hono + D1 + KV + Drizzle — adopting the shared toolkit standardizes patterns and provides migration helpers.

### Steps:
1. `npm install @finsavvyai/cf-stack @finsavvyai/db` in backend workspace
2. Use cf-stack Hono helpers for middleware chain
3. Use db schema templates for common tables (users, subscriptions)
4. Keep Qestro-specific tables (tests, runs, results, assertions)

---

## Phase 8: Install @finsavvyai/ui (Effort: 8 hours)

**Why**: Frontend uses custom Tailwind components. @finsavvyai/ui provides Apple HIG-compliant design system components that ensure portfolio-wide visual consistency.

### Steps:
1. `npm install @finsavvyai/ui` in frontend workspace
2. Replace custom button, input, modal, card components with shared ones
3. Apply Apple HIG spacing, typography, and color tokens
4. Keep Qestro-specific components (test editor, execution viewer, results panel)
5. Update Tailwind config to extend shared design tokens

---

## Phase 9: Enable Intelligence Features (Effort: 4 hours)

**Why**: After Claw Gateway connection, enable advanced AI optimization features.

### Steps:
1. **Agent Booster**: Route simple selector updates through WASM transform (<1ms vs ~2s LLM call)
2. **Context Packing**: Trim test context before LLM calls (40-60% token savings)
3. **Self-Learning SDK**: Track which test generation approaches produce passing tests
   - Feed outcomes back to Smart Router for better model selection
   - Build a test generation quality score per project

---

## Summary

| Phase | Library/Feature | Effort | Impact |
|-------|----------------|--------|--------|
| 1 | Claw Gateway | 4 hrs | 30% AI cost reduction |
| 2 | @finsavvyai/llm | 3 hrs | Unified AI, fallback chains |
| 3 | @finsavvyai/auth | 6 hrs | 90% auth maintenance reduction |
| 4 | @finsavvyai/monitor | 2 hrs | Error tracking + metrics |
| 5 | @finsavvyai/pay | 3 hrs | LemonSqueezy + intl payments |
| 6 | @finsavvyai/test-config | 1 hr | Consistent test standards |
| 7 | @finsavvyai/cf-stack + db | 2 hrs | Standardized infra patterns |
| 8 | @finsavvyai/ui | 8 hrs | Apple HIG design system |
| 9 | Intelligence features | 4 hrs | 40-60% additional AI savings |
| **Total** | | **33 hrs** | **~$120/mo AI savings + 80% maintenance reduction** |

## Recommended Execution Order

**Sprint 1 (this week)**: Phases 1-2 — Gateway + LLM (7 hrs, highest ROI)
**Sprint 2 (next week)**: Phases 3-4 — Auth + Monitor (8 hrs, reliability)
**Sprint 3**: Phases 5-7 — Pay + Test + Infra (6 hrs, standardization)
**Sprint 4**: Phases 8-9 — UI + Intelligence (12 hrs, polish + optimization)
