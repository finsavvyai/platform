import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { WebhookEventNotAllowedError } from "../../errors.js";
import {
  parseStripeSignatureHeader,
  verifyStripeWebhook,
  type WebhookHeaders,
} from "./webhook.js";

const SECRET = "whsec_test_secret";

function sign(body: Buffer, timestamp: number, secret = SECRET): string {
  const signed = Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), body]);
  return createHmac("sha256", secret).update(signed).digest("hex");
}

function header(body: Buffer, timestamp: number): WebhookHeaders {
  const v1 = sign(body, timestamp);
  return { "stripe-signature": `t=${timestamp},v1=${v1}` };
}

describe("parseStripeSignatureHeader", () => {
  it("parses t and multiple v1", () => {
    const out = parseStripeSignatureHeader("t=1700000000,v1=abc,v1=def,v0=old");
    expect(out.timestamp).toBe(1700000000);
    expect(out.v1).toEqual(["abc", "def"]);
  });

  it("ignores malformed entries with no '='", () => {
    const out = parseStripeSignatureHeader("t=1700000000,garbage,v1=abc");
    expect(out.timestamp).toBe(1700000000);
    expect(out.v1).toEqual(["abc"]);
  });

  it("returns NaN timestamp when missing", () => {
    const out = parseStripeSignatureHeader("v1=abc");
    expect(out.timestamp).toBeNaN();
    expect(out.v1).toEqual(["abc"]);
  });
});

describe("verifyStripeWebhook — accept paths", () => {
  const now = () => 1_700_000_000;
  const body = Buffer.from(
    JSON.stringify({ type: "invoice.paid", id: "evt_1" }),
  );

  it("accepts a valid signed payload", () => {
    const res = verifyStripeWebhook(body, header(body, now()), {
      secret: SECRET,
      allowedEvents: ["invoice.paid"],
      now,
    });
    expect(res.event).toBe("invoice.paid");
    expect(res.payload.type).toBe("invoice.paid");
    expect(res.payload.id).toBe("evt_1");
  });

  it("accepts when allowedEvents is empty (any event)", () => {
    const res = verifyStripeWebhook(body, header(body, now()), {
      secret: SECRET,
      allowedEvents: [],
      now,
    });
    expect(res.event).toBe("invoice.paid");
  });

  it("accepts when a second v1 (rotation) is the right one", () => {
    const correct = sign(body, now());
    const wrong = "0".repeat(64);
    const hdrs: WebhookHeaders = {
      "stripe-signature": `t=${now()},v1=${wrong},v1=${correct}`,
    };
    const res = verifyStripeWebhook(body, hdrs, {
      secret: SECRET,
      allowedEvents: [],
      now,
    });
    expect(res.event).toBe("invoice.paid");
  });

  it("is case-insensitive on header name", () => {
    const v1 = sign(body, now());
    const hdrs: WebhookHeaders = {
      "Stripe-Signature": `t=${now()},v1=${v1}`,
    };
    const res = verifyStripeWebhook(body, hdrs, {
      secret: SECRET,
      allowedEvents: [],
      now,
    });
    expect(res.event).toBe("invoice.paid");
  });

  it("rejects event not in allowlist", () => {
    expect(() =>
      verifyStripeWebhook(body, header(body, now()), {
        secret: SECRET,
        allowedEvents: ["charge.succeeded"],
        now,
      }),
    ).toThrow(WebhookEventNotAllowedError);
  });
});
