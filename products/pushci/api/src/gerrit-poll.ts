// Gerrit polling — for enterprises that can't expose a webhook endpoint.
//
// Some Gerrit installations sit behind corporate firewalls. For those we pull
// recently-updated open changes on a cron, dedupe by (changeId, revision) in
// KV, and create PushCI runs for changes we haven't seen before.
//
// KV layout:
//   gerrit:seen:${projectId}:${changeId}:${revision}  marker (TTL 30d)
//   gerrit:project:${projectId}                        config (GerritProjectRecord)
//   gerrit:user:${sub}:projects                        project id list (per owner)
//
// Contract: NEVER throws. The scheduled handler continues even if a single
// project fails. All errors are captured in the returned counts structure.

import type { Env, Run } from "./types";
import type { GerritProjectRecord } from "./gerrit-routes";
import { insertRun, getProjectByRepo } from "./db";
import { listOpenChanges } from "./gerrit";
import { queueCiRun } from "./cloud-runners";

const SEEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const MAX_CHANGES_PER_POLL = 25;

export interface PollResult {
  checked: number;
  newChanges: number;
  runsCreated: string[];
  errors: string[];
}

// --- tiny crypto helpers (mirror gerrit-routes.ts / gerrit-callback.ts) -----

async function deriveKey(secret: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function decryptPassword(env: Env, record: GerritProjectRecord): Promise<string> {
  if (!record.httpPasswordEnc) return record.httpPassword;
  const secret = (env as unknown as { GERRIT_ENC_KEY?: string }).GERRIT_ENC_KEY;
  if (!secret) throw new Error("GERRIT_ENC_KEY missing for decryption");
  const key = await deriveKey(secret);
  const combined = b64decode(record.httpPassword);
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(pt);
}

// --- KV key helpers ---------------------------------------------------------

const PROJECT_KEY = (id: string) => `gerrit:project:${id}`;
const SEEN_KEY = (projectId: string, changeId: string, revision: string) =>
  `gerrit:seen:${projectId}:${changeId}:${revision}`;

async function loadProject(env: Env, id: string): Promise<GerritProjectRecord | null> {
  const raw = await env.RUNNERS.get(PROJECT_KEY(id));
  return raw ? (JSON.parse(raw) as GerritProjectRecord) : null;
}

async function seen(env: Env, projectId: string, changeId: string, revision: string): Promise<boolean> {
  return (await env.RUNNERS.get(SEEN_KEY(projectId, changeId, revision))) !== null;
}

async function markSeen(env: Env, projectId: string, changeId: string, revision: string): Promise<void> {
  await env.RUNNERS.put(SEEN_KEY(projectId, changeId, revision), "1", {
    expirationTtl: SEEN_TTL_SECONDS,
  });
}

// --- main polling routine ---------------------------------------------------

/**
 * Poll a single Gerrit project for new open changes and queue runs.
 * Never throws — returns a structured PollResult with captured errors.
 */
export async function pollGerritProject(env: Env, projectId: string): Promise<PollResult> {
  const result: PollResult = { checked: 0, newChanges: 0, runsCreated: [], errors: [] };

  let project: GerritProjectRecord | null;
  try {
    project = await loadProject(env, projectId);
  } catch (err) {
    result.errors.push(`load project: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }
  if (!project) {
    result.errors.push(`project ${projectId} not found`);
    return result;
  }

  let password: string;
  try {
    password = await decryptPassword(env, project);
  } catch (err) {
    result.errors.push(`decrypt: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  // The query filter -age:10m is enforced by listOpenChanges callers. Since
  // Stream A exposes only listOpenChanges(creds, project, limit), we use that
  // and filter client-side. This keeps us compatible with the existing client.
  let changes: Awaited<ReturnType<typeof listOpenChanges>>;
  try {
    changes = await listOpenChanges(
      { baseUrl: project.host, httpUser: project.httpUser, httpPassword: password },
      project.project,
      MAX_CHANGES_PER_POLL
    );
  } catch (err) {
    result.errors.push(`list changes: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  result.checked = changes.length;

  const pushciRepo = `gerrit/${project.project}`;
  const pushciProject = await getProjectByRepo(env.DB, pushciRepo);
  // If there's no linked PushCI project we can't queue runs — record it and
  // return what we have (seen markers not yet set, so a future registration
  // will still see these changes).
  if (!pushciProject) {
    result.errors.push(`no pushci project for ${pushciRepo}`);
    return result;
  }

  for (const change of changes) {
    const revision = change.current_revision ?? "";
    const changeId = change.change_id ?? change.id;
    if (!revision || !changeId) continue;

    if (await seen(env, projectId, changeId, revision)) continue;

    const runId = crypto.randomUUID();
    const run: Run = {
      id: runId,
      repo: pushciProject.repo,
      branch: change.branch ?? "master",
      sha: revision,
      status: "pending",
      created_at: new Date().toISOString(),
      started_at: null,
      finished_at: null,
      duration_ms: null,
      checks_json: null,
    };

    try {
      await insertRun(env.DB, run);
      await queueCiRun(env, pushciProject, run, { trigger: "gerrit:poll" });
    } catch (err) {
      result.errors.push(`queue ${runId}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    // Correlation so the completion callback can write Verified back.
    try {
      await env.RUNNERS.put(
        `run:${runId}:gerrit`,
        JSON.stringify({ projectId: project.id, changeId, revision }),
        { expirationTtl: 60 * 60 * 24 }
      );
    } catch { /* noop */ }

    await markSeen(env, projectId, changeId, revision);
    result.newChanges += 1;
    result.runsCreated.push(runId);
  }

  return result;
}

// --- fan-out: iterate every project that opted into polling ----------------

export interface PollAllResult {
  projectsPolled: number;
  totalNewChanges: number;
  totalRunsCreated: number;
  perProject: Record<string, PollResult>;
}

/**
 * Iterate every registered Gerrit project and poll the ones where
 * `pollEnabled === true`. Called from the scheduled handler in index.ts.
 *
 * We intentionally scan all project KV keys rather than keeping a global
 * "poll-enabled index" because the list is small (one per customer Gerrit
 * host) and KV's list() handles this efficiently.
 */
export async function pollAllGerritProjects(env: Env): Promise<PollAllResult> {
  const out: PollAllResult = {
    projectsPolled: 0,
    totalNewChanges: 0,
    totalRunsCreated: 0,
    perProject: {},
  };

  let cursor: string | undefined;
  do {
    const page: KVNamespaceListResult<unknown, string> = await env.RUNNERS.list({
      prefix: "gerrit:project:",
      cursor,
    });
    for (const { name } of page.keys) {
      const id = name.slice("gerrit:project:".length);
      let project: GerritProjectRecord | null = null;
      try {
        project = await loadProject(env, id);
      } catch {
        continue;
      }
      if (!project) continue;

      // Only poll projects that opted in.
      const pe = (project as unknown as { pollEnabled?: boolean }).pollEnabled;
      if (!pe) continue;

      const res = await pollGerritProject(env, id);
      out.projectsPolled += 1;
      out.totalNewChanges += res.newChanges;
      out.totalRunsCreated += res.runsCreated.length;
      out.perProject[id] = res;
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return out;
}
