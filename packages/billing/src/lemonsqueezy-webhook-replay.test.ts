import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { WebhookReplayError } from "./errors.js";
import {
  verifyLemonSqueezyWebhook,
  type VerifyOptions,
} from "./lemonsqueezy-webhook.js";

const SECRET = "test_secret_value_do_not_use_in_prod";
const ALLOWED = ["subscription_created", "subscription_updated"] as const;
const sign = (body: Buffer) =>
  createHmac("sha256", SECRET).update(body).digest("hex");
const bodyOf = (obj: unknown) => Buffer.from(JSON.stringify(obj), "utf8");
const baseOpts = (o: Partial<VerifyOptions> = {}): VerifyOptions => ({
  secret: SECRET,
  allowedEvents: ALLOWED,
  ...o,
});

describe("verifyLemonSqueezyWebhook — replay protection", () => {
  it("rejects replayed timestamp outside window", () => {
    const body = bodyOf({ ok: true });
    const now = 1_700_000_000;
    expect(() =>
      verifyLemonSqueezyWebhook(
        body,
        {
          "x-signature": sign(body),
          "x-event-name": "subscription_created",
          "x-event-timestamp": String(now - 600), // 10min old
        },
        baseOpts({ replayWindowSeconds: 300, now: () => now }),
      ),
    ).toThrow(WebhookReplayError);
  });

  it("accepts timestamp inside window", () => {
    const body = bodyOf({ ok: true });
    const now = 1_700_000_000;
    const res = verifyLemonSqueezyWebhook(
      body,
      {
        "x-signature": sign(body),
        "x-event-name": "subscription_created",
        "x-event-timestamp": String(now - 60),
      },
      baseOpts({ replayWindowSeconds: 300, now: () => now }),
    );
    expect(res.event).toBe("subscription_created");
  });

  it("rejects missing timestamp when replay window enabled", () => {
    const body = bodyOf({ ok: true });
    expect(() =>
      verifyLemonSqueezyWebhook(
        body,
        {
          "x-signature": sign(body),
          "x-event-name": "subscription_created",
        },
        baseOpts({ replayWindowSeconds: 300, now: () => 1_700_000_000 }),
      ),
    ).toThrow(/Missing X-Event-Timestamp/);
  });

  it("rejects malformed timestamp", () => {
    const body = bodyOf({ ok: true });
    expect(() =>
      verifyLemonSqueezyWebhook(
        body,
        {
          "x-signature": sign(body),
          "x-event-name": "subscription_created",
          "x-event-timestamp": "not-a-number",
        },
        baseOpts({ replayWindowSeconds: 300, now: () => 1_700_000_000 }),
      ),
    ).toThrow(/Malformed X-Event-Timestamp/);
  });

  it("uses default now() when replay window set without injected clock", () => {
    const body = bodyOf({ ok: true });
    const tsNow = Math.floor(Date.now() / 1000);
    const res = verifyLemonSqueezyWebhook(
      body,
      {
        "x-signature": sign(body),
        "x-event-name": "subscription_created",
        "x-event-timestamp": String(tsNow),
      },
      baseOpts({ replayWindowSeconds: 60 }),
    );
    expect(res.event).toBe("subscription_created");
  });
});
