/**
 * Admin Announcements — CRUD for platform-wide announcements.
 * Public endpoint for fetching active announcements.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../app/types';
import { authMiddleware } from '../../middleware/auth';
import { platformAdminMiddleware, logAdminAction } from '../../middleware/admin-auth';

const adminAnnouncements = new Hono<AppEnv>();

const announcementSchema = z.object({
	title: z.string().min(1).max(200),
	message: z.string().min(1).max(2000),
	type: z.enum(['info', 'warning', 'maintenance']),
	active: z.boolean().optional().default(true),
	expiresAt: z.string().datetime().optional(),
});

// Public endpoint — no auth required. Swallow missing-table errors so
// this widget doesn't 500 when the announcements feature is unused.
adminAnnouncements.get('/active', async (c) => {
	const now = new Date().toISOString();
	try {
		const rows = await c.env.DB.prepare(
			`SELECT id, title, message, type, expires_at FROM announcements
			 WHERE active = 1 AND (expires_at IS NULL OR expires_at > ?)
			 ORDER BY created_at DESC LIMIT 5`
		).bind(now).all();
		return c.json({ announcements: rows.results ?? [] });
	} catch (err) {
		const msg = String(err instanceof Error ? err.message : err);
		if (msg.includes('no such table')) {
			return c.json({ announcements: [] });
		}
		throw err;
	}
});

// Admin endpoints — require auth + admin role
adminAnnouncements.use('/admin/*', authMiddleware);
adminAnnouncements.use('/admin/*', platformAdminMiddleware);

// GET /admin/list — all announcements
adminAnnouncements.get('/admin/list', async (c) => {
	const rows = await c.env.DB.prepare(
		`SELECT id, title, message, type, active, expires_at, created_at, updated_at
		 FROM announcements ORDER BY created_at DESC LIMIT 50`
	).all();
	return c.json({ announcements: rows.results ?? [] });
});

// POST /admin/create — create announcement
adminAnnouncements.post('/admin/create', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const parsed = announcementSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: 'Invalid input', issues: parsed.error.issues }, 422);

	const { title, message, type, active, expiresAt } = parsed.data;
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await c.env.DB.prepare(
		`INSERT INTO announcements (id, title, message, type, active, expires_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	).bind(id, title, message, type, active ? 1 : 0, expiresAt ?? null, now, now).run();

	await logAdminAction(c, { action: 'create_announcement', resourceType: 'announcement', resourceId: id });
	return c.json({ success: true, id });
});

// PUT /admin/:id — update announcement
adminAnnouncements.put('/admin/:id', async (c) => {
	const announcementId = c.req.param('id');
	const body = await c.req.json().catch(() => ({}));
	const parsed = announcementSchema.partial().safeParse(body);
	if (!parsed.success) return c.json({ error: 'Invalid input', issues: parsed.error.issues }, 422);

	const fields: string[] = [];
	const values: unknown[] = [];
	for (const [key, val] of Object.entries(parsed.data)) {
		const col = key === 'expiresAt' ? 'expires_at' : key;
		fields.push(`${col} = ?`);
		values.push(col === 'active' ? (val ? 1 : 0) : val);
	}
	fields.push('updated_at = ?');
	values.push(new Date().toISOString());
	values.push(announcementId);

	await c.env.DB.prepare(`UPDATE announcements SET ${fields.join(', ')} WHERE id = ?`)
		.bind(...values).run();

	await logAdminAction(c, { action: 'update_announcement', resourceType: 'announcement', resourceId: announcementId });
	return c.json({ success: true });
});

// DELETE /admin/:id — delete announcement
adminAnnouncements.delete('/admin/:id', async (c) => {
	const announcementId = c.req.param('id');
	await c.env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(announcementId).run();
	await logAdminAction(c, { action: 'delete_announcement', resourceType: 'announcement', resourceId: announcementId });
	return c.json({ success: true });
});

export default adminAnnouncements;
