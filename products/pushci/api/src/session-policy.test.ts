import { describe, it, expect } from "vitest";
import {
  DEFAULT_POLICY,
  evaluateSession,
  policyFromEnv,
  touchSession,
} from "./session-policy";

const hour = 3600 * 1000;
const now = 1_700_000_000_000;

describe("policyFromEnv", () => {
  it("returns defaults when no env overrides", () => {
    expect(policyFromEnv({})).toEqual(DEFAULT_POLICY);
  });

  it("applies env overrides", () => {
    const p = policyFromEnv({
      PUSHCI_SESSION_TTL_SECONDS: "120",
      PUSHCI_REAUTH_WINDOW_SECONDS: "60",
      PUSHCI_IDLE_TIMEOUT_SECONDS: "30",
    });
    expect(p.sessionTtlSeconds).toBe(120);
    expect(p.reauthWindowSeconds).toBe(60);
    expect(p.idleTimeoutSeconds).toBe(30);
  });

  it("rejects non-numeric and non-positive overrides", () => {
    const p = policyFromEnv({ PUSHCI_SESSION_TTL_SECONDS: "abc" });
    expect(p.sessionTtlSeconds).toBe(DEFAULT_POLICY.sessionTtlSeconds);
    const q = policyFromEnv({ PUSHCI_IDLE_TIMEOUT_SECONDS: "-10" });
    expect(q.idleTimeoutSeconds).toBe(DEFAULT_POLICY.idleTimeoutSeconds);
  });
});

describe("evaluateSession", () => {
  const fresh = { issuedAt: now - 1000, lastAuthAt: now - 1000, lastSeenAt: now - 500 };

  it("accepts a fresh session", () => {
    expect(evaluateSession(fresh, DEFAULT_POLICY, now)).toEqual({ ok: true });
  });

  it("expires after sessionTtlSeconds", () => {
    const state = { ...fresh, issuedAt: now - 9 * hour };
    expect(evaluateSession(state, DEFAULT_POLICY, now)).toEqual({ ok: false, reason: "expired" });
  });

  it("idle-timeouts after idleTimeoutSeconds", () => {
    const state = { ...fresh, lastSeenAt: now - 2 * hour };
    expect(evaluateSession(state, DEFAULT_POLICY, now)).toEqual({
      ok: false,
      reason: "idle_timeout",
    });
  });

  it("requires reauth for sensitive endpoints when last auth is stale", () => {
    const state = { ...fresh, lastAuthAt: now - 20 * 60 * 1000 };
    expect(evaluateSession(state, DEFAULT_POLICY, now, { sensitive: true })).toEqual({
      ok: false,
      reason: "reauth_required",
    });
  });

  it("allows sensitive endpoints when lastAuth is within window", () => {
    const state = { ...fresh, lastAuthAt: now - 5 * 60 * 1000 };
    expect(evaluateSession(state, DEFAULT_POLICY, now, { sensitive: true })).toEqual({ ok: true });
  });
});

describe("touchSession", () => {
  it("updates lastSeenAt only", () => {
    const s = { issuedAt: 1, lastAuthAt: 2, lastSeenAt: 3 };
    const out = touchSession(s, 42);
    expect(out).toEqual({ issuedAt: 1, lastAuthAt: 2, lastSeenAt: 42 });
  });
});
