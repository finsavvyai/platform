import { describe, expect, it } from "vitest";
import {
  assertVerifiedLemonSqueezyWebhook,
  createLemonSqueezySignature,
  verifyLemonSqueezyWebhookSignature,
} from "./lemonsqueezy.js";

describe("LemonSqueezy webhook signatures", () => {
  const secret = "ls_whsec_test";
  const rawBody =
    '{"meta":{"event_name":"subscription_created"},"data":{"id":"123"}}';

  it("creates the provider-compatible HMAC-SHA256 hex digest", async () => {
    await expect(createLemonSqueezySignature(secret, rawBody)).resolves.toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it("verifies the raw body against the X-Signature value", async () => {
    const signature = await createLemonSqueezySignature(secret, rawBody);

    await expect(
      verifyLemonSqueezyWebhookSignature({ rawBody, secret, signature }),
    ).resolves.toBe(true);
  });

  it("rejects missing and mismatched signatures", async () => {
    await expect(
      verifyLemonSqueezyWebhookSignature({
        rawBody,
        secret,
        signature: null,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyLemonSqueezyWebhookSignature({
        rawBody: `${rawBody}\n`,
        secret,
        signature: await createLemonSqueezySignature(secret, rawBody),
      }),
    ).resolves.toBe(false);
  });

  it("throws before mutation when verification fails", async () => {
    await expect(
      assertVerifiedLemonSqueezyWebhook({
        rawBody,
        secret,
        signature: "bad",
      }),
    ).rejects.toThrow("Invalid LemonSqueezy webhook signature");
  });
});
