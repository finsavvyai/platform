// Unit tests for aws-externalid.ts — confused-deputy guard helpers.
// Integration/route coverage lives in aws-sts-externalid.test.ts.

import { describe, it, expect } from "vitest";
import {
  EXTERNAL_ID_MIN_LEN,
  generateExternalId,
  redactExternalId,
  resolveExternalId,
  validateExternalId,
} from "./aws-externalid";

describe("generateExternalId", () => {
  it("returns 32 hex chars with crypto entropy", () => {
    const a = generateExternalId();
    const b = generateExternalId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(b).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});

describe("validateExternalId", () => {
  it("rejects short values", () => {
    const r = validateExternalId("short");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(new RegExp(`at least ${EXTERNAL_ID_MIN_LEN}`));
  });
  it("rejects non-string values", () => {
    expect(validateExternalId(123).ok).toBe(false);
    expect(validateExternalId(undefined).ok).toBe(false);
    expect(validateExternalId(null).ok).toBe(false);
    expect(validateExternalId({}).ok).toBe(false);
  });
  it("accepts exactly minimum length", () => {
    expect(validateExternalId("x".repeat(EXTERNAL_ID_MIN_LEN)).ok).toBe(true);
  });
});

describe("redactExternalId", () => {
  it("collapses short values to ***", () => {
    expect(redactExternalId("short")).toBe("***");
    expect(redactExternalId("eightch!")).toBe("***");
  });
  it("returns prefix…suffix for long values", () => {
    expect(redactExternalId("abcdefghij0123456789")).toBe("abcd…6789");
  });
});

describe("resolveExternalId", () => {
  it("static drops externalId entirely", () => {
    const r = resolveExternalId("static", "anything");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.externalId).toBeUndefined();
      expect(r.generated).toBeUndefined();
    }
  });
  it("role missing → auto-generates", () => {
    const r = resolveExternalId("role", undefined);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.externalId).toMatch(/^[0-9a-f]{32}$/);
      expect(r.generated).toBe(r.externalId);
    }
  });
  it("role + short → error", () => {
    const r = resolveExternalId("role", "nope");
    expect(r.ok).toBe(false);
  });
  it("role + valid → passthrough", () => {
    const ext = "a".repeat(EXTERNAL_ID_MIN_LEN);
    const r = resolveExternalId("role", ext);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.externalId).toBe(ext);
      expect(r.generated).toBeUndefined();
    }
  });
});
