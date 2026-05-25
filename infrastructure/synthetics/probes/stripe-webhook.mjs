// stripe-webhook probe — POST a synthetic Stripe webhook with a valid signature.
// Expects 200 and an X-Audit-Correlation-Id response header echoing our probe id
// (used by ALERTING to confirm the audit record was emitted).

import { randomUUID } from "node:crypto";
import {
  assert,
  fetchWithTimeout,
  now,
  result,
  signStripePayload,
} from "./_lib.mjs";

export const name = "stripe-webhook";

function buildEvent(correlationId) {
  return {
    id: `evt_synth_${correlationId}`,
    type: "invoice.paid",
    created: Math.floor(now() / 1000),
    livemode: false,
    data: {
      object: {
        id: `in_synth_${correlationId}`,
        object: "invoice",
        amount_paid: 0,
        currency: "usd",
        metadata: { synthetic: "true", probe: name },
      },
    },
  };
}

export async function run({
  baseUrl,
  stripeWebhookSecret,
  timeoutMs = 10_000,
}) {
  const start = now();
  try {
    assert(baseUrl, "baseUrl required");
    assert(
      stripeWebhookSecret,
      "STRIPE_WEBHOOK_TEST_SECRET required",
    );
    const correlationId = randomUUID();
    const event = buildEvent(correlationId);
    const signed = signStripePayload(event, stripeWebhookSecret);
    const res = await fetchWithTimeout(
      `${baseUrl}/v1/billing/webhooks/stripe`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": signed.header,
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
