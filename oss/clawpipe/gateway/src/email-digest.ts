/** Email digest — renders HTML + POSTs to Resend. Silently skipped when RESEND_API_KEY missing. */

import type { Env } from './types';
import type { DigestStats } from './slack-digest';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'ClawPipe <digest@clawpipe.ai>';

/** RFC-5322-ish email shape check. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Render the weekly digest as a minimal, mail-client-safe HTML body. */
export function formatDigestEmail(stats: DigestStats): { subject: string; html: string; text: string } {
  const cost = `$${stats.totalCost.toFixed(2)}`;
  const delta = stats.costDeltaPct == null
    ? 'First week of data — no comparison yet.'
    : `${stats.costDeltaPct >= 0 ? '+' : ''}${stats.costDeltaPct}% vs prior week`;

  const rows = stats.topModels.length
    ? stats.topModels.map((m) =>
        `<tr><td style="padding:6px 0">${esc(m.model)}</td><td style="padding:6px 0;text-align:right">$${m.cost.toFixed(4)}</td><td style="padding:6px 0;text-align:right;color:#6e6e73">${m.requests.toLocaleString()}</td></tr>`,
      ).join('')
    : '<tr><td style="padding:6px 0;color:#6e6e73" colspan="3">No requests this week.</td></tr>';

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fafafa;color:#1d1d1f;padding:24px">
  <table style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e7;border-radius:14px;padding:28px" cellpadding="0" cellspacing="0">
    <tr><td style="font-size:20px;font-weight:700;padding-bottom:6px">ClawPipe weekly digest</td></tr>
    <tr><td style="font-size:14px;color:#6e6e73;padding-bottom:18px">${esc(stats.projectName)}</td></tr>
    <tr><td style="font-size:36px;font-weight:700;letter-spacing:-0.02em">${cost}</td></tr>
    <tr><td style="font-size:13px;color:#6e6e73;padding-bottom:14px">${esc(delta)}</td></tr>
    <tr><td style="font-size:13px;color:#515154;padding-bottom:20px">${stats.totalRequests.toLocaleString()} requests · avg ${stats.avgLatencyMs}ms · ${stats.cachedPct.toFixed(1)}% cached · ${stats.boostedPct.toFixed(1)}% boosted</td></tr>
    <tr><td style="font-weight:600;font-size:13px;padding-bottom:8px;border-top:1px solid #e5e5e7;padding-top:16px">Top models by cost</td></tr>
    <tr><td><table style="width:100%;font-size:13px" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
    <tr><td style="padding-top:20px;font-size:12px;color:#6e6e73">
      <a href="https://app.clawpipe.ai" style="color:#6e56cf;text-decoration:none">Open dashboard</a> ·
      <a href="https://clawpipe.ai/finops" style="color:#6e56cf;text-decoration:none">ClawPipe for FinOps</a>
    </td></tr>
  </table></body></html>`;

  const text = [
    `ClawPipe weekly digest — ${stats.projectName}`,
    `Total spend: ${cost}`,
    `Change vs last week: ${delta}`,
    `Requests: ${stats.totalRequests.toLocaleString()} | avg ${stats.avgLatencyMs}ms | ${stats.cachedPct.toFixed(1)}% cached | ${stats.boostedPct.toFixed(1)}% boosted`,
    '',
    'Top models:',
    ...stats.topModels.map((m) => `  ${m.model}: $${m.cost.toFixed(4)} (${m.requests} calls)`),
    '',
    'Dashboard: https://app.clawpipe.ai',
  ].join('\n');

  return { subject: `ClawPipe: ${stats.projectName} — ${cost} this week`, html, text };
}

/** Render a budget-threshold alert email. */
export function formatBudgetAlertEmail(
  projectName: string, threshold: number, usedMtd: number, cap: number,
): { subject: string; html: string; text: string } {
  const emoji = threshold >= 100 ? '🚨' : threshold >= 80 ? '⚠️' : '📊';
  const headline = threshold >= 100
    ? 'Budget exhausted — requests are being rejected'
    : `Budget alert — ${threshold}% of monthly cap used`;

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fafafa;color:#1d1d1f;padding:24px">
  <table style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e7;border-radius:14px;padding:28px" cellpadding="0" cellspacing="0">
    <tr><td style="font-size:20px;font-weight:700">${emoji} ${esc(projectName)}</td></tr>
    <tr><td style="font-size:15px;color:#1d1d1f;padding:10px 0 18px">${esc(headline)}</td></tr>
    <tr><td style="font-size:14px;color:#515154">Spent this month: <strong>$${usedMtd.toFixed(2)}</strong> of <strong>$${cap.toFixed(2)}</strong></td></tr>
    <tr><td style="padding-top:20px;font-size:12px;color:#6e6e73">
      <a href="https://app.clawpipe.ai" style="color:#6e56cf;text-decoration:none">Open dashboard</a> to adjust the cap.
    </td></tr>
  </table></body></html>`;

  const text = `${emoji} ${projectName}\n${headline}\nSpent this month: $${usedMtd.toFixed(2)} of $${cap.toFixed(2)}\nDashboard: https://app.clawpipe.ai`;

  return { subject: `${emoji} ClawPipe budget: ${projectName} at ${threshold}%`, html, text };
}

/** Extract domain from sender header like "Name <addr@example.com>". */
export function senderDomain(from: string): string | null {
  const m = from.match(/<([^>]+)>/) ?? [null, from];
  const addr = m[1] ?? '';
  const at = addr.indexOf('@');
  return at >= 0 ? addr.slice(at + 1).trim().toLowerCase() : null;
}

/** Look up whether the configured sender domain is verified in Resend. */
export async function checkResendDomainStatus(env: Env): Promise<{
  configured: boolean; domain: string | null; verified: boolean; status: string | null;
}> {
  if (!env.RESEND_API_KEY) return { configured: false, domain: null, verified: false, status: null };
  const from = env.RESEND_FROM || DEFAULT_FROM;
  const domain = senderDomain(from);
  if (!domain) return { configured: true, domain: null, verified: false, status: 'invalid_from' };

  const res = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
  });
  if (!res.ok) return { configured: true, domain, verified: false, status: `resend_${res.status}` };
  const body = await res.json() as { data?: Array<{ name: string; status: string }> };
  const match = body.data?.find((d) => d.name.toLowerCase() === domain);
  return {
    configured: true,
    domain,
    verified: match?.status === 'verified',
    status: match?.status ?? 'not_added',
  };
}

/** POST an email via Resend. Returns true on success, false when key missing or error. */
export async function sendEmail(
  env: Env, to: string, msg: { subject: string; html: string; text: string },
): Promise<boolean> {
  const key = env.RESEND_API_KEY;
  if (!key || !isValidEmail(to)) return false;
  const from = env.RESEND_FROM || DEFAULT_FROM;
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to, subject: msg.subject, html: msg.html, text: msg.text }),
  });
  return res.ok;
}
