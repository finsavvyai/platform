import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { AgentName } from '../detectors/agent-detector'

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'
export type EventType = 'file_read' | 'file_write' | 'bash_exec' | 'network_call'

export interface ActivityEvent {
  id: string
  timestamp: string
  agent: AgentName
  type: EventType
  risk: RiskLevel
  path?: string      // file path — never file content
  summary: string    // human-readable, never includes secret values
  secretsCount: number  // count only — never values
}

export type LogInput = Omit<ActivityEvent, 'id' | 'timestamp'>

export interface ActivitySummary {
  total: number
  critical: number
  high: number
  medium: number
  secretsDetected: number
}

export class ActivityLogger {
  private readonly logPath: string
  private readonly maxLines = 2000

  constructor() {
    const dir = path.join(os.homedir(), '.opensyber')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    }
    this.logPath = path.join(dir, 'activity.jsonl')
  }

  log(input: LogInput): ActivityEvent {
    const event: ActivityEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...input,
    }
    fs.appendFileSync(this.logPath, JSON.stringify(event) + '\n', 'utf8')
    this.pruneIfNeeded()
    return event
  }

  getRecent(limit = 100): ActivityEvent[] {
    if (!fs.existsSync(this.logPath)) return []
    const lines = fs.readFileSync(this.logPath, 'utf8')
      .split('\n')
      .filter((l) => l.trim().length > 0)
    return lines
      .slice(-limit)
      .reverse()
      .map((l) => JSON.parse(l) as ActivityEvent)
  }

  getSummary(): ActivitySummary {
    const events = this.getRecent(this.maxLines)
    return {
      total: events.length,
      critical: events.filter((e) => e.risk === 'critical').length,
      high: events.filter((e) => e.risk === 'high').length,
      medium: events.filter((e) => e.risk === 'medium').length,
      secretsDetected: events.reduce((sum, e) => sum + e.secretsCount, 0),
    }
  }

  clear(): void {
    if (fs.existsSync(this.logPath)) {
      fs.writeFileSync(this.logPath, '', 'utf8')
    }
  }

  getLogPath(): string {
    return this.logPath
  }

  // Keep file from growing unbounded — trim to last maxLines lines
  private pruneIfNeeded(): void {
    if (!fs.existsSync(this.logPath)) return
    const lines = fs.readFileSync(this.logPath, 'utf8').split('\n').filter((l) => l.trim())
    if (lines.length > this.maxLines) {
      fs.writeFileSync(this.logPath, lines.slice(-this.maxLines).join('\n') + '\n', 'utf8')
    }
  }
}
