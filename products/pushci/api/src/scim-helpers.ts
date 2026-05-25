// SCIM 2.0 response builders, auth check, and user shape mapping.

import type { Env } from "./types";
import { ScimUser, SCHEMA_USER, SCHEMA_ERROR } from "./scim-types";

export function scimError(status: number, detail: string): Response {
  return new Response(
    JSON.stringify({ schemas: [SCHEMA_ERROR], status: String(status), detail }),
    {
      status,
      headers: { "Content-Type": "application/scim+json" },
    }
  );
}

export function scimJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/scim+json" },
  });
}

export async function checkScimAuth(c: {
  req: { header: (n: string) => string | undefined; query: (n: string) => string | undefined };
  env: Env;
}): Promise<{ tenant: string } | null> {
  const auth = c.req.header("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  const tenant = c.req.query("tenant") ?? "default";
  const stored = await c.env.RUNNERS.get(`scim:token:${tenant}`);
  if (!stored || stored !== token) return null;
  return { tenant };
}

export function userSub(tenant: string, email: string): string {
  return `saml:${tenant}:${email}`;
}

export function toScimUser(row: {
  sub: string;
  login: string;
  email: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}): ScimUser {
  const now = new Date().toISOString();
  return {
    schemas: [SCHEMA_USER],
    id: row.sub,
    userName: row.email,
    displayName: row.login,
    emails: [{ value: row.email, primary: true, type: "work" }],
    active: row.active,
    meta: {
      resourceType: "User",
      created: row.created_at ?? now,
      lastModified: row.updated_at ?? now,
    },
  };
}
