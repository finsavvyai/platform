/**
 * ClusterInferenceProvider — Brain's HTTP client for FinSavvy Cluster.
 *
 * Speaks OpenAI Chat Completions wire format against
 * `<clusterUrl>/v1/chat/completions`. Authenticates with a short-lived
 * JWT minted by the injected JwtSigner. Retries idempotent transport
 * failures per the ai-gateway pattern. No streaming in v0.1.
 *
 * Cross-agent contract honored: mesh §2 (cluster bridge). Does NOT
 * import products/finsavvy-cluster/* and does NOT import @finsavvyai/*.
 */

import {
  backoffMs,
  fromOpenAiBody,
  isAbort,
  isRetryable,
  joinUrl,
  safeText,
  toOpenAiBody,
} from "./http-internal.js";
import {
  type CompletionRequest,
  type CompletionResponse,
  type InferenceProvider,
  InferenceProviderError,
  InferenceTransportError,
  type JwtSigner,
} from "./types.js";

export interface ClusterProviderConfig {
  readonly clusterUrl: string;
  readonly signer: JwtSigner;
  /** Default per-call timeout (ms). Caller can override via request. */
  readonly defaultTimeoutMs?: number;
  /** Max retry attempts including the first call. Default 3. */
  readonly maxAttempts?: number;
  /** Decorrelated jitter base in ms. Default 50. */
  readonly retryBaseMs?: number;
  /** Decorrelated jitter cap in ms. Default 2000. */
  readonly retryCapMs?: number;
  /** Provider id surfaced in telemetry. Default "cluster". */
  readonly providerId?: string;
  /** JWT TTL in seconds. Default 60. Hard cap 300. */
  readonly jwtTtlSeconds?: number;
  // -------- test seams (no defaults injected outside tests) --------
  readonly fetchImpl?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly jitter?: () => number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BASE_MS = 50;
const DEFAULT_CAP_MS = 2_000;
const DEFAULT_JWT_TTL = 60;
const MAX_JWT_TTL = 300;

export class ClusterInferenceProvider implements InferenceProvider {
  public readonly id: string;
  private readonly cfg: ClusterProviderConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly jitter: () => number;

  constructor(cfg: ClusterProviderConfig) {
    if (!cfg.clusterUrl) throw new Error("clusterUrl required");
    if (!cfg.signer) throw new Error("signer required");
    const ttl = cfg.jwtTtlSeconds ?? DEFAULT_JWT_TTL;
    if (ttl <= 0 || ttl > MAX_JWT_TTL) {
      throw new Error(`jwtTtlSeconds must be in (0, ${MAX_JWT_TTL}]`);
    }
    this.cfg = cfg;
    this.id = cfg.providerId ?? "cluster";
    this.fetchImpl = cfg.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.sleep = cfg.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.jitter = cfg.jitter ?? Math.random;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    if (!req.tenantId) {
      throw new InferenceProviderError(this.id, 400, "tenantId required");
    }
    const max = this.cfg.maxAttempts ?? DEFAULT_ATTEMPTS;
    const base = this.cfg.retryBaseMs ?? DEFAULT_BASE_MS;
    const cap = this.cfg.retryCapMs ?? DEFAULT_CAP_MS;
    if (max < 1) throw new Error("maxAttempts must be >= 1");

    // callOnce contract: only ever throws InferenceProviderError (4xx,
    // non-retryable) or InferenceTransportError (5xx/408/429/timeout/
    // network, retryable). isRetryable encodes that policy.
    let lastErr!: InferenceTransportError;
    for (let attempt = 1; attempt <= max; attempt++) {
      try {
        return await this.callOnce(req);
      } catch (err) {
        if (!isRetryable(err)) throw err;
        lastErr = err as InferenceTransportError;
        if (attempt >= max) break;
        await this.sleep(backoffMs(attempt, base, cap, this.jitter));
      }
    }
    throw lastErr;
  }

  private async callOnce(req: CompletionRequest): Promise<CompletionResponse> {
    const token = await this.cfg.signer.sign({
      sub: req.tenantId,
      aud: "cluster",
      scope: "inference:complete",
      ttlSeconds: this.cfg.jwtTtlSeconds ?? DEFAULT_JWT_TTL,
    });
    const timeoutMs =
      req.timeoutMs ?? this.cfg.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const url = joinUrl(this.cfg.clusterUrl, "/v1/chat/completions");
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify(toOpenAiBody(req)),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const text = await safeText(res);
        if (res.status >= 500 || res.status === 408 || res.status === 429) {
          throw new InferenceTransportError(
            this.id,
            `cluster ${res.status}: ${text}`,
            res.status,
          );
        }
        throw new InferenceProviderError(
          this.id,
          res.status,
          `cluster ${res.status}: ${text}`,
        );
      }
      const json = (await res.json()) as Record<string, unknown>;
      return fromOpenAiBody(this.id, req.model, json);
    } catch (err) {
      if (err instanceof InferenceProviderError) throw err;
      if (err instanceof InferenceTransportError) throw err;
      if (isAbort(err)) {
        throw new InferenceTransportError(
          this.id,
          "cluster request timed out",
          undefined,
          err,
        );
      }
      throw new InferenceTransportError(
        this.id,
        "cluster fetch failed",
        undefined,
        err,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
