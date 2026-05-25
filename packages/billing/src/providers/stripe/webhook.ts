import { createHmac, timingSafeEqual } from "node:crypto";
import {
  WebhookEventNotAllowedError,
  WebhookReplayError,
  WebhookSignatureError,
} from "../../errors.js";

/**
 * Stripe webhook verifier.
 *
 * Stripe sends a `Stripe-Signature` header of the form:
 *   t=<unix_seconds>,v1=<hex_sig>,v1=<hex_sig>,v0=<legacy>
 * The signed payload is the literal string `${t}.${rawBody}`; the signature
 * is HMAC-SHA256 with your webhook signing secret. Multiple `v1` entries
 * may appear during secret rotation — any match wins.
 *
 * Reference: https://docs.stripe.com/webhooks#verify-manually
 *
 * Transport-agnostic: pass raw body bytes + headers dict. No HTTP, no SDK.
 */

export type WebhookHeaders = Readonly<Record<string, string | undefined>>;

export type VerifyOptions = {
  readonly secret: string;
  /** Allowlist of event types (e.g. "invoice.paid"). Empty = accept any. */
  readonly allowedEvents: readonly string[];
  /** Replay-window in seconds. Defaults to 300 (Stripe's recommendation). */
  readonly toleranceSeconds?: number;
  /** Injected clock for tests. Returns unix seconds. */
  readonly now?: () => number;
};

export type VerifiedWebhook = {
  readonly event: string;
  readonly payload: { readonly type: string; readonly id?: string } & Record<
    string,
    unknown
  >;
};

const SIG_HEADER = "stripe-signature";
const DEFAULT_TOLERANCE = 300;

function header(headers: WebhookHeaders, name: string): string | undefined {
  const direct = headers[name];
  if (direct !== undefined) return direct;
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name) return headers[key];
  }
  return undefined;
}

type ParsedSignature = {
  readonly timestamp: number;
  readonly v1: readonly string[];
};

export function parseStripeSignatureHeader(value: string): ParsedSignature {
  let timestamp = NaN;
  const v1: string[] = [];
  for (const part of value.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === "t") timestamp = Number(v);
    else if (k === "v1") v1.push(v);
  }
  return { timestamp, v1 };
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

function computeSignature(
  secret: string,
  timestamp: number,
  body: Buffer,
): string {
  const signed = Buffer.concat([
    Buffer.from(`${timestamp}.`, "utf8"),
    body,
  ]);
  return createHmac("sha256", secret).update(signed).digest("hex");
}

/**
 * Verify a Stripe webhook.
 *
 * @throws WebhookSignatureError - missing/malformed/wrong signature
 * @throws WebhookEventNotAllowedError - event type not in allowlist
 * @throws WebhookReplayError - timestamp outside tolerance window
 */
export function verifyStripeWebhook(
  rawBody: Buffer,
  headers: WebhookHeaders,
  opts: VerifyOptions,
): VerifiedWebhook {
  if (!opts.secret || opts.secret.length === 0) {
    throw new WebhookSignatureError("Webhook secret not configured");
  }

  const sig = header(headers, SIG_HEADER);
  if (!sig) throw new WebhookSignatureError("Missing Stripe-Signature header");

  const parsed = parseStripeSignatureHeader(sig);
  if (!Number.isFinite(parsed.timestamp)) {
    throw new WebhookSignatureError("Malformed Stripe-Signature timestamp");
  }
  if (parsed.v1.length === 0) {
    throw new WebhookSignatureError("No v1 signature in Stripe-Signature");
  }

  const tolerance = opts.toleranceSeconds ?? DEFAULT_TOLERANCE;
  const now = (opts.now ?? defaultNow)();
  if (Math.abs(now - parsed.timestamp) > tolerance) {
    throw new WebhookReplayError();
  }

  const expected = computeSignature(opts.secret, parsed.timestamp, rawBody);
  let matched = false;
  for (const candidate of parsed.v1) {
    if (constantTimeEqualHex(candidate, expected)) {
      matched = true;
      break;
    }
  }
  if (!matched) throw new WebhookSignatureError();

  let payload: { type?: unknown } & Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new WebhookSignatureError("Malformed JSON body");
  }
  if (typeof payload.type !== "string") {
    throw new WebhookSignatureError("Webhook payload missing 'type' field");
  }
  const event = payload.type;
  if (
    opts.allowedEvents.length > 0 &&
    !opts.allowedEvents.includes(event)
  ) {
    throw new WebhookEventNotAllowedError(event);
  }

  return {
    event,
    payload: payload as VerifiedWebhook["payload"],
  };
}

function defaultNow(): number {
  return Math.floor(Date.now() / 1000);
}
