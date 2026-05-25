import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { authMiddleware } from '../../middleware/auth';
import { platformAdminMiddleware, logAdminAction } from '../../middleware/admin-auth';

/**
 * Admin Broadcast Notifications
 *
 * Allows admins to send notifications to all users or org-scoped users.
 * Stores notifications in KV for retrieval by the frontend.
 */

interface BroadcastPayload {
	targetType: 'all_users' | 'org_users';
	orgId?: string;
	title: string;
	message: string;
	type: 'info' | 'warning' | 'promotion';
}

interface StoredNotification {
	id: string;
	title: string;
	message: string;
	type: 'info' | 'warning' | 'promotion';
	sentBy: string;
	sentAt: string;
	targetType: 'all_users' | 'org_users';
	orgId?: string;
}

const adminNotifications = new Hono<AppEnv>();

adminNotifications.use('*', authMiddleware);

// /mine endpoints accessible to all authenticated users; rest require admin.
adminNotifications.use('*', async (c, next) => {
	if (c.req.path.includes('/mine')) return next();
	return platformAdminMiddleware(c, next);
});

function genId(): string {
	const bytes = new Uint8Array(12);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// POST /broadcast — send notification to users
adminNotifications.post('/broadcast', async (c) => {
	const body = await c.req.json<BroadcastPayload>();
	const { targetType, orgId, title, message, type } = body;

	if (!title || !message || !type || !targetType) {
		return c.json({ error: 'Missing required fields: title, message, type, targetType' }, 400);
	}
	if (!['info', 'warning', 'promotion'].includes(type)) {
		return c.json({ error: 'Invalid type. Must be info, warning, or promotion' }, 400);
	}
	if (targetType === 'org_users' && !orgId) {
		return c.json({ error: 'orgId required when targetType is org_users' }, 400);
	}

	const db = c.env.DB;
	const notificationId = genId();
	const sentBy = c.get('userId') ?? 'unknown';

	// Query target users
	let usersQuery: string;
	const bindings: string[] = [];
	if (targetType === 'org_users' && orgId) {
		usersQuery = 'SELECT id FROM platform_users WHERE organization_id = ? AND status = ?';
		bindings.push(orgId, 'active');
	} else {
		usersQuery = 'SELECT id FROM platform_users WHERE status = ?';
		bindings.push('active');
	}

	const stmt = bindings.length === 2
		? db.prepare(usersQuery).bind(bindings[0], bindings[1])
		: db.prepare(usersQuery).bind(bindings[0]);
	const usersResult = await stmt.all<{ id: string }>();
	const userIds = usersResult.results.map((u) => u.id);

	const notification: StoredNotification = {
		id: notificationId, title, message, type,
		sentBy, sentAt: new Date().toISOString(), targetType, orgId,
	};

	// Store notification for each user in KV
	const kvWrites = userIds.map((userId) =>
		c.env.KV.put(
			`admin-notification:${userId}:${notificationId}`,
			JSON.stringify(notification),
			{ expirationTtl: 30 * 86400 } // 30 days
		)
	);
	await Promise.all(kvWrites);

	// Store in broadcast history
	const historyKey = `admin-broadcast-history`;
	const existing = await c.env.KV.get<StoredNotification[]>(historyKey, 'json');
	const history = existing ?? [];
	history.unshift(notification);
	await c.env.KV.put(historyKey, JSON.stringify(history.slice(0, 50)));

	await logAdminAction(c, { action: 'broadcast_notification', resourceType: 'notification', resourceId: notificationId });
	return c.json({ sent: userIds.length, targetType, notificationId });
});

// GET /history — list past broadcasts
adminNotifications.get('/history', async (c) => {
	const history = await c.env.KV.get<StoredNotification[]>('admin-broadcast-history', 'json');
	return c.json({ broadcasts: (history ?? []).slice(0, 20) });
});

// GET /mine — get unread admin notifications for current user
adminNotifications.get('/mine', async (c) => {
	const userId = c.get('userId');
	if (!userId) return c.json({ notifications: [] });

	const prefix = `admin-notification:${userId}:`;
	const listed = await c.env.KV.list({ prefix });
	const notifications: StoredNotification[] = [];

	for (const key of listed.keys.slice(0, 10)) {
		const val = await c.env.KV.get<StoredNotification>(key.name, 'json');
		if (val) notifications.push(val);
	}

	notifications.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
	return c.json({ notifications });
});

// POST /mine/:id/read — mark notification as read (delete from KV)
adminNotifications.post('/mine/:id/read', async (c) => {
	const userId = c.get('userId');
	const notificationId = c.req.param('id');
	if (!userId || !notificationId) {
		return c.json({ error: 'Missing parameters' }, 400);
	}

	await c.env.KV.delete(`admin-notification:${userId}:${notificationId}`);
	return c.json({ success: true });
});

export default adminNotifications;
