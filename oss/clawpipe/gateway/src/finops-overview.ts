/** Multi-project finance overview: MTD spend + caps + EOM forecast for every project the user is a member of. */

import type { Env } from './types';
import { getAuthUser } from './auth/rbac';
import { daysInUtcMonth, utcDaysElapsed } from './budget-forecast';

interface Row {
  id: string; name: string; role: string;
  team_id: string | null; team_name: string | null;
  monthly_budget_usd: number | null; team_budget_usd: number | null;
}

/** GET /v1/finops/overview — one row per project with spend + caps. */
export async function handleFinopsOverview(
  request: Request, env: Env,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const projects = await env.DB.prepare(`
    SELECT p.id, p.name, pm.role,
           p.team_id, t.name as team_name,
           p.monthly_budget_usd,
           t.budget_usd as team_budget_usd
    FROM project_members pm
    JOIN projects p ON p.id = pm.project_id
    LEFT JOIN teams t ON t.id = p.team_id
    WHERE pm.user_id = ?
    ORDER BY p.created_at DESC
  `).bind(user.sub).all<Row>();

  const rows = projects.results ?? [];
  const ids = rows.map((r) => r.id);
  const spends = new Map<string, number>();

  // Compute linear EOM forecast constants once for this request.
  const now = new Date();
  const daysElapsed = utcDaysElapsed();
  const totalDays = daysInUtcMonth(now.getUTCFullYear(), now.getUTCMonth() + 1);

  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    const spend = await env.DB.prepare(`
      SELECT project_id, COALESCE(SUM(cost), 0) as cost
      FROM requests
      WHERE project_id IN (${placeholders})
        AND created_at >= datetime('now', 'start of month')
      GROUP BY project_id
    `).bind(...ids).all<{ project_id: string; cost: number }>();
    for (const s of spend.results ?? []) spends.set(s.project_id, s.cost);
  }

  const projectsOut = rows.map((r) => {
    const used = spends.get(r.id) ?? 0;
    const cap = r.monthly_budget_usd;
    const forecastEomUsd = daysElapsed > 0
      ? Math.round((used / daysElapsed) * totalDays * 10000) / 10000
      : 0;
    const pctOfCapForecast = cap && cap > 0
      ? Math.round((forecastEomUsd / cap) * 1000) / 10
      : 0;
    return {
      id: r.id, name: r.name, role: r.role,
      team: r.team_id ? { id: r.team_id, name: r.team_name ?? '', monthlyCap: r.team_budget_usd } : null,
      budget: {
        monthlyCap: cap,
        usedMtd: Math.round(used * 10000) / 10000,
        pct: cap && cap > 0 ? Math.round((used / cap) * 1000) / 10 : 0,
        over: cap != null && cap > 0 && used >= cap,
        forecastEomUsd,
        pctOfCapForecast,
      },
    };
  });

  const totals = {
    projects: projectsOut.length,
    usedMtd: Math.round(projectsOut.reduce((a, p) => a + p.budget.usedMtd, 0) * 10000) / 10000,
    cappedProjects: projectsOut.filter((p) => p.budget.monthlyCap != null).length,
    overBudget: projectsOut.filter((p) => p.budget.over).length,
  };

  return Response.json({ totals, projects: projectsOut });
}
