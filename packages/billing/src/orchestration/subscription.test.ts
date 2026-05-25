import { describe, expect, it, vi } from "vitest";
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
import type { CustomerId, PlanId, SubscriptionId } from "../types.js";
import { cancelSubscription, createSubscription } from "./subscription.js";

function makeGateway(over: Partial<PaymentGateway> = {}): PaymentGateway {
  return {
    name: "lemonsqueezy",
    charge: vi.fn(),
    refund: vi.fn(),
    createSubscription: vi.fn(
      async (req: SubscriptionCreateRequest): Promise<SubscriptionCreateResult> => ({
        provider: "lemonsqueezy",
        providerSubscriptionId: "sub_1",
        status: req.trialDays && req.trialDays > 0 ? "trialing" : "active",
      }),
    ),
    cancelSubscription: vi.fn(
      async (req: SubscriptionCancelRequest): Promise<SubscriptionCancelResult> => ({
        provider: "lemonsqueezy",
        providerSubscriptionId: req.subscriptionId,
        canceledAt: 1_700_000_000,
        effectiveAt: req.atPeriodEnd ? 1_702_000_000 : 1_700_000_000,
      }),
    ),
    ...over,
  };
}

const createReq: SubscriptionCreateRequest = {
  idempotencyKey: "idem_sub_create_1",
  customerId: "cust_1" as CustomerId,
  planId: "pro" as PlanId,
};

const cancelReq: SubscriptionCancelRequest = {
  idempotencyKey: "idem_sub_cancel_1",
  subscriptionId: "sub_1" as SubscriptionId,
  atPeriodEnd: true,
};

describe("orchestration.createSubscription", () => {
  it("delegates and returns result", async () => {
    const gateway = makeGateway();
    const res = await createSubscription(createReq, { gateway });
    expect(res.providerSubscriptionId).toBe("sub_1");
    expect(res.status).toBe("active");
  });

  it("forwards trialDays", async () => {
    const gateway = makeGateway();
    const res = await createSubscription(
      { ...createReq, trialDays: 14 },
      { gateway },
    );
    expect(res.status).toBe("trialing");
  });

  it("rejects missing idempotency key", async () => {
    const gateway = makeGateway();
    await expect(
      createSubscription({ ...createReq, idempotencyKey: "" }, { gateway }),
    ).rejects.toThrow(IdempotencyKeyRequiredError);
  });

  it("rejects negative trialDays", async () => {
    const gateway = makeGateway();
    await expect(
      createSubscription({ ...createReq, trialDays: -1 }, { gateway }),
    ).rejects.toThrow(ProviderError);
  });

  it("wraps unknown errors", async () => {
    const gateway = makeGateway({
      createSubscription: vi.fn(async () => {
        throw new Error("plan not found");
      }),
    });
    await expect(createSubscription(createReq, { gateway })).rejects.toMatchObject(
      { code: "billing.provider.error" },
    );
  });

  it("wraps non-Error throwables", async () => {
    const gateway = makeGateway({
      createSubscription: vi.fn(async () => {
        throw "explosion";
      }),
    });
    await expect(createSubscription(createReq, { gateway })).rejects.toThrow(
      ProviderError,
    );
  });

  it("passes through ProviderError", async () => {
    const existing = new ProviderError("lemonsqueezy", "duplicate");
    const gateway = makeGateway({
      createSubscription: vi.fn(async () => {
        throw existing;
      }),
    });
    await expect(createSubscription(createReq, { gateway })).rejects.toBe(existing);
  });
});

describe("orchestration.cancelSubscription", () => {
  it("delegates and returns result", async () => {
    const gateway = makeGateway();
    const res = await cancelSubscription(cancelReq, { gateway });
    expect(res.providerSubscriptionId).toBe("sub_1");
    expect(res.effectiveAt).toBe(1_702_000_000);
  });

  it("rejects missing idempotency key", async () => {
    const gateway = makeGateway();
    await expect(
      cancelSubscription({ ...cancelReq, idempotencyKey: "" }, { gateway }),
    ).rejects.toThrow(IdempotencyKeyRequiredError);
  });

  it("wraps unknown errors", async () => {
    const gateway = makeGateway({
      cancelSubscription: vi.fn(async () => {
        throw new Error("not found");
      }),
    });
    await expect(cancelSubscription(cancelReq, { gateway })).rejects.toMatchObject(
      { code: "billing.provider.error" },
    );
  });

  it("wraps non-Error throwables", async () => {
    const gateway = makeGateway({
      cancelSubscription: vi.fn(async () => {
        throw null;
      }),
    });
    await expect(cancelSubscription(cancelReq, { gateway })).rejects.toThrow(
      ProviderError,
    );
  });

  it("passes through ProviderError", async () => {
    const existing = new ProviderError("lemonsqueezy", "already canceled");
    const gateway = makeGateway({
      cancelSubscription: vi.fn(async () => {
        throw existing;
      }),
    });
    await expect(cancelSubscription(cancelReq, { gateway })).rejects.toBe(existing);
  });
});
