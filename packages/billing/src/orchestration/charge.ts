import {
  IdempotencyKeyRequiredError,
  ProviderError,
} from "../errors.js";
import type {
  ChargeRequest,
  ChargeResult,
  PaymentGateway,
} from "../providers/types.js";

/**
 * Provider-agnostic charge flow.
 *
 * Wraps an injected `PaymentGateway`. Enforces idempotency-key presence
 * and re-shapes provider errors into stable `ProviderError`s so callers
 * don't need to catch provider-specific exception types.
 */

export type ChargeOptions = {
  readonly gateway: PaymentGateway;
};

export async function charge(
  req: ChargeRequest,
  opts: ChargeOptions,
): Promise<ChargeResult> {
  if (!req.idempotencyKey || req.idempotencyKey.length === 0) {
    throw new IdempotencyKeyRequiredError("charge");
  }
  if (req.amount.amountMinor < 0) {
    throw new ProviderError(
      opts.gateway.name,
      "charge amount must be non-negative",
    );
  }
  try {
    return await opts.gateway.charge(req);
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new ProviderError(opts.gateway.name, message);
  }
}
