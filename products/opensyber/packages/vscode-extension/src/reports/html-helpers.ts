import type { ActivityEvent, ActivitySummary } from '../logger/activity-logger'

export const RISK_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#6b7280',
}

export function computeScore(summary: ActivitySummary): number {
  const raw = 100 - summary.critical * 20 - summary.high * 8 - summary.medium * 2 - summary.secretsDetected * 5
  return Math.max(0, Math.min(100, raw))
}

export function scoreToColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#eab308'
  if (score >= 40) return '#f97316'
  return '#ef4444'
}

export function scoreToLabel(score: number): string {
  if (score >= 80) return 'Good'
  if (score >= 60) return 'Moderate Risk'
  if (score >= 40) return 'High Risk'
  return 'Critical Risk'
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildAgentBreakdown(events: ActivityEvent[]): string {
  const byAgent = new Map<string, { critical: number; high: number; total: number }>()
  for (const e of events) {
    const cur = byAgent.get(e.agent) ?? { critical: 0, high: 0, total: 0 }
    cur.total++
    if (e.risk === 'critical') cur.critical++
    if (e.risk === 'high') cur.high++
    byAgent.set(e.agent, cur)
  }
  if (byAgent.size === 0) return '<p style="color:#525252;font-size:13px">No agents detected yet.</p>'
  return Array.from(byAgent.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, stats]) => `
      <div class="agent-row">
        <div class="agent-name">${escapeHtml(name)}</div>
        <div class="agent-stats">
          <span class="agent-stat"><b style="color:#ef4444">${stats.critical}</b> critical</span>
          <span class="agent-stat"><b style="color:#f97316">${stats.high}</b> high</span>
          <span class="agent-stat"><b>${stats.total}</b> total</span>
        </div>
      </div>`).join('')
}

export function buildTimelineRows(events: ActivityEvent[]): string {
  return events.slice(0, 200).map((e) => `
    <tr>
      <td style="color:${RISK_COLORS[e.risk]};font-weight:700;font-size:11px;white-space:nowrap">${e.risk.toUpperCase()}</td>
      <td style="color:#a3a3a3;font-size:11px;white-space:nowrap">${e.type.replace('_', ' ')}</td>
      <td style="color:#e5e5e5;font-size:12px">${escapeHtml(e.summary)}</td>
      <td style="color:#525252;font-size:11px;white-space:nowrap">${e.agent}</td>
      <td style="color:#525252;font-size:11px;white-space:nowrap">${new Date(e.timestamp).toLocaleString()}</td>
    </tr>`).join('')
}
