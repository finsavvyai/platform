// Audit helper for integration /connect + /connections lifecycle (I-003 fix).
//
// Portfolio CLAUDE.md requires audit logging for "auth events, admin
// actions, sensitive data mutations". Every /connect endpoint stores a
// long-lived PAT or secret — that IS a sensitive data mutation. The
// bridges added since v1.5 (gitlab, bitbucket, azure-devops, circleci,
// github-actions, cepien, jenkins, aws) bypassed the audit path. This
// helper writes one row per connect/disconnect into the existing
// `audit_logs` table declared in db.ts.
//
// Schema reuse — no new migration needed. We map semantically:
//   action       := "integration_connect" | "integration_disconnect"
//   resource_type := "integration"
//   resource_id   := `${provider}:${label}`
//   details_json  := { ip, meta }   (secrets NEVER logged)
//
// License: Apache-2.0

import type { Env } from "./types";

export type AuditConnectEvent = "integration_connect" | "integration_disconnect";

export interface AuditConnectInput {
  sub: string;
  provider: string;
  label: string;
  ip: string | null;
  meta?: Record<string, string>;
}

interface AuditEnv {
  DB: Env["DB"];
}

// --- writers ---

/** Record a successful integration connect. */
export async function auditConnect(
  env: AuditEnv,
  input: AuditConnectInput
): Promise<void> {
  await writeAudit(env, "integration_connect", input);
}

/** Record a successful integration disconnect. */
export async function auditDisconnect(
  env: AuditEnv,
  input: AuditConnectInput
): Promise<void> {
  await writeAudit(env, "integration_disconnect", input);
}

async function writeAudit(
  env: AuditEnv,
  action: AuditConnectEvent,
  input: AuditConnectInput
): Promise<void> {
  const details = JSON.stringify({
    ip: input.ip ?? null,
    ...(input.meta ? { meta: input.meta } : {}),
  });
  const resourceId = `${input.provider}:${input.label}`;
  try {
    await env.DB.prepare(
      `INSERT INTO audit_logs (actor_sub, actor_login, action, resource_type, resource_id, details_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(input.sub, null, action, "integration", resourceId, details)
      .run();
  } catch (err) {
    // Audit must never block a user action — log and continue.
    console.error(
      JSON.stringify({
        level: "error",
        msg: "audit_connect_failed",
        action,
        provider: input.provider,
        error: err instanceof Error ? err.message : "unknown",
      })
    );
  }
}

/** Extract the caller IP from CF-Connecting-IP with safe fallback. */
export function callerIp(headerGet: (k: string) => string | undefined): string | null {
  const raw = headerGet("cf-connecting-ip") ?? headerGet("CF-Connecting-IP");
  if (!raw) return null;
  // Basic sanity — keep it short, no control chars.
  return raw.slice(0, 64).replace(/[\x00-\x1f]/g, "");
}
