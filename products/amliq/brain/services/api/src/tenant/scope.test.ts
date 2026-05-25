/**
 * Scope derivation + require* guards — 100% line + branch coverage.
 */

import { describe, expect, it } from "vitest";
import { TenantError, type TenantContext } from "./types.js";
import { deriveScope, requireAdmin, requireRead, requireWrite } from "./scope.js";

const ctx = (roles: readonly string[]): TenantContext => ({
  tenant_id: "acme",
  actor_id: "alice",
  roles,
});

describe("deriveScope", () => {
  it("empty roles → all false", () => {
    expect(deriveScope(ctx([]))).toEqual({ read: false, write: false, admin: false });
  });

  it("brain:*:read grants read only", () => {
    expect(deriveScope(ctx(["brain:search:read"]))).toEqual({
      read: true,
      write: false,
      admin: false,
    });
  });

  it("brain:*:write implies read", () => {
    expect(deriveScope(ctx(["brain:case:write"]))).toEqual({
      read: true,
      write: true,
      admin: false,
    });
  });

  it("brain:admin implies write and read", () => {
    expect(deriveScope(ctx(["brain:admin"]))).toEqual({
      read: true,
      write: true,
      admin: true,
    });
  });

  it("non-brain roles contribute nothing", () => {
    expect(deriveScope(ctx(["aml:decision:write", "other:read"]))).toEqual({
      read: false,
      write: false,
      admin: false,
    });
  });

  it("admin + read is idempotent", () => {
    expect(
      deriveScope(ctx(["brain:admin", "brain:search:read"])),
    ).toEqual({ read: true, write: true, admin: true });
  });

  it("returns frozen object (defensive)", () => {
    const s = deriveScope(ctx(["brain:search:read"]));
    expect(Object.isFrozen(s)).toBe(true);
  });

  it("brain-prefixed role without :read/:write/admin contributes nothing", () => {
    expect(deriveScope(ctx(["brain:foo"]))).toEqual({
      read: false,
      write: false,
      admin: false,
    });
  });
});

describe("requireRead", () => {
  it("passes when read granted", () => {
    expect(() => requireRead(ctx(["brain:search:read"]))).not.toThrow();
  });

  it("throws tenant.scope_denied otherwise", () => {
    try {
      requireRead(ctx([]));
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TenantError);
      expect((e as TenantError).code).toBe("tenant.scope_denied");
    }
  });
});

describe("requireWrite", () => {
  it("passes when write granted", () => {
    expect(() => requireWrite(ctx(["brain:case:write"]))).not.toThrow();
  });

  it("denies read-only role", () => {
    try {
      requireWrite(ctx(["brain:search:read"]));
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TenantError);
      expect((e as TenantError).code).toBe("tenant.scope_denied");
    }
  });

  it("admin satisfies write", () => {
    expect(() => requireWrite(ctx(["brain:admin"]))).not.toThrow();
  });
});

describe("requireAdmin", () => {
  it("passes when admin granted", () => {
    expect(() => requireAdmin(ctx(["brain:admin"]))).not.toThrow();
  });

  it("denies write role", () => {
    try {
      requireAdmin(ctx(["brain:case:write"]));
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TenantError);
      expect((e as TenantError).code).toBe("tenant.scope_denied");
    }
  });

  it("denies empty roles", () => {
    expect(() => requireAdmin(ctx([]))).toThrow(TenantError);
  });
});

describe("TenantError", () => {
  it("carries the code and default message", () => {
    const e = new TenantError("tenant.missing");
    expect(e.code).toBe("tenant.missing");
    expect(e.message).toBe("tenant.missing");
    expect(e.name).toBe("TenantError");
  });

  it("accepts a custom message", () => {
    const e = new TenantError("tenant.scope_denied", "needs admin");
    expect(e.message).toBe("needs admin");
  });
});
