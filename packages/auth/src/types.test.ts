import { describe, expect, it } from "vitest";
import { isMultiTenant, type BasicSubject, type MultiTenantSubject } from "./types.js";

const basic: BasicSubject = {
  kind: "basic",
  id: "u",
  email: "u@x.io",
  roles: [],
};

const multi: MultiTenantSubject = {
  kind: "multitenant",
  id: "u",
  email: "u@x.io",
  name: "U",
  orgId: "o",
  tenantIds: ["t1"],
  roles: [],
};

describe("isMultiTenant", () => {
  it("returns true for multitenant subjects", () => {
    expect(isMultiTenant(multi)).toBe(true);
  });
  it("returns false for basic subjects", () => {
    expect(isMultiTenant(basic)).toBe(false);
  });
  it("narrows the type so org fields are reachable", () => {
    const s: BasicSubject | MultiTenantSubject = multi;
    if (isMultiTenant(s)) {
      expect(s.orgId).toBe("o");
    }
  });
});
