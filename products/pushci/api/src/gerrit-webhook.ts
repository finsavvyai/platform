// Gerrit webhook receiver — translates Gerrit events into PushCI runs.
//
// Gerrit can POST events via the `webhooks` plugin or the `events-plugin`
// (ref: https://gerrit.googlesource.com/plugins/webhooks/+/master/src/main/resources/Documentation/config.md).
// We support the common JSON payloads:
//   - patchset-created  (new patchset on a change)
//   - change-merged     (change merged to target branch)
//   - ref-updated       (raw ref update — push to refs/heads/*)
//
// Auth: a shared secret passed via the `X-Gerrit-Token` header. The secret is
// stored with the registered project in KV (see gerrit-routes.ts).

import { Hono } from "hono";
import type { Env, Run } from "./types";
import { insertRun, getProjectByRepo } from "./db";
import { queueCiRun } from "./cloud-runners";
import { getGerritProjectById, findGerritProjectByRepoKey } from "./gerrit-routes";
import type { GerritProjectRecord } from "./gerrit-routes";

export const gerritWebhookRoutes = new Hono<{ Bindings: Env }>();

interface GerritPatchsetCreated {
  type: "patchset-created";
  change: { project: string; branch: string; id: string; number: number | string };
  patchSet: { revision: string; number: number | string };
  uploader?: { username?: string; name?: string };
}

interface GerritChangeMerged {
  type: "change-merged";
  change: { project: string; branch: string; id: string };
  patchSet?: { revision: string };
  submitter?: { username?: string; name?: string };
  newRev?: string;
}

interface GerritRefUpdated {
  type: "ref-updated";
  refUpdate: { project: string; refName: string; oldRev: string; newRev: string };
  submitter?: { username?: string; name?: string };
}

type GerritEvent = GerritPatchsetCreated | GerritChangeMerged | GerritRefUpdated;

export interface NormalizedGerritEvent {
  project: string;         // Gerrit project name, e.g. "norlys/metering"
  branch: string;          // short branch name
  sha: string;             // revision / commit sha
  sender: string;          // uploader/submitter name
  changeId?: string;       // for change-bound events
  trigger: "patchset-created" | "change-merged" | "ref-updated";
}

/**
 * Translate a raw Gerrit stream event into a PushCI run descriptor.
 * Returns `null` for unsupported / malformed events.
 */
export function normalizeGerritEvent(body: unknown): NormalizedGerritEvent | null {
  if (!body || typeof body !== "object") return null;
  const ev = body as Partial<GerritEvent>;
  if (!ev.type) return null;

  if (ev.type === "patchset-created") {
    const e = ev as GerritPatchsetCreated;
    if (!e.change?.project || !e.patchSet?.revision) return null;
    return {
      project: e.change.project,
      branch: e.change.branch ?? "master",
      sha: e.patchSet.revision,
      sender: e.uploader?.username ?? e.uploader?.name ?? "unknown",
      changeId: e.change.id,
      trigger: "patchset-created",
    };
  }

  if (ev.type === "change-merged") {
    const e = ev as GerritChangeMerged;
    if (!e.change?.project) return null;
    return {
      project: e.change.project,
      branch: e.change.branch ?? "master",
      sha: e.newRev ?? e.patchSet?.revision ?? "",
      sender: e.submitter?.username ?? e.submitter?.name ?? "unknown",
      changeId: e.change.id,
      trigger: "change-merged",
    };
  }

  if (ev.type === "ref-updated") {
    const e = ev as GerritRefUpdated;
    if (!e.refUpdate?.project || !e.refUpdate.newRev) return null;
    const branch = (e.refUpdate.refName ?? "").replace(/^refs\/heads\//, "");
    return {
      project: e.refUpdate.project,
      branch: branch || "master",
      sha: e.refUpdate.newRev,
      sender: e.submitter?.username ?? e.submitter?.name ?? "unknown",
      trigger: "ref-updated",
    };
  }

  return null;
}

/**
 * Constant-time-ish equality for the shared secret token. Cloudflare's
 * runtime doesn't give us `timingSafeEqual`, so we at least avoid short-circuit
 * on first mismatch by XOR-ing every byte.
 */
export function verifyWebhookSecret(expected: string, provided: string | null): boolean {
  if (!expected || !provided) return false;
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Build the repo key PushCI uses internally for a Gerrit project.
 * We namespace with `gerrit/` so Gerrit projects never collide with GitHub
 * `owner/repo` slugs.
 */
export function gerritRepoKey(project: string): string {
  return `gerrit/${project}`;
}

/** POST /webhook/gerrit — primary Gerrit ingress. */
gerritWebhookRoutes.post("/webhook/gerrit", async (c) => {
  const token = c.req.header("x-gerrit-token") ?? null;
  const projectIdHint = c.req.header("x-gerrit-project-id") ?? c.req.query("project_id") ?? null;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const event = normalizeGerritEvent(body);
  if (!event) return c.json({ error: "unsupported event" }, 400);

  // Locate the registered Gerrit project: either by explicit id hint, or by
  // looking up the PushCI "repo" key derived from the Gerrit project name.
  let gerritProject: GerritProjectRecord | null = null;
  if (projectIdHint) {
    gerritProject = await getGerritProjectById(c.env, projectIdHint);
  }
  if (!gerritProject) {
    gerritProject = await findGerritProjectByRepoKey(c.env, gerritRepoKey(event.project));
  }
  if (!gerritProject) return c.json({ error: "gerrit project not registered" }, 404);

  if (!verifyWebhookSecret(gerritProject.webhookSecret, token)) {
    return c.json({ error: "invalid gerrit token" }, 401);
  }

  // We need a PushCI Project row so that queueCiRun has something to attach to.
  // If the user has already linked this Gerrit project to a PushCI project
  // (same `repo` string), we reuse it. Otherwise we report 412 so the admin
  // UI can prompt for creation — we deliberately don't auto-create projects
  // here to keep membership/auth intact.
  const pushciProject = await getProjectByRepo(c.env.DB, gerritRepoKey(event.project));
  if (!pushciProject) {
    return c.json({
      error: "pushci project missing",
      hint: `Create a PushCI project with repo='${gerritRepoKey(event.project)}' linked to this Gerrit registration.`,
    }, 412);
  }

  const runId = crypto.randomUUID();
  const run: Run = {
    id: runId,
    repo: pushciProject.repo,
    branch: event.branch,
    sha: event.sha,
    status: "pending",
    created_at: new Date().toISOString(),
    started_at: null,
    finished_at: null,
    duration_ms: null,
    checks_json: null,
  };
  await insertRun(c.env.DB, run);

  const job = await queueCiRun(c.env, pushciProject, run, { trigger: `gerrit:${event.trigger}` });

  // Stash the change id so the run-completion path can post back a Verified
  // label via gerrit.postReview / postRunResult.
  if (event.changeId) {
    await c.env.RUNNERS.put(
      `run:${runId}:gerrit`,
      JSON.stringify({
        projectId: gerritProject.id,
        changeId: event.changeId,
        revision: event.sha || "current",
      }),
      { expirationTtl: 60 * 60 * 24 }
    );
  }

  return c.json({ ok: true, runId, jobId: job.id, trigger: event.trigger }, 201);
});
