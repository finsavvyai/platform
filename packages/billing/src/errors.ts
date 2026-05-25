/**
 * Domain errors for @finsavvyai/billing.
 * Stable `code` strings are part of the public contract; do not rename.
 */

export class BillingError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "BillingError";
    this.code = code;
  }
}

export class WebhookSignatureError extends BillingError {
  constructor(message = "Invalid webhook signature") {
    super("billing.webhook.signature_invalid", message);
    this.name = "WebhookSignatureError";
  }
}

export class WebhookEventNotAllowedError extends BillingError {
  constructor(event: string) {
    super(
      "billing.webhook.event_not_allowed",
      `Webhook event not allowed: ${event}`,
    );
    this.name = "WebhookEventNotAllowedError";
  }
}

export class WebhookReplayError extends BillingError {
  constructor(message = "Webhook timestamp outside replay window") {
    super("billing.webhook.replay", message);
    this.name = "WebhookReplayError";
  }
}

export class BillingEntitlementMissingError extends BillingError {
  constructor(customerId: string, key: string) {
    super(
      "billing.entitlement.missing",
      `No active entitlement '${key}' for customer ${customerId}`,
    );
    this.name = "BillingEntitlementMissingError";
  }
}

export class InvoiceTotalsMismatchError extends BillingError {
  constructor(message = "Invoice declared total does not match computed total") {
    super("billing.invoice.totals_mismatch", message);
    this.name = "InvoiceTotalsMismatchError";
  }
}

export class InvoiceLineItemInvalidError extends BillingError {
  constructor(reason: string) {
    super("billing.invoice.line_item_invalid", `Invalid line item: ${reason}`);
    this.name = "InvoiceLineItemInvalidError";
  }
}

export class CurrencyMismatchError extends BillingError {
  constructor(a: string, b: string) {
    super(
      "billing.money.currency_mismatch",
      `Currency mismatch: ${a} vs ${b}`,
    );
    this.name = "CurrencyMismatchError";
  }
}

export class IdempotencyKeyRequiredError extends BillingError {
  constructor(operation: string) {
    super(
      "billing.orchestration.idempotency_key_required",
      `Idempotency key required for ${operation}`,
    );
    this.name = "IdempotencyKeyRequiredError";
  }
}

export class ProviderError extends BillingError {
  readonly providerCode: string | undefined;
  constructor(
    provider: string,
    reason: string,
    providerCode?: string,
  ) {
    super("billing.provider.error", `[${provider}] ${reason}`);
    this.name = "ProviderError";
    this.providerCode = providerCode;
  }
}
