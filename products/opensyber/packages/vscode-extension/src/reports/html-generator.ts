import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { ActivityEvent, ActivitySummary } from '../logger/activity-logger'
import { buildShareText, buildLinkedInUrl, buildTwitterUrl, buildFacebookUrl, buildRedditUrl, buildScoreCardSvg } from './share-card'
import { computeScore, scoreToColor, scoreToLabel, escapeHtml, buildAgentBreakdown, buildTimelineRows } from './html-helpers'
import { buildHtmlPage } from './html-template'

export { computeScore } from './html-helpers'

export interface ReportData {
  events:    ActivityEvent[]
  summary:   ActivitySummary
  agents:    string[]
  generatedAt: string
}

export function buildReportHtml(data: ReportData): string {
  const { events, summary, agents, generatedAt } = data
  const score       = computeScore(summary)
  const scoreColor  = scoreToColor(score)
  const topEvents   = events.filter((e) => e.risk === 'critical' || e.risk === 'high').slice(0, 5)
  const shareText   = buildShareText(summary, agents, topEvents)
  const liUrl       = buildLinkedInUrl()
  const twitterUrl  = buildTwitterUrl(summary, agents, topEvents)
  const fbUrl       = buildFacebookUrl()
  const redditUrl   = buildRedditUrl(summary, agents)
  const svgCard     = buildScoreCardSvg(summary, agents, score, scoreColor)
  const svgDataUrl  = `data:image/svg+xml;base64,${Buffer.from(svgCard).toString('base64')}`

  const timelineRows = buildTimelineRows(events)
  const agentBreakdown = buildAgentBreakdown(events)

  return buildHtmlPage({
    generatedAt, score, scoreColor, summary, timelineRows, agentBreakdown,
    shareText, liUrl, twitterUrl, fbUrl, redditUrl, svgDataUrl, events,
  })
}

export function writeReportToDisk(data: ReportData): string {
  const html    = buildReportHtml(data)
  const outDir  = path.join(os.homedir(), '.opensyber')
  const outPath = path.join(outDir, 'report.html')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(outPath, html, 'utf8')
  return outPath
}
