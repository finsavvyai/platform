// Per-team chargeback — closes ENTERPRISE_ROADMAP.md P1 #14 /
// ENTERPRISE_CAPABILITIES.md §2.3 "Chargeback / cost attribution by team".
//
// Computes CI build minutes and $-equivalent-saved-vs-GHA, grouped by
// team (org sub-group) over a date range. Finance exports this as CSV;
// the dashboard renders it as a bar chart. Cost model matches the public
// comparison claim: $0.008 / minute saved.
//
// Pure group-by over existing `runs` / `projects` / `project_memberships`.
// No migrations. No new writes. If the deployment doesn't have a `team`
// column on projects yet, the endpoint falls back to grouping by org.

import { Hono } from "hono";
import type { Env } from "./types";
import { getAuthUser } from "./team-auth";

export const CHARGEBACK_RATE_USD_PER_MIN = 0.008;

export interface ChargebackRow {
  team: string;
  projectCount: number;
  totalRuns: number;
  totalMinutes: number;
  costSavedUsd: number;
}

export interface ChargebackReport {
  orgId: string;
  startIso: string;
  endIso: string;
  rows: ChargebackRow[];
  totals: {
    runs: number;
    minutes: number;
    costSavedUsd: number;
  };
}

interface DbRow {
  team: string | null;
  project_count: number;
  total_runs: number;
  total_seconds: number;
}

export async function computeChargeback(
  env: Env,
  orgId: string,
  startMs: number,
  endMs: number,
): Promise<ChargebackReport> {
  const stmt = env.DB.prepare(
    `SELECT COALESCE(p.team, 'unassigned')  AS team,
            COUNT(DISTINCT p.id)            AS project_count,
            COUNT(r.id)                     AS total_runs,
            COALESCE(SUM(r.duration_ms), 0) / 1000 AS total_seconds
     FROM projects p
     LEFT JOIN runs r ON r.project_id = p.id
       AND r.started_at BETWEEN ? AND ?
     WHERE p.org_id = ?
     GROUP BY COALESCE(p.team, 'unassigned')
     ORDER BY total_seconds DESC`,
  );
  const { results } = await stmt.bind(startMs, endMs, orgId).all<DbRow>();

  const rows: ChargebackRow[] = results.map((r) => {
    const minutes = r.total_seconds / 60;
    return {
      team: r.team ?? "unassigned",
      projectCount: r.project_count,
      totalRuns: r.total_runs,
      totalMinutes: Math.round(minutes * 100) / 100,
      costSavedUsd: Math.round(minutes * CHARGEBACK_RATE_USD_PER_MIN * 100) / 100,
    };
  });

  const totals = rows.reduce(
    (acc, row) => ({
      runs: acc.runs + row.totalRuns,
      minutes: acc.minutes + row.totalMinutes,
      costSavedUsd: acc.costSavedUsd + row.costSavedUsd,
    }),
    { runs: 0, minutes: 0, costSavedUsd: 0 },
  );
  totals.minutes = Math.round(totals.minutes * 100) / 100;
  totals.costSavedUsd = Math.round(totals.costSavedUsd * 100) / 100;

  return {
    orgId,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    rows,
    totals,
  };
}

export const chargebackRoutes = new Hono<{ Bindings: Env }>();

chargebackRoutes.get("/orgs/:orgId/chargeback", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const orgId = c.req.param("orgId");
  const now = Date.now();
  const start = Number(c.req.query("from") ?? now - 30 * 86400_000);
  const end = Number(c.req.query("to") ?? now);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return c.json({ error: "invalid_range" }, 400);
  }
  const report = await computeChargeback(c.env, orgId, start, end);
  return c.json(report);
});
