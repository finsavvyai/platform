// CircleCI API v2 client — poll+mirror bridge for users still on CircleCI.
// Authenticates with a Personal API Token in the `Circle-Token` header.
// See https://circleci.com/docs/api/v2/ for the full spec. This module is
// orthogonal to internal/platform/circleci.go (inbound webhook handler).
// Runs on Cloudflare Workers: uses the global `fetch` — no node:http.
// License: Apache-2.0

export interface CircleCIAuth {
  apiToken: string;
}

export interface CircleCIPipeline {
  id: string;
  number: number;
  project_slug: string;
  state: string;
  created_at: string;
  updated_at?: string;
  vcs?: { branch?: string; tag?: string; revision?: string; origin_repository_url?: string };
  trigger?: { type?: string; received_at?: string };
}

export interface CircleCIWorkflow {
  id: string;
  name: string;
  pipeline_id: string;
  pipeline_number?: number;
  project_slug: string;
  status: CircleCIWorkflowStatus;
  created_at: string;
  stopped_at?: string | null;
}

export type CircleCIWorkflowStatus =
  | "success" | "failed" | "error" | "running" | "on_hold"
  | "not_run" | "canceled" | "failing" | "unauthorized";

export type PushCIStatus = "passed" | "failed" | "running" | "pending" | "stopped" | "unknown";

const API = "https://circleci.com/api/v2";

function headers(auth: CircleCIAuth, contentType?: string): HeadersInit {
  const h: Record<string, string> = {
    "Circle-Token": auth.apiToken,
    Accept: "application/json",
  };
  if (contentType) h["Content-Type"] = contentType;
  return h;
}

async function expectOk(res: Response, ctx: string): Promise<void> {
  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch { /* ignore */ }
    throw new Error(`circleci ${ctx} failed: ${res.status} ${body.slice(0, 200)}`);
  }
}

/** CircleCI expects segments URL-encoded but '/' separators preserved. */
function encodeSlug(slug: string): string {
  return slug.split("/").map((seg) => encodeURIComponent(seg)).join("/");
}

/** GET /me/collaborations — list orgs the token can see. */
export async function listCollaborations(
  auth: CircleCIAuth
): Promise<Array<{ slug: string; name: string; vcs_type: string }>> {
  const res = await fetch(`${API}/me/collaborations`, { headers: headers(auth) });
  await expectOk(res, "listCollaborations");
  return (await res.json()) as Array<{ slug: string; name: string; vcs_type: string }>;
}

/** GET /project/{slug}/pipeline — list recent pipelines for a project. */
export async function listPipelines(
  projectSlug: string,
  auth: CircleCIAuth,
  opts: { branch?: string; pageToken?: string } = {}
): Promise<{ items: CircleCIPipeline[]; next_page_token?: string }> {
  const params = new URLSearchParams();
  if (opts.branch) params.set("branch", opts.branch);
  if (opts.pageToken) params.set("page-token", opts.pageToken);
  const qs = params.toString() ? `?${params}` : "";
  const url = `${API}/project/${encodeSlug(projectSlug)}/pipeline${qs}`;
  const res = await fetch(url, { headers: headers(auth) });
  await expectOk(res, `listPipelines(${projectSlug})`);
  return (await res.json()) as { items: CircleCIPipeline[]; next_page_token?: string };
}

/** GET /pipeline/{id} — fetch a specific pipeline record. */
export async function getPipeline(id: string, auth: CircleCIAuth): Promise<CircleCIPipeline> {
  const res = await fetch(`${API}/pipeline/${id}`, { headers: headers(auth) });
  await expectOk(res, `getPipeline(${id})`);
  return (await res.json()) as CircleCIPipeline;
}

/** GET /pipeline/{id}/workflow — list workflows attached to a pipeline. */
export async function getPipelineWorkflows(
  id: string,
  auth: CircleCIAuth
): Promise<CircleCIWorkflow[]> {
  const res = await fetch(`${API}/pipeline/${id}/workflow`, { headers: headers(auth) });
  await expectOk(res, `getPipelineWorkflows(${id})`);
  const body = (await res.json()) as { items?: CircleCIWorkflow[] };
  return body.items ?? [];
}

/** POST /project/{slug}/pipeline — trigger a new pipeline run. */
export async function triggerPipeline(
  projectSlug: string,
  payload: { branch?: string; tag?: string; parameters?: Record<string, string | number | boolean> },
  auth: CircleCIAuth
): Promise<{ id: string; number: number; state: string; created_at: string }> {
  const url = `${API}/project/${encodeSlug(projectSlug)}/pipeline`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(auth, "application/json"),
    body: JSON.stringify(payload),
  });
  if (res.status !== 201 && res.status !== 200) {
    await expectOk(res, `triggerPipeline(${projectSlug})`);
  }
  return (await res.json()) as { id: string; number: number; state: string; created_at: string };
}

/**
 * Map CircleCI workflow/pipeline status → PushCI run status vocabulary.
 * Token sets overlap enough for a single normaliser across both layers.
 */
export function circleCIStatusToPushCI(
  status: CircleCIWorkflowStatus | string | undefined | null
): PushCIStatus {
  if (!status) return "unknown";
  switch (status) {
    case "success":
      return "passed";
    case "failed":
    case "failing":
    case "error":
    case "unauthorized":
      return "failed";
    case "running":
    case "on_hold":
      return "running";
    case "not_run":
    case "created":
    case "setup":
    case "setup-pending":
    case "pending":
      return "pending";
    case "canceled":
      return "stopped";
    default:
      return "unknown";
  }
}
