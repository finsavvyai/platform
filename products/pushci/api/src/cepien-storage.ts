// KV-backed workspace credentials for the Cepien integration.
// Key layout: `cepien:workspace:${userSub}:${workspaceId}` in RUNNERS KV.
// Stores the HMAC shared secret + callback bearer token; both are redacted
// in outbound API responses.
//
// Reverse lookup: `cepien:workspace_connections:${workspaceId}` = JSON list
// of `{sub, connectionId}`. See `cepien-workspace-list.ts` for the security
// rationale (C-001 cross-tenant hijack fix). License: Apache-2.0

import { verifyJwt } from "./auth";
import type { Env } from "./types";
import {
  type WorkspaceCandidate,
  readCandidates,
  addCandidate,
  removeCandidate,
  migrateLegacyPointer,
} from "./cepien-workspace-list";

export const KV_PREFIX = "cepien:workspace:";

export interface StoredWorkspace {
  id: string;                 // internal UUID — not the Cepien workspace id
  user_sub: string;
  workspaceId: string;        // Cepien's ws_xxx id
  label: string;
  sharedSecret: string;       // HMAC-SHA256 key for webhook verification
  callbackToken?: string;     // optional bearer for POST /callback_url
  created_at: string;
  updated_at: string;
}

export interface RedactedWorkspace {
  id: string;
  workspaceId: string;
  label: string;
  sharedSecretPreview: string;
  callbackTokenPreview?: string;
  created_at: string;
  updated_at: string;
}

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

function preview(s: string | undefined): string | undefined {
  if (!s) return undefined;
  return s.length > 8 ? `${s.slice(0, 4)}…${s.slice(-4)}` : "***";
}

export function redact(w: StoredWorkspace): RedactedWorkspace {
  return {
    id: w.id,
    workspaceId: w.workspaceId,
    label: w.label,
    sharedSecretPreview: preview(w.sharedSecret) ?? "***",
    callbackTokenPreview: preview(w.callbackToken),
    created_at: w.created_at,
    updated_at: w.updated_at,
  };
}

export const connKey = (sub: string, workspaceId: string): string =>
  `${KV_PREFIX}${sub}:${workspaceId}`;

export async function loadWorkspace(
  env: Env, sub: string, workspaceId: string
): Promise<StoredWorkspace | null> {
  const raw = await env.RUNNERS.get(connKey(sub, workspaceId));
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredWorkspace; } catch { return null; }
}

/**
 * All workspaces registered against a given Cepien workspaceId. May include
 * multiple tenants — callers MUST HMAC-verify the request body against each
 * candidate's `sharedSecret` and reject if none match. Never return the
 * first entry blindly; doing so is the C-001 cross-tenant hijack bug.
 */
export async function loadAllByWorkspaceId(
  env: Env, workspaceId: string
): Promise<StoredWorkspace[]> {
  const candidates = await migrateLegacyPointer(env, workspaceId);
  const out: StoredWorkspace[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    // connectionId="" sentinel = migrated legacy pointer; fall back to sub+wsId
    const key = connKey(c.sub, workspaceId);
    if (seen.has(key)) continue;
    seen.add(key);
    const raw = await env.RUNNERS.get(key);
    if (!raw) continue;
    try { out.push(JSON.parse(raw) as StoredWorkspace); } catch { /* skip */ }
  }
  return out;
}

export async function listWorkspaces(env: Env, sub: string): Promise<StoredWorkspace[]> {
  const list = await env.RUNNERS.list({ prefix: `${KV_PREFIX}${sub}:` });
  const out: StoredWorkspace[] = [];
  for (const key of list.keys) {
    const raw = await env.RUNNERS.get(key.name);
    if (!raw) continue;
    try { out.push(JSON.parse(raw) as StoredWorkspace); } catch { /* skip */ }
  }
  return out;
}

export async function saveWorkspace(env: Env, w: StoredWorkspace): Promise<void> {
  const primary = connKey(w.user_sub, w.workspaceId);
  await env.RUNNERS.put(primary, JSON.stringify(w));
  await addCandidate(env, w.workspaceId, { sub: w.user_sub, connectionId: w.id });
}

export async function deleteWorkspace(
  env: Env, sub: string, workspaceId: string
): Promise<void> {
  const existing = await loadWorkspace(env, sub, workspaceId);
  await env.RUNNERS.delete(connKey(sub, workspaceId));
  if (existing) {
    await removeCandidate(env, workspaceId, {
      sub, connectionId: existing.id,
    });
  }
  // Belt-and-suspenders: also drop any migrated-sentinel entry for this sub.
  await removeCandidate(env, workspaceId, { sub, connectionId: "" });
}

export type { WorkspaceCandidate } from "./cepien-workspace-list";
export { readCandidates } from "./cepien-workspace-list";
