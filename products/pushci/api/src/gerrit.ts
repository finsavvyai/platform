// Gerrit REST API client — pure Cloudflare Workers (fetch + WebCrypto).
//
// Gerrit prefixes JSON responses with the `)]}'\n` "magic" XSSI guard.
// We strip it before JSON.parse. All authenticated endpoints live under `/a/`
// and use HTTP Basic auth with a Gerrit HTTP password.

export const GERRIT_MAGIC_PREFIX = ")]}'";

export interface GerritCredentials {
  baseUrl: string;   // e.g. https://gerrit.example.com
  httpUser: string;  // Gerrit HTTP username
  httpPassword: string; // Gerrit HTTP password
}

export interface GerritChange {
  id: string;
  change_id: string;
  project: string;
  branch: string;
  subject: string;
  status: string;
  current_revision?: string;
  _number?: number;
}

export interface GerritReviewInput {
  message?: string;
  labels?: Record<string, number>;
  tag?: string;
  notify?: "NONE" | "OWNER" | "OWNER_REVIEWERS" | "ALL";
}

export type RunLikeStatus = "pending" | "running" | "passed" | "failed" | "cancelled";

/**
 * Strip the Gerrit `)]}'` XSSI magic prefix and JSON.parse.
 * Safe to call on already-clean JSON (no prefix) — returns parsed value anyway.
 */
export function stripGerritMagic(raw: string): string {
  if (raw.startsWith(GERRIT_MAGIC_PREFIX)) {
    // Also consume the trailing newline if present.
    return raw.slice(GERRIT_MAGIC_PREFIX.length).replace(/^\r?\n/, "");
  }
  return raw;
}

export function parseGerritJson<T = unknown>(raw: string): T {
  return JSON.parse(stripGerritMagic(raw)) as T;
}

/**
 * Map a PushCI run status to a Gerrit label patch.
 * Default strategy:
 *   passed   -> Verified +1
 *   failed   -> Verified -1
 *   running  -> Verified  0 (clear)
 *   pending  -> Verified  0
 *   cancelled-> Verified  0
 */
export function labelsForRunStatus(
  status: RunLikeStatus,
  opts?: { codeReview?: number }
): Record<string, number> {
  const labels: Record<string, number> = {};
  switch (status) {
    case "passed":
      labels["Verified"] = 1;
      break;
    case "failed":
      labels["Verified"] = -1;
      break;
    default:
      labels["Verified"] = 0;
  }
  if (typeof opts?.codeReview === "number") {
    labels["Code-Review"] = opts.codeReview;
  }
  return labels;
}

function basicAuthHeader(user: string, password: string): string {
  // btoa is available in the Workers runtime.
  return "Basic " + btoa(`${user}:${password}`);
}

async function gerritFetch(
  creds: GerritCredentials,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = `${creds.baseUrl.replace(/\/$/, "")}${path}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", basicAuthHeader(creds.httpUser, creds.httpPassword));
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers });
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  return parseGerritJson<T>(text);
}

/** GET /a/config/server/version — connectivity / auth sanity check. */
export async function getServerVersion(creds: GerritCredentials): Promise<string> {
  const res = await gerritFetch(creds, "/a/config/server/version");
  if (!res.ok) throw new Error(`gerrit version failed: ${res.status}`);
  return await readJson<string>(res);
}

/** GET /a/changes/?q=project:X+status:open — list open changes for a project. */
export async function listOpenChanges(
  creds: GerritCredentials,
  project: string,
  limit = 25
): Promise<GerritChange[]> {
  const q = encodeURIComponent(`project:${project} status:open`);
  const res = await gerritFetch(creds, `/a/changes/?q=${q}&n=${limit}`);
  if (!res.ok) throw new Error(`gerrit list changes failed: ${res.status}`);
  return await readJson<GerritChange[]>(res);
}

/** GET /a/changes/{change-id}/detail */
export async function getChangeDetail(
  creds: GerritCredentials,
  changeId: string
): Promise<GerritChange> {
  const res = await gerritFetch(creds, `/a/changes/${encodeURIComponent(changeId)}/detail`);
  if (!res.ok) throw new Error(`gerrit change detail failed: ${res.status}`);
  return await readJson<GerritChange>(res);
}

/**
 * POST /a/changes/{change-id}/revisions/{revision-id}/review
 * Posts a review/label (e.g. Verified +1) on a specific revision.
 * Pass revision = "current" to target the latest patchset.
 */
export async function postReview(
  creds: GerritCredentials,
  changeId: string,
  revision: string,
  review: GerritReviewInput
): Promise<void> {
  const path = `/a/changes/${encodeURIComponent(changeId)}/revisions/${encodeURIComponent(revision)}/review`;
  const res = await gerritFetch(creds, path, {
    method: "POST",
    body: JSON.stringify(review),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`gerrit postReview failed: ${res.status} ${detail}`);
  }
}

/**
 * Post a Verified label derived from a PushCI run status.
 * Convenience wrapper that also includes a summary message.
 */
export async function postRunResult(
  creds: GerritCredentials,
  changeId: string,
  revision: string,
  status: RunLikeStatus,
  summary?: string
): Promise<void> {
  const labels = labelsForRunStatus(status);
  const message = summary ?? `PushCI run ${status}`;
  await postReview(creds, changeId, revision, {
    message,
    labels,
    tag: "autogenerated:pushci",
    notify: "OWNER",
  });
}

/** POST /a/changes/{change-id}/abandon */
export async function abandonChange(
  creds: GerritCredentials,
  changeId: string,
  message?: string
): Promise<void> {
  const res = await gerritFetch(creds, `/a/changes/${encodeURIComponent(changeId)}/abandon`, {
    method: "POST",
    body: JSON.stringify({ message: message ?? "Abandoned by PushCI" }),
  });
  if (!res.ok) throw new Error(`gerrit abandon failed: ${res.status}`);
}

/** POST /a/changes/{change-id}/submit */
export async function submitChange(
  creds: GerritCredentials,
  changeId: string
): Promise<void> {
  const res = await gerritFetch(creds, `/a/changes/${encodeURIComponent(changeId)}/submit`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`gerrit submit failed: ${res.status}`);
}
