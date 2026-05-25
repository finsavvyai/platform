// Bitbucket connection storage helpers shared by `bitbucket-routes.ts`.
// Keeping this separate keeps the routes file under the 200-line cap.
//
// KV layout: `bb:conn:<userSub>:<id>` → JSON StoredConnection.
// License: Apache-2.0

import { verifyJwt } from "./auth";
import type { Env } from "./types";
import type { BitbucketAuth } from "./bitbucket";

export const KV_PREFIX = "bb:conn:";

export interface StoredConnection {
  id: string;
  label: string;
  user?: string;
  appPassword?: string;
  bearer?: string;
  defaultWorkspace?: string;
  created_at: string;
  updated_at: string;
}

export interface RedactedConnection {
  id: string;
  label: string;
  user?: string;
  authType: "app-password" | "bearer";
  secretPreview: string;
  defaultWorkspace?: string;
  created_at: string;
  updated_at: string;
}

export async function getUserSub(c: any): Promise<string | null> {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  return payload ? payload.sub : null;
}

function preview(s: string): string {
  return s.length > 8 ? `${s.slice(0, 4)}…${s.slice(-4)}` : "***";
}

export function redact(c: StoredConnection): RedactedConnection {
  const secret = c.bearer ?? c.appPassword ?? "";
  return {
    id: c.id,
    label: c.label,
    user: c.user,
    authType: c.bearer ? "bearer" : "app-password",
    secretPreview: preview(secret),
    defaultWorkspace: c.defaultWorkspace,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

export function connKey(sub: string, id: string): string {
  return `${KV_PREFIX}${sub}:${id}`;
}

export async function loadConn(
  env: Env,
  sub: string,
  id: string
): Promise<StoredConnection | null> {
  const raw = await env.RUNNERS.get(connKey(sub, id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredConnection;
  } catch {
    return null;
  }
}

export async function listConns(env: Env, sub: string): Promise<StoredConnection[]> {
  const list = await env.RUNNERS.list({ prefix: `${KV_PREFIX}${sub}:` });
  const out: StoredConnection[] = [];
  for (const key of list.keys) {
    const raw = await env.RUNNERS.get(key.name);
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw) as StoredConnection);
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

export function toAuth(c: StoredConnection): BitbucketAuth {
  return { user: c.user, appPassword: c.appPassword, bearer: c.bearer };
}
