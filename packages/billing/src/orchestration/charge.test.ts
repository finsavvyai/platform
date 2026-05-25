import { describe, expect, it, vi } from "vitest";
import {
  IdempotencyKeyRequiredError,
  ProviderError,
} from "../errors.js";
import type {
  ChargeRequest,
  ChargeResult,
  PaymentGateway,
} from "../providers/types.js";
import type { CustomerId } from "../types.js";
import { charge } from "./charge.js";

function makeGateway(over: Partial<PaymentGateway> = {}): PaymentGateway {
  return {
    name: "stripe",
    charge: vi.fn(async (req: ChargeRequest): Promise<ChargeResult> => ({
      provider: "stripe",
      providerChargeId: "ch_1",
      status: "succeeded",
      amount: req.amount,
    })),
    refund: vi.fn(),
    createSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    ...over,
  };
}

const baseReq: ChargeRequest = {
  idempotencyKey: "idem_charge_1",
  customerId: "cust_1" as CustomerId,
  amount: { amountMinor: 2900, currency: "USD" },
};

describe("orchestration.charge", () => {
  it("delegates to the gateway and returns its result", async () => {
    const gateway = makeGateway();
    const res = await charge(baseReq, { gateway });
    expect(res.providerChargeId).toBe("ch_1");
    expect(gateway.charge).toHaveBeenCalledWith(baseReq);
  });

  it("rejects missing idempotency key", async () => {
    const gateway = makeGateway();
    await expect(
      charge({ ...baseReq, idempotencyKey: "" }, { gateway }),
    ).rejects.toThrow(IdempotencyKeyRequiredError);
    expect(gateway.charge).not.toHaveBeenCalled();
  });

  it("rejects negative amount", async () => {
    const gateway = makeGateway();
    await expect(
      charge(
        { ...baseReq, amount: { amountMinor: -1, currency: "USD" } },
        { gateway },
      ),
    ).rejects.toThrow(ProviderError);
    expect(gateway.charge).not.toHaveBeenCalled();
  });

  it("wraps unknown errors as ProviderError", async () => {
    const gateway = makeGateway({
      charge: vi.fn(async () => {
        throw new Error("network down");
      }),
    });
    await expect(charge(baseReq, { gateway })).rejects.toMatchObject({
      code: "billing.provider.error",
      message: expect.stringContaining("network down"),
    });
  });

  it("wraps non-Error throwables", async () => {
    const gateway = makeGateway({
      charge: vi.fn(async () => {
        throw "boom";
      }),
    });
    await expect(charge(baseReq, { gateway })).rejects.toThrow(ProviderError);
  });

  it("passes through existing ProviderError unwrapped", async () => {
    const existing = new ProviderError("stripe", "card declined", "card_declined");
    const gateway = makeGateway({
      charge: vi.fn(async () => {
        throw existing;
      }),
    });
    await expect(charge(baseReq, { gateway })).rejects.toBe(existing);
  });
});
