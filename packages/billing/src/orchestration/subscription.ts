import {
  IdempotencyKeyRequiredError,
  ProviderError,
} from "../errors.js";
import type {
  PaymentGateway,
  SubscriptionCancelRequest,
  SubscriptionCancelResult,
  SubscriptionCreateRequest,
  SubscriptionCreateResult,
} from "../providers/types.js";

/**
 * Provider-agnostic subscription create / cancel flow.
 *
 * Both mutations require an idempotency key. Errors from the underlying
 * gateway surface as `ProviderError` with the provider name attached.
 */

export type SubscriptionOptions = {
  readonly gateway: PaymentGateway;
};

export async function createSubscription(
  req: SubscriptionCreateRequest,
  opts: SubscriptionOptions,
): Promise<SubscriptionCreateResult> {
  if (!req.idempotencyKey || req.idempotencyKey.length === 0) {
    throw new IdempotencyKeyRequiredError("createSubscription");
  }
  if (req.trialDays !== undefined && req.trialDays < 0) {
    throw new ProviderError(opts.gateway.name, "trialDays must be >= 0");
  }
  try {
    return await opts.gateway.createSubscription(req);
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new ProviderError(opts.gateway.name, message);
  }
}

export async function cancelSubscription(
  req: SubscriptionCancelRequest,
  opts: SubscriptionOptions,
): Promise<SubscriptionCancelResult> {
  if (!req.idempotencyKey || req.idempotencyKey.length === 0) {
    throw new IdempotencyKeyRequiredError("cancelSubscription");
  }
  try {
    return await opts.gateway.cancelSubscription(req);
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new ProviderError(opts.gateway.name, message);
  }
}
