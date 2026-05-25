import { describe, expect, it } from "vitest";
import { InMemoryKvStore } from "./kv-memory.js";

describe("InMemoryKvStore", () => {
  it("get returns null for missing key", async () => {
    const kv = new InMemoryKvStore();
    expect(await kv.get("nope")).toBeNull();
  });

  it("put then get returns the value", async () => {
    const kv = new InMemoryKvStore();
    await kv.put("k", "v", { expirationTtl: 60 });
    expect(await kv.get("k")).toBe("v");
  });

  it("expired entries return null and self-delete", async () => {
    let t = 1_000;
    const kv = new InMemoryKvStore(() => t);
    await kv.put("k", "v", { expirationTtl: 1 }); // expires at t + 1000
    expect(await kv.get("k")).toBe("v");
    t += 2_000;
    expect(await kv.get("k")).toBeNull();
    expect(kv.size()).toBe(0);
  });

  it("rejects non-positive expirationTtl", async () => {
    const kv = new InMemoryKvStore();
    await expect(kv.put("k", "v", { expirationTtl: 0 })).rejects.toThrow(/> 0/u);
  });

  it("put overwrites existing value", async () => {
    const kv = new InMemoryKvStore();
    await kv.put("k", "v1", { expirationTtl: 60 });
    await kv.put("k", "v2", { expirationTtl: 60 });
    expect(await kv.get("k")).toBe("v2");
    expect(kv.size()).toBe(1);
  });
});
