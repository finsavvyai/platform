import { describe, expect, it } from "vitest";
import { StaticRbac } from "../rbac.js";
import type { BasicSubject } from "../types.js";
import { OPENSYBER_ROLES, SHARED_ROLES, TENANTIQ_ROLES } from "./catalog.js";

const subj = (roles: readonly string[]): BasicSubject => ({
  kind: "basic",
  id: "u",
  email: "u@x.io",
  roles,
});

describe("role catalogs", () => {
  it("SHARED_ROLES has admin with write", () => {
    const rbac = new StaticRbac(SHARED_ROLES);
    expect(rbac.can(subj(["admin"]), "write:any")).toBe(true);
    expect(rbac.can(subj(["viewer"]), "write:any")).toBe(false);
  });

  it("OPENSYBER_ROLES gates org-admin escalation", () => {
    const rbac = new StaticRbac(OPENSYBER_ROLES);
    expect(rbac.can(subj(["org_admin"]), "billing:write")).toBe(true);
    expect(rbac.can(subj(["org_user"]), "billing:write")).toBe(false);
    expect(rbac.can(subj(["agent_executor"]), "skills:install")).toBe(false);
  });

  it("TENANTIQ_ROLES distinguishes tenant vs platform admin", () => {
    const rbac = new StaticRbac(TENANTIQ_ROLES);
    expect(rbac.can(subj(["tenant_admin"]), "platform:write")).toBe(false);
    expect(rbac.can(subj(["platform_admin"]), "platform:write")).toBe(true);
    expect(rbac.can(subj(["contractor"]), "tenant:write")).toBe(false);
    expect(rbac.can(subj(["tenant_engineer"]), "runbooks:run")).toBe(true);
  });
});
