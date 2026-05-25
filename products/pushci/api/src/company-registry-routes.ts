// Company registry routes — /api/registries
//
// CRUD over a user-scoped list of CompanyRegistry records. Records
// are keyed by the authenticated user's sub; the routes layer never
// trusts an ownerSub from the request body. Secret values are never
// received or returned here — callers must configure usernameRef /
// passwordRef / tokenRef to point at a secret id in the secret store.

import { Hono } from "hono";
import type { Env } from "./types";
import { verifyJwt } from "./auth";
import {
  listRegistries,
  getRegistry,
  upsertRegistry,
  deleteRegistry,
  validateRegistry,
  renderCredentialsEnvVars,
  type CompanyRegistry,
  type RegistryType,
  type RegistryAuthMode,
} from "./company-registry";

export const companyRegistryRoutes = new Hono<{ Bindings: Env }>();

async function authedSub(c: {
  req: { header: (n: string) => string | undefined };
  env: Env;
}): Promise<string | null> {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  return payload?.sub ?? null;
}

companyRegistryRoutes.get("/", async (c) => {
  const sub = await authedSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const registries = await listRegistries(c.env.RUNNERS, sub);
  return c.json({
    registries: registries.map((r) => ({
      ...r,
      envVars: renderCredentialsEnvVars(r),
    })),
  });
});

companyRegistryRoutes.get("/:id", async (c) => {
  const sub = await authedSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const r = await getRegistry(c.env.RUNNERS, sub, c.req.param("id"));
  if (!r) return c.json({ error: "not_found" }, 404);
  return c.json({ registry: r, envVars: renderCredentialsEnvVars(r) });
});

companyRegistryRoutes.post("/", async (c) => {
  const sub = await authedSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  let body: Partial<CompanyRegistry>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const errors = validateRegistry(body);
  if (errors.length > 0) {
    return c.json({ error: "validation_failed", detail: errors }, 400);
  }
  const registry = await upsertRegistry(c.env.RUNNERS, {
    ...body,
    ownerSub: sub,
    name: body.name!,
    type: body.type as RegistryType,
    url: body.url!,
    authMode: body.authMode as RegistryAuthMode,
  });
  return c.json({ registry }, 201);
});

companyRegistryRoutes.put("/:id", async (c) => {
  const sub = await authedSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  const existing = await getRegistry(c.env.RUNNERS, sub, id);
  if (!existing) return c.json({ error: "not_found" }, 404);
  let body: Partial<CompanyRegistry>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const errors = validateRegistry(body);
  if (errors.length > 0) {
    return c.json({ error: "validation_failed", detail: errors }, 400);
  }
  const registry = await upsertRegistry(c.env.RUNNERS, {
    ...body,
    id,
    ownerSub: sub,
    name: body.name!,
    type: body.type as RegistryType,
    url: body.url!,
    authMode: body.authMode as RegistryAuthMode,
  });
  return c.json({ registry });
});

companyRegistryRoutes.delete("/:id", async (c) => {
  const sub = await authedSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const removed = await deleteRegistry(
    c.env.RUNNERS,
    sub,
    c.req.param("id"),
  );
  if (!removed) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

companyRegistryRoutes.post("/:id/test", async (c) => {
  const sub = await authedSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const r = await getRegistry(c.env.RUNNERS, sub, c.req.param("id"));
  if (!r) return c.json({ error: "not_found" }, 404);
  return c.json({
    ok: false,
    error:
      "not implemented: connectivity tests for remote registries run from the runner, not Workers",
  });
});
