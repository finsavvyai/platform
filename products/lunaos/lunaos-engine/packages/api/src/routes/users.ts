/**
 * User Routes — GDPR-compliant account management
 *
 * GET    /users/me          → current user profile
 * GET    /users/export       → export all user data (GDPR Art. 20)
 * POST   /users/delete       → delete account and all data (GDPR Art. 17)
 * PATCH  /users/me           → update profile
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../worker';
import { requireAuth } from '../middleware/auth';

const updateProfileSchema = z.object({
    name: z.string().max(100).optional(),
}).strict();

export const userRoutes = new Hono<{ Bindings: Env }>();

// ─── GET /users/me — current user profile ────────────────────────────────────

userRoutes.get('/me', requireAuth, async (c) => {
    const userId = c.get('userId');
    const user = await c.env.DB.prepare(
        'SELECT id, email, name, tier, created_at, updated_at FROM users WHERE id = ?',
    ).bind(userId).first();

    if (!user) return c.json({ error: 'User not found' }, 404);
    return c.json({ user });
});

// ─── PATCH /users/me — update profile ────────────────────────────────────────

userRoutes.patch('/me', requireAuth, async (c) => {
    const userId = c.get('userId');
    const raw = await c.req.json();
    const parsed = updateProfileSchema.safeParse(raw);
    if (!parsed.success) {
        return c.json({ error: 'Invalid input', issues: parsed.error.issues }, 400);
    }
    const body = parsed.data;

    if (body.name !== undefined) {
        await c.env.DB.prepare(
            'UPDATE users SET name = ?, updated_at = ? WHERE id = ?',
        ).bind(body.name, new Date().toISOString(), userId).run();
    }

    return c.json({ message: 'Profile updated' });
});

// ─── GET /users/export — GDPR data export (Art. 20) ─────────────────────────

userRoutes.get('/export', requireAuth, async (c) => {
    const userId = c.get('userId');
    const now = new Date().toISOString();

    const [user, executions, chains, apiKeys, subscriptions, github] = await Promise.all([
        c.env.DB.prepare(
            'SELECT id, email, name, tier, created_at, updated_at FROM users WHERE id = ?',
        ).bind(userId).first(),
        c.env.DB.prepare(
            'SELECT id, agent, status, created_at FROM executions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1000',
        ).bind(userId).all(),
        c.env.DB.prepare(
            'SELECT id, chain_name, status, created_at FROM chain_executions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1000',
        ).bind(userId).all(),
        c.env.DB.prepare(
            'SELECT id, name, created_at FROM api_keys WHERE user_id = ?',
        ).bind(userId).all(),
        c.env.DB.prepare(
            'SELECT id, tier, status, created_at FROM subscriptions WHERE user_id = ?',
        ).bind(userId).all(),
        c.env.DB.prepare(
            'SELECT id, github_username, connected_at FROM github_connections WHERE user_id = ?',
        ).bind(userId).all(),
    ]);

    const exportData = {
        exportedAt: now,
        format: 'GDPR Article 20 Data Export',
        user,
        executions: executions.results || [],
        chainExecutions: chains.results || [],
        apiKeys: apiKeys.results || [],
        subscriptions: subscriptions.results || [],
        githubConnections: github.results || [],
    };

    c.header('Content-Disposition', `attachment; filename="lunaos-export-${userId}.json"`);
    c.header('Content-Type', 'application/json');
    return c.json(exportData);
});

// ─── POST /users/delete — GDPR account deletion (Art. 17) ───────────────────

userRoutes.post('/delete', requireAuth, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{ confirmation?: string }>().catch((): { confirmation?: string } => ({}));

    if (body.confirmation !== 'DELETE_MY_ACCOUNT') {
        return c.json({
            error: 'Confirmation required',
            message: 'Send { "confirmation": "DELETE_MY_ACCOUNT" } to proceed',
        }, 400);
    }

    const now = new Date().toISOString();
    const tables = [
        'DELETE FROM executions WHERE user_id = ?',
        'DELETE FROM chain_executions WHERE user_id = ?',
        'DELETE FROM api_keys WHERE user_id = ?',
        'DELETE FROM subscriptions WHERE user_id = ?',
        'DELETE FROM github_connections WHERE user_id = ?',
        'DELETE FROM team_members WHERE user_id = ?',
        'DELETE FROM custom_agents WHERE user_id = ?',
        'DELETE FROM analytics_events WHERE agent LIKE ?',
    ];

    const deletionLog: string[] = [];
    for (const sql of tables) {
        try {
            const bindValue = sql.includes('LIKE') ? `%${userId}%` : userId;
            await c.env.DB.prepare(sql).bind(bindValue).run();
            deletionLog.push(`OK: ${sql.split('FROM ')[1]?.split(' ')[0]}`);
        } catch {
            deletionLog.push(`SKIP: ${sql.split('FROM ')[1]?.split(' ')[0]}`);
        }
    }

    // Finally delete the user record
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
    deletionLog.push('OK: users');

    // Invalidate any cached sessions
    try {
        await c.env.KV.delete(`session:${userId}`);
    } catch { /* non-critical */ }

    return c.json({
        message: 'Account and all associated data have been permanently deleted',
        deletedAt: now,
        tables: deletionLog,
    });
});
