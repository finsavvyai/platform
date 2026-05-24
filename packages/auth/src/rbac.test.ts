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
});
