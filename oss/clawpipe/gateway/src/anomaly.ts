/** FinOps anomaly detection: today's spend vs 30-day trailing daily average. */

import type { Env } from './types';

const DEFAULT_MULTIPLIER = 2; // today >= 200% of avg triggers alert

export interface AnomalyStatus {
  todayUsd: number;
  avg30dUsd: number;
  multiplier: number;   // todayUsd / avg30dUsd
  threshold: number;    // multiplier that would trigger
  alert: boolean;
}

/** Compute today's spend + trailing 30-day daily average for a project. */
export async function getAnomalyStatus(
  env: Env, projectId: string, thresholdMultiplier: number = DEFAULT_MULTIPLIER,
): Promise<AnomalyStatus> {
  const today = await env.DB.prepare(`
    SELECT COALESCE(SUM(cost), 0) as cost FROM requests
    WHERE project_id = ? AND date(created_at) = date('now')
  `).bind(projectId).first<{ cost: number }>();

  const trailing = await env.DB.prepare(`
    SELECT COALESCE(SUM(cost), 0) as cost FROM requests
    WHERE project_id = ?
      AND date(created_at) >= date('now', '-30 days')
      AND date(created_at) < date('now')
  `).bind(projectId).first<{ cost: number }>();

  const todayUsd = today?.cost ?? 0;
  const avg30dUsd = (trailing?.cost ?? 0) / 30;
  const multiplier = avg30dUsd > 0 ? todayUsd / avg30dUsd : 0;
  const MIN_DAILY_FLOOR = 1; // ignore anomalies when today's spend is tiny
  const alert = avg30dUsd > 0 && todayUsd >= MIN_DAILY_FLOOR && multiplier >= thresholdMultiplier;

  return {
    todayUsd: Math.round(todayUsd * 10000) / 10000,
    avg30dUsd: Math.round(avg30dUsd * 10000) / 10000,
    multiplier: Math.round(multiplier * 100) / 100,
    threshold: thresholdMultiplier,
    alert,
  };
}

/** Parse JSON array of dates, tolerant to malformed input. */
export function parseFiredDates(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}

/** Has today already fired an anomaly alert? */
export function alreadyFiredToday(fired: string[]): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return fired.includes(today);
}

/** Slack Block Kit payload for anomaly alert. */
export function formatAnomalyBlocks(projectName: string, status: AnomalyStatus): unknown {
  return {
    text: `🔥 ${projectName}: today's spend ${status.multiplier}× the 30-day avg`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `🔥 Spend anomaly — ${projectName}` } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Today so far*\n$${status.todayUsd.toFixed(2)}` },
          { type: 'mrkdwn', text: `*30-day daily avg*\n$${status.avg30dUsd.toFixed(2)}` },
          { type: 'mrkdwn', text: `*Multiplier*\n${status.multiplier}×` },
          { type: 'mrkdwn', text: `*Threshold*\n${status.threshold}×` },
        ],
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: '<https://app.clawpipe.ai|Investigate in dashboard>' }],
      },
    ],
  };
}

/** Minimal HTML email for anomaly alert. */
export function formatAnomalyEmail(projectName: string, status: AnomalyStatus): { subject: string; html: string; text: string } {
  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fafafa;color:#1d1d1f;padding:24px">
  <table style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e5e7;border-radius:14px;padding:28px" cellpadding="0" cellspacing="0">
    <tr><td style="font-size:18px;font-weight:700">🔥 Spend anomaly — ${projectName}</td></tr>
    <tr><td style="font-size:14px;color:#515154;padding:12px 0 18px">Today's spend is ${status.multiplier}× your 30-day daily average.</td></tr>
    <tr><td style="font-size:13px;color:#515154"><strong>Today:</strong> $${status.todayUsd.toFixed(2)} &nbsp;&nbsp; <strong>30-day avg:</strong> $${status.avg30dUsd.toFixed(2)}</td></tr>
    <tr><td style="padding-top:20px;font-size:12px;color:#6e6e73"><a href="https://app.clawpipe.ai" style="color:#6e56cf;text-decoration:none">Investigate in dashboard</a></td></tr>
  </table></body></html>`;
  const text = `🔥 Spend anomaly — ${projectName}\nToday: $${status.todayUsd.toFixed(2)} · 30-day avg: $${status.avg30dUsd.toFixed(2)} · ${status.multiplier}× avg\nDashboard: https://app.clawpipe.ai`;
  return { subject: `🔥 ClawPipe anomaly: ${projectName} — ${status.multiplier}× avg`, html, text };
}

/** Mark today fired; merge into existing list. */
export async function recordFiredToday(env: Env, projectId: string, fired: string[]): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const next = Array.from(new Set([...fired, today])).slice(-60); // keep last 60 days
  await env.DB.prepare('UPDATE projects SET anomaly_alerts_fired = ? WHERE id = ?')
    .bind(JSON.stringify(next), projectId).run();
}

/** Main entry point — checks status, fires Slack+email once per day. Non-blocking. */
export async function maybeFireAnomalyAlert(env: Env, projectId: string): Promise<void> {
  const row = await env.DB.prepare(
    'SELECT name, slack_webhook_url, digest_email, anomaly_alerts_fired FROM projects WHERE id = ?',
  ).bind(projectId).first<{
    name: string; slack_webhook_url: string | null;
    digest_email: string | null; anomaly_alerts_fired: string | null;
  }>();
  if (!row || (!row.slack_webhook_url && !row.digest_email)) return;

  const fired = parseFiredDates(row.anomaly_alerts_fired);
  if (alreadyFiredToday(fired)) return;

  const status = await getAnomalyStatus(env, projectId);
  if (!status.alert) return;

  const { postToSlack } = await import('./slack-digest');
  const { sendEmail } = await import('./email-digest');
  const { emitWebhook } = await import('./webhook-emit');
  const jobs: Promise<unknown>[] = [];
  if (row.slack_webhook_url) jobs.push(postToSlack(row.slack_webhook_url, formatAnomalyBlocks(row.name, status)));
  if (row.digest_email) jobs.push(sendEmail(env, row.digest_email, formatAnomalyEmail(row.name, status)));
  jobs.push(emitWebhook(env, projectId, 'anomaly.detected', {
    project_name: row.name,
    today_usd: status.todayUsd, avg30d_usd: status.avg30dUsd,
    multiplier: status.multiplier, threshold: status.threshold,
  }));
  await Promise.all(jobs);
  await recordFiredToday(env, projectId, fired);
}
