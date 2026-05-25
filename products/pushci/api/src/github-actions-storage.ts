// KV-backed storage + JWT auth helpers for github-actions-routes.ts.
// Split out so the routes file stays under the 200-line portfolio cap.
//
// KV key layout: `gha:conn:${userSub}:${connectionId}` in the RUNNERS
// KV namespace. Token is stored as-is (KV is tenant-scoped per Worker)
// and redacted in every outbound API response.
//
// License: Apache-2.0

import { verifyJwt } from "./auth";
import type { Env } from "./types";
import type { GitHubAuth } from "./github-actions-client";

export const KV_PREFIX = "gha:conn:";

export interface StoredConnection {
  id: string;
  label: string;
  /** GitHub login/user/org the token identifies as — purely a UI hint. */
  login?: string;
  token: string;
  created_at: string;
  updated_at: string;
}

export interface RedactedConnection {
  id: string;
  label: string;
  login?: string;
  tokenPreview: string;
  created_at: string;
  updated_at: string;
}

// Hono's `Context` typing requires Env/Variables generics; at the helper
// layer we only need c.req + c.env so a minimal structural type keeps us
// free of a hard Hono import (and free of `any`).
export interface AuthedCtx {
  req: { header(name: string): string | undefined };
  env: Env;
}

export async function getUserSub(c: AuthedCtx): Promise<string | null> {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  return payload ? payload.sub : null;
}

/** Redact all but the first/last 4 characters of the GitHub token. */
export function redact(conn: StoredConnection): RedactedConnection {
  const t = conn.token;
  const preview = t.length > 8 ? `${t.slice(0, 4)}…${t.slice(-4)}` : "***";
  return {
    id: conn.id,
    label: conn.label,
    login: conn.login,
    tokenPreview: preview,
    created_at: conn.created_at,
    updated_at: conn.updated_at,
  };
}

export const connKey = (sub: string, id: string): string => `${KV_PREFIX}${sub}:${id}`;

export async function loadConn(
  env: Env, sub: string, id: string
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
      // skip malformed entries (KV corruption or partial writes)
    }
  }
  return out;
}

export const toAuth = (c: StoredConnection): GitHubAuth => ({ token: c.token });
