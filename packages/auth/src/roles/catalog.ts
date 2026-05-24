import type { Permission, RoleDefinition } from "../types.js";

export const SHARED_ROLES: readonly RoleDefinition[] = [
  {
    name: "viewer",
    permissions: ["read:any"] satisfies Permission[],
  },
  {
    name: "admin",
    permissions: ["read:any", "write:any", "admin:any"] satisfies Permission[],
  },
];

export const OPENSYBER_ROLES: readonly RoleDefinition[] = [
  {
    name: "agent_executor",
    permissions: [
      "agents:read",
      "agents:run",
      "skills:read",
    ] satisfies Permission[],
  },
  {
    name: "org_user",
    permissions: [
      "agents:read",
      "agents:write",
      "skills:read",
      "skills:install",
      "alerts:read",
    ] satisfies Permission[],
  },
  {
    name: "org_admin",
    permissions: [
      "agents:read",
      "agents:write",
      "agents:delete",
      "skills:read",
      "skills:install",
      "skills:publish",
      "alerts:read",
      "alerts:write",
      "billing:read",
      "billing:write",
    ] satisfies Permission[],
  },
];

export const TENANTIQ_ROLES: readonly RoleDefinition[] = [
  {
    name: "tenant_viewer",
    permissions: ["tenant:read", "alerts:read"] satisfies Permission[],
  },
  {
    name: "tenant_engineer",
    permissions: [
      "tenant:read",
      "tenant:write",
      "alerts:read",
      "alerts:write",
      "runbooks:run",
    ] satisfies Permission[],
  },
  {
    name: "tenant_admin",
    permissions: [
      "tenant:read",
      "tenant:write",
      "tenant:delete",
      "alerts:read",
      "alerts:write",
      "runbooks:run",
      "members:write",
      "billing:read",
    ] satisfies Permission[],
  },
  {
    name: "platform_admin",
    permissions: [
      "platform:read",
      "platform:write",
      "tenant:read",
      "tenant:write",
      "tenant:delete",
      "alerts:read",
      "alerts:write",
      "members:write",
      "billing:read",
      "billing:write",
    ] satisfies Permission[],
  },
  {
    name: "contractor",
    permissions: ["tenant:read", "alerts:read", "runbooks:run"] satisfies Permission[],
  },
];
