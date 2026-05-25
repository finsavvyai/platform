
export interface AuditLogEntry {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    metadata?: Record<string, any>;
    ip: string;
    userAgent: string;
    timestamp: string;
}

export class AuditService {
    // In a real implementation, this would write to D1 or R2 or an external logging service (e.g. Datadog)
    // For now, we will log to console in a structured format which Cloudflare logs captures

    async log(c: any, action: string, resource: string, metadata?: Record<string, any>) {
        const user = c.get('user');
        const entry: AuditLogEntry = {
            userId: user?.id || 'anonymous',
            action,
            resource,
            resourceId: metadata?.resourceId,
            metadata,
            ip: c.req.header('CF-Connecting-IP') || 'unknown',
            userAgent: c.req.header('User-Agent') || 'unknown',
            timestamp: new Date().toISOString()
        };

        // Async logging - strictly non-blocking
        c.executionCtx.waitUntil(this.writeLog(c.env, entry));
    }

    private async writeLog(env: any, entry: AuditLogEntry) {
        // 1. Log to console (captured by Cloudflare logs)
        console.log(JSON.stringify({
            level: 'info',
            type: 'audit_log',
            ...entry
        }));

        // 2. Write to D1 Audit Table (if it exists)
        if (env.MCP_DB) {
            try {
                await env.MCP_DB.prepare(
                    `INSERT INTO audit_logs (user_id, action, resource, metadata, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?)`
                ).bind(
                    entry.userId,
                    entry.action,
                    entry.resource,
                    JSON.stringify(entry.metadata || {}),
                    entry.ip,
                    entry.timestamp
                ).run();
            } catch (e) {
                // Fail silently on audit write failure to avoid impacting user experience, 
                // but log the error for ops.
                console.error('Failed to write audit log to DB', e);
            }
        }
    }
}

export const auditService = new AuditService();
