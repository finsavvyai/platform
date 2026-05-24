import type { Subject } from "../types.js";
import type { MiddlewareHandler } from "./context.js";

export const requireRole = (
  ...allowedRoles: readonly string[]
): MiddlewareHandler => {
  if (allowedRoles.length === 0) {
    throw new Error("requireRole needs at least one role.");
  }
  const allowed = new Set(allowedRoles);
  return async (ctx, next) => {
    const subject = ctx.get("subject") as Subject | undefined;
    if (!subject) {
      return ctx.json({ error: "missing_token" }, 401);
    }
    const has = subject.roles.some((r) => allowed.has(r));
    if (!has) {
      return ctx.json({ error: "unauthorized" }, 403);
    }
    await next();
    return;
  };
};

export const requireTenant = (headerName: string = "x-tenant-id"): MiddlewareHandler => {
  return async (ctx, next) => {
    const subject = ctx.get("subject") as Subject | undefined;
    if (!subject) {
      return ctx.json({ error: "missing_token" }, 401);
    }
    if (subject.kind !== "multitenant") {
      return ctx.json({ error: "tenant_mismatch" }, 403);
    }
    const requested =
      ctx.req.header(headerName) ?? ctx.req.header(headerName.toLowerCase());
    if (!requested) {
      return ctx.json({ error: "tenant_mismatch" }, 400);
    }
    if (!subject.tenantIds.includes(requested)) {
      return ctx.json({ error: "tenant_mismatch" }, 403);
    }
    await next();
    return;
  };
};
