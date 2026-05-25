/** Slack weekly digest — queries last 7 days, formats message, posts to webhook. */

import type { Env } from './types';

const SLACK_WEBHOOK_PREFIX = 'https://hooks.slack.com/services/';

export interface DigestStats {
  projectName: string;
  totalRequests: number;
  totalCost: number;
  cachedPct: number;
  boostedPct: number;
  avgLatencyMs: number;
  topModels: Array<{ model: string; cost: number; requests: number }>;
  costDeltaPct: number | null;
}

/** Reject any URL not matching the Slack webhook prefix. */
export function isValidSlackWebhook(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && url.startsWith(SLACK_WEBHOOK_PREFIX);
  } catch {
    return false;
  }
}

/** Gather last-7d stats for a single project. */
export async function collectProjectDigest(
  env: Env, projectId: string, projectName: string,
): Promise<DigestStats> {
  const lastWeek = await env.DB.prepare(`
    SELECT
      COUNT(*) as total_requests,
      COALESCE(SUM(cost), 0) as total_cost,
      COALESCE(SUM(cached), 0) as cached_count,
      COALESCE(SUM(boosted), 0) as boosted_count,
      COALESCE(AVG(latency_ms), 0) as avg_latency
    FROM requests
    WHERE project_id = ? AND created_at >= datetime('now', '-7 days')
  `).bind(projectId).first<{
    total_requests: number; total_cost: number;
    cached_count: number; boosted_count: number; avg_latency: number;
  }>();

  const priorWeek = await env.DB.prepare(`
    SELECT COALESCE(SUM(cost), 0) as total_cost FROM requests
    WHERE project_id = ?
      AND created_at >= datetime('now', '-14 days')
      AND created_at < datetime('now', '-7 days')
  `).bind(projectId).first<{ total_cost: number }>();

  const topModels = await env.DB.prepare(`
    SELECT model, COALESCE(SUM(cost), 0) as cost, COUNT(*) as requests
    FROM requests
    WHERE project_id = ? AND created_at >= datetime('now', '-7 days')
    GROUP BY model
    ORDER BY cost DESC
    LIMIT 3
  `).bind(projectId).all<{ model: string; cost: number; requests: number }>();

  const totalReq = lastWeek?.total_requests ?? 0;
  const priorCost = priorWeek?.total_cost ?? 0;
  const thisCost = lastWeek?.total_cost ?? 0;
  const costDeltaPct = priorCost > 0 ? ((thisCost - priorCost) / priorCost) * 100 : null;

  return {
    projectName,
    totalRequests: totalReq,
    totalCost: thisCost,
    cachedPct: totalReq > 0 ? ((lastWeek?.cached_count ?? 0) / totalReq) * 100 : 0,
    boostedPct: totalReq > 0 ? ((lastWeek?.boosted_count ?? 0) / totalReq) * 100 : 0,
    avgLatencyMs: Math.round(lastWeek?.avg_latency ?? 0),
    topModels: (topModels.results ?? []).map((r) => ({
      model: r.model,
      cost: Math.round(r.cost * 10000) / 10000,
      requests: r.requests,
    })),
    costDeltaPct: costDeltaPct != null ? Math.round(costDeltaPct * 10) / 10 : null,
  };
}

/** Build Slack Block Kit payload from digest stats. */
export function formatSlackBlocks(stats: DigestStats): unknown {
  const costStr = `$${stats.totalCost.toFixed(2)}`;
  const deltaLine = stats.costDeltaPct == null
    ? '_First week of data — no comparison yet._'
    : `${stats.costDeltaPct >= 0 ? '📈' : '📉'} ${stats.costDeltaPct >= 0 ? '+' : ''}${stats.costDeltaPct}% vs prior week`;

  const savingsLine = `🧠 ${stats.cachedPct.toFixed(1)}% cached · ⚡ ${stats.boostedPct.toFixed(1)}% boosted (skipped LLM)`;

  const modelsLines = stats.topModels.length
    ? stats.topModels.map((m, i) => `${i + 1}. *${m.model}* — $${m.cost.toFixed(4)} (${m.requests.toLocaleString()} calls)`).join('\n')
    : '_No requests this week._';

  return {
    text: `ClawPipe weekly digest: ${stats.projectName} — ${costStr}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `ClawPipe weekly digest · ${stats.projectName}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Total spend*\n${costStr}` },
          { type: 'mrkdwn', text: `*Requests*\n${stats.totalRequests.toLocaleString()}` },
          { type: 'mrkdwn', text: `*Avg latency*\n${stats.avgLatencyMs}ms` },
          { type: 'mrkdwn', text: `*vs last week*\n${deltaLine}` },
        ],
      },
      { type: 'section', text: { type: 'mrkdwn', text: savingsLine } },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Top models by cost*\n${modelsLines}` },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: '<https://app.clawpipe.ai|Open dashboard> · <https://clawpipe.ai/finops|ClawPipe for FinOps>' },
        ],
      },
    ],
  };
}

/** Build Slack Block Kit payload for a budget-threshold alert. */
export function formatBudgetAlertBlocks(
  projectName: string, threshold: number, usedMtd: number, cap: number,
): unknown {
  const emoji = threshold >= 100 ? '🚨' : threshold >= 80 ? '⚠️' : '📊';
  const headline = threshold >= 100
    ? `Budget exhausted — requests are being rejected`
    : `Budget alert — ${threshold}% of monthly cap used`;

  return {
    text: `${emoji} ${projectName}: ${threshold}% of $${cap.toFixed(2)} budget used`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `${emoji} ${projectName}` } },
      { type: 'section', text: { type: 'mrkdwn', text: `*${headline}*` } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Spent this month*\n$${usedMtd.toFixed(2)}` },
          { type: 'mrkdwn', text: `*Monthly cap*\n$${cap.toFixed(2)}` },
        ],
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: '<https://app.clawpipe.ai|Open dashboard> · Adjust cap in project settings' },
        ],
      },
    ],
  };
}

/** POST the digest to Slack. Returns true on 2xx. */
export async function postToSlack(webhookUrl: string, payload: unknown): Promise<boolean> {
  if (!isValidSlackWebhook(webhookUrl)) return false;
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

type ProjectRow = { id: string; name: string; slack_webhook_url: string | null; digest_email: string | null; teams_webhook_url: string | null };

/** Fetch every project with a Slack/Teams webhook or digest_email, build digest, fire in parallel. */
export async function runDigestForAllProjects(env: Env): Promise<{ sent: number; failed: number }> {
  const q = `SELECT id, name, slack_webhook_url, digest_email, teams_webhook_url FROM projects
     WHERE (slack_webhook_url IS NOT NULL AND slack_webhook_url != '')
        OR (digest_email IS NOT NULL AND digest_email != '')
        OR (teams_webhook_url IS NOT NULL AND teams_webhook_url != '')`;
  const projects = await env.DB.prepare(q).all<ProjectRow>();
  const { formatDigestEmail, sendEmail } = await import('./email-digest');
  const { formatDigestCard, postToTeams } = await import('./teams-digest');
  const results = await Promise.allSettled(
    (projects.results ?? []).map(async (p) => {
      const stats = await collectProjectDigest(env, p.id, p.name);
      if (stats.totalRequests === 0) return false;
      const tasks: Promise<boolean>[] = [];
      if (p.slack_webhook_url) tasks.push(postToSlack(p.slack_webhook_url, formatSlackBlocks(stats)));
      if (p.digest_email) tasks.push(sendEmail(env, p.digest_email, formatDigestEmail(stats)));
      if (p.teams_webhook_url) tasks.push(postToTeams(p.teams_webhook_url, formatDigestCard(stats)));
      const outcomes = await Promise.all(tasks);
      return outcomes.some(Boolean);
    }),
  );
  let sent = 0, failed = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value === true) sent++;
    else failed++;
  }
  return { sent, failed };
}
