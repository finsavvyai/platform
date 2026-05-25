// Shared helpers for synthetic probes. ESM only. Node 20+ builtins.
// No internal package imports — probes simulate real external clients.

import { createHmac } from "node:crypto";

/** Test-overridable clock (millis). */
export function now() {
  return Date.now();
}

/**
 * fetch with hard timeout via AbortController.
 * Default 10s. Returns the Response (caller reads body).
 * Throws AbortError if the timeout fires before headers arrive.
 */
export async function fetchWithTimeout(url, opts = {}, timeoutMs = 10_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Build a Stripe-style signature header for a raw JSON payload.
 *   header = `t=<ts>,v1=<hex_hmac_sha256>`
 * Stripe signs the literal string `${ts}.${rawBody}` with the secret.
 * Matches packages/billing/src/providers/stripe/webhook.ts.
 */
export function signStripePayload(payload, secret, ts) {
  if (!secret || typeof secret !== "string") {
    throw new Error("signStripePayload: secret required");
  }
  const tsNum = Number.isFinite(ts) ? Math.floor(ts) : Math.floor(now() / 1000);
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  const signed = `${tsNum}.${raw}`;
  const sig = createHmac("sha256", secret).update(signed).digest("hex");
  return {
    header: `t=${tsNum},v1=${sig}`,
    rawBody: raw,
    timestamp: tsNum,
  };
}

/**
 * LemonSqueezy webhook signature: HMAC-SHA256 of raw body, hex digest.
 * Header: `x-signature`. No timestamp envelope.
 */
export function signLemonSqueezyPayload(payload, secret) {
  if (!secret || typeof secret !== "string") {
    throw new Error("signLemonSqueezyPayload: secret required");
  }
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  const sig = createHmac("sha256", secret).update(raw).digest("hex");
  return { header: sig, rawBody: raw };
}

/**
 * Build the contract §3 synthetic result shape.
 *   { probe, ok, latency_ms, ts, error? }
 * ALERTING parses this exact shape — do not add/rename fields.
 */
export function result(probe, ok, startMs, error) {
  const out = {
    probe: String(probe),
    ok: Boolean(ok),
    latency_ms: Math.max(0, Math.round(now() - startMs)),
    ts: new Date().toISOString(),
  };
  if (!ok && error !== undefined && error !== null) {
    out.error = typeof error === "string" ? error : String(error);
  }
  return out;
}

/** Tiny assertion that throws a stable, parseable error message. */
export function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
