import { describe, expect, it } from "vitest";
import { securityHeaders, withHeaders } from "./security-headers.js";

describe("securityHeaders", () => {
  it("returns hardened defaults without HSTS", () => {
    const h = securityHeaders();
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-XSS-Protection"]).toBe("1; mode=block");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["X-Gateway-Version"]).toMatch(/^ai-gateway/u);
    expect(h["Strict-Transport-Security"]).toBeUndefined();
  });

  it("adds HSTS when enabled", () => {
    const h = securityHeaders({ enableHsts: true });
    expect(h["Strict-Transport-Security"]).toContain("max-age=31536000");
  });

  it("respects custom gatewayVersion", () => {
    const h = securityHeaders({ gatewayVersion: "v9.9" });
    expect(h["X-Gateway-Version"]).toBe("v9.9");
  });
});

describe("withHeaders", () => {
  it("preserves body and status while merging headers", async () => {
    const original = new Response("body", {
      status: 201,
      headers: { "X-Original": "1" },
    });
    const next = withHeaders(original, { "X-Extra": "2" });
    expect(next.status).toBe(201);
    expect(await next.text()).toBe("body");
    expect(next.headers.get("X-Original")).toBe("1");
    expect(next.headers.get("X-Extra")).toBe("2");
  });

  it("overwrites a colliding header", () => {
    const original = new Response("x", { headers: { "X-Same": "old" } });
    const next = withHeaders(original, { "X-Same": "new" });
    expect(next.headers.get("X-Same")).toBe("new");
  });
});
