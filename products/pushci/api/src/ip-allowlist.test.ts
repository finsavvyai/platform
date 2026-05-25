import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { ipAllowlist, ipMatchesCidr, parseCidrs } from "./ip-allowlist";

describe("parseCidrs", () => {
  it("splits a comma list and trims whitespace", () => {
    expect(parseCidrs("10.0.0.0/8, 192.168.0.0/16")).toEqual([
      "10.0.0.0/8",
      "192.168.0.0/16",
    ]);
  });

  it("returns [] for undefined / empty", () => {
    expect(parseCidrs(undefined)).toEqual([]);
    expect(parseCidrs("")).toEqual([]);
  });
});

describe("ipMatchesCidr", () => {
  it("matches an IPv4 inside /24", () => {
    expect(ipMatchesCidr("10.0.0.42", "10.0.0.0/24")).toBe(true);
  });

  it("rejects an IPv4 outside /24", () => {
    expect(ipMatchesCidr("10.0.1.1", "10.0.0.0/24")).toBe(false);
  });

  it("matches any IPv4 in /0", () => {
    expect(ipMatchesCidr("1.2.3.4", "0.0.0.0/0")).toBe(true);
  });

  it("matches a single IPv4 with no /prefix", () => {
    expect(ipMatchesCidr("8.8.8.8", "8.8.8.8")).toBe(true);
    expect(ipMatchesCidr("8.8.8.9", "8.8.8.8")).toBe(false);
  });

  it("matches IPv6 /64", () => {
    expect(ipMatchesCidr("2001:db8::1", "2001:db8::/64")).toBe(true);
    expect(ipMatchesCidr("2001:db9::1", "2001:db8::/64")).toBe(false);
  });

  it("returns false on malformed input", () => {
    expect(ipMatchesCidr("not-an-ip", "10.0.0.0/8")).toBe(false);
    expect(ipMatchesCidr("10.0.0.0", "wrong/cidr")).toBe(false);
  });
});

describe("ipAllowlist middleware", () => {
  it("noops when allowlist is empty", async () => {
    const app = new Hono();
    app.use("/x", ipAllowlist([]));
    app.get("/x", (c) => c.text("ok"));
    const res = await app.request("/x", { headers: { "x-forwarded-for": "4.4.4.4" } });
    expect(res.status).toBe(200);
  });

  it("allows an IP inside CIDR", async () => {
    const app = new Hono();
    app.use("/x", ipAllowlist(["10.0.0.0/8"]));
    app.get("/x", (c) => c.text("ok"));
    const res = await app.request("/x", { headers: { "x-forwarded-for": "10.4.5.6" } });
    expect(res.status).toBe(200);
  });

  it("denies an IP outside every CIDR", async () => {
    const app = new Hono();
    app.use("/x", ipAllowlist(["10.0.0.0/8"]));
    app.get("/x", (c) => c.text("ok"));
    const res = await app.request("/x", { headers: { "x-forwarded-for": "8.8.8.8" } });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "ip_denied", ip: "8.8.8.8" });
  });

  it("reads cf-connecting-ip as a fallback", async () => {
    const app = new Hono();
    app.use("/x", ipAllowlist(["1.2.3.0/24"]));
    app.get("/x", (c) => c.text("ok"));
    const res = await app.request("/x", { headers: { "cf-connecting-ip": "1.2.3.4" } });
    expect(res.status).toBe(200);
  });

  it("denies when no IP header is present", async () => {
    const app = new Hono();
    app.use("/x", ipAllowlist(["10.0.0.0/8"]));
    app.get("/x", (c) => c.text("ok"));
    const res = await app.request("/x");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "ip_required" });
  });
});
