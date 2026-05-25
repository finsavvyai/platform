// Immutable audit log with SHA-256 hash chain. Closes enterprise gap #2.
//
// Each row in `audit_logs` carries two new columns (see migration
// 2026-04-22_mfa_and_audit_chain.sql):
//   prev_hash  — row_hash of the previous row (NULL for genesis)
//   row_hash   — SHA-256(prev_hash || canonical(row_without_row_hash))
//
// The chain lets any auditor (or external SIEM) detect if any historical
// row has been tampered with: recomputing row_hash for any row yields a
// different value iff the input changed, and that breaks every subsequent
// row in the chain. Verification walks the chain end-to-end in batches
// to keep Workers CPU budget under control.
//
// Rows that pre-date this migration have NULL hashes. The verifier skips
// them (treats the first hashed row as the chain's genesis) so legacy
// audit trail doesn't invalidate the chain; new rows appended via
// appendAudit() are guaranteed to be hash-linked.
//
// SOC 2 CC7.2 evidence: GET /api/audit/tip returns the current chain
// head which can be anchored externally (git commit, RFC 3161 TSA,
// blockchain) to prove no in-place edits occurred.

import { Hono } from "hono";
import type { Env } from "./types";

export interface AuditRow {
  id: number;
  actor_sub: string | null;
  actor_login: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details_json: string | null;
  created_at: string; // ISO datetime text
  prev_hash: string | null;
  row_hash: string | null;
}

type InsertInput = Omit<AuditRow, "id" | "prev_hash" | "row_hash">;

/** Canonical JSON for hashing — key-sorted, no whitespace, stable. */
function canonical(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  const parts: string[] = [];
  for (const k of keys) {
    parts.push(JSON.stringify(k) + ":" + JSON.stringify(obj[k] ?? null));
  }
  return "{" + parts.join(",") + "}";
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Append a row to audit_logs with a freshly-linked hash. Callers that
 *  previously wrote `INSERT INTO audit_logs (...)` directly should route
 *  through here so every new entry joins the chain. */
export async function appendAudit(
  env: Env,
  row: InsertInput,
): Promise<{ id: number; row_hash: string }> {
  const tip = await env.DB.prepare(
    `SELECT row_hash FROM audit_logs
     WHERE row_hash IS NOT NULL
     ORDER BY id DESC LIMIT 1`,
  ).first<{ row_hash: string | null }>();
  const prev = tip?.row_hash ?? null;

  // Stamp created_at server-side so the same string goes into the hash
  // and the row (a SQLite default would resolve to a slightly different
  // moment on the subsequent read and break verification).
  const createdAt = new Date().toISOString().replace("T", " ").slice(0, 19);

  const payload = canonical({
    actor_sub: row.actor_sub,
    actor_login: row.actor_login,
    action: row.action,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    details_json: row.details_json,
    created_at: createdAt,
  });
  const row_hash = await sha256Hex((prev ?? "") + payload);

  const res = await env.DB.prepare(
    `INSERT INTO audit_logs
      (actor_sub, actor_login, action, resource_type, resource_id,
       details_json, created_at, prev_hash, row_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
  ).bind(
    row.actor_sub, row.actor_login, row.action, row.resource_type,
    row.resource_id, row.details_json, createdAt, prev, row_hash,
  ).first<{ id: number }>();

  return { id: res?.id ?? 0, row_hash };
}

export interface ChainVerifyResult {
  verified: boolean;
  checked: number;
  skipped_legacy: number;
  tip: { id: number; row_hash: string; created_at: string } | null;
  firstBadRow?: {
    id: number;
    expected_row_hash: string;
    stored_row_hash: string;
  };
}

/** Walk the chain oldest → newest, confirm every row_hash. Bail on first
 *  mismatch so incident response can pinpoint where tampering began.
 *  Rows with NULL row_hash (pre-migration legacy) are counted separately. */
export async function verifyChain(env: Env, limit = 50_000): Promise<ChainVerifyResult> {
  const rows = await env.DB.prepare(
    `SELECT id, actor_sub, actor_login, action, resource_type, resource_id,
            details_json, created_at, prev_hash, row_hash
     FROM audit_logs ORDER BY id ASC LIMIT ?`,
  ).bind(limit).all<AuditRow>();

  let prev: string | null = null;
  let tip: ChainVerifyResult["tip"] = null;
  let skipped = 0;
  let checked = 0;

  for (const r of rows.results) {
    if (r.row_hash === null) { skipped++; continue; }
    const expected = await sha256Hex(
      (prev ?? "") +
        canonical({
          actor_sub: r.actor_sub,
          actor_login: r.actor_login,
          action: r.action,
          resource_type: r.resource_type,
          resource_id: r.resource_id,
          details_json: r.details_json,
          created_at: r.created_at,
        }),
    );
    checked++;
    if (expected !== r.row_hash) {
      return {
        verified: false,
        checked,
        skipped_legacy: skipped,
        tip,
        firstBadRow: {
          id: r.id,
          expected_row_hash: expected,
          stored_row_hash: r.row_hash ?? "<null>",
        },
      };
    }
    prev = r.row_hash;
    tip = { id: r.id, row_hash: r.row_hash!, created_at: r.created_at };
  }
  return { verified: true, checked, skipped_legacy: skipped, tip };
}

// --- HTTP surface ---
export const auditChainRoutes = new Hono<{ Bindings: Env }>();

/** GET /api/audit/verify — run the chain walk. Returns 200 on success,
 *  409 on tamper detection, so monitoring can alert on status code alone. */
auditChainRoutes.get("/verify", async (c) => {
  const res = await verifyChain(c.env);
  return c.json(res, res.verified ? 200 : 409);
});

/** GET /api/audit/tip — cheap endpoint for external timestamp anchoring.
 *  Returns the tip hash + created_at so SIEM/TSA integrations can pin it. */
auditChainRoutes.get("/tip", async (c) => {
  const tip = await c.env.DB.prepare(
    `SELECT id, row_hash, created_at FROM audit_logs
     WHERE row_hash IS NOT NULL
     ORDER BY id DESC LIMIT 1`,
  ).first<{ id: number; row_hash: string; created_at: string }>();
  return c.json({ tip: tip ?? null, at: new Date().toISOString() });
});
