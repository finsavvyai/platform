import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

export interface ActivityEvent {
  id: string
  timestamp: string
  agent: string
  type: string
  risk: 'critical' | 'high' | 'medium' | 'low'
  path?: string
  summary: string
  secretsCount: number
}

export interface ActivitySummary {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  secretsDetected: number
}

const LOG_PATH = path.join(os.homedir(), '.opensyber', 'activity.jsonl')

export function readEvents(limit = 500): ActivityEvent[] {
  if (!fs.existsSync(LOG_PATH)) return []
  const lines = fs.readFileSync(LOG_PATH, 'utf8').trim().split('\n').filter(Boolean)
  return lines
    .slice(-limit)
    .map((line: string) => {
      try { return JSON.parse(line) as ActivityEvent } catch { return null }
    })
    .filter((e): e is ActivityEvent => e !== null)
}

export function summarise(events: ActivityEvent[]): ActivitySummary {
  const s: ActivitySummary = { total: events.length, critical: 0, high: 0, medium: 0, low: 0, secretsDetected: 0 }
  for (const e of events) {
    if (e.risk === 'critical') s.critical++
    else if (e.risk === 'high') s.high++
    else if (e.risk === 'medium') s.medium++
    else s.low++
    s.secretsDetected += e.secretsCount ?? 0
  }
  return s
}

export function logPath(): string { return LOG_PATH }
