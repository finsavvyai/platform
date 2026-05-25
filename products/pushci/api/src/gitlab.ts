// GitLab Remote API (v4) client — Personal Access Token with `api` scope.
// Poll-based mirror: complements the webhook-in bridge at
// `internal/platform/gitlab.go` (push-based GitLab → PushCI). License: Apache-2.0

import { assertSafeBaseUrl } from "./bridge-fetch-guard";

export interface GitLabAuth {
  privateToken: string;
}

const guard = (baseUrl: string): void => assertSafeBaseUrl(baseUrl, "gitlab");
export interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
  default_branch?: string;
  visibility?: string;
  last_activity_at?: string;
}
export interface GitLabPipeline {
  id: number;
  iid?: number;
  project_id: number;
  status: string;
  ref: string;
  sha: string;
  web_url: string;
  source?: string;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration?: number | null;
}
export interface GitLabJob {
  id: number;
  name: string;
  stage: string;
  status: string;
  ref: string;
  allow_failure?: boolean;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration?: number | null;
  web_url: string;
}

const trimSlash = (u: string): string => u.replace(/\/+$/, "");
const apiUrl = (baseUrl: string, path: string): string => `${trimSlash(baseUrl)}/api/v4${path}`;

function buildHeaders(auth: GitLabAuth, contentType?: string): HeadersInit {
  const headers: Record<string, string> = { "PRIVATE-TOKEN": auth.privateToken, Accept: "application/json" };
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
}

async function expectOk(res: Response, context: string): Promise<void> {
  if (res.ok) return;
  let body = "";
  try { body = await res.text(); } catch { /* ignore */ }
  throw new Error(`gitlab ${context} failed: ${res.status} ${body.slice(0, 200)}`);
}

/** GET /projects?membership=true — list projects the token can access. */
export async function listProjects(
  baseUrl: string,
  auth: GitLabAuth,
  opts: { perPage?: number; page?: number; search?: string } = {}
): Promise<GitLabProject[]> {
  const params = new URLSearchParams({
    membership: "true",
    per_page: String(opts.perPage ?? 100),
    page: String(opts.page ?? 1),
    order_by: "last_activity_at",
  });
  if (opts.search) params.set("search", opts.search);
  guard(baseUrl);
  const url = apiUrl(baseUrl, `/projects?${params.toString()}`);
  const res = await fetch(url, { headers: buildHeaders(auth) });
  await expectOk(res, "listProjects");
  return (await res.json()) as GitLabProject[];
}

/** GET /projects/:id/pipelines — list recent pipelines for a project. */
export async function listPipelines(
  baseUrl: string,
  projectId: number | string,
  auth: GitLabAuth,
  opts: { perPage?: number; ref?: string; status?: string } = {}
): Promise<GitLabPipeline[]> {
  const params = new URLSearchParams({ per_page: String(opts.perPage ?? 20) });
  if (opts.ref) params.set("ref", opts.ref);
  if (opts.status) params.set("status", opts.status);
  guard(baseUrl);
  const path = `/projects/${encodeURIComponent(String(projectId))}/pipelines?${params.toString()}`;
  const res = await fetch(apiUrl(baseUrl, path), { headers: buildHeaders(auth) });
  await expectOk(res, `listPipelines(${projectId})`);
  return (await res.json()) as GitLabPipeline[];
}

/** GET /projects/:id/pipelines/:pipeline_id — fetch one pipeline record. */
export async function getPipeline(
  baseUrl: string,
  projectId: number | string,
  pipelineId: number | string,
  auth: GitLabAuth
): Promise<GitLabPipeline> {
  guard(baseUrl);
  const path = `/projects/${encodeURIComponent(String(projectId))}/pipelines/${encodeURIComponent(String(pipelineId))}`;
  const res = await fetch(apiUrl(baseUrl, path), { headers: buildHeaders(auth) });
  await expectOk(res, `getPipeline(${projectId}#${pipelineId})`);
  return (await res.json()) as GitLabPipeline;
}

/** GET /projects/:id/pipelines/:pipeline_id/jobs — jobs for a pipeline. */
export async function listPipelineJobs(
  baseUrl: string,
  projectId: number | string,
  pipelineId: number | string,
  auth: GitLabAuth
): Promise<GitLabJob[]> {
  guard(baseUrl);
  const path = `/projects/${encodeURIComponent(String(projectId))}/pipelines/${encodeURIComponent(String(pipelineId))}/jobs`;
  const res = await fetch(apiUrl(baseUrl, path), { headers: buildHeaders(auth) });
  await expectOk(res, `listPipelineJobs(${projectId}#${pipelineId})`);
  return (await res.json()) as GitLabJob[];
}

/** POST /projects/:id/pipeline?ref=... — trigger a pipeline on a ref. */
export async function triggerPipeline(
  baseUrl: string,
  projectId: number | string,
  ref: string,
  auth: GitLabAuth,
  variables: Record<string, string> = {}
): Promise<GitLabPipeline> {
  guard(baseUrl);
  const path = `/projects/${encodeURIComponent(String(projectId))}/pipeline`;
  const body = {
    ref,
    variables: Object.entries(variables).map(([key, value]) => ({ key, value })),
  };
  const res = await fetch(apiUrl(baseUrl, path), {
    method: "POST",
    headers: buildHeaders(auth, "application/json"),
    body: JSON.stringify(body),
  });
  if (res.status !== 201 && res.status !== 200) {
    await expectOk(res, `triggerPipeline(${projectId},${ref})`);
  }
  return (await res.json()) as GitLabPipeline;
}

/** GET /projects/:id/repository/files/:path/raw?ref=... — raw file contents. */
export async function getRawFile(
  baseUrl: string,
  projectId: number | string,
  filePath: string,
  ref: string,
  auth: GitLabAuth
): Promise<string> {
  guard(baseUrl);
  const path = `/projects/${encodeURIComponent(String(projectId))}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(apiUrl(baseUrl, path), {
    headers: { ...buildHeaders(auth), Accept: "text/plain" },
  });
  await expectOk(res, `getRawFile(${projectId},${filePath})`);
  return await res.text();
}

/** Normalize a GitLab pipeline status into PushCI run status-ish values. */
export function gitlabStatusToRunStatus(
  status?: string
): "pending" | "running" | "passed" | "failed" | "cancelled" | "unknown" {
  if (!status) return "unknown";
  switch (status) {
    case "success":
      return "passed";
    case "failed":
      return "failed";
    case "canceled":
    case "skipped":
      return "cancelled";
    case "running":
    case "preparing":
      return "running";
    case "created":
    case "waiting_for_resource":
    case "pending":
    case "manual":
    case "scheduled":
      return "pending";
    default:
      return "unknown";
  }
}
