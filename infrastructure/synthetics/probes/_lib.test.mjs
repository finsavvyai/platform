// Unit tests for _lib helpers. No network.
// Covers: result() contract shape, Stripe + LS signing correctness.

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  result,
  signLemonSqueezyPayload,
  signStripePayload,
} from "./_lib.mjs";

describe("result()", () => {
  it("builds the exact contract shape on success", () => {
    const start = Date.now() - 25;
    const r = result("health", true, start);
    expect(r.probe).toBe("health");
    expect(r.ok).toBe(true);
    expect(typeof r.latency_ms).toBe("number");
    expect(r.latency_ms).toBeGreaterThanOrEqual(0);
    expect(typeof r.ts).toBe("string");
    expect(new Date(r.ts).toString()).not.toBe("Invalid Date");
    expect("error" in r).toBe(false);
  });

  it("includes error string only on failure", () => {
    const r = result("p", false, Date.now(), new Error("boom"));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("boom");
  });

  it("omits error when ok=true even if error supplied", () => {
    const r = result("p", true, Date.now(), "ignored");
    expect("error" in r).toBe(false);
  });

  it("coerces non-string errors to string", () => {
    const r = result("p", false, Date.now(), { msg: "x" });
    expect(typeof r.error).toBe("string");
  });

  it("clamps negative latency to 0", () => {
    const r = result("p", true, Date.now() + 10_000);
    expect(r.latency_ms).toBeGreaterThanOrEqual(0);
  });
});

describe("signStripePayload()", () => {
  it("produces a header parseable as t=...,v1=hex", () => {
    const signed = signStripePayload({ type: "x" }, "whsec_test", 1700000000);
    expect(signed.header).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
    expect(signed.timestamp).toBe(1700000000);
  });

  it("matches Stripe's documented HMAC formula", () => {
    const secret = "whsec_test";
    const ts = 1700000000;
    const payload = { type: "invoice.paid", id: "evt_1" };
    const raw = JSON.stringify(payload);
    const expected = createHmac("sha256", secret)
      .update(`${ts}.${raw}`)
      .digest("hex");
    const signed = signStripePayload(payload, secret, ts);
    expect(signed.header).toBe(`t=${ts},v1=${expected}`);
    expect(signed.rawBody).toBe(raw);
  });

  it("accepts a pre-serialized string body", () => {
    const raw = '{"type":"x"}';
    const signed = signStripePayload(raw, "s", 1);
    expect(signed.rawBody).toBe(raw);
  });

  it("throws when secret missing", () => {
    expect(() => signStripePayload({}, "", 1)).toThrow();
  });
});

describe("signLemonSqueezyPayload()", () => {
  it("hex hmac-sha256 of raw body", () => {
    const secret = "ls_test";
    const payload = { meta: { event_name: "order_created" } };
    const raw = JSON.stringify(payload);
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    const signed = signLemonSqueezyPayload(payload, secret);
    expect(signed.header).toBe(expected);
    expect(signed.rawBody).toBe(raw);
  });

  it("throws when secret missing", () => {
    expect(() => signLemonSqueezyPayload({}, "")).toThrow();
  });
});
