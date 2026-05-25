import {
  IdempotencyKeyRequiredError,
  ProviderError,
} from "../errors.js";
import type {
  PaymentGateway,
  RefundRequest,
  RefundResult,
} from "../providers/types.js";

/**
 * Provider-agnostic refund flow.
 *
 * Like `charge`, this wraps an injected gateway, enforces idempotency, and
 * normalizes any thrown error into `ProviderError`.
 */

export type RefundOptions = {
  readonly gateway: PaymentGateway;
};

export async function refund(
  req: RefundRequest,
  opts: RefundOptions,
): Promise<RefundResult> {
  if (!req.idempotencyKey || req.idempotencyKey.length === 0) {
    throw new IdempotencyKeyRequiredError("refund");
  }
  if (req.amount.amountMinor <= 0) {
    throw new ProviderError(
      opts.gateway.name,
      "refund amount must be positive",
    );
  }
  try {
    return await opts.gateway.refund(req);
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new ProviderError(opts.gateway.name, message);
  }
}
