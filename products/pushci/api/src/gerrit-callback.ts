// Gerrit run-completion callback — posts Verified labels back to Gerrit when
// a PushCI run finishes. Wires Stream A's webhook correlation record into
// the existing cloud-runners run-completion path.
//
// KV layout (populated by gerrit-webhook.ts):
//   run:${runId}:gerrit -> { projectId, changeId, revision }  (TTL 24h)
//
// This file is intentionally self-contained: it re-implements the tiny AES-GCM
// wrap/unwrap used in gerrit-routes.ts so it can decrypt httpPassword without
// importing from that router module (avoids a cyclic dependency if Stream L
// touches gerrit-routes.ts concurrently). Identical algorithm, same key
// derivation, same IV|cipher layout.
//
// Contract: NEVER throws. All error paths return a structured result so a
// Gerrit outage can never take down the runner's job-completion path.
import type { Env } from "./types";
import type { GerritProjectRecord } from "./gerrit-routes";
import { postRunResult } from "./gerrit";

export interface GerritCorrelation {
  projectId: string;
  changeId: string;
  revision: string;
}

export type NotifyResult =
  | { ok: true; posted: boolean }
  | { ok: false; error: string };

// -------- crypto (mirrors gerrit-routes.ts) --------------------------------

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

// -------- KV helpers -------------------------------------------------------

const CORRELATION_KEY = (runId: string) => `run:${runId}:gerrit`;
const PROJECT_KEY = (projectId: string) => `gerrit:project:${projectId}`;

export async function readCorrelation(
  env: Env,
  runId: string
): Promise<GerritCorrelation | null> {
  try {
    const raw = await env.RUNNERS.get(CORRELATION_KEY(runId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GerritCorrelation>;
    if (!parsed.projectId || !parsed.changeId || !parsed.revision) return null;
    return parsed as GerritCorrelation;
  } catch {
    return null;
  }
}

async function loadGerritProject(
  env: Env,
  projectId: string
): Promise<GerritProjectRecord | null> {
  try {
    const raw = await env.RUNNERS.get(PROJECT_KEY(projectId));
    return raw ? (JSON.parse(raw) as GerritProjectRecord) : null;
  } catch {
    return null;
  }
}

// -------- public entry point -----------------------------------------------

/**
 * Post a Verified label back to Gerrit when a PushCI run completes.
 *
 * - No correlation record in KV → returns `{ ok: true, posted: false }` (run
 *   is not Gerrit-originated, so nothing to do)
 * - Run cancelled → returns `{ ok: true, posted: false }` (we don't post a
 *   score for cancellations; it would overwrite a human's review)
 * - Project config missing → `{ ok: false, error: "project not found" }`
 * - Any postReview HTTP failure → `{ ok: false, error: ... }`
 * - Success deletes the correlation key so re-runs don't double-post
 */
export async function notifyGerritOnRunComplete(
  env: Env,
  runId: string,
  status: "passed" | "failed" | "cancelled"
): Promise<NotifyResult> {
  try {
    const correlation = await readCorrelation(env, runId);
    if (!correlation) return { ok: true, posted: false };

    // Cancellations: don't post a -1 — the run was aborted, not rejected.
    if (status === "cancelled") return { ok: true, posted: false };

    const project = await loadGerritProject(env, correlation.projectId);
    if (!project) return { ok: false, error: "gerrit project not found" };

    let password: string;
    try {
      password = await decryptPassword(env, project);
    } catch (err) {
      return {
        ok: false,
        error: `decrypt failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    try {
      await postRunResult(
        {
          baseUrl: project.host,
          httpUser: project.httpUser,
          httpPassword: password,
        },
        correlation.changeId,
        correlation.revision,
        status,
        `PushCI run ${status} (run id ${runId})`
      );
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "gerrit post failed",
      };
    }

    // Best-effort cleanup — if this fails, the 24h TTL eventually expires.
    try {
      await env.RUNNERS.delete(CORRELATION_KEY(runId));
    } catch {
      /* noop */
    }

    return { ok: true, posted: true };
  } catch (err) {
    // Final safety net — never throw.
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown gerrit callback error",
    };
  }
}
