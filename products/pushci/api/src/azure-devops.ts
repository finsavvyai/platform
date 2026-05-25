// Azure DevOps Pipelines REST API client (api-version=7.0).
//
// Poll-and-mirror companion to the webhook-in parser at
// internal/platform/azure.go. Same pattern as jenkins.ts / gitlab.ts:
// one thin module per HTTP verb, typed responses, status mapping to
// PushCI's run status vocabulary. No external deps — uses fetch + btoa.
//
// Auth & HTTP helpers live in azure-devops-auth.ts to keep this file
// under the 200-line portfolio cap.
//
// License: Apache-2.0

import { API_VERSION, base, buildHeaders, expectOk } from "./azure-devops-auth";
import type { AzureAuth } from "./azure-devops-auth";

export { trimBaseUrl } from "./azure-devops-auth";
export type { AzureAuth } from "./azure-devops-auth";

export interface AzureProject {
  id: string;
  name: string;
  url?: string;
}

export interface AzurePipeline {
  id: number;
  name: string;
  folder?: string;
  revision?: number;
  url?: string;
}

export type AzureRunState = "unknown" | "inProgress" | "canceling" | "completed" | "notStarted";
export type AzureRunResult =
  | "unknown"
  | "succeeded"
  | "failed"
  | "canceled"
  | "partiallySucceeded";

export interface AzureRun {
  id: number;
  name?: string;
  state: AzureRunState;
  result?: AzureRunResult;
  createdDate?: string;
  finishedDate?: string;
  url?: string;
}

export interface AzurePipelineDetail extends AzurePipeline {
  configuration?: {
    type?: string;
    path?: string;
    repository?: { id?: string; type?: string; fullName?: string };
  };
}

/** GET /{org}/_apis/projects — list projects the PAT has access to. */
export async function listProjects(org: string, auth: AzureAuth): Promise<AzureProject[]> {
  const url = `${base(org)}/_apis/projects?${API_VERSION}`;
  const res = await fetch(url, { headers: buildHeaders(auth) });
  await expectOk(res, "listProjects");
  const body = (await res.json()) as { value?: AzureProject[] };
  return body.value ?? [];
}

/** GET /{org}/{project}/_apis/pipelines — list pipeline definitions. */
export async function listPipelines(
  org: string,
  project: string,
  auth: AzureAuth
): Promise<AzurePipeline[]> {
  const url = `${base(org)}/${encodeURIComponent(project)}/_apis/pipelines?${API_VERSION}`;
  const res = await fetch(url, { headers: buildHeaders(auth) });
  await expectOk(res, `listPipelines(${project})`);
  const body = (await res.json()) as { value?: AzurePipeline[] };
  return body.value ?? [];
}

/** GET /{org}/{project}/_apis/pipelines/{id}?includeDefinition=true. */
export async function getPipeline(
  org: string,
  project: string,
  pipelineId: number,
  auth: AzureAuth
): Promise<AzurePipelineDetail> {
  const url = `${base(org)}/${encodeURIComponent(project)}/_apis/pipelines/${pipelineId}?${API_VERSION}&includeDefinition=true`;
  const res = await fetch(url, { headers: buildHeaders(auth) });
  await expectOk(res, `getPipeline(${pipelineId})`);
  return (await res.json()) as AzurePipelineDetail;
}

/** GET /{org}/{project}/_apis/pipelines/{id}/runs — list recent runs. */
export async function listRuns(
  org: string,
  project: string,
  pipelineId: number,
  auth: AzureAuth
): Promise<AzureRun[]> {
  const url = `${base(org)}/${encodeURIComponent(project)}/_apis/pipelines/${pipelineId}/runs?${API_VERSION}`;
  const res = await fetch(url, { headers: buildHeaders(auth) });
  await expectOk(res, `listRuns(${pipelineId})`);
  const body = (await res.json()) as { value?: AzureRun[] };
  return body.value ?? [];
}

/** GET /{org}/{project}/_apis/pipelines/{id}/runs/{runId}. */
export async function getRun(
  org: string,
  project: string,
  pipelineId: number,
  runId: number,
  auth: AzureAuth
): Promise<AzureRun> {
  const url = `${base(org)}/${encodeURIComponent(project)}/_apis/pipelines/${pipelineId}/runs/${runId}?${API_VERSION}`;
  const res = await fetch(url, { headers: buildHeaders(auth) });
  await expectOk(res, `getRun(${pipelineId}#${runId})`);
  return (await res.json()) as AzureRun;
}

/**
 * POST /{org}/{project}/_apis/pipelines/{id}/runs — trigger a run.
 * `refName` takes the full ref (e.g. `refs/heads/main`). Variables are the
 * pipeline-defined overridable variables.
 */
export async function runPipeline(
  org: string,
  project: string,
  pipelineId: number,
  opts: { refName?: string; variables?: Record<string, { value: string; isSecret?: boolean }> },
  auth: AzureAuth
): Promise<AzureRun> {
  const url = `${base(org)}/${encodeURIComponent(project)}/_apis/pipelines/${pipelineId}/runs?${API_VERSION}`;
  const payload: Record<string, unknown> = {};
  if (opts.refName) {
    payload.resources = { repositories: { self: { refName: opts.refName } } };
  }
  if (opts.variables && Object.keys(opts.variables).length > 0) {
    payload.variables = opts.variables;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: buildHeaders(auth, "application/json"),
    body: JSON.stringify(payload),
  });
  await expectOk(res, `runPipeline(${pipelineId})`);
  return (await res.json()) as AzureRun;
}

export type PushCiRunStatus = "pending" | "running" | "passed" | "failed" | "stopped" | "unknown";

/**
 * Map Azure DevOps `state` + `result` fields onto PushCI's run status.
 * Matches the vocabulary used by jenkins-importer + gerrit.
 */
export function azureStatus(state?: string, result?: string): PushCiRunStatus {
  const s = (state ?? "").toLowerCase();
  const r = (result ?? "").toLowerCase();
  if (s === "notstarted") return "pending";
  if (s === "inprogress") return "running";
  if (s === "canceling") return "stopped";
  if (s === "completed") {
    if (r === "succeeded" || r === "partiallysucceeded") return "passed";
    if (r === "failed") return "failed";
    if (r === "canceled") return "stopped";
    return "unknown";
  }
  return "unknown";
}
