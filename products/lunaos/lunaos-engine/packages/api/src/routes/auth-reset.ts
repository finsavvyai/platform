/**
 * Auth Reset routes — POST /auth/forgot-password, POST /auth/reset-password
 *
 * Generates a secure reset token stored in KV with 15-minute TTL.
 * Sends password reset email via Resend, then validates token on reset.
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { sendPasswordResetEmail } from '../services/email';
import { validateJson } from '../middleware/validation';
import { forgotPasswordSchema, resetPasswordSchema } from '../schemas/auth-reset';
import { ipRateLimit } from '../middleware/ip-rate-limiter';

export const authResetRoutes = new Hono<{ Bindings: Env }>();

const RESET_TTL_SECONDS = 900; // 15 minutes
const KV_PREFIX = 'pw-reset:';

/** Generate a cryptographically secure hex token */
function generateResetToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * POST /auth/forgot-password
 * Body: { email }
 *
 * Always returns 200 to prevent email enumeration.
 * If user exists, stores token in KV and sends reset email.
 */
authResetRoutes.post(
    '/forgot-password',
    ipRateLimit,
    validateJson(forgotPasswordSchema),
    async (c) => {
        const { email } = c.req.valid('json');

        const user = await c.env.DB.prepare(
            'SELECT id, email FROM users WHERE email = ?'
        ).bind(email).first<{ id: string; email: string }>();

        if (user && c.env.RESEND_API_KEY) {
            const token = generateResetToken();

            await c.env.KV.put(
                `${KV_PREFIX}${token}`,
                JSON.stringify({ userId: user.id, email: user.email }),
                { expirationTtl: RESET_TTL_SECONDS },
            );

            sendPasswordResetEmail(c.env.RESEND_API_KEY, {
                email: user.email,
                resetToken: token,
            }).catch(() => { /* non-critical — don't leak timing */ });
        }

        return c.json({
            message: 'If that email is registered, a reset link has been sent.',
        });
    },
);

/**
 * POST /auth/reset-password
 * Body: { token, password }
 *
 * Validates the KV token, hashes the new password, updates the user row,
 * then deletes the token to prevent reuse.
 */
authResetRoutes.post(
    '/reset-password',
    ipRateLimit,
    validateJson(resetPasswordSchema),
    async (c) => {
        const { token, password } = c.req.valid('json');

        const kvKey = `${KV_PREFIX}${token}`;
        const stored = await c.env.KV.get(kvKey);

        if (!stored) {
            return c.json({ error: 'Invalid or expired reset token' }, 400);
        }

        const { userId } = JSON.parse(stored) as { userId: string; email: string };

        // Hash new password with PBKDF2
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const saltHex = Array.from(salt)
            .map(b => b.toString(16).padStart(2, '0')).join('');

        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits'],
        );

        const hashBuffer = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            256,
        );

        const hashHex = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0')).join('');

        const passwordHash = `${saltHex}:${hashHex}`;

        await c.env.DB.prepare(
            'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'
        ).bind(passwordHash, new Date().toISOString(), userId).run();

        // Delete token to prevent reuse
        await c.env.KV.delete(kvKey);

        return c.json({ message: 'Password has been reset successfully.' });
    },
);
