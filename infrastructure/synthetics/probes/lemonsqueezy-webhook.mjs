// lemonsqueezy-webhook probe — POST a synthetic LS webhook with a valid signature.
// Expects 200 + X-Audit-Correlation-Id echo.

import { randomUUID } from "node:crypto";
import {
  assert,
  fetchWithTimeout,
  now,
  result,
  signLemonSqueezyPayload,
} from "./_lib.mjs";

export const name = "lemonsqueezy-webhook";

function buildEvent(correlationId) {
  return {
    meta: {
      event_name: "order_created",
      custom_data: { synthetic: "true", correlation_id: correlationId },
    },
    data: {
      type: "orders",
      id: `synth_${correlationId}`,
      attributes: {
        store_id: 0,
        identifier: correlationId,
        status: "paid",
        total: 0,
        currency: "USD",
      },
    },
  };
}

export async function run({
  baseUrl,
  lemonSqueezyWebhookSecret,
  timeoutMs = 10_000,
}) {
  const start = now();
  try {
    assert(baseUrl, "baseUrl required");
    assert(
      lemonSqueezyWebhookSecret,
      "LEMONSQUEEZY_WEBHOOK_TEST_SECRET required",
    );
    const correlationId = randomUUID();
    const event = buildEvent(correlationId);
    const signed = signLemonSqueezyPayload(event, lemonSqueezyWebhookSecret);
    const res = await fetchWithTimeout(
      `${baseUrl}/v1/billing/webhooks/lemonsqueezy`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature": signed.header,
          "x-event-name": "order_created",
          "x-synthetic-probe": name,
          "x-correlation-id": correlationId,
        },
        body: signed.rawBody,
      },
      timeoutMs,
    );
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const echo = res.headers.get("x-audit-correlation-id");
    assert(
      echo === correlationId,
      `audit correlation header missing/mismatch (got '${echo}')`,
    );
    return result(name, true, start);
  } catch (err) {
    return result(name, false, start, err?.message ?? String(err));
  }
}
