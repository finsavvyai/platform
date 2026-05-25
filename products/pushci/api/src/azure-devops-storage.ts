// KV-backed storage + auth helpers for azure-devops-routes.ts.
// Split out to keep both files ≤200 lines (portfolio CLAUDE.md rule).
//
// Storage key: `azure:conn:${userSub}:${connectionId}` in the RUNNERS KV.
//
// License: Apache-2.0

import { verifyJwt } from "./auth";
import type { Env } from "./types";
import type { AzureAuth } from "./azure-devops-auth";

export const KV_PREFIX = "azure:conn:";

export interface StoredConnection {
  id: string;
  label: string;
  org: string;
  pat: string;
  created_at: string;
  updated_at: string;
}

export interface RedactedConnection {
  id: string;
  label: string;
  org: string;
  patPreview: string;
  created_at: string;
  updated_at: string;
}

export async function getUserSub(c: any): Promise<string | null> {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  return payload ? payload.sub : null;
}

/** Mask all but the first/last 4 characters of the stored PAT. */
export function redact(conn: StoredConnection): RedactedConnection {
  const t = conn.pat;
  const preview = t.length > 8 ? `${t.slice(0, 4)}…${t.slice(-4)}` : "***";
  return {
    id: conn.id,
    label: conn.label,
    org: conn.org,
    patPreview: preview,
    created_at: conn.created_at,
    updated_at: conn.updated_at,
  };
}

export const connKey = (sub: string, id: string): string => `${KV_PREFIX}${sub}:${id}`;

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
      // skip malformed entries (KV corruption or partial writes)
    }
  }
  return out;
}

export const toAuth = (c: StoredConnection): AzureAuth => ({ pat: c.pat });
