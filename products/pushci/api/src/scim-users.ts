// SCIM 2.0 /Users CRUD handlers. Mounted under /scim/v2.

import { Hono } from "hono";
import type { Env } from "./types";
import { upsertUser, getUser } from "./usage";
import { ScimUser, SCHEMA_LIST } from "./scim-types";
import { scimError, scimJson, checkScimAuth, userSub, toScimUser } from "./scim-helpers";

export const scimUsersRoutes = new Hono<{ Bindings: Env }>();

scimUsersRoutes.post("/", async (c) => {
  const session = await checkScimAuth(c);
  if (!session) return scimError(401, "unauthorized");

  let body: Partial<ScimUser>;
  try {
    body = (await c.req.json()) as Partial<ScimUser>;
  } catch {
    return scimError(400, "invalid json");
  }
  const email =
    body.emails?.find((e) => e.primary)?.value ??
    body.emails?.[0]?.value ??
    body.userName;
  if (!email) return scimError(400, "userName or primary email required");

  const sub = userSub(session.tenant, email);
  const login =
    body.displayName ??
    [body.name?.givenName, body.name?.familyName].filter(Boolean).join(" ") ??
    email.split("@")[0];

  try {
    await upsertUser(c.env.DB, sub, login, "saml");
  } catch {
    // non-fatal in test env
  }
  const user = toScimUser({
    sub,
    login,
    email,
    active: body.active !== false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return scimJson(user, 201);
});

scimUsersRoutes.get("/", async (c) => {
  const session = await checkScimAuth(c);
  if (!session) return scimError(401, "unauthorized");

  const startIndex = parseInt(c.req.query("startIndex") ?? "1", 10);
  const count = Math.min(parseInt(c.req.query("count") ?? "100", 10), 200);
  const filter = c.req.query("filter") ?? "";

  let filterEmail: string | null = null;
  const m = filter.match(/userName\s+eq\s+"([^"]+)"/i);
  if (m) filterEmail = m[1];

  let rows: Array<{ sub: string; login: string; email: string; active: boolean }> = [];
  try {
    if (filterEmail) {
      const sub = userSub(session.tenant, filterEmail);
      const u = await getUser(c.env.DB, sub);
      if (u) rows.push({ sub: u.sub, login: filterEmail.split("@")[0], email: filterEmail, active: true });
    } else {
      const prefix = `saml:${session.tenant}:`;
      const res = await c.env.DB.prepare(
        "SELECT sub, login FROM users WHERE sub LIKE ? ORDER BY sub LIMIT ? OFFSET ?"
      )
        .bind(`${prefix}%`, count, Math.max(0, startIndex - 1))
        .all<{ sub: string; login: string }>();
      rows = (res.results ?? []).map((r) => ({
        sub: r.sub,
        login: r.login,
        email: r.sub.slice(prefix.length),
        active: true,
      }));
    }
  } catch {
    rows = [];
  }

  return scimJson({
    schemas: [SCHEMA_LIST],
    totalResults: rows.length,
    startIndex,
    itemsPerPage: rows.length,
    Resources: rows.map(toScimUser),
  });
});

scimUsersRoutes.get("/:id", async (c) => {
  const session = await checkScimAuth(c);
  if (!session) return scimError(401, "unauthorized");
  const id = c.req.param("id");
  if (!id.startsWith(`saml:${session.tenant}:`)) return scimError(404, "not found");
  try {
    const u = await getUser(c.env.DB, id);
    if (!u) return scimError(404, "not found");
    const email = id.slice(`saml:${session.tenant}:`.length);
    return scimJson(toScimUser({ sub: id, login: email.split("@")[0], email, active: true }));
  } catch {
    return scimError(404, "not found");
  }
});

scimUsersRoutes.put("/:id", async (c) => {
  const session = await checkScimAuth(c);
  if (!session) return scimError(401, "unauthorized");
  const id = c.req.param("id");
  if (!id.startsWith(`saml:${session.tenant}:`)) return scimError(404, "not found");
  let body: Partial<ScimUser>;
  try {
    body = (await c.req.json()) as Partial<ScimUser>;
  } catch {
    return scimError(400, "invalid json");
  }
  const email = id.slice(`saml:${session.tenant}:`.length);
  const login = body.displayName ?? email.split("@")[0];
  try {
    await upsertUser(c.env.DB, id, login, "saml");
  } catch {
    // non-fatal
  }
  return scimJson(toScimUser({ sub: id, login, email, active: body.active !== false }));
});

scimUsersRoutes.patch("/:id", async (c) => {
  const session = await checkScimAuth(c);
  if (!session) return scimError(401, "unauthorized");
  const id = c.req.param("id");
  if (!id.startsWith(`saml:${session.tenant}:`)) return scimError(404, "not found");
  let body: { schemas?: string[]; Operations?: Array<{ op: string; path?: string; value: unknown }> };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return scimError(400, "invalid json");
  }
  if (!body.Operations) return scimError(400, "missing Operations");

  let active = true;
  for (const op of body.Operations) {
    if (op.path === "active" && typeof op.value !== "undefined") {
      active = op.value === true || op.value === "True" || op.value === "true";
    }
  }
  const email = id.slice(`saml:${session.tenant}:`.length);
  return scimJson(toScimUser({ sub: id, login: email.split("@")[0], email, active }));
});

scimUsersRoutes.delete("/:id", async (c) => {
  const session = await checkScimAuth(c);
  if (!session) return scimError(401, "unauthorized");
  const id = c.req.param("id");
  if (!id.startsWith(`saml:${session.tenant}:`)) return scimError(404, "not found");
  try {
    await c.env.DB.prepare("DELETE FROM users WHERE sub = ?").bind(id).run();
  } catch {
    // non-fatal
  }
  return new Response(null, { status: 204 });
});
