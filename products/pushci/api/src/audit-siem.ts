// SIEM export for the audit log. Closes enterprise gap §2.2 (SIEM feed).
// Supports four destination kinds:
//   - splunk        (HEC, POST /services/collector/event)
//   - datadog       (HTTP Logs Intake, POST /api/v2/logs)
//   - webhook       (generic JSON POST; BYO pipeline)
//   - syslog_https  (CEF-wrapped JSON to any HTTPS syslog receiver)
//
// Flow is incremental: POST /api/audit/orgs/:orgId/export advances a
// `since` cursor (audit_logs.id) forward to the current tip and batches
// rows to every configured destination. Success/failure is stamped on
// siem_destinations for observability. No SDKs — plain fetch keeps the
// Workers bundle lean.
//
// Auth is the destination's own bearer/HEC token, never a user token.
// `auth_header` is assumed encrypted at rest (same pattern as
// aws-creds-store.ts).

import { Hono } from "hono";
import type { Env } from "./types";
import { getAuthUser } from "./team-auth";

type Kind = "splunk" | "datadog" | "webhook" | "syslog_https";

interface Destination {
  id: string;
  org_id: string;
  kind: Kind;
  endpoint_url: string;
  auth_header: string | null;
}

interface AuditRow {
  id: number;
  actor_sub: string | null;
  actor_login: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details_json: string | null;
  created_at: string;
  row_hash: string | null;
}

/** Confirm the caller is a member of the target org before doing anything
 *  destination-side. Mirrors the pattern in team-orgs.ts. */
async function requireOrgMember(
  env: Env, userSub: string, orgId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT 1 AS ok FROM org_members WHERE org_id=? AND user_sub=?",
  ).bind(orgId, userSub).first<{ ok: number }>();
  return !!row;
}

function toSplunk(rows: AuditRow[]): string {
  // HEC accepts newline-delimited JSON. Convert ISO time to epoch seconds.
  return rows
    .map((r) =>
      JSON.stringify({
        time: Math.floor(Date.parse(r.created_at) / 1000),
        source: "pushci",
        sourcetype: "pushci:audit",
        event: r,
      }),
    )
    .join("\n");
}

function toDatadog(rows: AuditRow[], orgId: string): string {
  return JSON.stringify(
    rows.map((r) => ({
      ddsource: "pushci",
      service: "audit",
      ddtags: `env:prod,org:${orgId}`,
      hostname: "api.pushci.dev",
      message: r,
    })),
  );
}

function toCef(r: AuditRow): string {
  // CEF:Version|Vendor|Product|Version|SignatureID|Name|Severity|Extension
  const ext = `actor=${r.actor_login ?? r.actor_sub ?? "-"} act=${r.action} resource=${r.resource_type ?? "-"}:${r.resource_id ?? "-"} rowHash=${r.row_hash ?? "-"}`;
  return `CEF:0|PushCI|PushCI|1.7.0|${r.action}|${r.action}|3|${ext}`;
}

async function deliver(
  dest: Destination,
  rows: AuditRow[],
): Promise<{ ok: boolean; status: number; body: string }> {
  let body: string;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  switch (dest.kind) {
    case "splunk":
      body = toSplunk(rows);
      if (dest.auth_header) headers.Authorization = `Splunk ${dest.auth_header}`;
      break;
    case "datadog":
      body = toDatadog(rows, dest.org_id);
      if (dest.auth_header) headers["DD-API-KEY"] = dest.auth_header;
      break;
    case "syslog_https":
      body = rows.map(toCef).join("\n");
      headers["Content-Type"] = "text/plain";
      if (dest.auth_header) headers.Authorization = `Bearer ${dest.auth_header}`;
      break;
    case "webhook":
    default:
      body = JSON.stringify({ events: rows });
      if (dest.auth_header) headers.Authorization = `Bearer ${dest.auth_header}`;
      break;
  }

  const r = await fetch(dest.endpoint_url, { method: "POST", headers, body });
  const text = await r.text().catch(() => "");
  return { ok: r.ok, status: r.status, body: text.slice(0, 500) };
}

async function recordResult(
  env: Env,
  destId: string,
  result: { ok: boolean; status: number; body: string },
) {
  const now = Math.floor(Date.now() / 1000);
  if (result.ok) {
    await env.DB.prepare(
      "UPDATE siem_destinations SET last_success_at=?, last_error=NULL WHERE id=?",
    ).bind(now, destId).run();
  } else {
    await env.DB.prepare(
      "UPDATE siem_destinations SET last_error=? WHERE id=?",
    ).bind(`HTTP ${result.status}: ${result.body}`, destId).run();
  }
}

export const siemRoutes = new Hono<{ Bindings: Env }>();

/** POST /api/audit/orgs/:orgId/export — flush audit rows since last
 *  cursor to every configured destination for the org. Body:
 *  { since?: number, limit?: number }. `since` is the last audit_logs.id
 *  the caller has already exported; rows are ordered by id ASC. */
siemRoutes.post("/orgs/:orgId/export", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const orgId = c.req.param("orgId");
  if (!(await requireOrgMember(c.env, user.sub, orgId))) {
    return c.json({ error: "forbidden" }, 403);
  }

  const body = await c.req
    .json<{ since?: number; limit?: number }>()
    .catch(() => ({} as { since?: number; limit?: number }));
  const { since = 0, limit = 1000 } = body;

  const dests = await c.env.DB.prepare(
    "SELECT id, org_id, kind, endpoint_url, auth_header FROM siem_destinations WHERE org_id=?",
  ).bind(orgId).all<Destination>();
  if (!dests.results.length) return c.json({ sent: 0, destinations: 0 });

  const rows = await c.env.DB.prepare(
    `SELECT id, actor_sub, actor_login, action, resource_type, resource_id,
            details_json, created_at, row_hash
     FROM audit_logs WHERE id > ? ORDER BY id ASC LIMIT ?`,
  ).bind(since, Math.min(limit, 5000)).all<AuditRow>();

  const report: Array<{ destination: string; kind: Kind; ok: boolean; status: number }> = [];
  for (const d of dests.results) {
    const res = await deliver(d, rows.results);
    await recordResult(c.env, d.id, res);
    report.push({ destination: d.id, kind: d.kind, ok: res.ok, status: res.status });
  }

  return c.json({
    sent: rows.results.length,
    destinations: dests.results.length,
    tip: rows.results.at(-1)?.id ?? since,
    report,
  });
});

/** GET /api/audit/orgs/:orgId/destinations — list configured destinations
 *  (sans secrets). */
siemRoutes.get("/orgs/:orgId/destinations", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const orgId = c.req.param("orgId");
  if (!(await requireOrgMember(c.env, user.sub, orgId))) {
    return c.json({ error: "forbidden" }, 403);
  }
  const dests = await c.env.DB.prepare(
    `SELECT id, kind, endpoint_url, created_at, last_success_at, last_error
     FROM siem_destinations WHERE org_id=? ORDER BY created_at DESC`,
  ).bind(orgId).all();
  return c.json({ destinations: dests.results });
});
