// Multi-tenant workspace routing list for the Cepien integration.
// Fixes C-001 (cross-tenant workspace hijack): a single KV pointer key
// `cepien:lookup:${workspaceId}` was overwritten whenever a second user
// registered the same Cepien `workspaceId`. Now we store a list of
// candidate `{sub, connectionId}` entries and disambiguate on the webhook
// path by HMAC-verifying the request body against each candidate's
// `sharedSecret`. First match wins; no match = 401.
//
// License: Apache-2.0

import type { Env } from "./types";

/** Candidate pointer from Cepien `workspaceId` → an owner/connection pair. */
export interface WorkspaceCandidate {
  sub: string;             // JWT subject of the owning user
  connectionId: string;    // StoredWorkspace.id (internal UUID)
}

export const KV_WS_LIST_PREFIX = "cepien:workspace_connections:";
export const KV_LEGACY_LOOKUP_PREFIX = "cepien:lookup:";

export const wsListKey = (workspaceId: string): string =>
  `${KV_WS_LIST_PREFIX}${workspaceId}`;
export const legacyLookupKey = (workspaceId: string): string =>
  `${KV_LEGACY_LOOKUP_PREFIX}${workspaceId}`;

function parseList(raw: string | null): WorkspaceCandidate[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    const out: WorkspaceCandidate[] = [];
    for (const item of v) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      if (typeof rec.sub === "string" && typeof rec.connectionId === "string") {
        out.push({ sub: rec.sub, connectionId: rec.connectionId });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Read the current candidate list for a Cepien workspaceId. */
export async function readCandidates(
  env: Env, workspaceId: string
): Promise<WorkspaceCandidate[]> {
  const raw = await env.RUNNERS.get(wsListKey(workspaceId));
  return parseList(raw);
}

/**
 * Append a candidate; dedup on (sub, connectionId). Safe to call on every
 * saveWorkspace — idempotent.
 */
export async function addCandidate(
  env: Env, workspaceId: string, cand: WorkspaceCandidate
): Promise<void> {
  const list = await readCandidates(env, workspaceId);
  const already = list.some(
    (c) => c.sub === cand.sub && c.connectionId === cand.connectionId
  );
  const next = already ? list : [...list, cand];
  await env.RUNNERS.put(wsListKey(workspaceId), JSON.stringify(next));
}

/** Remove a candidate by (sub, connectionId). Deletes the key when empty. */
export async function removeCandidate(
  env: Env, workspaceId: string, cand: WorkspaceCandidate
): Promise<void> {
  const list = await readCandidates(env, workspaceId);
  const next = list.filter(
    (c) => !(c.sub === cand.sub && c.connectionId === cand.connectionId)
  );
  if (next.length === 0) {
    await env.RUNNERS.delete(wsListKey(workspaceId));
    return;
  }
  await env.RUNNERS.put(wsListKey(workspaceId), JSON.stringify(next));
}

/**
 * One-shot migration: if the legacy single-pointer key still exists,
 * read it once, merge its (sub, connectionId) into the list (if derivable),
 * then delete the legacy key. Call from the webhook read path. Safe to
 * remove after v1.7.0 when all deployments have rolled over.
 */
export async function migrateLegacyPointer(
  env: Env, workspaceId: string
): Promise<WorkspaceCandidate[]> {
  const legacy = await env.RUNNERS.get(legacyLookupKey(workspaceId));
  if (!legacy) return readCandidates(env, workspaceId);
  // Legacy pointer was the primary key `cepien:workspace:${sub}:${wsId}`.
  // We can't reconstruct the internal connectionId without reading the
  // primary record, but the candidate list only needs (sub, connectionId)
  // to locate the primary record — the primary is keyed by sub+wsId not
  // connectionId. So we use connectionId="" as a sentinel meaning
  // "load via sub+workspaceId".
  // Legacy pointer format: `cepien:workspace:${sub}:${workspaceId}`. Sub may
  // contain colons (e.g. "user:alice"), so reverse-parse by stripping the
  // known prefix + the trailing `:${workspaceId}` suffix.
  const PREFIX = "cepien:workspace:";
  const suffix = `:${workspaceId}`;
  if (legacy.startsWith(PREFIX) && legacy.endsWith(suffix)) {
    const sub = legacy.slice(PREFIX.length, legacy.length - suffix.length);
    if (sub) await addCandidate(env, workspaceId, { sub, connectionId: "" });
  }
  await env.RUNNERS.delete(legacyLookupKey(workspaceId));
  return readCandidates(env, workspaceId);
}
