import { describe, expect, it } from "vitest";
import { InMemoryJtiStore, NullJtiStore } from "./jti-revocation.js";
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
});
