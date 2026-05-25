/** ClawPipe SDK — The intelligent AI pipeline. @module clawpipe */
import { Booster } from './booster';
import { Packer } from './packer';
import { Cache } from './cache';
import { Router } from './router';
import { Gateway } from './gateway';
import { Telemetry } from './telemetry';
import { Budget } from './budget';
import { RateLimiter } from './rate-limiter';
import { CircuitBreaker } from './circuit-breaker';
import { Allowlist } from './allowlist';
import { AuditLogger } from './audit';
import { Tracer } from './tracer';
import { Guard, GuardError } from './guard';
import type { GuardRule } from './guards';
import { PipelineGuards } from './pipeline-guards';
import { SavingsClient } from './savings-client';
import { buildShare, type ShareChannel, type ShareResult } from './share';
import { initMeta, finalizeResult } from './pipeline-finalize';
import { runWithFailover } from './failover';
import type { ClawPipeConfig, PromptOptions, PipelineMeta, PipelineResult } from './types';
export * from './exports';

const DEFAULT_GATEWAY = 'https://api.clawpipe.ai/v1';

export class ClawPipe {
  private booster: Booster; private packer: Packer; private cache: Cache; private router: Router;
  private gateway: Gateway; private telemetry: Telemetry; private budget: Budget;
  private rateLimiter: RateLimiter; private circuitBreaker: CircuitBreaker;
  private allowlist: Allowlist; private audit: AuditLogger; private guard: Guard;
  private pipelineGuards = new PipelineGuards();
  private guardRules: GuardRule[];
  private savingsClient: SavingsClient;
  private apiKey: string;
  private enableGuard: boolean; private enableTrace: boolean;
  private cfg: Required<Pick<ClawPipeConfig, 'enableBooster' | 'enablePacker' | 'enableCache'>>;

  constructor(config: ClawPipeConfig) {
    const gatewayUrl = config.gatewayUrl ?? DEFAULT_GATEWAY;
    this.cfg = {
      enableBooster: config.enableBooster ?? true,
      enablePacker: config.enablePacker ?? true,
      enableCache: config.enableCache ?? true,
    };
    this.booster = new Booster();
    this.packer = new Packer();
    this.cache = new Cache(config.cacheTtlMs ?? 300_000);
    this.router = new Router();
    this.gateway = new Gateway({ gatewayUrl, apiKey: config.apiKey, projectId: config.projectId });
    this.apiKey = config.apiKey;
    this.savingsClient = new SavingsClient({ gatewayUrl, apiKey: config.apiKey, projectId: config.projectId });
    this.telemetry = new Telemetry();
    this.budget = new Budget({ capUsd: config.budgetCapUsd, warnUsd: config.budgetWarnUsd });
    this.rateLimiter = new RateLimiter({ maxRequests: config.rateLimitPerDay });
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: config.circuitBreakerThreshold, recoveryMs: config.circuitBreakerRecoveryMs,
    });
    this.allowlist = new Allowlist({ allow: config.allowlist, deny: config.denylist });
    this.audit = new AuditLogger({
      projectId: config.projectId, enabled: config.enableAudit ?? false,
      transport: config.auditTransport ?? null,
    });
    this.enableTrace = config.enableTrace ?? false;
    this.enableGuard = config.enableGuard ?? true;
    this.guardRules = config.guardRules ?? [];
    this.guard = new Guard({
      blockOnInjection: config.guardBlockOnInjection ?? false,
      injectionThreshold: config.guardInjectionThreshold,
    });
  }

  async prompt(input: string, options: PromptOptions = {}): Promise<PipelineResult> {
    this.rateLimiter.check();
    this.budget.check();
    const start = Date.now();
    const meta = initMeta();
    const tracer = new Tracer(this.enableTrace);

    let safeInput = this.runGuard(input, tracer);
    if (this.guardRules.length) {
      tracer.start('GuardRegistry');
      const r = await this.pipelineGuards.runPre(safeInput, this.guardRules, { system: options.system, model: options.model, provider: options.provider });
      tracer.end('GuardRegistry', { blocked: r.blocked });
      if (r.blocked) throw new GuardError(`guard rule failed: ${r.reason}`, { safe: false, redactedText: safeInput, originalText: input, detections: [], injectionScore: 0 });
      safeInput = r.prompt;
    }

    if (this.cfg.enableBooster) {
      tracer.start('Booster');
      const boosted = this.booster.tryResolve(safeInput);
      if (boosted !== null) {
        tracer.end('Booster', { result: 'resolved' });
        return await this.finish(boosted, { ...meta, boosted: true }, start, input, true, tracer);
      }
      tracer.end('Booster', { result: 'pass-through' });
    } else { tracer.skip('Booster', 'disabled'); }

    let packed = safeInput;
    if (this.cfg.enablePacker) {
      tracer.start('Packer');
      const result = this.packer.pack(safeInput, options.system);
      packed = result.packed;
      meta.packed = true;
      meta.contextSavings = result.savings;
      tracer.end('Packer', { savings: result.savings });
    } else { tracer.skip('Packer', 'disabled'); }

    if (this.cfg.enableCache) {
      tracer.start('Cache');
      const cached = this.cache.get(this.cache.key(packed, options));
      if (cached) {
        tracer.end('Cache', { result: 'hit' });
        return await this.finish(cached, { ...meta, cached: true }, start, input, false, tracer);
      }
      tracer.end('Cache', { result: 'miss' });
    } else { tracer.skip('Cache', 'disabled'); }

    tracer.start('Router');
    const route = await this.router.route(packed, options);
    if (!this.allowlist.isPermitted(route.provider, route.model))
      throw new Error(`Model ${route.provider}:${route.model} is not permitted by allowlist`);
    tracer.end('Router', { model: `${route.provider}:${route.model}` });
    if (!this.circuitBreaker.isAvailable(route.provider))
      throw new Error(`Provider ${route.provider} circuit is open (too many failures)`);
    meta.route = route.provider;
    meta.model = route.model;
    meta.circuitBreakerState = this.circuitBreaker.status(route.provider).state;

    tracer.start('Gateway');
    const fallbacks = this.router.fallbacks(route, packed).filter((r) => this.circuitBreaker.isAvailable(r.provider));
    try {
      const out = await runWithFailover(route, fallbacks, (r) => this.gateway.call(packed, options, r), this.router.health);
      tracer.end('Gateway', { tokensOut: out.result.tokensOut, attempts: out.attempts, usedProvider: out.usedRoute.provider });
      this.circuitBreaker.recordSuccess(out.usedRoute.provider);
      meta.tokensIn = out.result.tokensIn; meta.tokensOut = out.result.tokensOut;
      meta.route = out.usedRoute.provider; meta.model = out.usedRoute.model;
      this.router.learn(out.usedRoute, out.result.latencyMs, out.result.tokensOut);
      if (this.cfg.enableCache) this.cache.set(this.cache.key(packed, options), out.result.text);
      return await this.finish(out.result.text, meta, start, input, false, tracer);
    } catch (err) {
      tracer.end('Gateway', { error: true });
      this.circuitBreaker.recordFailure(route.provider);
      throw err;
    }
  }

  async *stream(input: string, options: PromptOptions = {}): AsyncGenerator<string> {
    this.rateLimiter.check();
    const packed = this.cfg.enablePacker ? this.packer.pack(input, options.system).packed : input;
    const route = await this.router.route(packed, options);
    this.rateLimiter.record();
    // Warm savings cache for subsequent getSavings()/shareSavings() calls.
    void this.savingsClient.get();
    yield* this.gateway.stream(packed, options, route);
  }

  /** Fetch (or reuse cached) savings snapshot from the gateway. */
  async getSavings() { return this.savingsClient.get(); }

  /** Build a prefilled share message for a given channel. */
  async shareSavings(channel: ShareChannel): Promise<ShareResult> {
    const snap = await this.savingsClient.get();
    return buildShare(channel, this.apiKey, snap?.thisMonth ?? 0);
  }

  stats() { return this.telemetry.snapshot(); }
  budgetStatus() { return this.budget.status(); }
  rateLimitStatus() { return this.rateLimiter.status(); }
  circuitStatus() { return this.circuitBreaker.allStatuses(); }
  auditLogs() { return this.audit.getLogs(); }

  private runGuard(input: string, tracer: Tracer): string {
    if (!this.enableGuard) { tracer.skip('Guard', 'disabled'); return input; }
    tracer.start('Guard');
    const r = this.guard.check(input);
    tracer.end('Guard', { safe: r.safe, score: r.injectionScore, detections: r.detections.length });
    if (r.detections.length > 0) this.audit.log({
      action: 'guard_detection', provider: '', model: '', tokensIn: 0, tokensOut: 0,
      latencyMs: 0, estimatedCostUsd: 0, cached: false, boosted: false,
      promptHash: AuditLogger.hashPrompt(input),
    });
    if (!r.safe)
      throw new GuardError(`Prompt injection detected (score=${r.injectionScore.toFixed(2)})`, r);
    return r.redactedText;
  }

  private async finish(text: string, meta: PipelineMeta, start: number, input: string, isBoosted: boolean, tracer?: Tracer) {
    const savings = await this.savingsClient.get();
    return finalizeResult(
      { telemetry: this.telemetry, budget: this.budget, rateLimiter: this.rateLimiter, audit: this.audit },
      text, meta, start, input, isBoosted, savings, tracer,
    );
  }
}
