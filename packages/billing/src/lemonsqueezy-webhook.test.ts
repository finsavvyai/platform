import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  WebhookEventNotAllowedError,
  WebhookSignatureError,
} from "./errors.js";
import {
  verifyLemonSqueezyWebhook,
  type VerifyOptions,
} from "./lemonsqueezy-webhook.js";

const SECRET = "test_secret_value_do_not_use_in_prod";
const ALLOWED = ["subscription_created", "subscription_updated"] as const;

function sign(body: Buffer, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function bodyOf(obj: unknown): Buffer {
  return Buffer.from(JSON.stringify(obj), "utf8");
}

const baseOpts = (
  overrides: Partial<VerifyOptions> = {},
): VerifyOptions => ({
  secret: SECRET,
  allowedEvents: ALLOWED,
  ...overrides,
});

describe("verifyLemonSqueezyWebhook — signature + event", () => {
  it("accepts valid signature + allowed event", () => {
    const body = bodyOf({ meta: { event_name: "subscription_created" } });
    const result = verifyLemonSqueezyWebhook(
      body,
      {
        "x-signature": sign(body),
        "x-event-name": "subscription_created",
      },
      baseOpts(),
    );
    expect(result.event).toBe("subscription_created");
    expect(result.payload).toMatchObject({
      meta: { event_name: "subscription_created" },
    });
  });

  it("rejects when secret is empty", () => {
    const body = bodyOf({ ok: true });
    expect(() =>
      verifyLemonSqueezyWebhook(
        body,
        { "x-signature": sign(body), "x-event-name": "subscription_created" },
        baseOpts({ secret: "" }),
      ),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects missing X-Signature header", () => {
    const body = bodyOf({ ok: true });
    expect(() =>
      verifyLemonSqueezyWebhook(
        body,
        { "x-event-name": "subscription_created" },
        baseOpts(),
      ),
    ).toThrow(/Missing X-Signature/);
  });

  it("rejects malformed signature (non-hex)", () => {
    const body = bodyOf({ ok: true });
    expect(() =>
      verifyLemonSqueezyWebhook(
        body,
        { "x-signature": "zzzznothex", "x-event-name": "subscription_created" },
        baseOpts(),
      ),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects wrong signature (right length, wrong value)", () => {
    const body = bodyOf({ ok: true });
    const bad = sign(body, "wrong_secret");
    expect(() =>
      verifyLemonSqueezyWebhook(
        body,
        { "x-signature": bad, "x-event-name": "subscription_created" },
        baseOpts(),
      ),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects signature with odd hex length", () => {
    const body = bodyOf({ ok: true });
    expect(() =>
      verifyLemonSqueezyWebhook(
        body,
        { "x-signature": "abc", "x-event-name": "subscription_created" },
        baseOpts(),
      ),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects signature with valid hex but wrong byte length", () => {
    const body = bodyOf({ ok: true });
    // 32 hex chars = 16 bytes, but SHA-256 is 32 bytes / 64 hex chars.
    expect(() =>
      verifyLemonSqueezyWebhook(
        body,
        {
          "x-signature": "deadbeefdeadbeefdeadbeefdeadbeef",
          "x-event-name": "subscription_created",
        },
        baseOpts(),
      ),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects when event header missing", () => {
    const body = bodyOf({ ok: true });
    expect(() =>
      verifyLemonSqueezyWebhook(
        body,
        { "x-signature": sign(body) },
        baseOpts(),
      ),
    ).toThrow(WebhookEventNotAllowedError);
  });

  it("rejects event not in allowlist", () => {
    const body = bodyOf({ ok: true });
    expect(() =>
      verifyLemonSqueezyWebhook(
        body,
        {
          "x-signature": sign(body),
          "x-event-name": "order_refunded",
        },
        baseOpts(),
      ),
    ).toThrow(/order_refunded/);
  });

  it("accepts any event when allowlist is empty (explicit opt-in)", () => {
    const body = bodyOf({ ok: true });
    const res = verifyLemonSqueezyWebhook(
      body,
      {
        "x-signature": sign(body),
        "x-event-name": "anything_goes",
      },
      baseOpts({ allowedEvents: [] }),
    );
    expect(res.event).toBe("anything_goes");
  });

  it("is case-insensitive on header names", () => {
    const body = bodyOf({ ok: true });
    const res = verifyLemonSqueezyWebhook(
      body,
      {
        "X-Signature": sign(body),
        "X-Event-Name": "subscription_created",
      },
      baseOpts(),
    );
    expect(res.event).toBe("subscription_created");
  });

  it("rejects malformed JSON body even with valid signature", () => {
    const body = Buffer.from("not-json{", "utf8");
    expect(() =>
      verifyLemonSqueezyWebhook(
        body,
        {
          "x-signature": sign(body),
          "x-event-name": "subscription_created",
        },
        baseOpts(),
      ),
    ).toThrow(/Malformed JSON/);
  });
});
