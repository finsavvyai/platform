// Enterprise dashboard read-only endpoints.
//
// Mounted at /api/enterprise. Backs the /enterprise dashboard page with
// *real* data pulled from runs + deployment_requests + SAML tenant config.
// No mock values — when the underlying table is empty we return an empty
// shape and the UI renders an empty state.

import { Hono } from "hono";
import { getAuthUser } from "./team-auth";
import type { Env } from "./types";
import {
  buildIdentityStatus,
  listUserOrgSlugs,
  samlForUser,
  scimForUser,
  type IdentityStatus,
} from "./enterprise-identity";

export type { IdentityStatus };

type Bindings = Env;
export const enterpriseRoutes = new Hono<{ Bindings: Bindings }>();

const WINDOW_DAYS = 30;

export interface DoraMetrics {
  window_days: number;
  deploy_count: number;
  deploy_frequency_per_day: number;
  lead_time_ms_p50: number | null;
  mttr_ms_p50: number | null;
  change_failure_rate: number | null;
  computed_at: string;
}

interface RunRow { duration_ms: number | null; status: string; finished_at: string | null; }
interface DeployRow { status: string; created_at: string; }

async function listUserProjectIds(db: D1Database, userSub: string): Promise<string[]> {
  try {
    const { results } = await db
      .prepare("SELECT project_id FROM project_memberships WHERE user_sub = ?")
      .bind(userSub)
      .all<{ project_id: string }>();
    return (results ?? []).map((r) => r.project_id);
  } catch {
    return [];
  }
}

async function computeDora(db: D1Database, projectIds: string[]): Promise<DoraMetrics> {
  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
  const base: DoraMetrics = {
    window_days: WINDOW_DAYS,
    deploy_count: 0,
    deploy_frequency_per_day: 0,
    lead_time_ms_p50: null,
    mttr_ms_p50: null,
    change_failure_rate: null,
    computed_at: now.toISOString(),
  };
  if (projectIds.length === 0) return base;

  const placeholders = projectIds.map(() => "?").join(",");
  let deploys: DeployRow[] = [];
  try {
    // scoped per tenant — DO NOT remove project_id IN (...) clause
    const { results } = await db
      .prepare(
        `SELECT status, created_at FROM deployment_requests
         WHERE project_id IN (${placeholders}) AND created_at >= ?`,
      )
      .bind(...projectIds, since)
      .all<DeployRow>();
    deploys = results ?? [];
  } catch {
    deploys = [];
  }

  const executed = deploys.filter((d) => d.status === "queued" || d.status === "approved");
  const failed = deploys.filter((d) => d.status === "blocked" || d.status === "failed");
  const total = executed.length + failed.length;
  base.deploy_count = executed.length;
  base.deploy_frequency_per_day = Number((executed.length / WINDOW_DAYS).toFixed(2));
  if (total > 0) base.change_failure_rate = Number((failed.length / total).toFixed(3));

  // Lead time + MTTR proxies from runs.
  // scoped per tenant — DO NOT remove JOIN to projects + project_id IN (...)
  // runs has no project_id column; tenancy flows through projects.repo = runs.repo,
  // then project_memberships filter (mirrors getRunForUser / listRunsForUser in db.ts).
  let runs: RunRow[] = [];
  try {
    const { results } = await db
      .prepare(
        `SELECT runs.duration_ms, runs.status, runs.finished_at
         FROM runs
         JOIN projects ON projects.repo = runs.repo
         WHERE projects.id IN (${placeholders})
           AND runs.duration_ms IS NOT NULL
           AND runs.finished_at >= ?`,
      )
      .bind(...projectIds, since)
      .all<RunRow>();
    runs = results ?? [];
  } catch {
    runs = [];
  }
  const durations = runs
    .map((r) => r.duration_ms)
    .filter((d): d is number => typeof d === "number" && d > 0)
    .sort((a, b) => a - b);
  base.lead_time_ms_p50 = durations.length > 0 ? durations[Math.floor(durations.length / 2)] : null;
  const failedDurations = runs
    .filter((r) => r.status === "failed")
    .map((r) => r.duration_ms)
    .filter((d): d is number => typeof d === "number" && d > 0)
    .sort((a, b) => a - b);
  base.mttr_ms_p50 = failedDurations.length > 0 ? failedDurations[Math.floor(failedDurations.length / 2)] : null;
  return base;
}

enterpriseRoutes.get("/dora", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const projects = await listUserProjectIds(c.env.DB, user.sub);
  const metrics = await computeDora(c.env.DB, projects);
  return c.json(metrics);
});

enterpriseRoutes.get("/identity-status", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  // H-003 fix — scope SAML/SCIM lookup to the caller's org memberships.
  // DO NOT replace with a global kv.list({ prefix: "saml:tenant:" }) —
  // that leaks the first SSO-configured tenant's name to every user.
  const orgSlugs = await listUserOrgSlugs(c.env.DB, user.sub);
  const saml = await samlForUser(c.env.RUNNERS, orgSlugs);
  const scim = await scimForUser(c.env.RUNNERS, orgSlugs);
  return c.json(buildIdentityStatus(saml, scim));
});

export const _internal = { computeDora, WINDOW_DAYS };
