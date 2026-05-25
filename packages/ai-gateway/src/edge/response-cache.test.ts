import { describe, expect, it } from "vitest";
import { InMemoryKvStore } from "./kv-memory.js";
import { EdgeResponseCache, buildEtag } from "./response-cache.js";

const validEntry = {
  status: 200,
  body: '{"hello":"world"}',
  contentType: "application/json",
  etag: '"abc12345"',
};

describe("EdgeResponseCache", () => {
  it("rejects ttlSeconds < 1", () => {
    const kv = new InMemoryKvStore();
    expect(() => new EdgeResponseCache(kv, { ttlSeconds: 0 })).toThrow(/ttlSeconds/u);
  });

  it("buildKey includes actor by default", () => {
    const kv = new InMemoryKvStore();
    const c = new EdgeResponseCache(kv, { ttlSeconds: 60 });
    expect(c.buildKey("GET", "/v1/x", "", "actor-1")).toBe(
      "edgecache:actor-1:GET:/v1/x",
    );
  });

  it("buildKey honors perActor=false", () => {
    const kv = new InMemoryKvStore();
    const c = new EdgeResponseCache(kv, { ttlSeconds: 60, perActor: false });
    expect(c.buildKey("GET", "/v1/x", "a=1", "actor-1")).toBe(
      "edgecache:_:GET:/v1/x?a=1",
    );
  });

  it("set then get returns the entry", async () => {
    const kv = new InMemoryKvStore();
    const c = new EdgeResponseCache(kv, { ttlSeconds: 60 });
    const key = c.buildKey("GET", "/health", "", "actor-1");
    await c.set(key, validEntry);
    const got = await c.get(key);
    expect(got?.status).toBe(200);
    expect(got?.body).toBe(validEntry.body);
  });

  it("returns null when entry is older than TTL", async () => {
    let t = 0;
    const kv = new InMemoryKvStore(() => t);
    const c = new EdgeResponseCache(kv, { ttlSeconds: 1 }, () => t);
    await c.set("k", validEntry);
    t += 5_000;
    expect(await c.get("k")).toBeNull();
  });

  it("returns null on missing key", async () => {
    const kv = new InMemoryKvStore();
    const c = new EdgeResponseCache(kv, { ttlSeconds: 60 });
    expect(await c.get("missing")).toBeNull();
  });

  it("returns null on corrupt payload", async () => {
    const kv = new InMemoryKvStore();
    await kv.put("k", "{bad-json", { expirationTtl: 60 });
    const c = new EdgeResponseCache(kv, { ttlSeconds: 60 });
    expect(await c.get("k")).toBeNull();
  });

  it("returns null when stored shape is invalid", async () => {
    const kv = new InMemoryKvStore();
    await kv.put("k", JSON.stringify({ status: "nope" }), { expirationTtl: 60 });
    const c = new EdgeResponseCache(kv, { ttlSeconds: 60 });
    expect(await c.get("k")).toBeNull();
  });

  it("uses Date.now when `now` not injected", async () => {
    const kv = new InMemoryKvStore();
    const c = new EdgeResponseCache(kv, { ttlSeconds: 60 });
    await c.set("k-default", validEntry);
    const got = await c.get("k-default");
    expect(got?.storedAtMs).toBeGreaterThan(0);
  });
});

describe("buildEtag", () => {
  it("produces deterministic etag for same input", () => {
    expect(buildEtag("hello")).toBe(buildEtag("hello"));
  });

  it("produces different etag for different input", () => {
    expect(buildEtag("a")).not.toBe(buildEtag("b"));
  });

  it("etag is quoted 8-hex per FNV-1a 32", () => {
    expect(buildEtag("hello")).toMatch(/^"[0-9a-f]{8}"$/u);
  });

  it("handles empty input", () => {
    expect(buildEtag("")).toMatch(/^"[0-9a-f]{8}"$/u);
  });
});
