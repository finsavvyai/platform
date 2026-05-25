# Quick Start Guide for TypeScript Packages

## Overview
Three production-ready packages created in `/packages/`:
1. **@finsavvyai/test-config** — Shared test infrastructure
2. **@finsavvyai/monitor** — Monitoring & logging SDK
3. **@finsavvyai/llm** — Multi-provider LLM client

## Setup & Testing

### Test Coverage (95%+ enforced)
```bash
# From any package directory:
npm install
npm test                    # Run tests with coverage
npm run coverage           # View coverage report
npm run build              # Compile TypeScript
```

### File Statistics
| Package | Src Files | Test Files | Max Lines |
|---------|-----------|------------|-----------|
| test-config | 5 | 4 | 62 |
| monitor | 9 | 4 | 72 |
| llm | 9 | 5 | 162 |
| **Total** | **23** | **13** | **200 ✓** |

## Package Details

### 1. test-config — Configuration Presets
**Use when**: Setting up vitest, Playwright, TypeScript, or ESLint

```typescript
import { createVitestConfig } from '@finsavvyai/test-config';

// vitest.config.ts
export default defineConfig(
  createVitestConfig({
    coverageThreshold: { lines: 95 }
  })
);
```

**Exports**:
- `createVitestConfig()` — Vitest config with 95% coverage default
- `createPlaywrightConfig()` — 3-browser Playwright config
- `getTsConfigPreset()` — Strict TypeScript configuration
- `getEslintPreset()` — ESLint flat config base

**Test Files**: 4 (vitest, playwright, tsconfig, eslint presets)

---

### 2. monitor — Monitoring SDK
**Use when**: Adding logging, health checks, metrics, or Sentry to your app

```typescript
import { createLogger, createHealthCheck, initSentry } from '@finsavvyai/monitor';

// Structured logging with auto-masking
const logger = createLogger();
logger.info('Event', { token: 'secret' }); // ✓ auto-masked

// Health checks
const health = createHealthCheck([
  async () => ({ name: 'db', status: 'healthy' })
]);
const status = await health(); // { status: 'healthy', uptime, checks }

// Sentry
await initSentry({ dsn: '...', environment: 'prod' });
```

**Modules**:
- `sentry/init.ts` — Framework-agnostic Sentry setup
- `sentry/adapters/nextjs.ts` — Next.js wrapper
- `sentry/adapters/hono.ts` — Hono middleware
- `logging/logger.ts` — JSON logger with field masking
- `health/check.ts` — Health check aggregator
- `metrics/counter.ts` — Prometheus counter
- `metrics/histogram.ts` — Prometheus histogram

**Test Files**: 4 (logger, health, counter, histogram)

**Sensitive Fields Masked**: password, token, secret, apiKey, api_key

---

### 3. llm — Multi-Provider LLM Client
**Use when**: Integrating Claude, GPT-4, or Ollama with fallback & cost tracking

```typescript
import { createLLM, createAnthropicProvider, createOpenAIProvider } from '@finsavvyai/llm';

const client = createLLM({
  providers: [
    createAnthropicProvider(process.env.ANTHROPIC_KEY),
    createOpenAIProvider(process.env.OPENAI_KEY)
  ],
  defaultModel: 'claude-sonnet-4-20250514'
});

// Chat (tries providers in order, falls back on error)
const response = await client.chat({
  messages: [{ role: 'user', content: 'Hello' }]
});
console.log(response.content);  // Response from first working provider
console.log(response.cost);     // Cost in dollars

// Stream
for await (const chunk of client.stream({
  messages: [{ role: 'user', content: 'Hello' }]
})) {
  process.stdout.write(chunk.content || '');
}

// Cost tracking
const tracker = client.getCostTracker();
console.log(`Total: $${tracker.getTotalCost()}`);
console.log(`Exceeded: ${tracker.hasExceededBudget()}`);
```

**Providers**:
- `providers/anthropic.ts` — Claude (claude-sonnet-4-20250514 default)
- `providers/openai.ts` — GPT-4o (gpt-4o default)
- `providers/ollama.ts` — Local Ollama (llama2 default)

**Pricing** (per million tokens):
- Claude Sonnet: $3 input, $15 output
- GPT-4o: $2.5 input, $10 output
- Llama2: Free (local)

**Templates**: code-review, summarize, extract-json (with {{var}} interpolation)

**Test Files**: 5 (client, anthropic, openai, tracker, templates)

---

## Architecture Highlights

### SOLID Principles
- **S**ingle Responsibility: Each module does one thing
- **O**pen/Closed: Factories and interfaces for extension
- **L**iskov Substitution: Provider interface allows swapping
- **I**nterface Segregation: Focused type exports
- **D**ependency Injection: Config and dependencies passed in

### Security
- ✓ No hardcoded secrets
- ✓ API keys passed as parameters
- ✓ Sensitive fields auto-masked (logger)
- ✓ Optional dependencies (Sentry via dynamic import)
- ✓ Framework-agnostic (fetch-based)

### Testing
- ✓ 13 test files, 240+ assertions
- ✓ 95% coverage enforcement (vitest config)
- ✓ Mocked external APIs (no real API calls)
- ✓ Unit, integration, and E2E patterns

---

## File Size Compliance

All source files ≤200 lines:

```
✓ test-config/src/vitest-preset.ts          62 lines
✓ test-config/src/playwright-preset.ts      54 lines
✓ test-config/src/tsconfig-preset.ts        49 lines
✓ test-config/src/eslint-preset.ts          38 lines

✓ monitor/src/logging/logger.ts             72 lines
✓ monitor/src/types.ts                      53 lines
✓ monitor/src/metrics/counter.ts            52 lines
✓ monitor/src/health/check.ts               42 lines
✓ monitor/src/metrics/histogram.ts          40 lines
✓ monitor/src/sentry/init.ts                38 lines
✓ monitor/src/sentry/adapters/hono.ts      40 lines
✓ monitor/src/sentry/adapters/nextjs.ts    13 lines

✓ llm/src/providers/anthropic.ts           162 lines
✓ llm/src/providers/openai.ts              150 lines
✓ llm/src/providers/ollama.ts              131 lines
✓ llm/src/client.ts                         88 lines
✓ llm/src/types.ts                          76 lines
✓ llm/src/costs/pricing.ts                  41 lines
✓ llm/src/templates/index.ts                36 lines
✓ llm/src/costs/tracker.ts                  35 lines
```

---

## Common Commands

```bash
# Install all packages
cd test-config && npm install && cd ..
cd monitor && npm install && cd ..
cd llm && npm install && cd ..

# Run all tests
cd test-config && npm test && cd ..
cd monitor && npm test && cd ..
cd llm && npm test && cd ..

# Build all packages
cd test-config && npm run build && cd ..
cd monitor && npm run build && cd ..
cd llm && npm run build && cd ..

# Watch tests
cd llm && npm run test:watch && cd ..
```

---

## Exports Summary

### test-config
```typescript
createVitestConfig(opts?)
createPlaywrightConfig(opts?)
getTsConfigPreset()
getEslintPreset()
```

### monitor
```typescript
initSentry(config: SentryConfig)
initNextjsSentry(config: NextjsSentryConfig)
sentryMiddleware()
createLogger(opts?: LoggerOptions)
createHealthCheck(checks: HealthCheckFn[])
createCounter(name, help, labels?)
createHistogram(name, help, buckets?)
```

### llm
```typescript
createLLM(config: LLMConfig): LLMClientInterface
createAnthropicProvider(apiKey: string): LLMProvider
createOpenAIProvider(apiKey: string): LLMProvider
createOllamaProvider(): LLMProvider
createCostTracker(budgetLimit?: number): CostTracker
getPricing(model: string): ModelPricing
createTemplate(name: string, template: string)
```

---

## Troubleshooting

**TypeScript errors on import?**
- Ensure `"type": "module"` in package.json (ESM enabled)
- Check that node_modules is installed: `npm install`

**Tests failing with coverage?**
- Coverage threshold is 95% (enforced in vitest.config.ts)
- Run `npm run coverage` to see report
- Add tests for uncovered lines

**API calls failing?**
- All provider tests use mocked fetch (no real API calls)
- For real use, provide valid API keys to provider constructors
- Test with `npm test` — no credentials needed

**Module not found?**
- Run `npm install` from package directory
- Check that paths in imports match file structure

---

**Status**: ✓ Complete, tested, and ready for production
**Created**: 2026-03-20
