// Audit logger
export interface AuditLogEntry {
  action: string
  resource: string
  resourceId?: string
  userId?: string
  tenantId?: string
  details?: Record<string, unknown>
  timestamp: Date
  level: 'info' | 'warn' | 'error'
}

class AuditLogger {
  async log(entry: Omit<AuditLogEntry, 'timestamp'> | { action: string; resource: string; details?: unknown }): Promise<void> {
    const fullEntry = {
      ...entry,
      timestamp: new Date(),
      level: ('level' in entry ? entry.level : 'info') as AuditLogEntry['level'],
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[AUDIT]', JSON.stringify(fullEntry))
    }
  }

  async info(action: string, resource: string, details?: Record<string, unknown>): Promise<void> {
    return this.log({ action, resource, details, level: 'info' })
  }

  async warn(action: string, resource: string, details?: Record<string, unknown>): Promise<void> {
    return this.log({ action, resource, details, level: 'warn' })
  }

  async error(action: string, resource: string, details?: Record<string, unknown>): Promise<void> {
    return this.log({ action, resource, details, level: 'error' })
  }
}

export const auditLogger = new AuditLogger()
export default auditLogger

// Aliases for services that import different names
export const secureLog = auditLogger.log.bind(auditLogger)
export function sanitizeInput(input: string): string {
  return input.replace(/[<>'"&]/g, '')
}
