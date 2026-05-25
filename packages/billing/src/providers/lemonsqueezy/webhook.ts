import { createHmac, timingSafeEqual } from "node:crypto";
import {
  WebhookEventNotAllowedError,
  WebhookReplayError,
  WebhookSignatureError,
} from "../../errors.js";

/**
 * LemonSqueezy webhook verifier.
 *
 * LemonSqueezy signs webhooks with HMAC-SHA256 over the raw request body
 * using your webhook secret, and sends the hex digest in `X-Signature`.
 * Reference: https://docs.lemonsqueezy.com/help/webhooks
 *
 * This module is transport-agnostic: pass in the raw body bytes + headers
 * dict. No HTTP client, no parsing of side-effects — verification only.
 */

export type WebhookHeaders = Readonly<Record<string, string | undefined>>;

export type VerifyOptions = {
  readonly secret: string;
  /** Allowlist of event names. Empty means accept any (not recommended). */
  readonly allowedEvents: readonly string[];
  /**
   * Optional replay-window in seconds. If provided, the verifier expects an
   * `X-Event-Timestamp` header (unix seconds) and rejects events older than
   * `replayWindowSeconds` from `now()`. LemonSqueezy does not currently send
   * a timestamp header by default, so leave undefined unless you proxy one.
   */
  readonly replayWindowSeconds?: number;
  /** Injected clock for tests. Returns unix seconds. */
  readonly now?: () => number;
};

export type VerifiedWebhook = {
  readonly event: string;
  readonly payload: unknown;
};

const SIG_HEADER = "x-signature";
const EVENT_HEADER = "x-event-name";
const TIMESTAMP_HEADER = "x-event-timestamp";

function header(headers: WebhookHeaders, name: string): string | undefined {
  const direct = headers[name];
  if (direct !== undefined) return direct;
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name) return headers[key];
  }
  return undefined;
}

function hexToBuf(hex: string): Buffer | null {
  if (hex.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  return Buffer.from(hex, "hex");
}

function constantTimeEqualHex(a: string, b: string): boolean {
  const ab = hexToBuf(a);
  const bb = hexToBuf(b);
  if (!ab || !bb) return false;
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function computeSignature(secret: string, body: Buffer): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Verify a LemonSqueezy webhook.
 *
 * @throws WebhookSignatureError - missing/malformed/wrong signature
 * @throws WebhookEventNotAllowedError - event not in allowlist
 * @throws WebhookReplayError - timestamp outside replay window
 */
export function verifyLemonSqueezyWebhook(
  rawBody: Buffer,
  headers: WebhookHeaders,
  opts: VerifyOptions,
): VerifiedWebhook {
  if (!opts.secret || opts.secret.length === 0) {
    throw new WebhookSignatureError("Webhook secret not configured");
  }

  const provided = header(headers, SIG_HEADER);
  if (!provided) throw new WebhookSignatureError("Missing X-Signature header");

  const expected = computeSignature(opts.secret, rawBody);
  if (!constantTimeEqualHex(provided, expected)) {
    throw new WebhookSignatureError();
  }

  const event = header(headers, EVENT_HEADER);
  if (!event) {
    throw new WebhookEventNotAllowedError("<missing>");
  }
  if (
    opts.allowedEvents.length > 0 &&
    !opts.allowedEvents.includes(event)
  ) {
    throw new WebhookEventNotAllowedError(event);
  }

  if (opts.replayWindowSeconds !== undefined) {
    const tsRaw = header(headers, TIMESTAMP_HEADER);
    if (!tsRaw) throw new WebhookReplayError("Missing X-Event-Timestamp header");
    const ts = Number(tsRaw);
    if (!Number.isFinite(ts)) {
      throw new WebhookReplayError("Malformed X-Event-Timestamp header");
    }
    const now = (opts.now ?? defaultNow)();
    if (Math.abs(now - ts) > opts.replayWindowSeconds) {
      throw new WebhookReplayError();
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new WebhookSignatureError("Malformed JSON body");
  }

  return { event, payload };
}

function defaultNow(): number {
  return Math.floor(Date.now() / 1000);
}
