/**
 * FallbackInferenceProvider — sequential failover across providers.
 *
 * Wraps N InferenceProviders. Calls them in order. First success wins.
 * If all fail, throws InferenceExhaustedError carrying the per-provider
 * error list so audit/telemetry can attribute the failure mode.
 *
 * Typical wiring:
 *   new FallbackInferenceProvider({
 *     providers: [clusterProvider, cloudProvider],
 *     onAttemptError: (e) => telemetry.warn(e),
 *   })
 *
 * Critical path (per portfolio rule): every code path covered.
 */

import {
  type CompletionRequest,
  type CompletionResponse,
  InferenceError,
  InferenceExhaustedError,
  type InferenceProvider,
} from "./types.js";

export interface FallbackProviderConfig {
  readonly providers: readonly InferenceProvider[];
  /** Provider id surfaced in telemetry. Default "fallback". */
  readonly providerId?: string;
  /**
   * Observer for each non-final failure. Sync only; do not block the
   * next attempt on user telemetry. Errors thrown here are swallowed.
   */
  readonly onAttemptError?: (err: InferenceError) => void;
}

export class FallbackInferenceProvider implements InferenceProvider {
  public readonly id: string;
  private readonly providers: readonly InferenceProvider[];
  private readonly onAttemptError?: (err: InferenceError) => void;

  constructor(cfg: FallbackProviderConfig) {
    if (!cfg.providers || cfg.providers.length === 0) {
      throw new Error("FallbackInferenceProvider requires at least one provider");
    }
    this.providers = cfg.providers;
    this.id = cfg.providerId ?? "fallback";
    if (cfg.onAttemptError !== undefined) {
      this.onAttemptError = cfg.onAttemptError;
    }
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const failures: InferenceError[] = [];
    for (const provider of this.providers) {
      try {
        return await provider.complete(req);
      } catch (err) {
        const wrapped = toInferenceError(provider.id, err);
        failures.push(wrapped);
        this.notify(wrapped);
      }
    }
    throw new InferenceExhaustedError(failures);
  }

  private notify(err: InferenceError): void {
    if (!this.onAttemptError) return;
    try {
      this.onAttemptError(err);
    } catch {
      // observer errors must never break the fallback chain
    }
  }
}

function toInferenceError(providerId: string, err: unknown): InferenceError {
  if (err instanceof InferenceError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  return new InferenceError(providerId, msg, err);
}
