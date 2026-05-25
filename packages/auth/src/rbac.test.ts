import { describe, expect, it } from "vitest";
import { StaticRbac } from "./rbac.js";
import type { BasicSubject, MultiTenantSubject } from "./types.js";

const basic = (roles: readonly string[]): BasicSubject => ({
  kind: "basic",
  id: "u1",
  email: "u@example.com",
  roles,
});

const multi = (roles: readonly string[]): MultiTenantSubject => ({
  kind: "multitenant",
  id: "u1",
  email: "u@example.com",
  name: "U",
  orgId: "o1",
  tenantIds: ["t1"],
  roles,
});

describe("StaticRbac", () => {
  const rbac = new StaticRbac([
    { name: "admin", permissions: ["users:write", "users:read"] },
    { name: "viewer", permissions: ["users:read"] },
  ]);

  it("grants when role has permission (basic subject)", () => {
    expect(rbac.can(basic(["admin"]), "users:write")).toBe(true);
  });

  it("grants when role has permission (multitenant subject)", () => {
    expect(rbac.can(multi(["admin"]), "users:write")).toBe(true);
  });

  it("denies when role lacks permission", () => {
    expect(rbac.can(basic(["viewer"]), "users:write")).toBe(false);
  });

  it("denies when subject has no roles", () => {
    expect(rbac.can(basic([]), "users:read")).toBe(false);
  });

  it("checks across multiple roles", () => {
    expect(rbac.can(basic(["viewer", "admin"]), "users:write")).toBe(true);
  });

  it("lists roles with permission", () => {
    expect(rbac.rolesWithPermission("users:read").sort()).toEqual(["admin", "viewer"]);
  });

  it("denies an unknown role on the subject", () => {
    expect(rbac.can(basic(["ghost"]), "users:read")).toBe(false);
  });

  it("denies an unknown permission even when role is known", () => {
    expect(rbac.can(basic(["admin"]), "billing:write")).toBe(false);
  });

  it("constructed from empty role list denies everything (default deny)", () => {
    const empty = new StaticRbac([]);
    expect(empty.can(basic(["admin"]), "users:read")).toBe(false);
    expect(empty.rolesWithPermission("users:read")).toEqual([]);
  });

  it("later role with same name wins the lookup (last-write semantics)", () => {
    const rbac2 = new StaticRbac([
      { name: "x", permissions: ["a:r"] },
      { name: "x", permissions: ["a:w"] },
    ]);
    expect(rbac2.can(basic(["x"]), "a:r")).toBe(false);
    expect(rbac2.can(basic(["x"]), "a:w")).toBe(true);
  });

  it("rolesWithPermission returns empty for permission no role grants", () => {
    expect(rbac.rolesWithPermission("nothing:here")).toEqual([]);
  });
});
