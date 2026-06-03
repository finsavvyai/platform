import { describe, expect, it } from "vitest";
import {
  InMemoryJtiStore,
  NullJtiStore,
  RedisJtiStore,
  type RedisJtiClient,
} from "./jti-revocation.js";
import { InMemorySessionStore } from "./session-store.js";
import { ClaimsOnlyResolver, subjectFromClaims } from "./user-resolver.js";
import type { TokenClaims } from "../types.js";

const baseClaims = (extra: Partial<TokenClaims> = {}): TokenClaims => ({
  sub: "u1",
  iss: "i",
  aud: "a",
  exp: Date.now() / 1000 + 60,
  iat: Date.now() / 1000,
  ...extra,
});

describe("JtiRevocationStore", () => {
  it("NullJtiStore is always allow", async () => {
    const store = new NullJtiStore();
    await store.revoke("j1", 100);
    expect(await store.isRevoked("j1")).toBe(false);
  });

  it("InMemoryJtiStore revokes", async () => {
    const store = new InMemoryJtiStore();
    await store.revoke("j1", 3600);
    expect(await store.isRevoked("j1")).toBe(true);
    expect(await store.isRevoked("j2")).toBe(false);
  });

  it("InMemoryJtiStore expires entries", async () => {
    const store = new InMemoryJtiStore();
    await store.revoke("j1", -1);
    expect(await store.isRevoked("j1")).toBe(false);
  });

  it("RedisJtiStore stores revocations with a hashed key and TTL", async () => {
    const calls: { key: string; ttl: number; value: string }[] = [];
    const backing = new Map<string, string>();
    const client: RedisJtiClient = {
      setEx: (key, ttl, value) => {
        calls.push({ key, ttl, value });
        backing.set(key, value);
      },
      get: (key) => backing.get(key) ?? null,
    };

    const store = new RedisJtiStore({ client, keyPrefix: "test:jti:" });
    await store.revoke("j1", 60.9);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.key).toMatch(/^test:jti:[a-f0-9]{64}$/);
    expect(calls[0]).toMatchObject({ ttl: 60, value: "1" });
    expect(await store.isRevoked("j1")).toBe(true);
    expect(await store.isRevoked("j2")).toBe(false);
  });

  it("RedisJtiStore deletes or ignores unusable revocations", async () => {
    const deleted: string[] = [];
    const client: RedisJtiClient = {
      setEx: () => {
        throw new Error("setEx should not be called");
      },
      get: () => null,
      del: (key) => {
        deleted.push(key);
      },
    };
    const store = new RedisJtiStore({ client });

    await store.revoke("expired", 0);
    await store.revoke("   ", 60);

    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toMatch(/^auth:jti:[a-f0-9]{64}$/);
    expect(await store.isRevoked("   ")).toBe(false);
  });
});

describe("InMemorySessionStore", () => {
  it("get/set/delete", async () => {
    const store = new InMemorySessionStore<string>();
    await store.set("k", "v", 60);
    expect(await store.get("k")).toBe("v");
    await store.delete("k");
    expect(await store.get("k")).toBeUndefined();
  });

  it("expires entries", async () => {
    const store = new InMemorySessionStore<string>();
    await store.set("k", "v", -1);
    expect(await store.get("k")).toBeUndefined();
  });
});

describe("subjectFromClaims", () => {
  it("returns basic when no org info", () => {
    const s = subjectFromClaims(baseClaims({ email: "u@x.io", roles: ["admin"] }));
    expect(s.kind).toBe("basic");
    expect(s.roles).toEqual(["admin"]);
  });

  it("returns multitenant when org+tenants present", () => {
    const s = subjectFromClaims(
      baseClaims({ email: "u@x.io", orgId: "o1", tenantIds: ["t1"], name: "U" }),
    );
    expect(s.kind).toBe("multitenant");
    if (s.kind === "multitenant") {
      expect(s.orgId).toBe("o1");
      expect(s.tenantIds).toEqual(["t1"]);
    }
  });

  it("ClaimsOnlyResolver delegates", async () => {
    const r = new ClaimsOnlyResolver();
    const s = await r.resolveByToken({ claims: baseClaims(), raw: "raw" });
    expect(s.kind).toBe("basic");
  });

  it("subjectFromClaims with only orgId stays basic (needs tenantIds too)", () => {
    const s = subjectFromClaims(baseClaims({ orgId: "o1" }));
    expect(s.kind).toBe("basic");
  });

  it("subjectFromClaims with only tenantIds stays basic (needs orgId too)", () => {
    const s = subjectFromClaims(baseClaims({ tenantIds: ["t1"] }));
    expect(s.kind).toBe("basic");
  });
});

describe("JtiRevocationStore.size + delete-on-expiry", () => {
  it("InMemoryJtiStore.size reports active entries", async () => {
    const store = new InMemoryJtiStore();
    expect(store.size()).toBe(0);
    await store.revoke("a", 60);
    await store.revoke("b", 60);
    expect(store.size()).toBe(2);
  });

  it("InMemoryJtiStore drops the entry after observing it as expired", async () => {
    const store = new InMemoryJtiStore();
    await store.revoke("x", -1);
    expect(await store.isRevoked("x")).toBe(false);
    expect(store.size()).toBe(0);
  });
});

describe("InMemorySessionStore.size + expiry cleanup", () => {
  it("size reports live entries and drops expired ones on get", async () => {
    const store = new InMemorySessionStore<number>();
    await store.set("k1", 1, 60);
    await store.set("k2", 2, -1);
    expect(store.size()).toBe(2);
    expect(await store.get("k2")).toBeUndefined();
    expect(store.size()).toBe(1);
  });
});
