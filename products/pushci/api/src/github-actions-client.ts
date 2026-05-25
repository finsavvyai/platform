// GitHub Actions REST API client — poll+mirror bridge so teams on cloud
// github.com runners see every run in the PushCI dashboard. Auth header:
// `Authorization: Bearer <PAT|installation_token>`. Scopes: repo,
// actions:read, workflow. Cloudflare Workers `fetch` only.
// Orthogonal to internal/platform/github.go (webhook-in) and
// internal/actions/ (local act runner). License: Apache-2.0

export interface GitHubAuth {
  token: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  owner: { login: string };
  pushed_at?: string | null;
}

export interface GitHubWorkflow {
  id: number;
  node_id: string;
  name: string;
  path: string;
  state: string;
  html_url: string;
  badge_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubRun {
  id: number;
  name?: string | null;
  run_number: number;
  event: string;
  status: string;   // queued|in_progress|completed|waiting|requested|pending
  conclusion: string | null; // success|failure|cancelled|skipped|timed_out|neutral|action_required|stale
  workflow_id: number;
  head_branch: string | null;
  head_sha: string;
  html_url: string;
  run_started_at?: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubJob {
  id: number;
  run_id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  html_url: string;
  steps?: Array<{ name: string; status: string; conclusion: string | null; number: number }>;
}

export type PushCIStatus = "pending" | "running" | "passed" | "failed" | "stopped" | "unknown";

const API = "https://api.github.com";

function headers(auth: GitHubAuth, contentType?: string): HeadersInit {
  const h: Record<string, string> = {
    Authorization: `Bearer ${auth.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "pushci-bridge",
  };
  if (contentType) h["Content-Type"] = contentType;
  return h;
}

async function expectOk(res: Response, ctx: string): Promise<void> {
  if (res.ok) return;
  let body = "";
  try { body = await res.text(); } catch { /* ignore */ }
  throw new Error(`github ${ctx} failed: ${res.status} ${body.slice(0, 200)}`);
}

/** GET /user/repos?per_page=100&sort=pushed — list repos the token can see. */
export async function listRepos(
  auth: GitHubAuth,
  opts: { search?: string; perPage?: number; page?: number } = {}
): Promise<GitHubRepo[]> {
  const params = new URLSearchParams({
    per_page: String(opts.perPage ?? 100),
    page: String(opts.page ?? 1),
    sort: "pushed",
  });
  const url = `${API}/user/repos?${params}`;
  const res = await fetch(url, { headers: headers(auth) });
  await expectOk(res, "listRepos");
  const all = (await res.json()) as GitHubRepo[];
  if (!opts.search) return all;
  const needle = opts.search.toLowerCase();
  return all.filter((r) => r.full_name.toLowerCase().includes(needle));
}

/** GET /repos/{owner}/{repo}/actions/workflows */
export async function listWorkflows(
  owner: string, repo: string, auth: GitHubAuth
): Promise<GitHubWorkflow[]> {
  const url = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows?per_page=100`;
  const res = await fetch(url, { headers: headers(auth) });
  await expectOk(res, `listWorkflows(${owner}/${repo})`);
  const body = (await res.json()) as { workflows?: GitHubWorkflow[] };
  return body.workflows ?? [];
}

/** GET /repos/{owner}/{repo}/actions/runs — list runs, optionally filtered. */
export async function listRuns(
  owner: string, repo: string, auth: GitHubAuth,
  opts: { workflowId?: number | string; branch?: string; perPage?: number } = {}
): Promise<GitHubRun[]> {
  const params = new URLSearchParams({ per_page: String(opts.perPage ?? 20) });
  if (opts.branch) params.set("branch", opts.branch);
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions`;
  const url = opts.workflowId
    ? `${base}/workflows/${encodeURIComponent(String(opts.workflowId))}/runs?${params}`
    : `${base}/runs?${params}`;
  const res = await fetch(url, { headers: headers(auth) });
  await expectOk(res, `listRuns(${owner}/${repo})`);
  const body = (await res.json()) as { workflow_runs?: GitHubRun[] };
  return body.workflow_runs ?? [];
}

/** GET /repos/{owner}/{repo}/actions/runs/{run_id} */
export async function getRun(
  owner: string, repo: string, runId: number | string, auth: GitHubAuth
): Promise<GitHubRun> {
  const url = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${encodeURIComponent(String(runId))}`;
  const res = await fetch(url, { headers: headers(auth) });
  await expectOk(res, `getRun(${owner}/${repo}#${runId})`);
  return (await res.json()) as GitHubRun;
}

/** GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs */
export async function listJobs(
  owner: string, repo: string, runId: number | string, auth: GitHubAuth
): Promise<GitHubJob[]> {
  const url = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${encodeURIComponent(String(runId))}/jobs?per_page=100`;
  const res = await fetch(url, { headers: headers(auth) });
  await expectOk(res, `listJobs(${owner}/${repo}#${runId})`);
  const body = (await res.json()) as { jobs?: GitHubJob[] };
  return body.jobs ?? [];
}

/** POST /repos/{owner}/{repo}/actions/workflows/{id}/dispatches */
export async function dispatchWorkflow(
  owner: string, repo: string, workflowId: number | string,
  payload: { ref: string; inputs?: Record<string, string> },
  auth: GitHubAuth
): Promise<{ ok: true }> {
  const url = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(String(workflowId))}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(auth, "application/json"),
    body: JSON.stringify(payload),
  });
  // 204 No Content on success.
  if (res.status !== 204 && !res.ok) {
    await expectOk(res, `dispatchWorkflow(${owner}/${repo}#${workflowId})`);
  }
  return { ok: true };
}

/** POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun */
export async function rerunRun(
  owner: string, repo: string, runId: number | string, auth: GitHubAuth
): Promise<{ ok: true }> {
  const url = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${encodeURIComponent(String(runId))}/rerun`;
  const res = await fetch(url, { method: "POST", headers: headers(auth) });
  if (res.status !== 201 && !res.ok) {
    await expectOk(res, `rerunRun(${owner}/${repo}#${runId})`);
  }
  return { ok: true };
}

/** POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel */
export async function cancelRun(
  owner: string, repo: string, runId: number | string, auth: GitHubAuth
): Promise<{ ok: true }> {
  const url = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${encodeURIComponent(String(runId))}/cancel`;
  const res = await fetch(url, { method: "POST", headers: headers(auth) });
  if (res.status !== 202 && !res.ok) {
    await expectOk(res, `cancelRun(${owner}/${repo}#${runId})`);
  }
  return { ok: true };
}

export { githubStatusToPushCI } from "./github-actions-status";
