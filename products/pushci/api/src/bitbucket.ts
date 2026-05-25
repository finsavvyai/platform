// Bitbucket Cloud REST API 2.0 client — mirrors pipelines status and
// triggers runs for customers migrating to PushCI. Scope: Bitbucket Cloud
// only; Server uses a different (Stash) API and is rejected at /connect.
// Auth: Basic (user + app password) OR OAuth 2.0 bearer. License: Apache-2.0

export interface BitbucketAuth {
  user?: string;
  appPassword?: string;
  bearer?: string;
}

export interface BitbucketWorkspace {
  slug: string;
  name: string;
  uuid?: string;
}

export interface BitbucketRepo {
  slug: string;
  full_name: string;
  name: string;
  mainbranch?: { name: string };
  is_private?: boolean;
  updated_on?: string;
}

export interface BitbucketPipelineState {
  name: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "HALTED" | "STOPPED";
  result?: { name: "SUCCESSFUL" | "FAILED" | "ERROR" | "STOPPED" | "EXPIRED" };
}

export interface BitbucketPipeline {
  uuid: string;
  build_number: number;
  state: BitbucketPipelineState;
  created_on: string;
  completed_on?: string;
  duration_in_seconds?: number;
  target?: {
    ref_type?: string;
    ref_name?: string;
    commit?: { hash?: string };
  };
  trigger?: { name?: string };
}

export interface BitbucketPipelineStep {
  uuid: string;
  name?: string;
  state: BitbucketPipelineState;
  started_on?: string;
  completed_on?: string;
  duration_in_seconds?: number;
}

const API = "https://api.bitbucket.org/2.0";

function authHeader(auth: BitbucketAuth): string {
  if (auth.bearer) return `Bearer ${auth.bearer}`;
  if (auth.user && auth.appPassword) return "Basic " + btoa(`${auth.user}:${auth.appPassword}`);
  throw new Error("bitbucket auth: provide bearer OR user+appPassword");
}

function headers(auth: BitbucketAuth, contentType?: string): HeadersInit {
  const h: Record<string, string> = { Authorization: authHeader(auth), Accept: "application/json" };
  if (contentType) h["Content-Type"] = contentType;
  return h;
}

async function expectOk(res: Response, ctx: string): Promise<void> {
  if (res.ok) return;
  let body = "";
  try { body = await res.text(); } catch { /* ignore */ }
  throw new Error(`bitbucket ${ctx} failed: ${res.status} ${body.slice(0, 200)}`);
}

/** GET /2.0/workspaces — list workspaces the auth principal can see. */
export async function listWorkspaces(auth: BitbucketAuth): Promise<BitbucketWorkspace[]> {
  const res = await fetch(`${API}/workspaces?pagelen=50`, { headers: headers(auth) });
  await expectOk(res, "listWorkspaces");
  const body = (await res.json()) as {
    values?: Array<{ slug: string; name: string; uuid?: string }>;
  };
  return (body.values ?? []).map((w) => ({ slug: w.slug, name: w.name, uuid: w.uuid }));
}

const enc = encodeURIComponent;
const repoBase = (ws: string, repo: string) =>
  `${API}/repositories/${enc(ws)}/${enc(repo)}`;

/** GET /2.0/repositories/{workspace} */
export async function listRepos(workspace: string, auth: BitbucketAuth): Promise<BitbucketRepo[]> {
  const res = await fetch(`${API}/repositories/${enc(workspace)}?pagelen=50&sort=-updated_on`, {
    headers: headers(auth),
  });
  await expectOk(res, `listRepos(${workspace})`);
  return ((await res.json()) as { values?: BitbucketRepo[] }).values ?? [];
}

/** GET /repositories/{workspace}/{repo_slug}/pipelines/ — recent pipelines. */
export async function listPipelines(
  workspace: string,
  repoSlug: string,
  auth: BitbucketAuth,
  pagelen = 20
): Promise<BitbucketPipeline[]> {
  const res = await fetch(`${repoBase(workspace, repoSlug)}/pipelines/?sort=-created_on&pagelen=${pagelen}`, {
    headers: headers(auth),
  });
  await expectOk(res, `listPipelines(${workspace}/${repoSlug})`);
  return ((await res.json()) as { values?: BitbucketPipeline[] }).values ?? [];
}

/** GET /pipelines/{uuid} */
export async function getPipeline(
  workspace: string,
  repoSlug: string,
  uuid: string,
  auth: BitbucketAuth
): Promise<BitbucketPipeline> {
  const res = await fetch(`${repoBase(workspace, repoSlug)}/pipelines/${enc(uuid)}`, {
    headers: headers(auth),
  });
  await expectOk(res, `getPipeline(${uuid})`);
  return (await res.json()) as BitbucketPipeline;
}

/** GET /pipelines/{uuid}/steps/ */
export async function getPipelineSteps(
  workspace: string,
  repoSlug: string,
  uuid: string,
  auth: BitbucketAuth
): Promise<BitbucketPipelineStep[]> {
  const res = await fetch(`${repoBase(workspace, repoSlug)}/pipelines/${enc(uuid)}/steps/`, {
    headers: headers(auth),
  });
  await expectOk(res, `getPipelineSteps(${uuid})`);
  return ((await res.json()) as { values?: BitbucketPipelineStep[] }).values ?? [];
}

/** POST /pipelines/ — trigger a run against a branch or tag ref. */
export async function triggerPipeline(
  workspace: string,
  repoSlug: string,
  refName: string,
  auth: BitbucketAuth,
  refType: "branch" | "tag" = "branch"
): Promise<BitbucketPipeline> {
  const body = { target: { ref_type: refType, ref_name: refName, type: "pipeline_ref_target" } };
  const res = await fetch(`${repoBase(workspace, repoSlug)}/pipelines/`, {
    method: "POST",
    headers: headers(auth, "application/json"),
    body: JSON.stringify(body),
  });
  await expectOk(res, `triggerPipeline(${workspace}/${repoSlug}@${refName})`);
  return (await res.json()) as BitbucketPipeline;
}

/** Normalize Bitbucket pipeline state into a PushCI-friendly status string. */
export function pipelineStatus(
  p: BitbucketPipeline
): "passed" | "failed" | "running" | "pending" | "stopped" | "unknown" {
  const stateName = p.state?.name;
  if (stateName === "IN_PROGRESS") return "running";
  if (stateName === "PENDING") return "pending";
  if (stateName === "HALTED" || stateName === "STOPPED") return "stopped";
  if (stateName === "COMPLETED") {
    const r = p.state?.result?.name;
    if (r === "SUCCESSFUL") return "passed";
    if (r === "FAILED" || r === "ERROR" || r === "EXPIRED") return "failed";
    if (r === "STOPPED") return "stopped";
  }
  return "unknown";
}

/** GET /src/{ref}/bitbucket-pipelines.yml */
export async function getPipelinesYaml(
  workspace: string,
  repoSlug: string,
  ref: string,
  auth: BitbucketAuth
): Promise<string> {
  const res = await fetch(`${repoBase(workspace, repoSlug)}/src/${enc(ref)}/bitbucket-pipelines.yml`, {
    headers: { Authorization: authHeader(auth), Accept: "text/plain" },
  });
  await expectOk(res, `getPipelinesYaml(${workspace}/${repoSlug}@${ref})`);
  return await res.text();
}
