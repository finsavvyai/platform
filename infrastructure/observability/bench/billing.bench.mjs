// Billing bench: Stripe webhook HMAC verify across 1KB / 10KB / 100KB bodies.
//
// Mirrors packages/billing/src/providers/stripe/webhook.ts. Replicated
// inline so the bench runs without TS toolchain.

import { createHmac, timingSafeEqual } from "node:crypto";
import { runBench, printReport, emitMachineReadable } from "./_runner.mjs";

const SIG_HEADER = "stripe-signature";
const DEFAULT_TOLERANCE = 300;

function header(headers, name) {
  const direct = headers[name];
  if (direct !== undefined) return direct;
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name) return headers[key];
  }
  return undefined;
}

function parseStripeSignatureHeader(value) {
  let timestamp = NaN;
  const v1 = [];
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

function hexToBuf(hex) {
  if (hex.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  return Buffer.from(hex, "hex");
}

function constantTimeEqualHex(a, b) {
  const ab = hexToBuf(a);
  const bb = hexToBuf(b);
  if (!ab || !bb) return false;
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function computeSignature(secret, timestamp, body) {
  const signed = Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), body]);
  return createHmac("sha256", secret).update(signed).digest("hex");
}

function verifyStripeWebhook(rawBody, headers, opts) {
  if (!opts.secret || opts.secret.length === 0) throw new Error("no secret");
  const sig = header(headers, SIG_HEADER);
  if (!sig) throw new Error("no sig header");
  const parsed = parseStripeSignatureHeader(sig);
  if (!Number.isFinite(parsed.timestamp)) throw new Error("bad ts");
  if (parsed.v1.length === 0) throw new Error("no v1");
  const tolerance = opts.toleranceSeconds ?? DEFAULT_TOLERANCE;
  const now = (opts.now ?? defaultNow)();
  if (Math.abs(now - parsed.timestamp) > tolerance) throw new Error("replay");
  const expected = computeSignature(opts.secret, parsed.timestamp, rawBody);
  let matched = false;
  for (const c of parsed.v1) {
    if (constantTimeEqualHex(c, expected)) {
      matched = true;
      break;
    }
  }
  if (!matched) throw new Error("bad sig");
  const payload = JSON.parse(rawBody.toString("utf8"));
  if (typeof payload.type !== "string") throw new Error("missing type");
  if (opts.allowedEvents.length > 0 && !opts.allowedEvents.includes(payload.type)) {
    throw new Error("event not allowed");
  }
  return { event: payload.type, payload };
}

function defaultNow() {
  return Math.floor(Date.now() / 1000);
}

// --- fixtures sized to target body bytes ---

function makeBody(approxBytes) {
  const baseObj = {
    id: "evt_test_123",
    type: "invoice.paid",
    object: "event",
    data: { object: { id: "in_123", amount_paid: 1000 } },
  };
  const baseStr = JSON.stringify(baseObj);
  const pad = "x".repeat(Math.max(0, approxBytes - baseStr.length - 12));
  return Buffer.from(JSON.stringify({ ...baseObj, _pad: pad }), "utf8");
}

const SIZES = [
  { label: "1KB", bytes: 1024 },
  { label: "10KB", bytes: 10240 },
  { label: "100KB", bytes: 102400 },
];

const SECRET = "whsec_bench_do_not_use_in_prod";

function buildSignedHeaders(body, ts) {
  const expected = computeSignature(SECRET, ts, body);
  return { "Stripe-Signature": `t=${ts},v1=${expected}` };
}

const setup = (sizeLabel) => {
  const def = SIZES.find((s) => s.label === sizeLabel);
  const body = makeBody(def.bytes);
  const ts = Math.floor(Date.now() / 1000);
  const headers = buildSignedHeaders(body, ts);
  return {
    body,
    headers,
    opts: {
      secret: SECRET,
      allowedEvents: ["invoice.paid"],
      now: () => ts, // freeze clock so tolerance always passes
    },
  };
};

const op = (ctx) => verifyStripeWebhook(ctx.body, ctx.headers, ctx.opts);

const machine = process.argv.includes("--json");
const result = await runBench({
  name: "billing: verifyStripeWebhook (happy path)",
  setup,
  op,
  sizes: SIZES.map((s) => s.label),
  warmupMs: 200,
  measureMs: 800,
});

if (machine) emitMachineReadable(result);
else printReport(result);
