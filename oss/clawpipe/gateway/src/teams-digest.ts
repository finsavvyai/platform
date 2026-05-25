/**
 * Microsoft Teams Incoming Webhook digest for ClawPipe.
 *
 * Uses the legacy MessageCard format (@type: MessageCard) — the only format accepted
 * by *.webhook.office.com Incoming Webhook connectors.
 *
 * DEPRECATION NOTICE: Microsoft announced the retirement of Office 365 connectors
 * (the *.webhook.office.com URL pattern) for Teams in 2025-2026 in favour of
 * "Workflows"-based webhooks (Power Automate). A separate adapter will be required
 * when connector retirement completes; this module does NOT claim future-proofing.
 * Track: https://devblogs.microsoft.com/microsoft365dev/retirement-of-office-365-connectors/
 */

import type { DigestStats } from './slack-digest';

// Teams Incoming Webhook URLs must be HTTPS and have one of these hosts.
const TEAMS_WEBHOOK_HOSTS = ['.webhook.office.com', '.webhook.office.us'];

/** Validate a Teams Incoming Webhook URL. */
export function isValidTeamsWebhook(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return TEAMS_WEBHOOK_HOSTS.some((suffix) => u.hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

/** MessageCard JSON for a budget threshold alert. */
export function formatBudgetAlertCard(
  projectName: string, threshold: number, used: number, cap: number,
): unknown {
  const isOver = threshold >= 100;
  const color = isOver ? 'FF0000' : threshold >= 80 ? 'FFA500' : '0078D4';
  const title = isOver
    ? `\u{1F6A8} ${projectName}: Budget exhausted`
    : `⚠️ ${projectName}: ${threshold}% of monthly cap used`;

  return {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor: color,
    summary: title,
    sections: [
      {
        activityTitle: title,
        facts: [
          { name: 'Spent this month', value: `$${used.toFixed(2)}` },
          { name: 'Monthly cap', value: `$${cap.toFixed(2)}` },
          { name: 'Usage', value: `${threshold}%` },
        ],
        markdown: true,
      },
    ],
    potentialAction: [
      {
        '@type': 'OpenUri',
        name: 'Open dashboard',
        targets: [{ os: 'default', uri: 'https://app.clawpipe.ai' }],
      },
    ],
  };
}

/** MessageCard JSON for a weekly digest. */
export function formatDigestCard(stats: DigestStats): unknown {
  const costStr = `$${stats.totalCost.toFixed(2)}`;
  const deltaStr = stats.costDeltaPct == null
    ? 'First week of data'
    : `${stats.costDeltaPct >= 0 ? '+' : ''}${stats.costDeltaPct}% vs prior week`;

  const modelLines = stats.topModels.length
    ? stats.topModels
        .map((m, i) => `${i + 1}. **${m.model}** — $${m.cost.toFixed(4)} (${m.requests.toLocaleString()} calls)`)
        .join('<br>')
    : 'No requests this week.';

  return {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor: '0078D4',
    summary: `ClawPipe weekly digest: ${stats.projectName} — ${costStr}`,
    sections: [
      {
        activityTitle: `ClawPipe weekly digest · ${stats.projectName}`,
        activitySubtitle: `Total spend: ${costStr} · ${stats.totalRequests.toLocaleString()} requests`,
        facts: [
          { name: 'Avg latency', value: `${stats.avgLatencyMs}ms` },
          { name: 'Cache rate', value: `${stats.cachedPct.toFixed(1)}%` },
          { name: 'Boost rate', value: `${stats.boostedPct.toFixed(1)}%` },
          { name: 'vs last week', value: deltaStr },
        ],
        markdown: true,
      },
      {
        activityTitle: 'Top models by cost',
        text: modelLines,
        markdown: true,
      },
    ],
    potentialAction: [
      {
        '@type': 'OpenUri',
        name: 'Open dashboard',
        targets: [{ os: 'default', uri: 'https://app.clawpipe.ai' }],
      },
      {
        '@type': 'OpenUri',
        name: 'ClawPipe FinOps',
        targets: [{ os: 'default', uri: 'https://clawpipe.ai/finops' }],
      },
    ],
  };
}

/**
 * POST a MessageCard to a Teams Incoming Webhook URL.
 * Fails fast on non-2xx (no retry) — callers should treat the alert as best-effort.
 * Teams Incoming Webhooks return HTTP 200 with text body "1" on success.
 */
export async function postToTeams(url: string, card: unknown): Promise<boolean> {
  if (!isValidTeamsWebhook(url)) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
    return res.ok;
  } catch {
    return false;
  }
}
