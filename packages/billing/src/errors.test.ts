import { describe, expect, it } from "vitest";
import {
  BillingEntitlementMissingError,
  BillingError,
  CurrencyMismatchError,
  IdempotencyKeyRequiredError,
  InvoiceLineItemInvalidError,
  InvoiceTotalsMismatchError,
  ProviderError,
  WebhookEventNotAllowedError,
  WebhookReplayError,
  WebhookSignatureError,
} from "./errors.js";

describe("billing errors carry stable codes", () => {
  it("WebhookSignatureError default + custom message", () => {
    const a = new WebhookSignatureError();
    expect(a.code).toBe("billing.webhook.signature_invalid");
    expect(a.message).toContain("Invalid");
    const b = new WebhookSignatureError("nope");
    expect(b.message).toBe("nope");
  });

  it("WebhookEventNotAllowedError includes event in message", () => {
    const err = new WebhookEventNotAllowedError("subscription_created");
    expect(err.code).toBe("billing.webhook.event_not_allowed");
    expect(err.message).toContain("subscription_created");
  });

  it("WebhookReplayError default + custom", () => {
    expect(new WebhookReplayError().code).toBe("billing.webhook.replay");
    expect(new WebhookReplayError("stale").message).toBe("stale");
  });

  it("BillingEntitlementMissingError", () => {
    const err = new BillingEntitlementMissingError("cust_1", "seats");
    expect(err.code).toBe("billing.entitlement.missing");
    expect(err.message).toContain("seats");
    expect(err.message).toContain("cust_1");
  });

  it("InvoiceTotalsMismatchError default + custom", () => {
    expect(new InvoiceTotalsMismatchError().code).toBe(
      "billing.invoice.totals_mismatch",
    );
    expect(new InvoiceTotalsMismatchError("custom").message).toBe("custom");
  });

  it("InvoiceLineItemInvalidError formats reason", () => {
    const err = new InvoiceLineItemInvalidError("empty desc");
    expect(err.code).toBe("billing.invoice.line_item_invalid");
    expect(err.message).toContain("empty desc");
  });

  it("CurrencyMismatchError lists both currencies", () => {
    const err = new CurrencyMismatchError("USD", "EUR");
    expect(err.code).toBe("billing.money.currency_mismatch");
    expect(err.message).toContain("USD");
    expect(err.message).toContain("EUR");
  });

  it("IdempotencyKeyRequiredError names the operation", () => {
    const err = new IdempotencyKeyRequiredError("charge");
    expect(err.code).toBe("billing.orchestration.idempotency_key_required");
    expect(err.message).toContain("charge");
  });

  it("ProviderError captures provider + reason + optional code", () => {
    const a = new ProviderError("stripe", "card declined", "card_declined");
    expect(a.code).toBe("billing.provider.error");
    expect(a.message).toContain("stripe");
    expect(a.providerCode).toBe("card_declined");
    const b = new ProviderError("lemonsqueezy", "bad");
    expect(b.providerCode).toBeUndefined();
  });

  it("BillingError is the common base", () => {
    expect(new WebhookSignatureError()).toBeInstanceOf(BillingError);
    expect(new ProviderError("x", "y")).toBeInstanceOf(BillingError);
    const err = new BillingError("billing.custom", "msg");
    expect(err.code).toBe("billing.custom");
    expect(err.name).toBe("BillingError");
  });
});
