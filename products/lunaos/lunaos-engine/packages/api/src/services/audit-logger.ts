/**
 * Audit Logger — log all security-relevant events to D1
 *
 * Tracks: auth events, billing events, API key operations, admin actions
 * Non-blocking — never fails a request if audit logging fails
 */

export type AuditAction =
    | 'auth.signup'
    | 'auth.login'
    | 'auth.login_failed'
    | 'auth.token_refresh'
    | 'api_key.created'
    | 'api_key.revoked'
    | 'api_key.used'
    | 'billing.checkout_started'
    | 'billing.subscription_created'
    | 'billing.subscription_updated'
    | 'billing.subscription_canceled'
    | 'billing.payment_failed'
    | 'agent.execution'
    | 'agent.tier_blocked'
    | 'chain.execution'
    | 'rate_limit.exceeded'
    // SSO events (Phase 1 SSO swarm)
    | 'sso.idp.created'
    | 'sso.idp.updated'
    | 'sso.idp.deleted'
    | 'user.provisioned_via_sso';

interface AuditEntry {
    action: AuditAction;
    userId?: string;
    resourceId?: string;
    resourceType?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Log an audit event to D1
 * Non-blocking — call with .catch(() => {}) or await with try/catch
 */
export async function logAuditEvent(
    db: D1Database,
    entry: AuditEntry,
): Promise<void> {
    try {
        await db.prepare(`
      INSERT INTO audit_log (id, action, user_id, resource_id, resource_type, metadata, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
            crypto.randomUUID(),
            entry.action,
            entry.userId || null,
            entry.resourceId || null,
            entry.resourceType || null,
            entry.metadata ? JSON.stringify(entry.metadata) : null,
            entry.ipAddress || null,
            entry.userAgent || null,
            new Date().toISOString(),
        ).run();
    } catch (err: any) {
        // Non-critical — never fail a request over audit logging
        console.error('Audit log error:', err.message);
    }
}

/**
 * Helper to extract client info from Hono context
 */
export function getClientInfo(c: any): { ipAddress?: string; userAgent?: string } {
    return {
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || undefined,
        userAgent: c.req.header('User-Agent') || undefined,
    };
}

/**
 * Query audit log for a user — useful for security review
 */
export async function getUserAuditLog(
    db: D1Database,
    userId: string,
    limit = 50,
): Promise<any[]> {
    const result = await db.prepare(`
    SELECT id, action, resource_id, resource_type, metadata, ip_address, created_at
    FROM audit_log
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(userId, limit).all();

    return (result.results || []).map((row: any) => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
    }));
}
