import { describe, expect, it } from "vitest";
import { InMemorySessionStore } from "../adapters/session-store.js";
import type { WebAuthnChallenge } from "../types.js";
import { consumeChallenge, generateChallenge, startChallenge } from "./challenge.js";
import { buildWebAuthnConfig, isOriginAllowed } from "./config.js";

const config = buildWebAuthnConfig({
  rpId: "tenantiq.io",
  rpName: "TenantIQ",
  origins: ["https://tenantiq.io", "https://app.tenantiq.io"],
});

describe("webauthn config", () => {
  it("allows configured origins", () => {
    expect(isOriginAllowed(config, "https://tenantiq.io")).toBe(true);
    expect(isOriginAllowed(config, "https://app.tenantiq.io")).toBe(true);
  });

  it("rejects unknown origins", () => {
    expect(isOriginAllowed(config, "https://evil.io")).toBe(false);
  });

  it("applies default TTL when not provided", () => {
    expect(config.challengeTtlSeconds).toBe(300);
  });
});

describe("webauthn challenge", () => {
  it("generates unique challenges", () => {
    const a = generateChallenge("u1", 60);
    const b = generateChallenge("u1", 60);
    expect(a.challenge).not.toBe(b.challenge);
  });

  it("stores and consumes challenge", async () => {
    const store = new InMemorySessionStore<WebAuthnChallenge>();
    const challenge = await startChallenge(store, config, "u1");
    const consumed = await consumeChallenge(store, "u1");
    expect(consumed?.challenge).toBe(challenge.challenge);
  });

  it("consume removes the challenge", async () => {
    const store = new InMemorySessionStore<WebAuthnChallenge>();
    await startChallenge(store, config, "u1");
    await consumeChallenge(store, "u1");
    expect(await consumeChallenge(store, "u1")).toBeUndefined();
  });

  it("returns undefined for missing user", async () => {
    const store = new InMemorySessionStore<WebAuthnChallenge>();
    expect(await consumeChallenge(store, "u9")).toBeUndefined();
  });
});
