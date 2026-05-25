/**
 * SSO Discovery Route — email-domain → IdP lookup (pre-login, no auth required)
 *
 * GET /v1/sso/discovery?email=<email>
 *
 * Security:
 *  - Zod-validates email format before touching DB.
 *  - Returns only { idpId, type, initiateUrl } — never orgId or org name.
 *  - Constant-ish response time: DB miss returns 404 with the same path as
 *    a hit, so attackers can't distinguish "domain not configured" vs
 *    "domain doesn't exist". Rate-limit (30 req/min/IP) caps enumeration.
 *  - No api-key-auth — must work for unauthenticated users.
 *
 * Rate limit: 30 req/min/IP (free-tier in-memory bucket via ip-rate-limiter).
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../worker';

export const discoveryRouter = new Hono<{ Bindings: Env }>();

// ─── In-process IP rate limiter (30 req / 60 s / IP) ─────────────────────────

const DISCOVERY_LIMIT = 30;
const DISCOVERY_WINDOW_MS = 60_000;
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 30_000;

function cleanupBuckets(): void {
    const now = Date.now();
    for (const [key, entry] of ipBuckets) {
        if (now >= entry.resetAt) ipBuckets.delete(key);
    }
    lastCleanup = now;
}

function checkDiscoveryLimit(ip: string): boolean {
    const now = Date.now();
    if (now - lastCleanup > CLEANUP_INTERVAL_MS) cleanupBuckets();
    const entry = ipBuckets.get(ip);
    if (!entry || now >= entry.resetAt) {
        ipBuckets.set(ip, { count: 1, resetAt: now + DISCOVERY_WINDOW_MS });
        return false;
    }
    entry.count += 1;
    return entry.count > DISCOVERY_LIMIT;
}

function getClientIp(c: { req: { header: (n: string) => string | undefined } }): string {
    return (
        c.req.header('cf-connecting-ip') ||
        c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
        'unknown'
    );
}

// ─── Discovery schema ─────────────────────────────────────────────────────────

const discoveryQuerySchema = z.object({
    email: z.string().email('invalid email'),
});

// ─── GET /v1/sso/discovery ────────────────────────────────────────────────────

discoveryRouter.get('/', async (c) => {
    const correlationId = crypto.randomUUID();
    const ip = getClientIp(c);

    // Rate-limit before any work
    if (checkDiscoveryLimit(ip)) {
        c.header('Retry-After', '60');
        c.header('X-RateLimit-Limit', String(DISCOVERY_LIMIT));
        c.header('X-RateLimit-Remaining', '0');
        return c.json({ error: 'rate_limit_exceeded', correlationId }, 429);
    }

    // Validate query param
    const parsed = discoveryQuerySchema.safeParse({
        email: c.req.query('email'),
    });
    if (!parsed.success) {
        return c.json(
            { error: 'validation_failed', issues: parsed.error.issues, correlationId },
            400,
        );
    }

    // Extract domain — always lowercase, never trust user casing
    const domain = parsed.data.email.split('@')[1].toLowerCase();

    // DB lookup — enabled IdPs only; no org info in result set
    const row = await c.env.DB.prepare(
        `SELECT id, type FROM identity_providers
         WHERE email_domain = ? AND enabled = 1 AND deleted_at IS NULL
         LIMIT 1`,
    ).bind(domain).first<{ id: string; type: string }>();

    // FIND-010 fix: uniform 200 response shape for hit AND miss. Returning
    // 404 with a different body shape was an enumeration oracle (response
    // size + status differs). Both paths now respond with the same key set
    // and same status; on miss the values are null.
    if (!row) {
        return c.json({
            idpId: null,
            type: null,
            initiateUrl: null,
            correlationId,
        });
    }

    const initiateUrl =
        row.type === 'oidc'
            ? '/v1/sso/oidc/initiate'
            : '/v1/sso/saml/initiate';

    return c.json({
        idpId: row.id,
        type: row.type,
        initiateUrl,
        correlationId,
    });
});
