import { describe, expect, it, vi } from "vitest";
import {
  IdempotencyKeyRequiredError,
  ProviderError,
} from "../errors.js";
import type {
  PaymentGateway,
  RefundRequest,
  RefundResult,
} from "../providers/types.js";
import { refund } from "./refund.js";

function makeGateway(over: Partial<PaymentGateway> = {}): PaymentGateway {
  return {
    name: "stripe",
    charge: vi.fn(),
    refund: vi.fn(async (req: RefundRequest): Promise<RefundResult> => ({
      provider: "stripe",
      providerRefundId: "rf_1",
      status: "succeeded",
      amount: req.amount,
    })),
    createSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    ...over,
  };
}

const baseReq: RefundRequest = {
  idempotencyKey: "idem_refund_1",
  providerChargeId: "ch_1",
  amount: { amountMinor: 1000, currency: "USD" },
  reason: "requested_by_customer",
};

describe("orchestration.refund", () => {
  it("delegates to gateway and returns result", async () => {
    const gateway = makeGateway();
    const res = await refund(baseReq, { gateway });
    expect(res.providerRefundId).toBe("rf_1");
    expect(gateway.refund).toHaveBeenCalledWith(baseReq);
  });

  it("rejects missing idempotency key", async () => {
    const gateway = makeGateway();
    await expect(
      refund({ ...baseReq, idempotencyKey: "" }, { gateway }),
    ).rejects.toThrow(IdempotencyKeyRequiredError);
    expect(gateway.refund).not.toHaveBeenCalled();
  });

  it("rejects non-positive amount", async () => {
    const gateway = makeGateway();
    await expect(
      refund(
        { ...baseReq, amount: { amountMinor: 0, currency: "USD" } },
        { gateway },
      ),
    ).rejects.toThrow(ProviderError);
  });

  it("wraps gateway errors as ProviderError", async () => {
    const gateway = makeGateway({
      refund: vi.fn(async () => {
        throw new Error("rate limited");
      }),
    });
    await expect(refund(baseReq, { gateway })).rejects.toMatchObject({
      code: "billing.provider.error",
    });
  });

  it("wraps non-Error throwables", async () => {
    const gateway = makeGateway({
      refund: vi.fn(async () => {
        throw 42;
      }),
    });
    await expect(refund(baseReq, { gateway })).rejects.toThrow(ProviderError);
  });

  it("passes through existing ProviderError", async () => {
    const existing = new ProviderError("stripe", "already refunded");
    const gateway = makeGateway({
      refund: vi.fn(async () => {
        throw existing;
      }),
    });
    await expect(refund(baseReq, { gateway })).rejects.toBe(existing);
  });
});
