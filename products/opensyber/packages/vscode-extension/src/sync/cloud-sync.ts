import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { ActivityEvent } from '../logger/activity-logger'

const CURSOR_FILE = path.join(os.homedir(), '.opensyber', '.sync-cursor')
const SESSION_ID  = crypto.randomUUID()

export interface SyncResult {
  synced: number
  error?: string
}

export class CloudSync {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
  ) {}

  /** Returns true only if both apiUrl and apiKey are configured */
  isEnabled(): boolean {
    return Boolean(this.apiUrl && this.apiKey)
  }

  /** Syncs events newer than the last cursor. Returns count of events synced. */
  async sync(events: ActivityEvent[]): Promise<SyncResult> {
    if (!this.isEnabled()) return { synced: 0 }

    const cursor   = this.readCursor()
    const unsent   = cursor
      ? events.filter((e) => e.timestamp > cursor)
      : events

    if (unsent.length === 0) return { synced: 0 }

    const payload = unsent.map((e) => ({
      id:           e.id,
      sessionId:    SESSION_ID,
      agent:        e.agent,
      type:         e.type,
      risk:         e.risk,
      path:         e.path,
      summary:      e.summary,
      secretsCount: e.secretsCount,
      timestamp:    e.timestamp,
    }))

    try {
      const res = await fetch(`${this.apiUrl}/api/agents/activity/sync`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ events: payload }),
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        return { synced: 0, error: `HTTP ${res.status}: ${body.slice(0, 120)}` }
      }

      // Advance cursor to the latest synced timestamp
      const latest = unsent.reduce((max, e) => (e.timestamp > max ? e.timestamp : max), unsent[0].timestamp)
      this.writeCursor(latest)

      return { synced: unsent.length }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { synced: 0, error: msg }
    }
  }

  private readCursor(): string | null {
    try {
      return fs.existsSync(CURSOR_FILE) ? fs.readFileSync(CURSOR_FILE, 'utf8').trim() : null
    } catch {
      return null
    }
  }

  private writeCursor(timestamp: string): void {
    try {
      fs.writeFileSync(CURSOR_FILE, timestamp, 'utf8')
    } catch {
      // Non-fatal — worst case we re-send a few events (server deduplicates by id)
    }
  }
}
