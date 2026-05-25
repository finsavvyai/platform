/** Monthly budget cap: month-to-date spend query + enforcement helper. */

import type { Env } from './types';

export interface BudgetStatus {
  monthlyCap: number | null;
  usedMtd: number;
  pct: number;
  over: boolean;
}

/** Return current month YYYY-MM in UTC. */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Sum cost for this UTC calendar month for a project. */
export async function getMonthToDateSpend(env: Env, projectId: string): Promise<number> {
  const row = await env.DB.prepare(`
    SELECT COALESCE(SUM(cost), 0) as cost
    FROM requests
    WHERE project_id = ?
      AND created_at >= datetime('now', 'start of month')
  `).bind(projectId).first<{ cost: number }>();
  return row?.cost ?? 0;
}

/** Full budget status for a project. */
export async function getBudgetStatus(env: Env, projectId: string): Promise<BudgetStatus> {
  const row = await env.DB.prepare(
    'SELECT monthly_budget_usd FROM projects WHERE id = ?',
  ).bind(projectId).first<{ monthly_budget_usd: number | null }>();

  const cap = row?.monthly_budget_usd ?? null;
  const used = await getMonthToDateSpend(env, projectId);
  const pct = cap && cap > 0 ? (used / cap) * 100 : 0;

  return {
    monthlyCap: cap,
    usedMtd: Math.round(used * 10000) / 10000,
    pct: Math.round(pct * 10) / 10,
    over: cap != null && cap > 0 && used >= cap,
  };
}

/** Which thresholds have been crossed that haven't yet been alerted on? */
export function pendingThresholds(
  status: BudgetStatus, fired: Record<string, number[]> | null,
): number[] {
  if (status.monthlyCap == null || status.monthlyCap <= 0) return [];
  const month = currentMonth();
  const alreadyFired = new Set(fired?.[month] ?? []);
  const crossed = [50, 80, 100].filter((t) => status.pct >= t);
  return crossed.filter((t) => !alreadyFired.has(t));
}

/** Merge newly-fired thresholds into the stored JSON and persist. */
export async function recordFiredThresholds(
  env: Env, projectId: string, newlyFired: number[],
): Promise<void> {
  const row = await env.DB.prepare(
    'SELECT threshold_alerts_fired FROM projects WHERE id = ?',
  ).bind(projectId).first<{ threshold_alerts_fired: string | null }>();

  const existing: Record<string, number[]> = row?.threshold_alerts_fired
    ? JSON.parse(row.threshold_alerts_fired)
    : {};

  const month = currentMonth();
  existing[month] = [...new Set([...(existing[month] ?? []), ...newlyFired])].sort((a, b) => a - b);

  await env.DB.prepare(
    'UPDATE projects SET threshold_alerts_fired = ? WHERE id = ?',
  ).bind(JSON.stringify(existing), projectId).run();
}

/** Sum month-to-date spend for every project linked to a team. */
export async function getTeamBudgetStatus(env: Env, teamId: string): Promise<BudgetStatus> {
  const team = await env.DB.prepare(
    'SELECT budget_usd FROM teams WHERE id = ?',
  ).bind(teamId).first<{ budget_usd: number | null }>();
  const cap = team?.budget_usd ?? null;

  const row = await env.DB.prepare(`
    SELECT COALESCE(SUM(r.cost), 0) as cost FROM requests r
    JOIN projects p ON p.id = r.project_id
    WHERE p.team_id = ? AND r.created_at >= datetime('now', 'start of month')
  `).bind(teamId).first<{ cost: number }>();
  const used = row?.cost ?? 0;
  const pct = cap && cap > 0 ? (used / cap) * 100 : 0;

  return {
    monthlyCap: cap,
    usedMtd: Math.round(used * 10000) / 10000,
    pct: Math.round(pct * 10) / 10,
    over: cap != null && cap > 0 && used >= cap,
  };
}

/** Team id for a project (null if unlinked). */
export async function getProjectTeamId(env: Env, projectId: string): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT team_id FROM projects WHERE id = ?',
  ).bind(projectId).first<{ team_id: string | null }>();
  return row?.team_id ?? null;
}

export interface TeamRateLimit {
  perDay: number | null; usedToday: number; over: boolean;
}

/** Sum of today's requests across every project in the team vs team's daily cap. */
export async function getTeamRateLimit(env: Env, teamId: string): Promise<TeamRateLimit> {
  const team = await env.DB.prepare(
    'SELECT rate_limit_per_day FROM teams WHERE id = ?',
  ).bind(teamId).first<{ rate_limit_per_day: number | null }>();
  const cap = team?.rate_limit_per_day ?? null;

  const row = await env.DB.prepare(`
    SELECT COUNT(*) as n FROM requests r
    JOIN projects p ON p.id = r.project_id
    WHERE p.team_id = ? AND date(r.created_at) = date('now')
  `).bind(teamId).first<{ n: number }>();
  const used = row?.n ?? 0;
  return { perDay: cap, usedToday: used, over: cap != null && cap > 0 && used >= cap };
}

/** Check status, fire Slack/Teams/email alerts for any newly-crossed thresholds. Non-blocking. */
export async function maybeFireBudgetAlerts(env: Env, projectId: string): Promise<void> {
  const row = await env.DB.prepare(
    `SELECT name, slack_webhook_url, digest_email, teams_webhook_url,
            threshold_alerts_fired FROM projects WHERE id = ?`,
  ).bind(projectId).first<{
    name: string; slack_webhook_url: string | null; digest_email: string | null;
    teams_webhook_url: string | null; threshold_alerts_fired: string | null;
  }>();
  if (!row || (!row.slack_webhook_url && !row.digest_email && !row.teams_webhook_url)) return;

  const status = await getBudgetStatus(env, projectId);
  if (status.monthlyCap == null) return;

  const pending = pendingThresholds(status, parseFiredThresholds(row.threshold_alerts_fired));
  if (pending.length === 0) return;

  const { formatBudgetAlertBlocks, postToSlack } = await import('./slack-digest');
  const { formatBudgetAlertEmail, sendEmail } = await import('./email-digest');
  const { emitWebhook } = await import('./webhook-emit');
  const { formatBudgetAlertCard, postToTeams } = await import('./teams-digest');
  for (const t of pending) {
    if (row.slack_webhook_url) {
      await postToSlack(row.slack_webhook_url, formatBudgetAlertBlocks(row.name, t, status.usedMtd, status.monthlyCap));
    }
    if (row.digest_email) {
      await sendEmail(env, row.digest_email, formatBudgetAlertEmail(row.name, t, status.usedMtd, status.monthlyCap));
    }
    if (row.teams_webhook_url) {
      await postToTeams(row.teams_webhook_url, formatBudgetAlertCard(row.name, t, status.usedMtd, status.monthlyCap));
    }
    await emitWebhook(env, projectId, 'budget.threshold.crossed', {
      project_name: row.name, threshold: t,
      used_usd: status.usedMtd, monthly_cap_usd: status.monthlyCap,
    });
  }
  await recordFiredThresholds(env, projectId, pending);
}

/** Parse stored threshold JSON, tolerant to malformed data. */
export function parseFiredThresholds(raw: string | null): Record<string, number[]> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}
