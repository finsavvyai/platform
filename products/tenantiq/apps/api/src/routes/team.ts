/**
 * Team Management API — manage users within your organization.
 * Accessible to tenant_admin and above (not just platform_admin).
 */

import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { URLS, TTL_MS } from '../lib/constants';
import { sendEmail, teamInviteEmail } from '../lib/email-service';

export const teamRoutes = new Hono<AppEnv>();
teamRoutes.use('*', authMiddleware);

// GET /api/team — List team members in current org
teamRoutes.get('/', async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	if (!orgId) return c.json({ members: [], invitations: [] });

	const db = c.env.DB;
	const members = await db.prepare('SELECT id, email, COALESCE(display_name, name) as display_name, role, status, created_at FROM platform_users WHERE organization_id = ? AND status != ? ORDER BY created_at ASC')
		.bind(orgId, 'deleted').all();

	// Invitations table may not exist yet — gracefully return empty array
	let invitationResults: unknown[] = [];
	try {
		const invitations = await db.prepare("SELECT id, email, role, status, invited_by, invited_at as created_at FROM invitations WHERE organization_id = ? AND status = 'pending' ORDER BY invited_at DESC")
			.bind(orgId).all();
		invitationResults = invitations.results;
	} catch { /* table not yet created */ }

	return c.json({ members: members.results, invitations: invitationResults });
});

// POST /api/team/invite — Invite a new team member (admin only)
teamRoutes.post('/invite', async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	if (!orgId) return c.json({ error: 'No organization' }, 400);
	if (!['admin', 'tenant_admin', 'super_admin', 'platform_admin'].includes(user.role)) {
		return c.json({ error: 'Admin role required to invite team members' }, 403);
	}

	const body = await c.req.json().catch(() => ({})) as { email?: string; role?: string };
	const email = body.email?.trim().toLowerCase();
	const role = body.role || 'tenant_viewer';

	if (!email || !email.includes('@')) return c.json({ error: 'Valid email required' }, 400);
	if (!['tenant_admin', 'tenant_operator', 'tenant_viewer'].includes(role)) {
		return c.json({ error: 'Invalid role' }, 400);
	}

	const db = c.env.DB;

	// Check if already a member
	const existing = await db.prepare('SELECT id FROM platform_users WHERE email = ? AND organization_id = ?')
		.bind(email, orgId).first();
	if (existing) return c.json({ error: 'User is already a team member' }, 409);

	// Check for pending invite
	const pendingInvite = await db.prepare("SELECT id FROM invitations WHERE email = ? AND organization_id = ? AND status = 'pending'")
		.bind(email, orgId).first();
	if (pendingInvite) return c.json({ error: 'Invitation already pending for this email' }, 409);

	const inviteId = crypto.randomUUID();
	const token = crypto.randomUUID();
	const now = new Date().toISOString();
	const expires = new Date(Date.now() + TTL_MS.SEVEN_DAYS).toISOString();

	await db.prepare(
		'INSERT INTO invitations (id, organization_id, email, role, token, status, invited_by, invited_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
	).bind(inviteId, orgId, email, role, token, 'pending', user.email || user.name || '', now, expires).run();

	const inviteUrl = `${URLS.FRONTEND}/invite/${token}`;

	// Send invite email via Resend
	const inviterName = user.name || user.email || 'A team member';
	const emailHtml = teamInviteEmail(inviterName, role, inviteUrl, expires);
	const emailSent = await sendEmail(c.env as any, {
		to: email,
		subject: `You've been invited to join TenantIQ`,
		html: emailHtml,
	});

	return c.json({ success: true, inviteId, inviteUrl, expiresAt: expires, emailSent });
});

// DELETE /api/team/:userId — Remove a team member (admin only)
teamRoutes.delete('/:userId', async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	const targetId = c.req.param('userId');
	if (!orgId) return c.json({ error: 'No organization' }, 400);
	if (!['admin', 'tenant_admin', 'super_admin', 'platform_admin'].includes(user.role)) {
		return c.json({ error: 'Admin role required to remove team members' }, 403);
	}
	if (targetId === user.sub) return c.json({ error: 'Cannot remove yourself' }, 400);

	await c.env.DB.prepare("UPDATE platform_users SET status = 'deleted' WHERE id = ? AND organization_id = ?")
		.bind(targetId, orgId).run();

	return c.json({ success: true });
});

// PATCH /api/team/:userId/role — Change a member's role (admin only)
teamRoutes.patch('/:userId/role', async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	const targetId = c.req.param('userId');
	if (!orgId) return c.json({ error: 'No organization' }, 400);
	if (!['admin', 'tenant_admin', 'super_admin', 'platform_admin'].includes(user.role)) {
		return c.json({ error: 'Admin role required to change roles' }, 403);
	}

	const body = await c.req.json().catch(() => ({})) as { role?: string };
	if (!body.role || !['tenant_admin', 'tenant_operator', 'tenant_viewer'].includes(body.role)) {
		return c.json({ error: 'Invalid role' }, 400);
	}

	await c.env.DB.prepare('UPDATE platform_users SET role = ? WHERE id = ? AND organization_id = ?')
		.bind(body.role, targetId, orgId).run();

	return c.json({ success: true });
});

// DELETE /api/team/invitations/:inviteId — Revoke a pending invitation (admin only)
teamRoutes.delete('/invitations/:inviteId', async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	if (!orgId) return c.json({ error: 'No organization' }, 400);
	if (!['admin', 'tenant_admin', 'super_admin', 'platform_admin'].includes(user.role)) {
		return c.json({ error: 'Admin role required to revoke invitations' }, 403);
	}

	await c.env.DB.prepare("UPDATE invitations SET status = 'revoked' WHERE id = ? AND organization_id = ?")
		.bind(c.req.param('inviteId'), orgId).run();

	return c.json({ success: true });
});
