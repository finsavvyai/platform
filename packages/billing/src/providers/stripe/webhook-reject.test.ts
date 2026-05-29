import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { WebhookSignatureError } from "../../errors.js";
import { verifyStripeWebhook, type WebhookHeaders } from "./webhook.js";

const SECRET = "whsec_test_secret";

function sign(body: Buffer, timestamp: number, secret = SECRET): string {
  const signed = Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), body]);
  return createHmac("sha256", secret).update(signed).digest("hex");
}

function header(body: Buffer, timestamp: number): WebhookHeaders {
  return { "stripe-signature": `t=${timestamp},v1=${sign(body, timestamp)}` };
}

describe("verifyStripeWebhook — reject paths", () => {
  const now = () => 1_700_000_000;
  const body = Buffer.from(
    JSON.stringify({ type: "invoice.paid", id: "evt_1" }),
  );

  it("rejects empty secret", () => {
    expect(() =>
      verifyStripeWebhook(body, header(body, now()), {
        secret: "",
        allowedEvents: [],
        now,
      }),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects missing Stripe-Signature header", () => {
    expect(() =>
      verifyStripeWebhook(body, {}, {
        secret: SECRET,
        allowedEvents: [],
        now,
      }),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects malformed timestamp", () => {
    expect(() =>
      verifyStripeWebhook(
        body,
        { "stripe-signature": "t=abc,v1=" + "0".repeat(64) },
        { secret: SECRET, allowedEvents: [], now },
      ),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects when no v1 present", () => {
    expect(() =>
      verifyStripeWebhook(
        body,
        { "stripe-signature": `t=${now()},v0=abc` },
        { secret: SECRET, allowedEvents: [], now },
      ),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects wrong signature", () => {
    const hdrs: WebhookHeaders = {
      "stripe-signature": `t=${now()},v1=${"0".repeat(64)}`,
    };
    expect(() =>
      verifyStripeWebhook(body, hdrs, {
        secret: SECRET,
        allowedEvents: [],
        now,
      }),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects when signed with a different secret", () => {
    const wrongSig = sign(body, now(), "different");
    const hdrs: WebhookHeaders = {
      "stripe-signature": `t=${now()},v1=${wrongSig}`,
    };
    expect(() =>
      verifyStripeWebhook(body, hdrs, {
        secret: SECRET,
        allowedEvents: [],
        now,
      }),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects malformed v1 hex", () => {
    const hdrs: WebhookHeaders = {
      "stripe-signature": `t=${now()},v1=zzzz`,
    };
    expect(() =>
      verifyStripeWebhook(body, hdrs, {
        secret: SECRET,
        allowedEvents: [],
        now,
      }),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects odd-length v1 hex (hexToBuf length%2!==0 branch)", () => {
    // "abc" is valid hex chars but odd-length => hexToBuf returns null
    // exercising the `hex.length % 2 !== 0` branch in constantTimeEqualHex.
    const hdrs: WebhookHeaders = {
      "stripe-signature": `t=${now()},v1=abc`,
    };
    expect(() =>
      verifyStripeWebhook(body, hdrs, {
        secret: SECRET,
        allowedEvents: [],
        now,
      }),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects v1 hex with valid chars but wrong byte length (ab.length!==bb.length branch)", () => {
    // "00" is a valid 1-byte hex string but expected sig is 32 bytes.
    // Both decode successfully, then the length-mismatch guard fires.
    const hdrs: WebhookHeaders = {
      "stripe-signature": `t=${now()},v1=00`,
    };
    expect(() =>
      verifyStripeWebhook(body, hdrs, {
        secret: SECRET,
        allowedEvents: [],
        now,
      }),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects when body is tampered after signing", () => {
    const tampered = Buffer.from(
      JSON.stringify({ type: "invoice.paid", id: "evt_X" }),
    );
    expect(() =>
      verifyStripeWebhook(tampered, header(body, now()), {
        secret: SECRET,
        allowedEvents: [],
        now,
      }),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects malformed JSON body", () => {
    const bad = Buffer.from("not json");
    expect(() =>
      verifyStripeWebhook(bad, header(bad, now()), {
        secret: SECRET,
        allowedEvents: [],
        now,
      }),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects payload missing 'type'", () => {
    const noType = Buffer.from(JSON.stringify({ id: "evt_1" }));
    expect(() =>
      verifyStripeWebhook(noType, header(noType, now()), {
        secret: SECRET,
        allowedEvents: [],
        now,
      }),
    ).toThrow(WebhookSignatureError);
  });
});
