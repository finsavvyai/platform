import type { ActivitySummary, ActivityEvent } from '../logger/activity-logger'

/** Builds the pre-written LinkedIn post text */
export function buildShareText(
  summary: ActivitySummary,
  agents: string[],
  topEvents: ActivityEvent[] = [],
): string {
  const agentList = agents.length > 0 ? agents.join(', ') : 'my AI coding agent'

  // Pull up to 3 most alarming file paths that were actually accessed
  const criticalPaths = topEvents
    .filter((e) => e.risk === 'critical' && e.path)
    .slice(0, 3)
    .map((e) => `   • ${e.path}`)

  const hasAlarm = summary.critical > 0 || summary.high > 0

  const lines: (string | null)[] = [
    hasAlarm
      ? `⚠️ I just found out what ${agentList} actually did in my last coding session. This should make every developer uncomfortable:`
      : `I just audited what ${agentList} did in my last coding session. Here's the real picture:`,
    '',
    summary.critical > 0
      ? `🔴 CRITICAL — ${summary.critical} sensitive file${summary.critical > 1 ? 's' : ''} opened:`
      : null,
    ...criticalPaths,
    criticalPaths.length > 0 ? '' : null,
    summary.secretsDetected > 0
      ? `🔑 ${summary.secretsDetected} live secret pattern${summary.secretsDetected > 1 ? 's' : ''} detected inside those files (AWS keys, tokens, private keys)`
      : null,
    summary.high > 0
      ? `🟠 HIGH — ${summary.high} elevated operation${summary.high > 1 ? 's' : ''} (sudo, aws iam, kubectl exec, curl | bash)`
      : null,
    summary.critical === 0 && summary.high === 0
      ? `✅ Clean session — nothing alarming. But now I can see exactly what it touches.`
      : null,
    '',
    hasAlarm
      ? `The agent had full read access to these secrets the entire time. One compromised npm package, one malicious tool call — and those credentials are gone.`
      : `Most developers have no idea what their AI agents are doing at the filesystem level. I didn't either.`,
    '',
    `I installed OpenAgent (free VSCode extension) and started watching. You should too.`,
    '',
    '👉 opensyber.cloud/openagent',
    '',
    '#AISecurity #DevSecOps #AIAgents #CyberSecurity #SupplyChainSecurity',
  ]
  return lines.filter((l) => l !== null).join('\n')
}

const LANDING = 'https://opensyber.cloud'

/** LinkedIn — opens blank dialog (text is copy+pasted; pre-fill is not supported by LinkedIn) */
export function buildLinkedInUrl(): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(LANDING + '?ref=li-report')}`
}

/** Twitter/X — pre-fills tweet text (280 char limit, so we use a shorter version) */
export function buildTwitterText(
  summary: ActivitySummary,
  agents: string[],
  topEvents: ActivityEvent[] = [],
): string {
  const agent = agents.length > 0 ? agents[0] : 'my AI agent'
  const firstCriticalPath = topEvents.find((e) => e.risk === 'critical' && e.path)?.path

  const parts: string[] = []
  if (summary.critical > 0 && firstCriticalPath) {
    parts.push(`${agent} just read ${firstCriticalPath} without me noticing.`)
    if (summary.secretsDetected > 0) parts.push(`${summary.secretsDetected} live secrets inside.`)
    parts.push(`This is the default for every AI coding agent.`)
  } else if (summary.critical > 0) {
    parts.push(`${agent} accessed credentials & .env files in my last session. I had no idea.`)
  } else {
    parts.push(`I just audited what ${agent} did in my coding session.`)
    parts.push(`✅ Nothing critical — but now I can see everything it touches.`)
  }
  parts.push(`\nFree monitor: opensyber.cloud/openagent\n#AISecurity #AIAgents`)
  return parts.join('\n')
}

export function buildTwitterUrl(
  summary: ActivitySummary,
  agents: string[],
  topEvents: ActivityEvent[] = [],
): string {
  const text = buildTwitterText(summary, agents, topEvents)
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`
}

/** Facebook — only URL is supported (displays OG card) */
export function buildFacebookUrl(): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(LANDING + '?ref=fb-report')}`
}

/** Reddit — pre-fills post title */
export function buildRedditUrl(summary: ActivitySummary, agents: string[]): string {
  const agent = agents.length > 0 ? agents[0] : 'my AI coding agent'
  const title = summary.critical > 0
    ? `I audited ${agent} and it read my .env and credentials — ${summary.critical} critical events`
    : `I monitored what ${agent} did in my last coding session — here's the audit`
  return (
    `https://www.reddit.com/submit` +
    `?url=${encodeURIComponent(LANDING + '?ref=reddit-report')}` +
    `&title=${encodeURIComponent(title)}`
  )
}

/** Builds an inline SVG scorecard (600×315 — LinkedIn OG ratio) */
export function buildScoreCardSvg(
  summary: ActivitySummary,
  agents: string[],
  score: number,
  scoreColor: string,
): string {
  const agentLabel = agents.length > 0 ? agents.slice(0, 2).join(' & ') : 'AI Agent'
  const scoreLabel =
    score >= 80 ? 'GOOD' :
    score >= 60 ? 'MODERATE RISK' :
    score >= 40 ? 'HIGH RISK' : 'CRITICAL RISK'

  const criticalBadge = summary.critical > 0
    ? `<rect x="40" y="178" width="155" height="36" rx="6" fill="#ef444420" stroke="#ef4444" stroke-width="1"/>
       <text x="118" y="201" fill="#ef4444" font-size="13" font-weight="700" text-anchor="middle" font-family="system-ui">${summary.critical} CRITICAL</text>`
    : ''

  const highBadge = summary.high > 0
    ? `<rect x="205" y="178" width="140" height="36" rx="6" fill="#f9731620" stroke="#f97316" stroke-width="1"/>
       <text x="275" y="201" fill="#f97316" font-size="13" font-weight="700" text-anchor="middle" font-family="system-ui">${summary.high} HIGH</text>`
    : ''

  const secretsBadge = summary.secretsDetected > 0
    ? `<rect x="355" y="178" width="175" height="36" rx="6" fill="#ef444420" stroke="#ef4444" stroke-width="1"/>
       <text x="443" y="201" fill="#ef4444" font-size="13" font-weight="700" text-anchor="middle" font-family="system-ui">${summary.secretsDetected} SECRET${summary.secretsDetected > 1 ? 'S' : ''} FOUND</text>`
    : ''

  const cleanBadge = summary.critical === 0 && summary.high === 0 && summary.secretsDetected === 0
    ? `<rect x="40" y="178" width="180" height="36" rx="6" fill="#22c55e20" stroke="#22c55e" stroke-width="1"/>
       <text x="130" y="201" fill="#22c55e" font-size="13" font-weight="700" text-anchor="middle" font-family="system-ui">✓ CLEAN SESSION</text>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="315" viewBox="0 0 600 315">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a0f"/>
      <stop offset="100%" stop-color="#0f0f1a"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="600" height="315" fill="url(#bg)" rx="12"/>
  <rect x="1" y="1" width="598" height="313" rx="11" fill="none" stroke="#1c1c2e" stroke-width="1.5"/>

  <!-- Logo -->
  <text x="40" y="52" fill="#3b82f6" font-size="18" font-weight="800" font-family="system-ui">⬡ OpenAgent</text>
  <text x="40" y="72" fill="#525252" font-size="12" font-family="system-ui">AI Agent Security Monitor · opensyber.cloud</text>

  <!-- Divider -->
  <line x1="40" y1="88" x2="560" y2="88" stroke="#1c1c2e" stroke-width="1"/>

  <!-- Score ring (right side) -->
  <circle cx="490" cy="145" r="54" fill="none" stroke="#1c1c2e" stroke-width="8"/>
  <circle cx="490" cy="145" r="54" fill="none" stroke="${scoreColor}" stroke-width="8"
    stroke-dasharray="${Math.round(score * 3.39)} 339"
    stroke-linecap="round"
    transform="rotate(-90 490 145)"/>
  <text x="490" y="137" fill="${scoreColor}" font-size="30" font-weight="800" text-anchor="middle" font-family="system-ui">${score}</text>
  <text x="490" y="155" fill="#6b7280" font-size="11" text-anchor="middle" font-family="system-ui">/ 100</text>
  <text x="490" y="172" fill="${scoreColor}" font-size="11" font-weight="700" text-anchor="middle" font-family="system-ui">${scoreLabel}</text>

  <!-- Agent name -->
  <text x="40" y="122" fill="#e5e5e5" font-size="22" font-weight="700" font-family="system-ui">${escapeXml(agentLabel)}</text>
  <text x="40" y="145" fill="#6b7280" font-size="13" font-family="system-ui">${summary.total} events logged this session</text>

  <!-- Risk badges -->
  ${criticalBadge}
  ${highBadge}
  ${secretsBadge}
  ${cleanBadge}

  <!-- Footer -->
  <rect x="0" y="273" width="600" height="42" rx="0" fill="#0d0d1a"/>
  <rect x="0" y="273" width="600" height="1" fill="#1c1c2e"/>
  <text x="40" y="298" fill="#3b82f6" font-size="12" font-weight="600" font-family="system-ui">opensyber.cloud/openagent</text>
  <text x="560" y="298" fill="#525252" font-size="11" text-anchor="end" font-family="system-ui">Free to use · No cloud required</text>
  <rect x="0" y="273" width="600" height="42" rx="0" fill="none" stroke="none"/>
  <rect x="1" y="274" width="598" height="40" rx="0" fill="none"/>
</svg>`
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
