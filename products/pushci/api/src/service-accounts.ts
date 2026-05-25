// Service accounts + fine-grained API tokens. Closes enterprise gaps:
//   §2.1 service-accounts (non-human identities distinct from user JWTs)
//   #9   token scopes       (per-token capability allowlist)
//
// Design:
//   - A service account is org-scoped and has its own lifecycle
//     (create, disable, delete) independent of any one user.
//   - An API token may be bound to a service account or created ad-hoc
//     by a user. Either way it carries a JSON array of scope strings
//     from a fixed vocabulary (see SCOPES below). Middleware
//     (see requireScope) checks the requested scope against the token.
//   - Plaintext tokens are returned exactly once on create. We persist
//     only the SHA-256 hash so a DB dump can't be replayed.
//
// Scope vocabulary is deliberately coarse (noun:verb). We can split
// finer later without breaking callers — e.g. "runs:read" stays valid
// when "runs:read:public" is introduced, because checks are substring-
// prefix only at the ":" boundary (see scopeSatisfies).

import { Hono } from "hono";
import type { Env } from "./types";
import type { Context, Next } from "hono";
import { getAuthUser } from "./team-auth";

export const SCOPES = [
  "runs:read",
  "runs:write",
  "projects:read",
  "projects:write",
  "secrets:read",
  "secrets:write",
  "audit:read",
  "audit:export",
  "billing:read",
  "admin",                 // wildcard — allows everything
] as const;
export type Scope = (typeof SCOPES)[number];

function ulid(): string {
  // Crockford-style ULID approximation — enough entropy for row IDs,
  // doesn't pull in a dep. Not cryptographic; token secrets use webcrypto.
  const t = Date.now().toString(36).padStart(10, "0");
  const r = Array.from(crypto.getRandomValues(new Uint8Array(10)),
    (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
  return (t + r).toUpperCase();
}

function generateTokenPlaintext(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `pctk_${hex}`;
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(s));
  return Array.from(new Uint8Array(digest),
    (b) => b.toString(16).padStart(2, "0")).join("");
}

async function requireOrgMember(
  env: Env, userSub: string, orgId: string,
): Promise<"owner" | "admin" | "member" | null> {
  const row = await env.DB.prepare(
    "SELECT role FROM org_members WHERE org_id=? AND user_sub=?",
  ).bind(orgId, userSub).first<{ role: "owner" | "admin" | "member" }>();
  return row?.role ?? null;
}

function scopeSatisfies(granted: string[], required: Scope): boolean {
  if (granted.includes("admin")) return true;
  return granted.includes(required);
}

/** Middleware factory. Apply to any route that should accept a `pctk_*`
 *  bearer token. On success stashes the resolved token row on the context
 *  so handlers can read the org_id without a second query. Falls through
 *  to 401 if the token is missing/invalid/revoked/expired/under-scoped. */
export function requireScope(required: Scope) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const auth = c.req.header("authorization") ?? "";
    const bearer = auth.replace("Bearer ", "");
    if (!bearer.startsWith("pctk_")) return c.json({ error: "invalid_token" }, 401);

    const hash = await sha256Hex(bearer);
    const row = await c.env.DB.prepare(
      `SELECT id, org_id, scopes_json, expires_at, revoked_at, service_account_id
       FROM api_tokens WHERE token_hash=?`,
    ).bind(hash).first<{
      id: string; org_id: string; scopes_json: string;
      expires_at: number | null; revoked_at: number | null;
      service_account_id: string | null;
    }>();
    if (!row) return c.json({ error: "invalid_token" }, 401);

    const now = Math.floor(Date.now() / 1000);
    if (row.revoked_at) return c.json({ error: "token_revoked" }, 401);
    if (row.expires_at && row.expires_at < now) return c.json({ error: "token_expired" }, 401);

    const scopes = (JSON.parse(row.scopes_json) as string[]) ?? [];
    if (!scopeSatisfies(scopes, required)) {
      return c.json({ error: "insufficient_scope", required, granted: scopes }, 403);
    }

    await c.env.DB.prepare("UPDATE api_tokens SET last_used_at=? WHERE id=?")
      .bind(now, row.id).run();

    // @ts-expect-error — Hono's Variables typing is opt-in per route group.
    c.set("apiToken", { id: row.id, orgId: row.org_id, scopes, serviceAccountId: row.service_account_id });
    await next();
  };
}

export const serviceAccountRoutes = new Hono<{ Bindings: Env }>();

/** POST /api/orgs/:orgId/service-accounts — create a new service account. */
serviceAccountRoutes.post("/orgs/:orgId/service-accounts", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const orgId = c.req.param("orgId");
  const role = await requireOrgMember(c.env, user.sub, orgId);
  if (role !== "owner" && role !== "admin") return c.json({ error: "forbidden" }, 403);

  const { name, description } = await c.req.json<{ name: string; description?: string }>();
  if (!name) return c.json({ error: "name_required" }, 400);

  const id = ulid();
  const now = Math.floor(Date.now() / 1000);
  try {
    await c.env.DB.prepare(
      `INSERT INTO service_accounts(id, org_id, name, description, created_at, created_by)
       VALUES(?, ?, ?, ?, ?, ?)`,
    ).bind(id, orgId, name, description ?? null, now, user.sub).run();
  } catch {
    return c.json({ error: "name_taken" }, 409);
  }
  return c.json({ id, org_id: orgId, name, description: description ?? null, created_at: now });
});

/** GET /api/orgs/:orgId/service-accounts — list org service accounts. */
serviceAccountRoutes.get("/orgs/:orgId/service-accounts", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const orgId = c.req.param("orgId");
  if (!(await requireOrgMember(c.env, user.sub, orgId))) {
    return c.json({ error: "forbidden" }, 403);
  }
  const rows = await c.env.DB.prepare(
    `SELECT id, name, description, created_at, created_by, disabled_at
     FROM service_accounts WHERE org_id=? ORDER BY created_at DESC`,
  ).bind(orgId).all();
  return c.json({ service_accounts: rows.results });
});

/** POST /api/orgs/:orgId/service-accounts/:saId/disable — disable. */
serviceAccountRoutes.post("/orgs/:orgId/service-accounts/:saId/disable", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const orgId = c.req.param("orgId");
  const saId = c.req.param("saId");
  const role = await requireOrgMember(c.env, user.sub, orgId);
  if (role !== "owner" && role !== "admin") return c.json({ error: "forbidden" }, 403);

  await c.env.DB.prepare(
    "UPDATE service_accounts SET disabled_at=? WHERE id=? AND org_id=?",
  ).bind(Math.floor(Date.now() / 1000), saId, orgId).run();
  // Cascade: revoke any live tokens bound to this service account.
  await c.env.DB.prepare(
    "UPDATE api_tokens SET revoked_at=? WHERE service_account_id=? AND revoked_at IS NULL",
  ).bind(Math.floor(Date.now() / 1000), saId).run();
  return c.json({ disabled: true });
});

// --- Scoped API tokens ---

export const apiTokenRoutes = new Hono<{ Bindings: Env }>();

/** POST /api/orgs/:orgId/tokens — mint a new scoped token. Returns the
 *  plaintext exactly once; callers must store it immediately. */
apiTokenRoutes.post("/orgs/:orgId/tokens", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const orgId = c.req.param("orgId");
  const role = await requireOrgMember(c.env, user.sub, orgId);
  if (role !== "owner" && role !== "admin") return c.json({ error: "forbidden" }, 403);

  const body = await c.req.json<{
    name: string; scopes: string[]; service_account_id?: string;
    expires_at?: number;
  }>();
  if (!body.name) return c.json({ error: "name_required" }, 400);
  if (!Array.isArray(body.scopes) || body.scopes.length === 0) {
    return c.json({ error: "scopes_required" }, 400);
  }
  const bad = body.scopes.filter((s) => !SCOPES.includes(s as Scope));
  if (bad.length) return c.json({ error: "unknown_scopes", unknown: bad }, 400);

  const plaintext = generateTokenPlaintext();
  const hash = await sha256Hex(plaintext);
  const id = ulid();
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    `INSERT INTO api_tokens(id, org_id, name, token_hash, scopes_json,
                             created_at, created_by, service_account_id, expires_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, orgId, body.name, hash, JSON.stringify(body.scopes),
    now, user.sub, body.service_account_id ?? null, body.expires_at ?? null,
  ).run();

  return c.json({
    id, name: body.name, scopes: body.scopes,
    token: plaintext,         // one-time
    created_at: now,
    expires_at: body.expires_at ?? null,
  });
});

/** GET /api/orgs/:orgId/tokens — list tokens (no plaintext). */
apiTokenRoutes.get("/orgs/:orgId/tokens", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const orgId = c.req.param("orgId");
  if (!(await requireOrgMember(c.env, user.sub, orgId))) {
    return c.json({ error: "forbidden" }, 403);
  }
  const rows = await c.env.DB.prepare(
    `SELECT id, name, scopes_json, created_at, created_by, service_account_id,
            last_used_at, expires_at, revoked_at
     FROM api_tokens WHERE org_id=? ORDER BY created_at DESC`,
  ).bind(orgId).all<{
    id: string; name: string; scopes_json: string; created_at: number;
    created_by: string; service_account_id: string | null;
    last_used_at: number | null; expires_at: number | null; revoked_at: number | null;
  }>();
  return c.json({
    tokens: rows.results.map((r) => ({
      ...r, scopes: JSON.parse(r.scopes_json), scopes_json: undefined,
    })),
  });
});

/** POST /api/orgs/:orgId/tokens/:tokenId/revoke — revoke immediately. */
apiTokenRoutes.post("/orgs/:orgId/tokens/:tokenId/revoke", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const orgId = c.req.param("orgId");
  const tokenId = c.req.param("tokenId");
  const role = await requireOrgMember(c.env, user.sub, orgId);
  if (role !== "owner" && role !== "admin") return c.json({ error: "forbidden" }, 403);

  await c.env.DB.prepare(
    "UPDATE api_tokens SET revoked_at=? WHERE id=? AND org_id=?",
  ).bind(Math.floor(Date.now() / 1000), tokenId, orgId).run();
  return c.json({ revoked: true });
});
