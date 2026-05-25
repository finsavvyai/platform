import type { Env, WebhookEvent } from "./types";
import { insertRun, getProjectByRepo } from "./db";

const encoder = new TextEncoder();

async function verifyGitHubSignature(
  secret: string,
  body: string,
  signature: string
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = "sha256=" +
    [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === signature;
}

function verifyGitLabToken(secret: string, token: string): boolean {
  return secret === token;
}

function parseGitHubEvent(body: Record<string, unknown>): WebhookEvent {
  const repo = (body.repository as Record<string, unknown>)?.full_name as string;
  const isPR = "pull_request" in body;
  const ref = isPR ? (body.pull_request as Record<string, unknown>)?.head as Record<string, unknown> : body;
  return {
    platform: "github",
    event_type: isPR ? "pull_request" : "push",
    repo,
    branch: isPR ? (ref?.ref as string) : ((body.ref as string) ?? "").replace("refs/heads/", ""),
    sha: isPR ? (ref?.sha as string) : (body.after as string),
    sender: ((body.sender as Record<string, unknown>)?.login as string) ?? "unknown",
  };
}

function parseGitLabEvent(body: Record<string, unknown>): WebhookEvent {
  const repo = ((body.project as Record<string, unknown>)?.path_with_namespace as string) ?? "";
  const isMR = body.object_kind === "merge_request";
  return {
    platform: "gitlab",
    event_type: isMR ? "pull_request" : "push",
    repo,
    branch: isMR ? ((body.object_attributes as Record<string, unknown>)?.source_branch as string) : ((body.ref as string) ?? "").replace("refs/heads/", ""),
    sha: isMR ? ((body.object_attributes as Record<string, unknown>)?.last_commit as Record<string, unknown>)?.id as string : (body.after as string),
    sender: ((body.user as Record<string, unknown>)?.username as string) ?? "unknown",
  };
}

function parseBitbucketEvent(body: Record<string, unknown>): WebhookEvent {
  const repo = ((body.repository as Record<string, unknown>)?.full_name as string) ?? "";
  const push = body.push as Record<string, unknown> | undefined;
  const changes = (push?.changes as Array<Record<string, unknown>>) ?? [];
  const change = changes[0] ?? {};
  const newRef = change.new as Record<string, unknown> | undefined;
  return {
    platform: "bitbucket",
    event_type: "push",
    repo,
    branch: (newRef?.name as string) ?? "main",
    sha: ((newRef?.target as Record<string, unknown>)?.hash as string) ?? "",
    sender: ((body.actor as Record<string, unknown>)?.display_name as string) ?? "unknown",
  };
}

export async function handleWebhook(
  platform: "github" | "gitlab" | "bitbucket",
  rawBody: string,
  headers: Headers,
  env: Env
): Promise<{ event: WebhookEvent; runId: string }> {
  const body = JSON.parse(rawBody) as Record<string, unknown>;
  const parsers = { github: parseGitHubEvent, gitlab: parseGitLabEvent, bitbucket: parseBitbucketEvent };
  const event = parsers[platform](body);
  const project = await getProjectByRepo(env.DB, event.repo);
  if (project) {
    if (platform === "github") {
      const sig = headers.get("x-hub-signature-256") ?? "";
      if (!(await verifyGitHubSignature(project.webhook_secret, rawBody, sig)))
        throw new Error("Invalid GitHub signature");
    } else if (platform === "gitlab") {
      if (!verifyGitLabToken(project.webhook_secret, headers.get("x-gitlab-token") ?? ""))
        throw new Error("Invalid GitLab token");
    }
  }
  const runId = crypto.randomUUID();
  await insertRun(env.DB, { id: runId, repo: event.repo, branch: event.branch, sha: event.sha, status: "pending", started_at: null, finished_at: null, duration_ms: null, checks_json: null });
  await env.RUNNERS.put(`run:${runId}`, JSON.stringify(event), { expirationTtl: 3600 });
  return { event, runId };
}
