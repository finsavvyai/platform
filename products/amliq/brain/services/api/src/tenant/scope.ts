/**
 * Tenant scope derivation + `require*` guards.
 *
 * Pure functions over `TenantContext.roles`. No I/O, no side effects.
 *
 * Role grammar (Brain SKU, complementary to AMLIQ `aml:decision:write`):
 *   - `brain:<resource>:read`   → read scope
 *   - `brain:<resource>:write`  → read + write scope
 *   - `brain:admin`             → read + write + admin scope
 *
 * 100% line + branch coverage required.
 */

import { TenantError, type TenantContext, type TenantScope } from "./types.js";

const ADMIN_ROLE = "brain:admin";
const WRITE_SUFFIX = ":write";
const READ_SUFFIX = ":read";
const BRAIN_PREFIX = "brain:";

const isBrainRole = (role: string): boolean => role.startsWith(BRAIN_PREFIX);

const grantsWrite = (role: string): boolean =>
  isBrainRole(role) && role.endsWith(WRITE_SUFFIX);

const grantsRead = (role: string): boolean =>
  isBrainRole(role) &&
  (role.endsWith(READ_SUFFIX) || role.endsWith(WRITE_SUFFIX));

const grantsAdmin = (role: string): boolean => role === ADMIN_ROLE;

/**
 * Pure mapping `roles -> TenantScope`. Admin implies write implies read.
 * Unknown / non-brain roles contribute nothing.
 */
export const deriveScope = (ctx: TenantContext): TenantScope => {
  let read = false;
  let write = false;
  let admin = false;
  for (const role of ctx.roles) {
    if (grantsAdmin(role)) {
      admin = true;
      write = true;
      read = true;
      continue;
    }
    if (grantsWrite(role)) {
      write = true;
      read = true;
      continue;
    }
    if (grantsRead(role)) {
      read = true;
    }
  }
  return Object.freeze({ read, write, admin });
};

/** Throw `TenantError("tenant.scope_denied")` unless read scope is granted. */
export const requireRead = (ctx: TenantContext): void => {
  if (!deriveScope(ctx).read) {
    throw new TenantError("tenant.scope_denied", "read scope required");
  }
};

/** Throw `TenantError("tenant.scope_denied")` unless write scope is granted. */
export const requireWrite = (ctx: TenantContext): void => {
  if (!deriveScope(ctx).write) {
    throw new TenantError("tenant.scope_denied", "write scope required");
  }
};

/** Throw `TenantError("tenant.scope_denied")` unless admin scope is granted. */
export const requireAdmin = (ctx: TenantContext): void => {
  if (!deriveScope(ctx).admin) {
    throw new TenantError("tenant.scope_denied", "admin scope required");
  }
};
