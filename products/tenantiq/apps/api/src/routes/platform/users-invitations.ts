import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { validateBody } from '../../middleware/validation.middleware';
import { getDb, schema } from '../../lib/db';
import { eq, and, desc } from 'drizzle-orm';
import type { AppEnv } from '../../index';

const inviteUserSchema = z.object({
	organizationId: z.string(),
	email: z.string().email(),
	role: z.enum(['tenant_admin', 'tenant_operator', 'tenant_viewer']),
	expiresInDays: z.number().min(1).max(30).default(7),
});

const usersInvitations = new Hono<AppEnv>();

/**
 * POST /invite — Create an invitation for a new user
 */
usersInvitations.post('/invite', validateBody(inviteUserSchema), async (c) => {
	const db = getDb(c.env);
	const currentUser = c.get('user');
	const data = await c.req.json();

	try {
		const org = await db
			.select()
			.from(schema.organizations)
			.where(eq(schema.organizations.id, data.organizationId))
			.limit(1);

		if (org.length === 0) {
			return c.json({ error: 'Not Found', message: 'Organization not found' }, 404);
		}

		const existing = await db
			.select()
			.from(schema.platformUsers)
			.where(eq(schema.platformUsers.email, data.email))
			.limit(1);

		if (existing.length > 0) {
			return c.json({
				error: 'Conflict',
				message: 'A user with this email already exists',
			}, 409);
		}

		const now = new Date().toISOString();
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + data.expiresInDays);
		const invitationToken = nanoid(32);

		const invitation = {
			id: nanoid(),
			organizationId: data.organizationId,
			email: data.email,
			role: data.role,
			token: invitationToken,
			status: 'pending',
			invitedBy: currentUser.sub,
			invitedAt: now,
			expiresAt: expiresAt.toISOString(),
		};

		await db.insert(schema.invitations).values(invitation);

		const invitationUrl = `${c.env.FRONTEND_URL || 'https://app.tenantiq.app'}/accept-invitation?token=${invitationToken}`;

		// Don't log raw email or URL — both are restricted-tier (see DATA_CLASSIFICATION.md).
		console.log(`Invitation created id=${invitation.id} expires_at=${invitation.expiresAt}`);

		return c.json({
			invitation: {
				...invitation,
				token: undefined,
				invitationUrl,
			},
		}, 201);
	} catch (error) {
		console.error('Failed to create invitation:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
});

/**
 * GET /invitations — List pending invitations
 */
usersInvitations.get('/invitations', async (c) => {
	const db = getDb(c.env);
	const currentUser = c.get('user');

	const organizationId = c.req.query('organizationId');
	const status = c.req.query('status') || 'pending';

	try {
		let conditions = [eq(schema.invitations.status, status)];

		if (currentUser.role !== 'platform_admin' && organizationId) {
			conditions.push(eq(schema.invitations.organizationId, organizationId));
		} else if (organizationId) {
			conditions.push(eq(schema.invitations.organizationId, organizationId));
		}

		const invitations = await db
			.select()
			.from(schema.invitations)
			.where(and(...conditions))
			.orderBy(desc(schema.invitations.invitedAt));

		return c.json({
			invitations: invitations.map(inv => ({
				...inv,
				token: undefined,
			})),
		});
	} catch (error) {
		console.error('Failed to list invitations:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
});

export default usersInvitations;
