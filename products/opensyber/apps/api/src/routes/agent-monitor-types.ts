export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'
export type EventType = 'file_read' | 'bash_exec'
export type ExtensionEventType = 'file_access' | 'file_write' | 'terminal_command' | 'secret_detected' | 'network_request'

export interface SyncEvent {
  id: string
  sessionId: string
  agent: string
  type: EventType
  risk: RiskLevel
  path?: string
  summary: string
  secretsCount: number
  timestamp: string
}

export interface ExtensionSyncEvent {
  id: string
  sessionId: string
  agentName: string
  eventType: ExtensionEventType
  riskLevel: RiskLevel
  filePath?: string
  summary: string
  secretsDetected: number
  metadata?: string
  timestamp: string
}

export const RISK_LEVELS = new Set<RiskLevel>(['critical', 'high', 'medium', 'low'])
export const EVENT_TYPES = new Set<EventType>(['file_read', 'bash_exec'])
export const EXTENSION_EVENT_TYPES = new Set<ExtensionEventType>([
  'file_access', 'file_write', 'terminal_command', 'secret_detected', 'network_request',
])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validateEvent(e: unknown): e is SyncEvent {
  if (!e || typeof e !== 'object') return false
  const ev = e as Record<string, unknown>
  return (
    typeof ev.id === 'string' && UUID_RE.test(ev.id) &&
    typeof ev.sessionId === 'string' && ev.sessionId.length > 0 &&
    typeof ev.agent === 'string' && ev.agent.length > 0 && ev.agent.length <= 100 &&
    typeof ev.type === 'string' && EVENT_TYPES.has(ev.type as EventType) &&
    typeof ev.risk === 'string' && RISK_LEVELS.has(ev.risk as RiskLevel) &&
    typeof ev.summary === 'string' && ev.summary.length > 0 && ev.summary.length <= 200 &&
    typeof ev.secretsCount === 'number' && ev.secretsCount >= 0 &&
    typeof ev.timestamp === 'string'
  )
}
