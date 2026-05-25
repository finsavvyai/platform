/** Pipeline finalize/init helpers — extracted from ClawPipe to keep the
 * orchestrator under the 200-line file cap.
 */

import type { Telemetry } from './telemetry';
import type { Budget } from './budget';
import type { RateLimiter } from './rate-limiter';
import type { AuditLogger } from './audit';
import type { Tracer } from './tracer';
import type { PipelineMeta, PipelineResult, SavingsMeta } from './types';

export function initMeta(): PipelineMeta {
  return {
    boosted: false, cached: false, packed: false, contextSavings: '0%', route: '', model: '',
    latencyMs: 0, tokensIn: 0, tokensOut: 0, estimatedCostUsd: 0,
    budgetRemainingUsd: null, rateLimitRemaining: null, circuitBreakerState: 'closed',
  };
}

export interface FinalizeDeps {
  telemetry: Telemetry;
  budget: Budget;
  rateLimiter: RateLimiter;
  audit: AuditLogger;
}

export function finalizeResult(
  deps: FinalizeDeps,
  text: string,
  meta: PipelineMeta,
  start: number,
  input: string,
  isBoosted: boolean,
  savings: SavingsMeta | null,
  tracer?: Tracer,
): PipelineResult {
  meta.latencyMs = Date.now() - start;
  const cost = deps.telemetry.estimateCost(meta.route, meta.model, meta.tokensIn, meta.tokensOut);
  meta.estimatedCostUsd = isBoosted || meta.cached ? 0 : cost;
  deps.telemetry.record({
    provider: meta.route, model: meta.model, tokensIn: meta.tokensIn,
    tokensOut: meta.tokensOut, latencyMs: meta.latencyMs, costUsd: meta.estimatedCostUsd,
    cached: meta.cached, boosted: meta.boosted,
  });
  if (!isBoosted && !meta.cached) deps.budget.record(meta.estimatedCostUsd);
  deps.rateLimiter.record();
  meta.budgetRemainingUsd = deps.budget.status().remainingUsd;
  meta.rateLimitRemaining = deps.rateLimiter.status().remaining;
  meta.savings = savings;
  deps.audit.log({
    action: 'prompt', provider: meta.route, model: meta.model,
    tokensIn: meta.tokensIn, tokensOut: meta.tokensOut, latencyMs: meta.latencyMs,
    estimatedCostUsd: meta.estimatedCostUsd, cached: meta.cached, boosted: meta.boosted,
    promptHash: hashFor(input),
  });
  const result: PipelineResult = { text, meta };
  if (tracer?.isEnabled()) result.trace = tracer.format();
  return result;
}

// Local re-import so this file remains independent.
import { AuditLogger as _AL } from './audit';
function hashFor(input: string): string { return _AL.hashPrompt(input); }
