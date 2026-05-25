import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { WebhookReplayError } from "../../errors.js";
import { verifyStripeWebhook, type WebhookHeaders } from "./webhook.js";

const SECRET = "whsec_test_secret";

function sign(body: Buffer, timestamp: number): string {
  const signed = Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), body]);
  return createHmac("sha256", SECRET).update(signed).digest("hex");
}

function header(body: Buffer, timestamp: number): WebhookHeaders {
  return { "stripe-signature": `t=${timestamp},v1=${sign(body, timestamp)}` };
}

describe("verifyStripeWebhook — replay tolerance", () => {
  const body = Buffer.from(JSON.stringify({ type: "invoice.paid" }));

  it("accepts within default 300s tolerance", () => {
    const ts = 1_700_000_000;
    const res = verifyStripeWebhook(body, header(body, ts), {
      secret: SECRET,
      allowedEvents: [],
      now: () => ts + 100,
    });
    expect(res.event).toBe("invoice.paid");
  });

  it("rejects when older than default 300s", () => {
    const ts = 1_700_000_000;
    expect(() =>
      verifyStripeWebhook(body, header(body, ts), {
        secret: SECRET,
        allowedEvents: [],
        now: () => ts + 301,
      }),
    ).toThrow(WebhookReplayError);
  });

  it("respects custom toleranceSeconds", () => {
    const ts = 1_700_000_000;
    const res = verifyStripeWebhook(body, header(body, ts), {
      secret: SECRET,
      allowedEvents: [],
      toleranceSeconds: 600,
      now: () => ts + 500,
    });
    expect(res.event).toBe("invoice.paid");
  });

  it("rejects far-future timestamp beyond tolerance", () => {
    const ts = 1_700_000_000;
    expect(() =>
      verifyStripeWebhook(body, header(body, ts), {
        secret: SECRET,
        allowedEvents: [],
        toleranceSeconds: 60,
        now: () => ts - 1000,
      }),
    ).toThrow(WebhookReplayError);
  });

  it("uses default clock when none injected", () => {
    const ts = Math.floor(Date.now() / 1000);
    const res = verifyStripeWebhook(body, header(body, ts), {
      secret: SECRET,
      allowedEvents: [],
    });
    expect(res.event).toBe("invoice.paid");
  });
});
